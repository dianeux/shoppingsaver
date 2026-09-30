import type { BrandId } from "@/domain/brands";
import type { Gender } from "@/domain/gender";
import type { L2 } from "@/domain/taxonomy";

export interface RawVariant {
  color: string;
  size: string;
  price: number;
  /** Original price when the variant is discounted, else null. */
  compareAtPrice: number | null;
  available: boolean;
  imageUrl: string | null;
  /** Product page preselecting this color, when the site has one (the card links to the cheapest color). */
  url?: string | null;
}

/** What an adapter hands the pipeline: brand-native data, not yet normalized. */
export interface RawProduct {
  brand: BrandId;
  sourceId: string;
  name: string;
  url: string;
  imageUrl: string | null;
  /** Human-readable source category, reported when unmapped. */
  sourceCategory: string;
  /** Canonical L2 from the brand's mapping table, or null when unmapped. */
  l2: L2 | null;
  /** True when the mapping table deliberately leaves this category out (e.g. gloves). */
  excluded: boolean;
  /** Catalog section; null = outside both (kids, home…). */
  gender: Gender | null;
  variants: RawVariant[];
  tags: string[];
  /** Composition text if the listing already carries it (saves a detail request). */
  compositionText: string | null;
  /** Free-text description, used by the LLM fallback. */
  description: string;
  /** Changes whenever fields that feed extraction change. */
  contentHash: string;
  /** Category-specific attributes the adapter can read directly (layer 2). */
  attrs: Record<string, string | string[] | null>;
}

export interface DetailResult {
  /** Text of the fiber-content block, or null if the page has none. */
  compositionText: string | null;
}

export interface BrandAdapter {
  brand: BrandId;
  /** Version of the category mapping table; stored on each crawl run. */
  mappingVersion: string;
  list(): AsyncIterable<RawProduct>;
  /** Fetch composition from the product page. Called only for new/changed products. */
  fetchDetail(p: RawProduct): Promise<DetailResult>;
}
