import { sql } from "drizzle-orm";
import { db } from "@/db/client";

/**
 * Price-drop detection (PRD F14). A product counts as dropped when today's sale
 * price is at least DROP_MIN below the median of the previous 30 days.
 * Comparing to a 30-day median rather than yesterday keeps permanently
 * discounted items out: their median *is* the sale price.
 */
export const DROP_MIN = 0.1;
/** Need this many prior daily snapshots before a median means anything. */
export const MIN_HISTORY_DAYS = 7;

export async function detectPriceDrops(today: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      CREATE TEMP TABLE drop_candidates ON COMMIT DROP AS
      WITH hist AS (
        SELECT s.product_id,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY s.sale_price) AS median,
               count(*) AS days
        FROM price_snapshots s
        WHERE s.snapshot_date >= ${today}::date - 30 AND s.snapshot_date < ${today}::date
        GROUP BY s.product_id
      )
      SELECT p.id AS product_id, h.median, p.sale_price AS current_price,
             1 - p.sale_price / h.median AS drop_pct
      FROM products p
      JOIN hist h ON h.product_id = p.id
      WHERE p.active AND h.days >= ${MIN_HISTORY_DAYS}::int AND p.sale_price <= h.median * (1 - ${DROP_MIN}::numeric)
    `);
    await tx.execute(sql`DELETE FROM price_drops WHERE product_id NOT IN (SELECT product_id FROM drop_candidates)`);
    // Keep the original detection date while the drop persists; that's what "this week" filters on.
    await tx.execute(sql`
      INSERT INTO price_drops (product_id, detected_on, median_30d, current_price, drop_pct)
      SELECT product_id, ${today}::date, median, current_price, drop_pct FROM drop_candidates
      ON CONFLICT (product_id) DO UPDATE
        SET median_30d = EXCLUDED.median_30d, current_price = EXCLUDED.current_price, drop_pct = EXCLUDED.drop_pct
    `);
  });
}
