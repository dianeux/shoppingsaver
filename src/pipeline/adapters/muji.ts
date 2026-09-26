import { createHash } from "node:crypto";
import { brandJson, brandText } from "../fetcher";
import type { BrandAdapter, RawProduct, RawVariant } from "../types";
import { htmlToText } from "../html";
import { isMujiWomen, mapMujiCategory, MUJI_MAPPING_VERSION } from "./muji-mapping";

/**
 * Muji US is a Shopify store: native /collections/<handle>/products.json for
 * listings, and the product page's "Material & Care" metafield for composition.
 */
const ORIGIN = "https://www.muji.us";

/**
 * Filter at the collection level (PRD ch.6): the store is mostly stationery and
 * home goods, so we only ever list apparel collections.
 */
/** Bump when extraction logic changes so stored results are re-extracted. */
const EXTRACTOR_VERSION = "muji-extract-2";

const COLLECTIONS = ["women", "womens-innerwear", "womens-loungewear", "socks", "winter-accessories"];

interface ShopifyVariant {
  id: number;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  price: string;
  compare_at_price: string | null;
  available: boolean;
  featured_image: { src: string } | null;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  product_type: string;
  tags: string[];
  options: { name: string; position: number; values: string[] }[];
  variants: ShopifyVariant[];
  images: { src: string }[];
}

function toVariants(p: ShopifyProduct): RawVariant[] {
  const pos = (name: RegExp) => p.options.find((o) => name.test(o.name))?.position;
  const colorPos = pos(/colou?r/i);
  const sizePos = pos(/size/i);
  const opt = (v: ShopifyVariant, n?: number) => (n ? (v[`option${n}` as "option1"] ?? "") : "");
  return p.variants.map((v) => {
    const price = Number(v.price);
    const compare = v.compare_at_price ? Number(v.compare_at_price) : null;
    return {
      color: opt(v, colorPos) || "Default",
      size: opt(v, sizePos) || "One Size",
      price,
      compareAtPrice: compare && compare > price ? compare : null,
      available: v.available,
      imageUrl: v.featured_image?.src ?? null,
    };
  });
}

function attrsFromTags(tags: string[]): Record<string, string | null> {
  const has = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());
  const sleeve = has("Sleeveless") ? "sleeveless" : has("Short Sleeve") ? "short" : has("Long Sleeve") || has("Long Sleeve T-Shirt") ? "long" : has("3/4 Sleeve") ? "three-quarter" : null;
  const fitTag = tags.find((t) => t.startsWith("Fit_"))?.slice(4) ?? tags.find((t) => / Fit$/.test(t))?.replace(/ Fit$/, "") ?? null;
  return { sleeve_length: sleeve, fit: fitTag };
}

async function* listCollection(handle: string): AsyncIterable<ShopifyProduct> {
  for (let page = 1; page < 50; page++) {
    const { products } = await brandJson<{ products: ShopifyProduct[] }>(
      "muji",
      `${ORIGIN}/collections/${handle}/products.json?limit=250&page=${page}`,
    );
    yield* products;
    if (products.length < 250) return;
  }
}

let mainSectionId: string | null = null;

async function productHtml(handle: string): Promise<string> {
  // Rendering just the main section is ~10× lighter than the full page.
  if (mainSectionId) {
    const html = await brandText("muji", `${ORIGIN}/products/${handle}?section_id=${mainSectionId}`);
    if (html.includes("collapsible-tab")) return html;
  }
  const full = await brandText("muji", `${ORIGIN}/products/${handle}`);
  mainSectionId = full.match(/id="shopify-section-(template--\d+__main)"/)?.[1] ?? mainSectionId;
  return full;
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
      for await (const p of listCollection(handle)) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const variants = toVariants(p);
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
          description: htmlToText(p.body_html).slice(0, 2000),
          contentHash: hash,
          attrs: attrsFromTags(p.tags),
        };
        yield product;
      }
    }
  },

  async fetchDetail(p) {
    const handle = new URL(p.url).pathname.split("/").pop()!;
    return { compositionText: extractMujiComposition(await productHtml(handle)) };
  },
};
