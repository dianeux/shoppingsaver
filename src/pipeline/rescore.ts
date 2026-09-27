import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { DEFAULT_MATERIAL_WEIGHT } from "@/domain/scoring";

/**
 * Recompute price percentiles within each L2 across all brands (in-stock
 * products only — sold-out items aren't on the page to compare against), then the
 * default-weight value score. Runs after every brand has loaded, because a new
 * brand shifts every other product's percentile.
 *
 * Same mid-rank definition as domain/scoring.ts `percentiles`:
 *   (count below + ½ count equal) / n
 */
export async function rescoreAll() {
  const w = DEFAULT_MATERIAL_WEIGHT;
  await db.execute(sql`
    WITH ranked AS (
      SELECT id,
        ( (rank() OVER (PARTITION BY category_l2 ORDER BY sale_price) - 1)
          + 0.5 * count(*) OVER (PARTITION BY category_l2, sale_price)
        )::real / count(*) OVER (PARTITION BY category_l2) AS pct
      FROM products
      WHERE active AND in_stock
    )
    UPDATE products p
    SET price_percentile = r.pct,
        value_score = round(100 * (${w}::real * coalesce(p.material_score, 0) + (1 - ${w}::real) * (1 - r.pct)))
    FROM ranked r
    WHERE p.id = r.id
  `);
  await db.execute(sql`UPDATE products SET price_percentile = NULL, value_score = NULL WHERE NOT active OR NOT in_stock`);
}
