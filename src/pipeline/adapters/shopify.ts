import type { BrandId } from "@/domain/brands";
import { brandJson, brandText } from "../fetcher";
import type { RawVariant } from "../types";

/** Shared pieces for Shopify storefronts (Muji, Everlane). */

export interface ShopifyVariant {
  id: number;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  price: string;
  compare_at_price: string | null;
  available: boolean;
  featured_image: { src: string } | null;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  product_type: string;
  tags: string[];
  options: { name: string; position: number; values: string[] }[];
  variants: ShopifyVariant[];
  images: { src: string }[];
}

/** Every product in a collection via the native /products.json endpoint (250 per page). */
export async function* listShopifyCollection(brand: BrandId, origin: string, handle: string): AsyncIterable<ShopifyProduct> {
  for (let page = 1; page < 100; page++) {
    const { products } = await brandJson<{ products: ShopifyProduct[] }>(brand, `${origin}/collections/${handle}/products.json?limit=250&page=${page}`);
    yield* products;
    if (products.length < 250) return;
  }
}

/**
 * Map Shopify variants to RawVariants. `color` overrides a store that has no
 * Color option; `url` gives the page for a variant (e.g. preselecting its color).
 */
export function shopifyVariants(p: ShopifyProduct, opts: { color?: string; url?: (v: ShopifyVariant) => string } = {}): RawVariant[] {
  const { color } = opts;
  const pos = (name: RegExp) => p.options.find((o) => name.test(o.name))?.position;
  const colorPos = pos(/colou?r/i);
  const sizePos = pos(/size/i);
  const opt = (v: ShopifyVariant, n?: number) => (n ? (v[`option${n}` as "option1"] ?? "") : "");
  return p.variants.map((v) => {
    const price = Number(v.price);
    const compare = v.compare_at_price ? Number(v.compare_at_price) : null;
    return {
      color: color ?? (opt(v, colorPos) || "Default"),
      size: opt(v, sizePos) || "One Size",
      price,
      compareAtPrice: compare && compare > price ? compare : null,
      available: v.available,
      imageUrl: v.featured_image?.src ?? p.images[0]?.src ?? null,
      url: opts.url?.(v) ?? null,
    };
  });
}

/**
 * Product page HTML, rendering only the theme's main section when possible
 * (~5–10× lighter than the full page). The section id is learned from the
 * first full page fetched; `isComplete` says whether a section render has what we need.
 */
export class ShopifyProductPage {
  private sectionId: string | null = null;

  constructor(
    private readonly brand: BrandId,
    private readonly origin: string,
    private readonly isComplete: (html: string) => boolean,
  ) {}

  async html(handle: string): Promise<string> {
    if (this.sectionId) {
      const html = await brandText(this.brand, `${this.origin}/products/${handle}?section_id=${this.sectionId}`);
      if (this.isComplete(html)) return html;
    }
    const full = await brandText(this.brand, `${this.origin}/products/${handle}`);
    this.sectionId = full.match(/id="shopify-section-(template--\d+__main)"/)?.[1] ?? this.sectionId;
    return full;
  }
}
