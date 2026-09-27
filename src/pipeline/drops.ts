import { sql } from "drizzle-orm";
import { db } from "@/db/client";

/**
 * Weekly price drops (F14). Rules:
 *  - enter: today's sale price is below the previous day's snapshot; that
 *    previous price becomes the day-0 (baseline) price
 *  - a further drop while listed restarts the window but keeps the day-0 price
 *  - leave: as soon as the price is back at (or above) the day-0 price, once
 *    the latest drop is DROP_WINDOW_DAYS old (drop day = day 1, listed days 1–7),
 *    or when the product sells out
 */
export const DROP_WINDOW_DAYS = 7;

/**
 * "Previous day" = the latest snapshot before today, looking back this far —
 * so one missed nightly run doesn't hide or fake a drop.
 */
const PREVIOUS_LOOKBACK_DAYS = 3;

export async function detectPriceDrops(today: string) {
  await db.transaction(async (tx) => {
    // Products whose price fell versus their previous snapshot.
    await tx.execute(sql`
      CREATE TEMP TABLE dropped_today ON COMMIT DROP AS
      SELECT DISTINCT ON (s.product_id) p.id AS product_id, s.sale_price AS previous_price, p.sale_price AS current_price
      FROM products p
      JOIN price_snapshots s ON s.product_id = p.id
      WHERE p.active AND p.in_stock
        AND s.snapshot_date < ${today}::date
        AND s.snapshot_date >= ${today}::date - ${PREVIOUS_LOOKBACK_DAYS}::int
      ORDER BY s.product_id, s.snapshot_date DESC
    `);
    await tx.execute(sql`DELETE FROM dropped_today WHERE current_price >= previous_price`);

    // New drops start a 7-day window at today; further drops restart it but keep day 0.
    await tx.execute(sql`
      INSERT INTO price_drops (product_id, detected_on, baseline_price, current_price, drop_pct)
      SELECT product_id, ${today}::date, previous_price, current_price, 1 - current_price / previous_price
      FROM dropped_today
      ON CONFLICT (product_id) DO UPDATE
        SET detected_on = EXCLUDED.detected_on,
            current_price = EXCLUDED.current_price,
            drop_pct = 1 - EXCLUDED.current_price / price_drops.baseline_price
    `);

    // Everyone else still listed: refresh today's price.
    await tx.execute(sql`
      UPDATE price_drops d
      SET current_price = p.sale_price, drop_pct = 1 - p.sale_price / d.baseline_price
      FROM products p
      WHERE p.id = d.product_id AND d.product_id NOT IN (SELECT product_id FROM dropped_today)
    `);

    // Leave: back at the day-0 price, window over, or product gone.
    await tx.execute(sql`
      DELETE FROM price_drops d
      USING products p
      WHERE p.id = d.product_id
        AND (d.current_price >= d.baseline_price
             OR ${today}::date - d.detected_on >= ${DROP_WINDOW_DAYS}::int
             OR NOT p.active
             OR NOT p.in_stock)
    `);
  });
}
