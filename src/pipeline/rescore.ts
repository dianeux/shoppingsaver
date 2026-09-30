import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { DEFAULT_MATERIAL_WEIGHT } from "@/domain/scoring";

/**
 * Recompute price percentiles within each L2 of each section (women's / men's)
 * across all brands (in-stock products only — sold-out items aren't on the page to
 * compare against), then the default-weight value score. Runs after every brand has loaded, because a new
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
        ( (rank() OVER (PARTITION BY gender, category_l2 ORDER BY sale_price) - 1)
          + 0.5 * count(*) OVER (PARTITION BY gender, category_l2, sale_price)
        )::real / count(*) OVER (PARTITION BY gender, category_l2) AS pct
      FROM products
      WHERE active AND in_stock AND source = 'crawl'
    )
    UPDATE products p
    SET price_percentile = r.pct,
        value_score = round(100 * (${w}::real * coalesce(p.material_score, 0) + (1 - ${w}::real) * (1 - r.pct)))
    FROM ranked r
    WHERE p.id = r.id
  `);
  await db.execute(sql`UPDATE products SET price_percentile = NULL, value_score = NULL WHERE NOT active OR NOT in_stock`);
  await rescoreSubmissions();
}

/**
 * User-submitted products get the percentile their price would have among the
 * crawled products of the same section and sub-category, without joining that
 * distribution themselves (so a bad submission can't move anyone else's score).
 */
export async function rescoreSubmissions(ids?: string[]) {
  const w = DEFAULT_MATERIAL_WEIGHT;
  const only = ids?.length ? sql`AND u.id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})` : sql``;
  await db.execute(sql`
    UPDATE products u
    SET price_percentile = r.pct,
        value_score = round(100 * (${w}::real * coalesce(u.material_score, 0) + (1 - ${w}::real) * (1 - r.pct)))
    FROM (
      SELECT u.id, coalesce((
        SELECT (count(*) FILTER (WHERE c.sale_price < u.sale_price) + 0.5 * count(*) FILTER (WHERE c.sale_price = u.sale_price))::real
               / nullif(count(*), 0)
        FROM products c
        WHERE c.source = 'crawl' AND c.active AND c.in_stock AND c.gender = u.gender AND c.category_l2 = u.category_l2
      ), 0.5) AS pct
      FROM products u
      WHERE u.source = 'user' ${only}
    ) r
    WHERE u.id = r.id
  `);
}
