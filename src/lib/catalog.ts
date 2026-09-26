import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { crawlRuns, priceDrops, products } from "@/db/schema";
import { BRANDS, type BrandId } from "@/domain/brands";
import { formatComposition } from "@/domain/composition";
import { MIN_BRANDS_PER_L2, TAXONOMY, type L2 } from "@/domain/taxonomy";
import type { CardProduct } from "./types";

/** PRD ch.5 coverage threshold; overridable locally while only a few brands are wired up. */
export const minBrandsPerL2 = Number(process.env.MIN_BRANDS_PER_L2 ?? MIN_BRANDS_PER_L2);

/** A site whose last good run is older than this is shown as degraded (PRD F7). */
const STALE_AFTER_HOURS = 36;

const cardColumns = {
  id: products.id,
  brand: products.brand,
  name: products.productName,
  url: products.productUrl,
  imageUrl: products.imageUrl,
  l2: products.categoryL2,
  listPrice: products.listPrice,
  salePrice: products.salePrice,
  colors: products.colors,
  colorFamilies: products.colorFamilies,
  sizes: products.sizeRange,
  composition: products.composition,
  compositionStatus: products.compositionStatus,
  dominantFiber: products.dominantFiber,
  materialScore: products.materialScore,
  pricePercentile: products.pricePercentile,
  dropPct: priceDrops.dropPct,
  median30d: priceDrops.median30d,
  dropDetectedOn: priceDrops.detectedOn,
};

type Row = { [K in keyof typeof cardColumns]: unknown } & Record<string, unknown>;

function toCard(r: Row): CardProduct {
  const comp = r.composition as { main: Parameters<typeof formatComposition>[0] } | null;
  return {
    id: r.id as string,
    brand: r.brand as BrandId,
    name: r.name as string,
    url: r.url as string,
    imageUrl: (r.imageUrl as string | null) ?? null,
    l2: r.l2 as L2,
    listPrice: r.listPrice as number,
    salePrice: r.salePrice as number,
    colors: (r.colors as CardProduct["colors"]).map((c) => ({ raw: c.raw, family: c.family })),
    colorFamilies: r.colorFamilies as CardProduct["colorFamilies"],
    sizes: r.sizes as string[],
    compositionText: comp ? formatComposition(comp.main) : null,
    compositionStatus: r.compositionStatus as CardProduct["compositionStatus"],
    dominantFiber: (r.dominantFiber as string | null) ?? null,
    materialScore: (r.materialScore as number | null) ?? null,
    pricePercentile: (r.pricePercentile as number | null) ?? 0.5,
    drop: r.dropPct != null ? { pct: r.dropPct as number, median30d: r.median30d as number, detectedOn: r.dropDetectedOn as string } : null,
  };
}

export async function productsForL2(l2: L2): Promise<CardProduct[]> {
  const rows = await db
    .select(cardColumns)
    .from(products)
    .leftJoin(priceDrops, eq(priceDrops.productId, products.id))
    .where(and(eq(products.categoryL2, l2), eq(products.active, true)));
  return rows.map(toCard);
}

export async function productsForBrand(brand: BrandId): Promise<CardProduct[]> {
  const rows = await db
    .select(cardColumns)
    .from(products)
    .leftJoin(priceDrops, eq(priceDrops.productId, products.id))
    .where(and(eq(products.brand, brand), eq(products.active, true)));
  return rows.map(toCard);
}

export async function weeklyDrops(today = new Date()): Promise<CardProduct[]> {
  const since = new Date(today.getTime() - 7 * 864e5).toISOString().slice(0, 10);
  const rows = await db
    .select(cardColumns)
    .from(priceDrops)
    .innerJoin(products, eq(priceDrops.productId, products.id))
    .where(and(eq(products.active, true), gte(priceDrops.detectedOn, since)))
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
export async function coverage(): Promise<L2Coverage[]> {
  const rows = await db
    .select({ l2: products.categoryL2, brand: products.brand, n: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.active, true))
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
