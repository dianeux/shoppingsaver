import "dotenv/config";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { crawlRuns, priceSnapshots, products, type CrawlStats, type ProductColor } from "@/db/schema";
import { colorFamily } from "@/domain/colors";
import { dominantFiber, materialScore } from "@/domain/composition";
import { isBrandId, type BrandId } from "@/domain/brands";
import { L2_INDEX } from "@/domain/taxonomy";
import { normalizeSize, sortSizes } from "@/domain/sizes";
import { mujiAdapter } from "./adapters/muji";
import { pactAdapter } from "./adapters/pact";
import { quinceAdapter } from "./adapters/quince";
import { extractComposition, LlmBudget } from "./extract";
import { detectPriceDrops } from "./drops";
import { rescoreAll } from "./rescore";
import type { BrandAdapter, RawProduct, RawVariant } from "./types";

/**
 * Nightly index job (PRD ch.6): fetch → extract → normalize → score → index.
 * Usage: npm run index [-- muji pact …]   (default: every registered adapter)
 */
const ADAPTERS: Partial<Record<BrandId, BrandAdapter>> = {
  muji: mujiAdapter,
  pact: pactAdapter,
  quince: quinceAdapter,
};

/** Price history retention (PRD F13: ≥ 90 days). */
const SNAPSHOT_RETENTION_DAYS = 120;

/**
 * A brand run that lists far fewer products than are currently active is treated
 * as a partial failure: we don't deactivate the missing ones.
 */
const MIN_LISTED_RATIO_TO_DEACTIVATE = 0.6;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Variants that describe what a shopper can buy: the in-stock ones, or all of
 * them for a sold-out product (so its price history keeps recording).
 */
function purchasable(p: RawProduct): RawVariant[] {
  const inStock = p.variants.filter((v) => v.available);
  return inStock.length ? inStock : p.variants;
}

function priceOf(variants: RawVariant[]): { list: number; sale: number } {
  const cheapest = variants.reduce((a, b) => (b.price < a.price ? b : a));
  return { sale: cheapest.price, list: cheapest.compareAtPrice ?? cheapest.price };
}

function colorsOf(variants: RawVariant[], stats: CrawlStats): ProductColor[] {
  const byColor = new Map<string, ProductColor>();
  for (const v of variants) {
    if (byColor.has(v.color)) continue;
    const family = colorFamily(v.color);
    // "Default" = the product has no color option; nothing to map.
    if (!family && v.color !== "Default") stats.unmappedColors[v.color] = (stats.unmappedColors[v.color] ?? 0) + 1;
    byColor.set(v.color, { raw: v.color, family, imageUrl: v.imageUrl });
  }
  return [...byColor.values()];
}

async function runBrand(adapter: BrandAdapter, budget: LlmBudget): Promise<void> {
  const brand = adapter.brand;
  const [run] = await db
    .insert(crawlRuns)
    .values({ brand, status: "running", mappingVersion: adapter.mappingVersion })
    .returning({ id: crawlRuns.id });
  const stats: CrawlStats = {
    listed: 0, kept: 0, skippedNonWomen: 0, excluded: 0, soldOut: 0, unmappedCategories: {}, detailFetched: 0,
    extracted: { parser: 0, llm: 0, failed: 0, notDisclosed: 0, reused: 0 }, unmappedColors: {}, deactivated: 0,
  };
  const tokensBefore = { in: budget.inputTokens, out: budget.outputTokens };
  const snapshotDate = today();
  const seen: string[] = [];

  try {
    const existing = new Map(
      (
        await db
          .select({
            id: products.id, contentHash: products.contentHash, compositionStatus: products.compositionStatus,
            compositionRaw: products.compositionRaw, composition: products.composition, compositionSource: products.compositionSource,
          })
          .from(products)
          .where(eq(products.brand, brand))
      ).map((r) => [r.id, r]),
    );

    for await (const raw of adapter.list()) {
      stats.listed++;
      if (!raw.isWomen) {
        stats.skippedNonWomen++;
        continue;
      }
      if (raw.excluded) {
        stats.excluded++;
        continue;
      }
      if (!raw.l2) {
        // Unmapped source category = mapping table needs attention (PRD ch.7).
        stats.unmappedCategories[raw.sourceCategory] = (stats.unmappedCategories[raw.sourceCategory] ?? 0) + 1;
        continue;
      }
      if (raw.variants.length === 0) continue;

      const id = `${brand}:${raw.sourceId}`;
      seen.push(id);
      const prev = existing.get(id);

      // Composition: only new or changed products hit the network or the LLM.
      let compositionRaw: string | null;
      let outcome: Awaited<ReturnType<typeof extractComposition>>;
      if (prev && prev.contentHash === raw.contentHash && prev.compositionStatus !== "extraction_failed") {
        compositionRaw = prev.compositionRaw;
        outcome = { status: prev.compositionStatus, composition: prev.composition, source: prev.compositionSource ?? null };
        stats.extracted.reused++;
      } else if (prev && prev.contentHash === raw.contentHash) {
        // Previously failed and unchanged: re-run the (possibly improved) parser on stored text, no fetch, no LLM.
        compositionRaw = prev.compositionRaw;
        outcome = await extractComposition(compositionRaw, null);
      } else {
        compositionRaw = raw.compositionText;
        if (!compositionRaw) {
          compositionRaw = (await adapter.fetchDetail(raw)).compositionText;
          stats.detailFetched++;
        }
        outcome = await extractComposition(compositionRaw, budget);
        if (outcome.source) stats.extracted[outcome.source]++;
      }
      // Final-status totals (drive the F21 failure-rate alert).
      if (outcome.status === "extraction_failed") stats.extracted.failed++;
      if (outcome.status === "not_disclosed") stats.extracted.notDisclosed++;
      if (outcome.status === "extraction_failed") {
        console.warn(`[${brand}] extraction_failed ${raw.name}: ${outcome.reason ?? ""} :: ${compositionRaw?.slice(0, 120)}`);
      }

      const inStock = raw.variants.some((v) => v.available);
      if (!inStock) stats.soldOut++;
      const variants = purchasable(raw);
      const { list, sale } = priceOf(variants);
      const colors = colorsOf(variants, stats);
      const main = outcome.composition?.main ?? [];
      const row = {
        id,
        brand,
        sourceId: raw.sourceId,
        productName: raw.name,
        productUrl: raw.url,
        imageUrl: raw.imageUrl,
        categoryL1: L2_INDEX[raw.l2].l1,
        categoryL2: raw.l2,
        sourceCategory: raw.sourceCategory,
        listPrice: list,
        salePrice: sale,
        colors,
        colorFamilies: [...new Set(colors.map((c) => c.family).filter((f): f is NonNullable<typeof f> => !!f))],
        // Some listings carry no per-size data (Quince); skip empty sizes rather than store "".
        sizeRange: sortSizes(variants.map((v) => normalizeSize(v.size)).filter(Boolean)),
        compositionRaw,
        composition: outcome.composition,
        compositionStatus: outcome.status,
        compositionSource: outcome.source,
        dominantFiber: dominantFiber(main),
        materialScore: outcome.status === "extracted" ? materialScore(main) : null,
        attrs: raw.attrs,
        tags: raw.tags,
        contentHash: raw.contentHash,
        active: true,
        inStock,
        lastSeenAt: new Date(),
      };
      await db
        .insert(products)
        .values(row)
        .onConflictDoUpdate({ target: products.id, set: { ...row, firstSeenAt: sql`${products.firstSeenAt}` } });
      await db
        .insert(priceSnapshots)
        .values({ productId: id, snapshotDate, listPrice: list, salePrice: sale })
        .onConflictDoUpdate({ target: [priceSnapshots.productId, priceSnapshots.snapshotDate], set: { listPrice: list, salePrice: sale } });
      stats.kept++;
      if (stats.kept % 50 === 0) console.log(`[${brand}] ${stats.kept} products indexed…`);
    }

    const previouslyActive = [...existing.keys()].length;
    if (stats.kept >= previouslyActive * MIN_LISTED_RATIO_TO_DEACTIVATE) {
      const gone = [...existing.keys()].filter((id) => !seen.includes(id));
      for (let i = 0; i < gone.length; i += 500) {
        await db.update(products).set({ active: false }).where(inArray(products.id, gone.slice(i, i + 500)));
      }
      stats.deactivated = gone.length;
    } else {
      console.warn(`[${brand}] listed ${stats.kept} vs ${previouslyActive} known — skipping deactivation`);
    }

    await db
      .update(crawlRuns)
      .set({
        status: "success", finishedAt: new Date(), stats,
        llmInputTokens: budget.inputTokens - tokensBefore.in, llmOutputTokens: budget.outputTokens - tokensBefore.out,
      })
      .where(eq(crawlRuns.id, run.id));
    reportQuality(brand, stats);
  } catch (err) {
    console.error(`[${brand}] run failed`, err);
    await db
      .update(crawlRuns)
      .set({ status: "failed", finishedAt: new Date(), error: String(err), stats })
      .where(eq(crawlRuns.id, run.id));
  }
}

/** PRD F21: per-site extraction failure rate, alert above 5%. */
export const EXTRACTION_FAILURE_ALERT = 0.05;

function reportQuality(brand: string, s: CrawlStats) {
  const total = s.kept || 1;
  const failRate = s.extracted.failed / total;
  const unmapped = Object.values(s.unmappedCategories).reduce((a, b) => a + b, 0);
  const unmappedColors = Object.values(s.unmappedColors).reduce((a, b) => a + b, 0);
  console.log(
    `[${brand}] kept=${s.kept} listed=${s.listed} details=${s.detailFetched} ` +
      `parser=${s.extracted.parser} llm=${s.extracted.llm} reused=${s.extracted.reused} ` +
      `failed=${s.extracted.failed} (${(failRate * 100).toFixed(1)}%) not_disclosed=${s.extracted.notDisclosed} sold_out=${s.soldOut} ` +
      `unmapped_products=${unmapped} unmapped_colors=${unmappedColors} deactivated=${s.deactivated}`,
  );
  if (failRate > EXTRACTION_FAILURE_ALERT) console.error(`::error::[${brand}] extraction failure rate ${(failRate * 100).toFixed(1)}% > 5%`);
  if (unmapped > 0) console.error(`::warning::[${brand}] ${unmapped} products in unmapped source categories: ${JSON.stringify(s.unmappedCategories)}`);
}

async function main() {
  const requested = process.argv.slice(2).filter(isBrandId);
  const adapters = (requested.length ? requested : (Object.keys(ADAPTERS) as BrandId[]))
    .map((b) => ADAPTERS[b])
    .filter((a): a is BrandAdapter => !!a);
  const budget = new LlmBudget(Number(process.env.LLM_BUDGET_USD ?? 2));
  const started = Date.now();

  for (const adapter of adapters) await runBrand(adapter, budget); // sequential by design

  await rescoreAll();
  await detectPriceDrops(today());
  const cutoff = new Date(Date.now() - SNAPSHOT_RETENTION_DAYS * 864e5).toISOString().slice(0, 10);
  await db.delete(priceSnapshots).where(lt(priceSnapshots.snapshotDate, cutoff));

  console.log(
    `done in ${((Date.now() - started) / 60000).toFixed(1)} min; LLM ${budget.inputTokens}+${budget.outputTokens} tokens ≈ $${budget.spentUsd.toFixed(3)}`,
  );
  const failed = await db.select({ brand: crawlRuns.brand }).from(crawlRuns).where(and(eq(crawlRuns.status, "failed"), sql`${crawlRuns.startedAt} > to_timestamp(${started / 1000})`));
  await pool.end();
  if (failed.length) process.exitCode = 1;
}

await main();
