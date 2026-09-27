import type { BrandId } from "@/domain/brands";
import type { ColorFamily } from "@/domain/colors";
import type { CompositionStatus } from "@/domain/composition";
import type { L2 } from "@/domain/taxonomy";

/** What the browse UI receives per product — enough to filter, sort and rescore client-side. */
export interface CardProduct {
  id: string;
  brand: BrandId;
  name: string;
  url: string;
  imageUrl: string | null;
  l2: L2;
  listPrice: number;
  salePrice: number;
  /** Highest in-stock price across colors; above salePrice → "from $salePrice". */
  maxPrice: number;
  /** Color carrying salePrice (the card links to it). */
  priceColor: string | null;
  colors: { raw: string; family: ColorFamily | null }[];
  colorFamilies: ColorFamily[];
  sizes: string[];
  compositionText: string | null;
  compositionStatus: CompositionStatus;
  dominantFiber: string | null;
  materialScore: number | null;
  pricePercentile: number;
  /** Present while the product is on the weekly drops list. */
  drop: { pct: number; baselinePrice: number; detectedOn: string } | null;
}
