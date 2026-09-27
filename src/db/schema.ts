import { sql } from "drizzle-orm";
import {
  boolean, date, index, integer, jsonb, numeric, pgTable, primaryKey, real, serial, text, timestamp,
} from "drizzle-orm/pg-core";
import type { CompositionStatus, Composition } from "@/domain/composition";
import type { ColorFamily } from "@/domain/colors";

export interface ProductColor {
  raw: string;
  family: ColorFamily | null;
  imageUrl: string | null;
}

/**
 * One row per brand product (all colorways). Layer-1 attributes are columns;
 * layer-2 category-specific attributes live in `attrs` (PRD ch.8).
 */
export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(), // `${brand}:${sourceId}`
    brand: text("brand").notNull(),
    sourceId: text("source_id").notNull(),
    productName: text("product_name").notNull(),
    productUrl: text("product_url").notNull(),
    imageUrl: text("image_url"),
    categoryL1: text("category_l1").notNull(),
    categoryL2: text("category_l2").notNull(),
    sourceCategory: text("source_category").notNull(),
    listPrice: numeric("list_price", { precision: 10, scale: 2, mode: "number" }).notNull(),
    salePrice: numeric("sale_price", { precision: 10, scale: 2, mode: "number" }).notNull(),
    /** Highest in-stock price across colors; above salePrice means "from $X". */
    maxPrice: numeric("max_price", { precision: 10, scale: 2, mode: "number" }),
    /** Color that carries salePrice; productUrl points at it. */
    priceColor: text("price_color"),
    colors: jsonb("colors").$type<ProductColor[]>().notNull(),
    colorFamilies: text("color_families").array().notNull().default(sql`'{}'::text[]`),
    sizeRange: text("size_range").array().notNull().default(sql`'{}'::text[]`),
    compositionRaw: text("composition_raw"),
    composition: jsonb("composition").$type<Composition>(),
    compositionStatus: text("composition_status").$type<CompositionStatus>().notNull(),
    compositionSource: text("composition_source").$type<"parser" | "llm">(),
    dominantFiber: text("dominant_fiber"),
    materialScore: real("material_score"),
    /** Percentile of sale price within the L2, recomputed nightly after all brands load. */
    pricePercentile: real("price_percentile"),
    /** Value score at the default 50/50 weight; the UI recomputes for other weights. */
    valueScore: integer("value_score"),
    attrs: jsonb("attrs").$type<Record<string, string | string[] | null>>().notNull().default({}),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    /** Hash of the source fields that feed extraction; unchanged hash = skip re-extraction. */
    contentHash: text("content_hash").notNull(),
    /** Still listed on the brand site (false = gone from the catalog). */
    active: boolean("active").notNull().default(true),
    /** At least one variant is purchasable. Sold-out products stay indexed (price history) but are hidden. */
    inStock: boolean("in_stock").notNull().default(true),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("products_l2_idx").on(t.categoryL2, t.active),
    index("products_brand_idx").on(t.brand, t.active),
  ],
);

/** Nightly price snapshot per product (PRD F13). Retained ≥ 90 days. */
export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date", { mode: "string" }).notNull(),
    listPrice: numeric("list_price", { precision: 10, scale: 2, mode: "number" }).notNull(),
    salePrice: numeric("sale_price", { precision: 10, scale: 2, mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.snapshotDate] }), index("snap_date_idx").on(t.snapshotDate)],
);

export interface CrawlStats {
  listed: number;
  kept: number;
  skippedNonWomen: number;
  excluded: number;
  soldOut: number;
  unmappedCategories: Record<string, number>;
  detailFetched: number;
  extracted: { parser: number; llm: number; failed: number; notDisclosed: number; reused: number };
  unmappedColors: Record<string, number>;
  deactivated: number;
}

/** One row per brand per nightly run. Drives F7 (degraded notice), F20 (freshness) and F21 (quality alerts). */
export const crawlRuns = pgTable(
  "crawl_runs",
  {
    id: serial("id").primaryKey(),
    brand: text("brand").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: text("status").$type<"running" | "success" | "failed">().notNull(),
    error: text("error"),
    stats: jsonb("stats").$type<CrawlStats>(),
    mappingVersion: text("mapping_version"),
    llmInputTokens: integer("llm_input_tokens").notNull().default(0),
    llmOutputTokens: integer("llm_output_tokens").notNull().default(0),
  },
  (t) => [index("crawl_runs_brand_idx").on(t.brand, t.startedAt)],
);

/**
 * Weekly price drops (F14/F15). A product enters when its price falls below the
 * previous day's, stays up to 7 days from its latest drop, and leaves early if the
 * price climbs back to the pre-drop (day-0) price.
 */
export const priceDrops = pgTable("price_drops", {
  productId: text("product_id").primaryKey().references(() => products.id, { onDelete: "cascade" }),
  /** Date of the most recent drop; a further drop restarts the 7-day window. */
  detectedOn: date("detected_on", { mode: "string" }).notNull(),
  /** Price on day 0 — the day before the first drop. Kept across further drops. */
  baselinePrice: numeric("baseline_price", { precision: 10, scale: 2, mode: "number" }).notNull(),
  currentPrice: numeric("current_price", { precision: 10, scale: 2, mode: "number" }).notNull(),
  /** Total drop versus the day-0 price. */
  dropPct: real("drop_pct").notNull(),
});
