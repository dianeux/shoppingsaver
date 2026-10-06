import "server-only";
import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { crawlRuns, priceDrops, products } from "@/db/schema";
import { BRANDS, type BrandId } from "@/domain/brands";
import { REPORTS_TO_HIDE, SUBMISSION_TTL_DAYS } from "@/domain/clip";
import type { Composition } from "@/domain/composition";
import type { Gender } from "@/domain/gender";
import { scoreProduct, type ParsedQuery } from "@/domain/search";
import { DROP_WINDOW_DAYS } from "@/pipeline/drops";
import { MIN_BRANDS_PER_L2, TAXONOMY, type L2 } from "@/domain/taxonomy";
import type { CardProduct } from "./types";

/** PRD ch.5 coverage threshold; overridable locally while only a few brands are wired up. */
export const minBrandsPerL2 = Number(process.env.MIN_BRANDS_PER_L2 ?? MIN_BRANDS_PER_L2);

/** A site whose last good run is older than this is shown as degraded (PRD F7). */
const STALE_AFTER_HOURS = 36;

/** Storefront queries only ever show listed, in-stock products. */
const cardColumns = {
  id: products.id,
  brand: products.brand,
  gender: products.gender,
  name: products.productName,
  url: products.productUrl,
  imageUrl: products.imageUrl,
  l2: products.categoryL2,
  listPrice: products.listPrice,
  salePrice: products.salePrice,
  maxPrice: products.maxPrice,
  priceColor: products.priceColor,
  colors: products.colors,
  colorFamilies: products.colorFamilies,
  sizes: products.sizeRange,
  composition: products.composition,
  compositionStatus: products.compositionStatus,
  dominantFiber: products.dominantFiber,
  materialScore: products.materialScore,
  pricePercentile: products.pricePercentile,
  dropPct: priceDrops.dropPct,
  dropBaseline: priceDrops.baselinePrice,
  dropDetectedOn: priceDrops.detectedOn,
  source: products.source,
  lastSeenAt: products.lastSeenAt,
};

type Row = { [K in keyof typeof cardColumns]: unknown } & Record<string, unknown>;

function toCard(r: Row): CardProduct {
  const comp = r.composition as Composition | null;
  return {
    id: r.id as string,
    brand: r.brand as BrandId,
    gender: r.gender as Gender,
    name: r.name as string,
    url: r.url as string,
    imageUrl: (r.imageUrl as string | null) ?? null,
    l2: r.l2 as L2,
    listPrice: r.listPrice as number,
    salePrice: r.salePrice as number,
    maxPrice: (r.maxPrice as number | null) ?? (r.salePrice as number),
    priceColor: (r.priceColor as string | null) ?? null,
    colors: (r.colors as CardProduct["colors"]).map((c) => ({ raw: c.raw, family: c.family })),
    colorFamilies: r.colorFamilies as CardProduct["colorFamilies"],
    sizes: r.sizes as string[],
    fibers: (comp?.main ?? []).map((f) => ({ fiber: f.fiber, percentage: f.percentage, recycled: f.recycled, organic: f.organic })),
    compositionStatus: r.compositionStatus as CardProduct["compositionStatus"],
    dominantFiber: (r.dominantFiber as string | null) ?? null,
    materialScore: (r.materialScore as number | null) ?? null,
    pricePercentile: (r.pricePercentile as number | null) ?? 0.5,
    drop: r.dropPct != null ? { pct: r.dropPct as number, baselinePrice: r.dropBaseline as number, detectedOn: r.dropDetectedOn as string } : null,
    submitted: r.source === "user" ? { confirmedOn: (r.lastSeenAt as Date).toISOString().slice(0, 10) } : null,
  };
}

/** User-submitted rows count while fresh and not reported gone; crawled rows always do. */
const visible = sql`(${products.source} = 'crawl' OR (${products.lastSeenAt} > now() - make_interval(days => ${SUBMISSION_TTL_DAYS}) AND ${products.reports} < ${REPORTS_TO_HIDE}))`;

/** Listed, in-stock products of one catalog section. */
const listed = (gender: Gender) => [eq(products.gender, gender), eq(products.active, true), eq(products.inStock, true), visible];

export async function productsForL2(l2: L2, gender: Gender): Promise<CardProduct[]> {
  const rows = await db
    .select(cardColumns)
    .from(products)
    .leftJoin(priceDrops, eq(priceDrops.productId, products.id))
    .where(and(eq(products.categoryL2, l2), ...listed(gender)));
  return rows.map(toCard);
}

/** Every product in an L1 group, limited to L2 pages that pass the coverage threshold. */
export async function productsForL1(l1: string, liveL2s: L2[], gender: Gender): Promise<CardProduct[]> {
  if (liveL2s.length === 0) return [];
  const rows = await db
    .select(cardColumns)
    .from(products)
    .leftJoin(priceDrops, eq(priceDrops.productId, products.id))
    .where(and(eq(products.categoryL1, l1), ...listed(gender), inArray(products.categoryL2, liveL2s)));
  return rows.map(toCard);
}

const SEARCH_LIMIT = 240;

/**
 * Lexicon search over listed, in-stock products. Category, brand and price are
 * narrowed in SQL; the rest (colors, fiber shares, style phrases) is scored per product.
 * `within` further limits the search to some sub-categories (in-page search).
 */
async function scoredMatches(q: ParsedQuery, gender: Gender, within?: L2[]): Promise<CardProduct[]> {
  const where: SQL[] = listed(gender);
  const l2s = [...new Set(q.categories.flatMap((c) => c.l2))];
  if (l2s.length) where.push(inArray(products.categoryL2, l2s));
  if (within) where.push(inArray(products.categoryL2, within));
  if (q.brands.length) where.push(inArray(products.brand, q.brands.map((b) => b.brand)));
  if (q.priceMax) where.push(lte(products.salePrice, q.priceMax.value));

  const rows = await db
    .select({ ...cardColumns, description: products.description })
    .from(products)
    .leftJoin(priceDrops, eq(priceDrops.productId, products.id))
    .where(and(...where));

  const scored: CardProduct[] = [];
  for (const r of rows) {
    const main = (r.composition as Composition | null)?.main ?? [];
    const relevance = scoreProduct(
      {
        brand: r.brand as BrandId, l2: r.l2 as L2, name: r.name, description: r.description,
        colorFamilies: r.colorFamilies as CardProduct["colorFamilies"], salePrice: r.salePrice, fibers: main,
      },
      q,
    );
    if (relevance !== null) scored.push({ ...toCard(r), relevance });
  }
  return scored.sort((a, b) => b.relevance! - a.relevance!);
}

export async function searchProducts(q: ParsedQuery, gender: Gender): Promise<{ items: CardProduct[]; total: number }> {
  const scored = await scoredMatches(q, gender);
  return { items: scored.slice(0, SEARCH_LIMIT), total: scored.length };
}

/** In-page search: id → relevance for every match within the given sub-categories. */
export async function searchWithin(q: ParsedQuery, within: L2[], gender: Gender): Promise<Record<string, number>> {
  if (within.length === 0) return {};
  return Object.fromEntries((await scoredMatches(q, gender, within)).map((p) => [p.id, p.relevance!]));
}

export type Availability = "available" | "sold_out" | "gone";
export type FavoriteProduct = CardProduct & { availability: Availability };

/**
 * Favorites by id, whatever their state: sold-out and delisted items come back
 * too so the favorites page can say so instead of silently dropping them.
 */
export async function productsByIds(ids: string[]): Promise<FavoriteProduct[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ ...cardColumns, active: products.active, inStock: products.inStock, visible: sql<boolean>`${visible}` })
    .from(products)
    .leftJoin(priceDrops, eq(priceDrops.productId, products.id))
    .where(inArray(products.id, ids));
  return rows.map((r) => ({ ...toCard(r), availability: !r.active || !r.visible ? "gone" : !r.inStock ? "sold_out" : "available" }));
}

export async function productsForBrand(brand: BrandId, gender: Gender): Promise<CardProduct[]> {
  const rows = await db
    .select(cardColumns)
    .from(products)
    .leftJoin(priceDrops, eq(priceDrops.productId, products.id))
    .where(and(eq(products.brand, brand), ...listed(gender)));
  return rows.map(toCard);
}

export async function weeklyDrops(gender: Gender, today = new Date()): Promise<CardProduct[]> {
  // Drop day counts as day 1, so the window starts DROP_WINDOW_DAYS − 1 days back.
  const since = new Date(today.getTime() - (DROP_WINDOW_DAYS - 1) * 864e5).toISOString().slice(0, 10);
  const rows = await db
    .select(cardColumns)
    .from(priceDrops)
    .innerJoin(products, eq(priceDrops.productId, products.id))
    .where(and(...listed(gender), gte(priceDrops.detectedOn, since)))
    .orderBy(desc(priceDrops.dropPct));
  return rows.map(toCard);
}

export interface L2Coverage {
  l2: L2;
  products: number;
  brands: BrandId[];
  skuByBrand: Partial<Record<BrandId, number>>;
}

/** Per-L2 brand coverage — drives which browse pages go live (PRD ch.5 / ch.14). */
export async function coverage(gender: Gender): Promise<L2Coverage[]> {
  const rows = await db
    .select({ l2: products.categoryL2, brand: products.brand, n: sql<number>`count(*)::int` })
    .from(products)
    .where(and(...listed(gender)))
    .groupBy(products.categoryL2, products.brand);
  const byL2 = new Map<string, L2Coverage>();
  for (const r of rows) {
    const c = byL2.get(r.l2) ?? { l2: r.l2 as L2, products: 0, brands: [], skuByBrand: {} };
    c.products += r.n;
    c.brands.push(r.brand as BrandId);
    c.skuByBrand[r.brand as BrandId] = r.n;
    byL2.set(r.l2, c);
  }
  return TAXONOMY.flatMap((g) => g.children.map((c) => byL2.get(c.l2) ?? { l2: c.l2, products: 0, brands: [], skuByBrand: {} }));
}

export interface CategoryCover {
  l1: string;
  l2: L2;
  brand: BrandId;
  name: string;
  imageUrl: string;
  valueScore: number;
  salePrice: number;
}

/**
 * Home-page cover image per L1: the highest default-weight value score among
 * live L2 pages (ties → cheaper). Only products with an image qualify.
 */
export async function topValueByL1(liveL2s: L2[], gender: Gender): Promise<Map<string, CategoryCover>> {
  if (liveL2s.length === 0) return new Map();
  const rows = await db.execute<{
    category_l1: string; category_l2: string; brand: string; product_name: string;
    image_url: string; value_score: number; sale_price: string;
  }>(sql`
    SELECT DISTINCT ON (category_l1) category_l1, category_l2, brand, product_name, image_url, value_score, sale_price
    FROM ${products}
    WHERE gender = ${gender} AND source = 'crawl' AND active AND in_stock AND image_url IS NOT NULL AND value_score IS NOT NULL
      AND category_l2 IN (${sql.join(liveL2s.map((l) => sql`${l}`), sql`, `)})
    ORDER BY category_l1, value_score DESC, sale_price ASC
  `);
  return new Map(
    rows.rows.map((r) => [
      r.category_l1,
      {
        l1: r.category_l1, l2: r.category_l2 as L2, brand: r.brand as BrandId, name: r.product_name,
        imageUrl: r.image_url, valueScore: r.value_score, salePrice: Number(r.sale_price),
      },
    ]),
  );
}

export interface SiteStatus {
  brand: BrandId;
  lastSuccessAt: Date | null;
  lastRunFailed: boolean;
  degraded: boolean;
}

/**
 * Freshness (F20) and degradation (F7). A brand is "expected" once it has ever
 * had a successful run; after that it can't silently disappear from a page.
 */
export async function siteStatus(): Promise<{ sites: SiteStatus[]; dataAsOf: Date | null }> {
  const rows = await db.execute<{ brand: string; last_success: string | null; last_status: string }>(sql`
    SELECT brand,
      max(finished_at) FILTER (WHERE status = 'success') AS last_success,
      (array_agg(status ORDER BY started_at DESC))[1] AS last_status
    FROM ${crawlRuns}
    GROUP BY brand
  `);
  const now = Date.now();
  const sites: SiteStatus[] = rows.rows
    .filter((r) => r.last_success)
    .map((r) => {
      const last = r.last_success ? new Date(r.last_success) : null;
      const stale = !last || now - last.getTime() > STALE_AFTER_HOURS * 3600e3;
      const lastRunFailed = r.last_status === "failed";
      return { brand: r.brand as BrandId, lastSuccessAt: last, lastRunFailed, degraded: stale || lastRunFailed };
    });
  const times = sites.map((s) => s.lastSuccessAt!.getTime());
  return { sites, dataAsOf: times.length ? new Date(Math.min(...times)) : null };
}

export function brandName(b: BrandId) {
  return BRANDS[b].name;
}
