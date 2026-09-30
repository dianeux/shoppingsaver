import { createHash } from "node:crypto";
import type { Gender } from "@/domain/gender";
import { brandJson, brandText } from "../fetcher";
import type { BrandAdapter, RawProduct, RawVariant } from "../types";
import { mapOldNavyCategory, OLDNAVY_MAPPING_VERSION } from "./oldnavy-mapping";

/**
 * Old Navy (Gap Inc.) product lists come from the public search API the
 * category page itself calls (api.gap.com/commerce/search/products/v2/cc):
 * styles with colorways, regular vs effective price, stock status and
 * sub-category. Fiber content is only in the product page's "Fabric & care"
 * bullets, fetched for new/changed styles.
 */
const ORIGIN = "https://oldnavy.gap.com";
const SEARCH_API = "https://api.gap.com/commerce/search/products/v2/cc";
/** "Shop All Women's" / "Shop All Men's". */
const SECTIONS: { gender: Gender; cid: string }[] = [
  { gender: "women", cid: "1185233" },
  { gender: "men", cid: "1031099" },
];
const PAGE_SIZE = 300;

/** Bump when extraction logic changes so stored results are re-extracted. */
const EXTRACTOR_VERSION = "oldnavy-extract-1";

interface OldNavyColor {
  ccId: string;
  ccName: string;
  effectivePrice: string;
  regularPrice: string;
  inventoryStatus: string;
  images: { type: string; path: string }[];
}

export interface OldNavyStyle {
  styleId: string;
  styleName: string;
  webProductType?: string | null;
  subBrand?: string | null;
  styleColors: OldNavyColor[];
}

export interface OldNavyPage {
  pagination: { pageNumberTotal: string };
  products: OldNavyStyle[];
  categories: { subCategoryName?: string; ccList?: { ccId: string }[] }[];
}

async function fetchPages(cid: string): Promise<OldNavyPage[]> {
  const pages: OldNavyPage[] = [];
  for (let n = 0, total = 1; n < total && n < 100; n++) {
    const qs = new URLSearchParams({ cid, brand: "on", market: "us", locale: "en_US", pageSize: String(PAGE_SIZE), pageNumber: String(n) });
    const page = await brandJson<OldNavyPage>("oldnavy", `${SEARCH_API}?${qs}`);
    pages.push(page);
    total = Number(page.pagination.pageNumberTotal);
  }
  return pages;
}

export interface OldNavyGroup {
  style: OldNavyStyle;
  colors: Map<string, OldNavyColor>;
  subCategory: string | null;
}

/** A style can appear on several pages, each carrying some of its colorways; merge them. */
export function groupStyles(pages: OldNavyPage[]): OldNavyGroup[] {
  const subByCc = new Map<string, string>();
  for (const p of pages) for (const c of p.categories) for (const cc of c.ccList ?? []) if (c.subCategoryName) subByCc.set(cc.ccId, c.subCategoryName);
  const groups = new Map<string, OldNavyGroup>();
  for (const p of pages) {
    for (const s of p.products) {
      const g = groups.get(s.styleId) ?? { style: s, colors: new Map(), subCategory: null };
      for (const c of s.styleColors) {
        g.colors.set(c.ccId, c);
        g.subCategory ??= subByCc.get(c.ccId) ?? null;
      }
      groups.set(s.styleId, g);
    }
  }
  return [...groups.values()];
}

/** Style names sometimes carry a trailing fit/size note ("-- 6-inch inseam - No"); keep the name itself. */
function cleanName(name: string): string {
  return name.split(/\s+--\s+/)[0].trim();
}

export function toRawProduct({ style, colors, subCategory }: OldNavyGroup, gender: Gender = "women"): RawProduct {
  const name = cleanName(style.styleName);
  const mapping = mapOldNavyCategory({ name, subCategory, webProductType: style.webProductType ?? null, subBrand: style.subBrand ?? null }, gender);
  const variants: RawVariant[] = [...colors.values()].map((c) => {
    const price = Number(c.effectivePrice);
    const regular = Number(c.regularPrice);
    const img = c.images.find((i) => i.type === "VLI") ?? c.images[0];
    return {
      color: c.ccName,
      size: "", // the search API has no per-size data
      price,
      compareAtPrice: regular > price ? regular : null,
      available: !/out of stock/i.test(c.inventoryStatus),
      imageUrl: img ? `${ORIGIN}${img.path}` : null,
      url: `${ORIGIN}/browse/product.do?pid=${c.ccId}`,
    };
  });
  const lead = [...colors.values()][0];
  const hash = createHash("sha1").update(JSON.stringify([EXTRACTOR_VERSION, name, subCategory, style.webProductType])).digest("hex");
  return {
    brand: "oldnavy",
    sourceId: style.styleId,
    name,
    url: `${ORIGIN}/browse/product.do?pid=${lead.ccId}`,
    imageUrl: variants[0]?.imageUrl ?? null,
    sourceCategory: `${subCategory ?? "(no sub-category)"} / ${style.webProductType ?? "(no type)"}`,
    l2: mapping && "l2" in mapping ? mapping.l2 : null,
    excluded: !!mapping && "excluded" in mapping,
    gender,
    variants,
    tags: [subCategory, style.webProductType, style.subBrand].filter((x): x is string => !!x),
    compositionText: null,
    description: "",
    contentHash: hash,
    attrs: { subBrand: style.subBrand ?? null },
  };
}

const FIBER_SHARE =
  /\d{1,3}\s?%\s*(?:[\w™®'-]+\s+){0,3}?(?:cotton|linen|flax|hemp|silk|wool|merino|cashmere|alpaca|lyocell|tencel|modal|cupro|viscose|rayon|ecovero|acetate|polyester|nylon|polyamide|acrylic|elastane|elastomultiester|spandex|lycra|rubber|leather|synthetic|metallic|other(?: fibers?)?)\b/i;

/**
 * The "Fabric & care" bullets embedded (JSON-escaped) in the product page's
 * server-component payload, e.g. ["100% recycled polyester", "machine wash…", "imported"].
 */
export function extractOldNavyComposition(html: string): string | null {
  const m = html.match(/\\"id\\":\\"fabric\\"[\s\S]{0,400}?\\"bullets\\":\[([\s\S]*?)\]/);
  if (!m) return null;
  const bullets = [...m[1].matchAll(/\\"((?:[^"\\]|\\\\.|\\u[0-9a-fA-F]{4})*?)\\"/g)].map((b) =>
    b[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))).trim(),
  );
  const fiber = bullets.filter((b) => FIBER_SHARE.test(b));
  return fiber.length ? fiber.join(" / ") : null;
}

export const oldNavyAdapter: BrandAdapter = {
  brand: "oldnavy",
  mappingVersion: OLDNAVY_MAPPING_VERSION,

  async *list() {
    for (const { gender, cid } of SECTIONS) {
      for (const g of groupStyles(await fetchPages(cid))) yield toRawProduct(g, gender);
    }
  },

  async fetchDetail(p) {
    return { compositionText: extractOldNavyComposition(await brandText("oldnavy", p.url)) };
  },
};
