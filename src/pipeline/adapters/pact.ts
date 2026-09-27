import { createHash } from "node:crypto";
import { brandPostForm } from "../fetcher";
import type { BrandAdapter, RawProduct, RawVariant } from "../types";
import { mapPactCategory, PACT_MAPPING_VERSION } from "./pact-mapping";

/**
 * Pact runs its own storefront (not Shopify). Product pages hydrate from an XHR
 * form post to /controller/product; asking for a whole "parent" (apparel,
 * underwear, clearance) without a category returns every women's style with
 * colorways, per-size stock and price, and fiber content — so three requests
 * cover the catalog and no per-product page fetch is needed.
 */
const ORIGIN = "https://wearpact.com";
const PARENTS = ["apparel", "underwear", "clearance"] as const;

/** Bump when extraction logic changes so stored results are re-extracted. */
const EXTRACTOR_VERSION = "pact-extract-1";

interface PactPrice {
  msrp: number;
  sale: number;
}

interface PactSize {
  display: string;
  inStock: boolean;
  price: PactPrice;
}

export interface PactColorway {
  id: string;
  styleCode: string;
  collectionCode: string | null;
  color: string;
  category: string[] | null;
  packSize: number | null;
  defaultColor?: boolean;
  gender: string;
  fabric: string | null;
  fiber: string[] | null;
  romance: string | null;
  price: PactPrice;
  sizes: Record<string, PactSize>;
  tracking?: { url?: string; img?: { large?: string[] } };
}

export interface PactStyle {
  packs?: Record<string, Record<string, Record<string, PactColorway>>>;
}

interface PactResponse {
  status: string;
  data: Record<string, PactStyle> | [];
}

function colorways(style: PactStyle): PactColorway[] {
  return Object.values(style.packs ?? {}).flatMap((groups) => Object.values(groups ?? {}).flatMap((c) => Object.values(c ?? {})));
}

const titleCase = (s: string) => s.replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
const https = (u: string) => (u.startsWith("//") ? `https:${u}` : u);

/** Strip the "clearance " prefix Pact adds to sale copies of a style. */
function baseName(key: string) {
  return key.replace(/^clearance\s+/i, "");
}

export interface PactGroup {
  styleCode: string;
  /** Style keys that share this code, regular ones first. */
  keys: string[];
  colorways: PactColorway[];
}

/**
 * Merge a style's regular and clearance listings (same style code) into one
 * product, and keep multipacks/sets apart — they share the code but not the price basis.
 */
export function groupStyles(styles: Record<string, PactStyle>): { groups: PactGroup[]; excluded: { key: string; reason: string }[] } {
  const groups = new Map<string, PactGroup>();
  const excluded: { key: string; reason: string }[] = [];
  for (const [key, style] of Object.entries(styles)) {
    const cws = colorways(style).filter((c) => c.gender === "women");
    if (!cws.length) continue;
    const first = cws[0];
    const mapping = mapPactCategory({
      name: key,
      categories: first.category ?? [],
      collectionCode: first.collectionCode,
      packSize: first.packSize ?? 1,
    });
    if (mapping && "excluded" in mapping) {
      excluded.push({ key, reason: mapping.excluded });
      continue;
    }
    const g = groups.get(first.styleCode) ?? { styleCode: first.styleCode, keys: [], colorways: [] };
    g.keys.push(key);
    for (const c of cws) {
      const dup = g.colorways.findIndex((x) => x.id === c.id);
      const inStock = (x: PactColorway) => Object.values(x.sizes).filter((s) => s.inStock).length;
      if (dup < 0) g.colorways.push(c);
      else if (inStock(c) > inStock(g.colorways[dup])) g.colorways[dup] = c;
    }
    groups.set(first.styleCode, g);
  }
  for (const g of groups.values()) g.keys.sort((a, b) => Number(/^clearance/i.test(a)) - Number(/^clearance/i.test(b)));
  return { groups: [...groups.values()], excluded };
}

export function toRawProduct(g: PactGroup): RawProduct {
  const regularKey = g.keys[0];
  // Prefer the regular listing's default colorway for name, URL, category and fiber content.
  const regular = g.colorways.filter((c) => (c.tracking?.url ?? "").includes(`/${regularKey}/`));
  const pool = regular.length ? regular : g.colorways;
  const lead = pool.find((c) => c.defaultColor) ?? pool[0];
  const categories = [...new Set(g.colorways.flatMap((c) => c.category ?? []))];
  const mapping = mapPactCategory({
    name: regularKey,
    categories: lead.category ?? categories,
    collectionCode: lead.collectionCode,
    packSize: lead.packSize ?? 1,
  });

  const variants: RawVariant[] = g.colorways.flatMap((c) =>
    Object.values(c.sizes).map((s) => ({
      color: titleCase(c.color),
      size: s.display.toUpperCase(),
      price: Number(s.price?.sale ?? c.price.sale),
      compareAtPrice: Number(s.price?.msrp ?? c.price.msrp) > Number(s.price?.sale ?? c.price.sale) ? Number(s.price?.msrp ?? c.price.msrp) : null,
      available: s.inStock,
      imageUrl: c.tracking?.img?.large?.[0] ? https(c.tracking.img.large[0]) : null,
    })),
  );

  const compositionText = lead.fiber?.length ? lead.fiber.join(", ") : lead.fabric;
  const name = titleCase(baseName(regularKey));
  const url = lead.tracking?.url ? encodeURI(https(lead.tracking.url)) : `${ORIGIN}/women`;
  const hash = createHash("sha1")
    .update(JSON.stringify([EXTRACTOR_VERSION, name, [...categories].sort(), compositionText, lead.collectionCode]))
    .digest("hex");

  return {
    brand: "pact",
    sourceId: g.styleCode,
    name,
    url,
    imageUrl: variants.find((v) => v.color === titleCase(lead.color))?.imageUrl ?? variants[0]?.imageUrl ?? null,
    sourceCategory: `${categories.filter((c) => !c.startsWith("all ") && c !== "new to sale").join(", ")} [${lead.collectionCode ?? "no collection"}]`,
    l2: mapping && "l2" in mapping ? mapping.l2 : null,
    excluded: false,
    isWomen: true,
    variants,
    tags: [...categories, ...(lead.collectionCode ? [lead.collectionCode] : []), ...(g.keys.some((k) => /^clearance/i.test(k)) ? ["clearance"] : [])],
    compositionText: compositionText ?? null,
    description: (lead.romance ?? "").slice(0, 2000),
    contentHash: hash,
    attrs: { collection: lead.collectionCode },
  };
}

async function fetchParent(parent: string): Promise<Record<string, PactStyle>> {
  const res = await brandPostForm<PactResponse>("pact", `${ORIGIN}/controller/product`, {
    action: "get",
    gender: "women",
    parent,
    category: "",
    style: "",
    pid: "",
  });
  if (res.status !== "success") throw new Error(`Pact ${parent}: status ${res.status}`);
  // An empty listing comes back as [] rather than {}.
  return Array.isArray(res.data) ? {} : res.data;
}

export const pactAdapter: BrandAdapter = {
  brand: "pact",
  mappingVersion: PACT_MAPPING_VERSION,

  async *list() {
    const styles: Record<string, PactStyle> = {};
    for (const parent of PARENTS) Object.assign(styles, await fetchParent(parent));
    const { groups, excluded } = groupStyles(styles);
    for (const e of excluded) {
      yield {
        brand: "pact", sourceId: `excluded:${e.key}`, name: e.key, url: ORIGIN, imageUrl: null,
        sourceCategory: e.reason, l2: null, excluded: true, isWomen: true, variants: [], tags: [],
        compositionText: null, description: "", contentHash: "", attrs: {},
      } satisfies RawProduct;
    }
    for (const g of groups) yield toRawProduct(g);
  },

  // Fiber content arrives with the listing; there is no detail page to fetch.
  async fetchDetail() {
    return { compositionText: null };
  },
};
