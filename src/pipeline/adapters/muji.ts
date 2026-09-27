import { createHash } from "node:crypto";
import type { BrandAdapter, RawProduct } from "../types";
import { htmlToText } from "../html";
import { isMujiWomen, mapMujiCategory, MUJI_MAPPING_VERSION } from "./muji-mapping";
import { listShopifyCollection, shopifyVariants, ShopifyProductPage } from "./shopify";

/**
 * Muji US is a Shopify store: native /collections/<handle>/products.json for
 * listings, and the product page's "Material & Care" metafield for composition.
 */
const ORIGIN = "https://www.muji.us";

/** Bump when extraction logic changes so stored results are re-extracted. */
const EXTRACTOR_VERSION = "muji-extract-2";

/**
 * Filter at the collection level (PRD ch.6): the store is mostly stationery and
 * home goods, so we only ever list apparel collections.
 */
const COLLECTIONS = ["women", "womens-innerwear", "womens-loungewear", "socks", "winter-accessories"];

const productPage = new ShopifyProductPage("muji", ORIGIN, (html) => html.includes("collapsible-tab"));

function attrsFromTags(tags: string[]): Record<string, string | null> {
  const has = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());
  const sleeve = has("Sleeveless") ? "sleeveless" : has("Short Sleeve") ? "short" : has("Long Sleeve") || has("Long Sleeve T-Shirt") ? "long" : has("3/4 Sleeve") ? "three-quarter" : null;
  const fitTag = tags.find((t) => t.startsWith("Fit_"))?.slice(4) ?? tags.find((t) => / Fit$/.test(t))?.replace(/ Fit$/, "") ?? null;
  return { sleeve_length: sleeve, fit: fitTag };
}

/** Text of the first non-care paragraph in the "Material & Care" tab, or null. */
export function extractMujiComposition(html: string): string | null {
  const start = html.search(/Material\s*(&amp;|&)\s*Care\s*<\/span>/i);
  if (start < 0) return null;
  const block = html.slice(start).match(/<div class="collapsible-tab__text">([\s\S]*?)<\/div>/);
  if (!block) return null;
  // Care notes start with "-", sometimes inside the same <p> as the fiber line.
  const lines = [...block[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].flatMap((m) => htmlToText(m[1]).split("\n")).map((l) => l.trim());
  const fiberLines = lines.filter((l) => l && !l.startsWith("-") && /\d\s*%/.test(l));
  return fiberLines.length ? fiberLines.join(" / ") : null;
}

export const mujiAdapter: BrandAdapter = {
  brand: "muji",
  mappingVersion: MUJI_MAPPING_VERSION,

  async *list() {
    const seen = new Set<number>();
    for (const handle of COLLECTIONS) {
      for await (const p of listShopifyCollection("muji", ORIGIN, handle)) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const variants = shopifyVariants(p, { url: (v) => `${ORIGIN}/products/${p.handle}?variant=${v.id}` });
        const mapping = mapMujiCategory(p.product_type, p.tags, p.title);
        const hash = createHash("sha1")
          .update(JSON.stringify([EXTRACTOR_VERSION, p.title, p.body_html, p.product_type, [...p.tags].sort(), p.options]))
          .digest("hex");
        const product: RawProduct = {
          brand: "muji",
          sourceId: String(p.id),
          name: p.title,
          url: `${ORIGIN}/products/${p.handle}`,
          imageUrl: p.images[0]?.src ?? null,
          sourceCategory: `${p.product_type} [${p.tags.filter((t) => !/^(USA|WK|YCRF|Tax|newMessage|YGroup|Ygroup)/.test(t)).slice(0, 8).join(", ")}]`,
          l2: mapping && "l2" in mapping ? mapping.l2 : null,
          excluded: !!mapping && "excluded" in mapping,
          isWomen: isMujiWomen(p.product_type, p.tags),
          variants,
          tags: p.tags,
          // body_html sometimes says "100% linen", but that's copy, not the fiber label.
          compositionText: null,
          description: htmlToText(p.body_html ?? "").slice(0, 2000),
          contentHash: hash,
          attrs: attrsFromTags(p.tags),
        };
        yield product;
      }
    }
  },

  async fetchDetail(p) {
    const handle = new URL(p.url).pathname.split("/").pop()!;
    return { compositionText: extractMujiComposition(await productPage.html(handle)) };
  },
};
