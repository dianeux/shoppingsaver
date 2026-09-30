import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { priceSnapshots, products, submissionEvents } from "@/db/schema";
import type { validateSubmission } from "@/domain/clip";
import { colorFamily } from "@/domain/colors";
import { dominantFiber, materialScore, parseComposition } from "@/domain/composition";
import { productId, type Gender } from "@/domain/gender";
import { DEFAULT_MATERIAL_WEIGHT } from "@/domain/scoring";
import { L2_INDEX, type L2 } from "@/domain/taxonomy";
import { rescoreSubmissions } from "@/pipeline/rescore";

type ValidSubmission = Extract<ReturnType<typeof validateSubmission>, { ok: true }>["value"];

/** Per visitor (salted IP hash): submissions per hour, reports per hour. */
export const SUBMIT_LIMIT_PER_HOUR = 20;
export const REPORT_LIMIT_PER_HOUR = 30;

/** The visitor's IP as a salted hash; the raw address is never stored. */
export function visitorHash(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${process.env.SUBMISSION_SALT ?? "shoppingsaver"}:${ip}`).digest("hex").slice(0, 32);
}

async function recentEvents(ipHash: string, kind: "submit" | "report", productIdFilter?: string): Promise<number> {
  const since = new Date(Date.now() - 3600_000);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(submissionEvents)
    .where(and(
      eq(submissionEvents.ipHash, ipHash), eq(submissionEvents.kind, kind), gt(submissionEvents.createdAt, since),
      ...(productIdFilter ? [eq(submissionEvents.productId, productIdFilter)] : []),
    ));
  return row.n;
}

/** Where a price would land among crawled products of the same section and sub-category. */
export async function estimate(gender: Gender, l2: L2, price: number, material: number | null) {
  const [row] = await db
    .select({
      below: sql<number>`count(*) FILTER (WHERE ${products.salePrice} < ${price})::int`,
      equal: sql<number>`count(*) FILTER (WHERE ${products.salePrice} = ${price})::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(products)
    .where(and(eq(products.source, "crawl"), eq(products.active, true), eq(products.inStock, true), eq(products.gender, gender), eq(products.categoryL2, l2)));
  const pct = row.n ? (row.below + 0.5 * row.equal) / row.n : 0.5;
  const w = DEFAULT_MATERIAL_WEIGHT;
  return {
    compared: row.n,
    cheaperThan: row.n ? Math.round((1 - pct) * 100) : null,
    valueScore: Math.round(100 * (w * (material ?? 0) + (1 - w) * (1 - pct))),
  };
}

export type SubmitResult = { ok: true; id: string; created: boolean } | { ok: false; reason: "rate_limited" | "conflict" };

/**
 * Insert or refresh a user-submitted product. A resubmission counts as a fresh
 * confirmation: price and date update, pending "gone" reports are cleared.
 */
export async function saveSubmission(v: ValidSubmission, ipHash: string): Promise<SubmitResult> {
  if ((await recentEvents(ipHash, "submit")) >= SUBMIT_LIMIT_PER_HOUR) return { ok: false, reason: "rate_limited" };
  const id = productId(v.brand, v.sourceId, v.gender);
  const [existing] = await db.select({ source: products.source }).from(products).where(eq(products.id, id));
  if (existing && existing.source !== "user") return { ok: false, reason: "conflict" };

  const parsed = parseComposition(v.compositionText);
  const main = parsed.ok ? parsed.composition.main : [];
  const colors = (v.colors.length ? v.colors : [v.priceColor ?? "Default"]).map((raw) => ({ raw, family: colorFamily(raw), imageUrl: null }));
  const now = new Date();
  const row = {
    id,
    brand: v.brand,
    sourceId: v.sourceId,
    gender: v.gender,
    source: "user" as const,
    reports: 0,
    productName: v.name,
    productUrl: v.url,
    imageUrl: v.imageUrl,
    categoryL1: L2_INDEX[v.l2].l1,
    categoryL2: v.l2,
    sourceCategory: "user submission",
    listPrice: v.listPrice ?? v.price,
    salePrice: v.price,
    maxPrice: v.price,
    priceColor: v.priceColor,
    colors,
    colorFamilies: [...new Set(colors.map((c) => c.family).filter((f): f is NonNullable<typeof f> => !!f))],
    sizeRange: [],
    description: "",
    compositionRaw: v.compositionText,
    composition: parsed.ok ? parsed.composition : null,
    compositionStatus: "extracted" as const,
    compositionSource: "parser" as const,
    dominantFiber: dominantFiber(main),
    materialScore: materialScore(main),
    attrs: {},
    tags: ["user"],
    contentHash: "user",
    active: true,
    inStock: true,
    lastSeenAt: now,
  };
  await db.transaction(async (tx) => {
    await tx.insert(products).values(row).onConflictDoUpdate({ target: products.id, set: { ...row, firstSeenAt: sql`${products.firstSeenAt}` } });
    const day = now.toISOString().slice(0, 10);
    await tx
      .insert(priceSnapshots)
      .values({ productId: id, snapshotDate: day, listPrice: row.listPrice, salePrice: row.salePrice })
      .onConflictDoUpdate({ target: [priceSnapshots.productId, priceSnapshots.snapshotDate], set: { listPrice: row.listPrice, salePrice: row.salePrice } });
    await tx.insert(submissionEvents).values({ kind: "submit", ipHash, productId: id });
  });
  await rescoreSubmissions([id]);
  return { ok: true, id, created: !existing };
}

export type ReportResult = "counted" | "already_reported" | "rate_limited" | "not_found";

/** "No longer sold" report on a user-submitted product; one per visitor per product. */
export async function reportGone(id: string, ipHash: string): Promise<ReportResult> {
  const [p] = await db.select({ source: products.source }).from(products).where(eq(products.id, id));
  if (!p || p.source !== "user") return "not_found";
  if ((await recentEvents(ipHash, "report")) >= REPORT_LIMIT_PER_HOUR) return "rate_limited";
  const [dup] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(submissionEvents)
    .where(and(
      eq(submissionEvents.ipHash, ipHash), eq(submissionEvents.kind, "report"), eq(submissionEvents.productId, id),
      // Reports reset when the product is confirmed again.
      sql`${submissionEvents.createdAt} > (SELECT last_seen_at FROM products WHERE id = ${id})`,
    ));
  if (dup.n > 0) return "already_reported";
  await db.transaction(async (tx) => {
    await tx.update(products).set({ reports: sql`${products.reports} + 1` }).where(eq(products.id, id));
    await tx.insert(submissionEvents).values({ kind: "report", ipHash, productId: id });
  });
  return "counted";
}
