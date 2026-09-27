import { createHash } from "node:crypto";
import { htmlToText } from "../html";
import type { BrandAdapter, RawProduct } from "../types";
import { EVERLANE_MAPPING_VERSION, mapEverlaneCategory } from "./everlane-mapping";
import { listShopifyCollection, shopifyVariants, ShopifyProductPage, type ShopifyProduct } from "./shopify";

/**
 * Everlane is a Shopify store where every colorway is its own product
 * ("The Box-Cut Tee in Essential Cotton | White"), tied together by a
 * "Product Group: <id>" tag. Composition lives in the product page's
 * "Materials & Care" accordion.
 */
const ORIGIN = "https://www.everlane.com";
const COLLECTION = "womens-all";

/** Bump when extraction logic changes so stored results are re-extracted. */
const EXTRACTOR_VERSION = "everlane-extract-1";

const productPage = new ShopifyProductPage("everlane", ORIGIN, (html) => html.includes("ProductAccordion-Materials"));

function tagValue(p: ShopifyProduct, prefix: string): string | null {
  const t = p.tags.find((x) => x.toLowerCase().startsWith(`${prefix}:`));
  return t ? t.slice(t.indexOf(":") + 1).trim() : null;
}

/** "The Box-Cut Tee in Essential Cotton | White | No Pocket" → name + color. */
export function splitTitle(title: string): { name: string; color: string } {
  const [name, color, ...rest] = title.split(" | ").map((s) => s.trim());
  return { name, color: [color, ...rest].filter(Boolean).join(" / ") || "Default" };
}

/**
 * Group colorways into products. Groups with nothing in stock are dropped: the
 * collection keeps thousands of retired colorways around, and a product that
 * disappears this way is simply deactivated (it comes back when restocked).
 */
export function groupColorways(list: ShopifyProduct[]): ShopifyProduct[][] {
  const groups = new Map<string, ShopifyProduct[]>();
  for (const p of list) {
    if (!p.tags.includes("female")) continue;
    const key = tagValue(p, "product group") ?? p.handle;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.values()].filter((g) => g.some((p) => p.variants.some((v) => v.available)));
}

export function toRawProduct(group: ShopifyProduct[]): RawProduct {
  // Lead with an in-stock colorway: its page and image represent the product.
  const lead = group.find((p) => p.variants.some((v) => v.available)) ?? group[0];
  const { name } = splitTitle(lead.title);
  const subcategory = tagValue(lead, "subcategory");
  const mapping = mapEverlaneCategory(lead.product_type, subcategory, lead.title);
  const variants = group.flatMap((p) => shopifyVariants(p, splitTitle(p.title).color));
  const groupId = tagValue(lead, "product group") ?? lead.handle;
  const hash = createHash("sha1")
    .update(JSON.stringify([EXTRACTOR_VERSION, name, lead.product_type, subcategory, groupId]))
    .digest("hex");
  return {
    brand: "everlane",
    sourceId: groupId,
    name,
    url: `${ORIGIN}/products/${lead.handle}`,
    imageUrl: lead.images[0]?.src ?? null,
    sourceCategory: `${lead.product_type || "(no type)"} / ${subcategory ?? "(no subcategory)"}`,
    l2: mapping && "l2" in mapping ? mapping.l2 : null,
    excluded: !!mapping && "excluded" in mapping,
    isWomen: true,
    variants,
    tags: lead.tags.filter((t) => /^(category|subcategory|fabric):/i.test(t)),
    compositionText: null,
    description: htmlToText(lead.body_html ?? "").slice(0, 2000),
    contentHash: hash,
    attrs: { fabric: tagValue(lead, "fabric") },
  };
}

/** The bullets under "Materials:" in the Materials & Care accordion (stops at "Care:"). */
export function extractEverlaneComposition(html: string): string | null {
  const start = html.search(/id="ProductAccordion-Materials[^"]*"/);
  if (start < 0) return null;
  const block = html.slice(start, start + 6000);
  const materials = block.match(/Materials:\s*<ul>([\s\S]*?)<\/ul>/i)?.[1];
  if (!materials) return null;
  const lines = [...materials.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => htmlToText(m[1]).trim()).filter((l) => /\d\s*%/.test(l));
  return lines.length ? lines.join(" / ") : null;
}

export const everlaneAdapter: BrandAdapter = {
  brand: "everlane",
  mappingVersion: EVERLANE_MAPPING_VERSION,

  async *list() {
    const all: ShopifyProduct[] = [];
    for await (const p of listShopifyCollection("everlane", ORIGIN, COLLECTION)) all.push(p);
    for (const g of groupColorways(all)) yield toRawProduct(g);
  },

  async fetchDetail(p) {
    const handle = new URL(p.url).pathname.split("/").pop()!;
    return { compositionText: extractEverlaneComposition(await productPage.html(handle)) };
  },
};
