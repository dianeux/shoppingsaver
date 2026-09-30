import "dotenv/config";
import { desc, eq, sql } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { crawlRuns, products } from "@/db/schema";
import { ACTIVE_BRAND_IDS as BRAND_IDS, BRANDS } from "@/domain/brands";
import { GENDER_LABEL, GENDERS } from "@/domain/gender";
import { MIN_BRANDS_PER_L2, TAXONOMY } from "@/domain/taxonomy";

/**
 * `npm run report` — the catalog-overlap table (PRD ch.14) with SKU counts per
 * brand, plus the latest per-site quality numbers (PRD ch.4). Markdown on stdout.
 */
const counts = await db
  .select({ gender: products.gender, l2: products.categoryL2, brand: products.brand, n: sql<number>`count(*)::int` })
  .from(products)
  .where(eq(products.active, true))
  .groupBy(products.gender, products.categoryL2, products.brand);
const cell = new Map(counts.map((c) => [`${c.gender}|${c.l2}|${c.brand}`, c.n]));

for (const gender of GENDERS) {
  console.log(`## 目錄重疊表・${GENDER_LABEL[gender]}（覆蓋數 ≥ ${MIN_BRANDS_PER_L2} 才上線）\n`);
  console.log(`| L1 | L2 | ${BRAND_IDS.map((b) => BRANDS[b].name).join(" | ")} | 覆蓋數 | 上線 |`);
  console.log(`|${"---|".repeat(BRAND_IDS.length + 4)}`);
  for (const g of TAXONOMY) {
    for (const c of g.children) {
      const row = BRAND_IDS.map((b) => cell.get(`${gender}|${c.l2}|${b}`) ?? 0);
      const cover = row.filter((n) => n > 0).length;
      if (cover === 0 && gender === "men") continue;
      console.log(`| ${g.name} | ${c.name} | ${row.map((n) => (n ? String(n) : "")).join(" | ")} | ${cover} | ${cover >= MIN_BRANDS_PER_L2 ? "✓" : ""} |`);
    }
  }
  console.log("");
}

console.log(`\n## 抽取品質（各站最近一次成功執行）\n`);
console.log(`| 品牌 | 商品數 | 成分抽取成功率 | extraction_failed | not_disclosed | LLM 補救 | 未對應分類 | 未對應色名 | 時間 |`);
console.log(`|---|---|---|---|---|---|---|---|---|`);
for (const b of BRAND_IDS) {
  const [run] = await db
    .select()
    .from(crawlRuns)
    .where(sql`${crawlRuns.brand} = ${b} AND ${crawlRuns.status} = 'success'`)
    .orderBy(desc(crawlRuns.startedAt))
    .limit(1);
  if (!run?.stats) continue;
  const s = run.stats;
  const disclosed = s.kept - s.extracted.notDisclosed;
  const rate = disclosed ? ((disclosed - s.extracted.failed) / disclosed) * 100 : 100;
  const unmappedCats = Object.values(s.unmappedCategories).reduce((a, n) => a + n, 0);
  const unmappedColors = Object.keys(s.unmappedColors);
  const mins = run.finishedAt ? ((run.finishedAt.getTime() - run.startedAt.getTime()) / 60000).toFixed(1) : "?";
  console.log(
    `| ${BRANDS[b].name} | ${s.kept} | ${rate.toFixed(1)}%${rate < 95 ? " ⚠" : ""} | ${s.extracted.failed} | ${s.extracted.notDisclosed} | ${s.extracted.llm} | ${unmappedCats} | ${unmappedColors.length} | ${mins} 分 |`,
  );
  if (unmappedColors.length) console.log(`\n未對應色名（${BRANDS[b].name}）：${unmappedColors.slice(0, 40).join("、")}\n`);
  if (unmappedCats) console.log(`\n未對應分類（${BRANDS[b].name}）：\n${Object.entries(s.unmappedCategories).map(([k, n]) => `- ${n} × ${k}`).join("\n")}\n`);
}

const failed = await db.execute<{ brand: string; product_name: string; composition_raw: string | null }>(
  sql`SELECT brand, product_name, composition_raw FROM products WHERE active AND composition_status = 'extraction_failed' ORDER BY brand LIMIT 30`,
);
if (failed.rows.length) {
  console.log(`\n## 抽取失敗樣本（前 30）\n`);
  for (const r of failed.rows) console.log(`- [${r.brand}] ${r.product_name} :: ${r.composition_raw ?? "(no text)"}`);
}
await pool.end();
