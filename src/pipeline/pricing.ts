import type { RawVariant } from "./types";

export interface ProductPrice {
  /** Lowest price among the given variants — what the card shows and scores on. */
  sale: number;
  /** That variant's own list price (its compare-at when discounted). */
  list: number;
  /** Highest price among the given variants; above `sale` means "from $sale". */
  max: number;
  /** Color carrying the lowest price. */
  color: string;
  /** Page preselecting that color, so the price on the card matches the page. */
  url: string;
}

/**
 * Product-level price from its purchasable variants: the cheapest one, and a
 * link to that color. On ties, keep the product's usual page (`defaultUrl`) so
 * links don't hop between colors night to night.
 */
export function productPrice(variants: RawVariant[], defaultUrl: string): ProductPrice {
  const cheapest = variants.reduce((best, v) => {
    if (v.price < best.price) return v;
    if (v.price === best.price && best.url !== defaultUrl && v.url === defaultUrl) return v;
    return best;
  });
  return {
    sale: cheapest.price,
    list: cheapest.compareAtPrice ?? cheapest.price,
    max: Math.max(...variants.map((v) => v.price)),
    color: cheapest.color,
    url: cheapest.url ?? defaultUrl,
  };
}
