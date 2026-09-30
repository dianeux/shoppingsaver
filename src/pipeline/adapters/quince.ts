import { createHash, randomUUID } from "node:crypto";
import type { Gender } from "@/domain/gender";
import { brandPostJson, brandText } from "../fetcher";
import { htmlToText } from "../html";
import type { BrandAdapter, RawProduct, RawVariant } from "../types";
import { mapQuinceCategory, QUINCE_MAPPING_VERSION, type QuinceClassification } from "./quince-mapping";

/**
 * Quince is a Next.js storefront. Each section's apparel collection page renders
 * its first 30 cards server-side and pages the rest from the site's own
 * presentation-layer API (the same call the page makes on scroll). The listing
 * has classification, colors, price and per-color availability; fiber content
 * lives only on the product page, which is fetched just for new/changed products.
 */
const ORIGIN = "https://www.quince.com";
/** Each section's apparel collection and the listing's gender value for it. */
const SECTIONS: { gender: Gender; collection: string; listingGender: string }[] = [
  { gender: "women", collection: "/shop/women/apparel", listingGender: "female" },
  { gender: "men", collection: "/shop/men/apparel", listingGender: "male" },
];
const WIDGET_API = "https://api-prod-public.onequince.com/presentation-layer-service/widgets/fetch/v1";
const PAGE_SIZE = 100;
/** Fallback when the collection page doesn't expose its sort config. */
const DEFAULT_BASE_SORT = "CLP_V2_8";

/** Bump when extraction logic changes so stored results are re-extracted. */
const EXTRACTOR_VERSION = "quince-extract-3";

interface QuinceCardVariant {
  displayConfig: { value: string };
  url: string;
  images: { url: string }[];
  price: { salePrice: number };
  atcDisabled?: boolean;
}

export interface QuinceProductItem {
  productId: string;
  title: string;
  slug: string;
  gender: string;
  classification: QuinceClassification | null;
  cardVariants: QuinceCardVariant[];
}

interface ProductListWidget {
  widgetId: string;
  pagination: { cursor: string; limit: number; hasMore: boolean; total: number };
  children?: { data?: { productItem?: QuinceProductItem } }[];
}

function nextData(html: string): unknown {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Quince: __NEXT_DATA__ not found");
  return JSON.parse(m[1]);
}

/** Depth-first search for the first object satisfying `pred`. */
function findObject<T>(root: unknown, pred: (o: Record<string, unknown>) => boolean): T | null {
  const stack = [root];
  while (stack.length) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    if (!Array.isArray(v) && pred(v as Record<string, unknown>)) return v as T;
    for (const x of Object.values(v)) stack.push(x);
  }
  return null;
}

const items = (w: { children?: ProductListWidget["children"] }) =>
  (w.children ?? []).map((c) => c.data?.productItem).filter((p): p is QuinceProductItem => !!p);

async function fetchListing(collection: string): Promise<QuinceProductItem[]> {
  const html = await brandText("quince", `${ORIGIN}${collection}`);
  const widget = findObject<ProductListWidget>(nextData(html), (o) => o.type === "PRODUCT_LIST" && typeof o.widgetId === "string");
  if (!widget) throw new Error("Quince: product list widget not found on collection page");
  const baseSortBy = html.match(/baseSortBy\\?"\s*:\s*\\?"(CLP_[A-Z0-9_]+)/)?.[1] ?? DEFAULT_BASE_SORT;
  const lbUserId = `v-${randomUUID()}`; // anonymous visitor id the API requires; not tied to anyone

  const all = items(widget);
  let pagination = widget.pagination;
  for (let guard = 0; pagination.hasMore && guard < 200; guard++) {
    const page = await brandPostJson<ProductListWidget>(
      "quince",
      WIDGET_API,
      {
        id: widget.widgetId,
        slug: collection,
        device: { platform: "DWEB" },
        type: "PRODUCT_LIST",
        user: { lbUserId },
        request: {
          productList: {
            sorting: { value: "FEATURED", baseSortBy },
            filters: [],
            pagination: { cursor: pagination.cursor, limit: PAGE_SIZE, hasMore: true },
            anchorAttributes: {},
            useApplicableFiltersV2: true,
          },
        },
      },
      {
        accept: "application/json",
        "x-content-env": "PRODUCTION",
        "x-content-env-mode": "LIVE",
        "x-gctx-request-origin-locale": "en-US",
        "x-gctx-request-origin-region-id": "101",
      },
    );
    all.push(...items(page));
    pagination = page.pagination;
  }
  if (all.length < widget.pagination.total * 0.9) {
    throw new Error(`Quince: listed ${all.length} of ${widget.pagination.total} cards — pagination likely changed`);
  }
  return all;
}

export interface QuinceGroup {
  item: QuinceProductItem;
  /** Every color seen across the product's cards (the listing repeats a product once per color group). */
  colors: Map<string, QuinceCardVariant>;
}

export function groupItems(list: QuinceProductItem[], listingGender = "female"): QuinceGroup[] {
  const groups = new Map<string, QuinceGroup>();
  for (const item of list) {
    if (item.gender !== listingGender) continue;
    const g = groups.get(item.productId) ?? { item, colors: new Map() };
    for (const cv of item.cardVariants) if (!g.colors.has(cv.displayConfig.value)) g.colors.set(cv.displayConfig.value, cv);
    groups.set(item.productId, g);
  }
  return [...groups.values()];
}

export function toRawProduct({ item, colors }: QuinceGroup, gender: Gender = "women"): RawProduct {
  const c = item.classification ?? {};
  const mapping = mapQuinceCategory(item.title, c);
  const variants: RawVariant[] = [...colors.values()].map((cv) => ({
    color: cv.displayConfig.value,
    size: "", // the listing has no per-size data
    price: Number(cv.price.salePrice),
    compareAtPrice: null, // Quince's "traditional retail" figure is a competitor comparison, not its own list price
    available: !cv.atcDisabled,
    imageUrl: cv.images[0]?.url ?? null,
    url: `${ORIGIN}/${cv.url.replace(/^\//, "")}`,
  }));
  const hash = createHash("sha1")
    .update(JSON.stringify([EXTRACTOR_VERSION, item.title, item.slug, c.department, c.subdepartment, c.class]))
    .digest("hex");
  return {
    brand: "quince",
    sourceId: item.productId,
    name: item.title.trim(),
    url: `${ORIGIN}/${item.slug.replace(/^\//, "")}`,
    imageUrl: variants[0]?.imageUrl ?? null,
    sourceCategory: [c.department, c.subdepartment, c.class].filter(Boolean).join(" / "),
    l2: mapping && "l2" in mapping ? mapping.l2 : null,
    excluded: !!mapping && "excluded" in mapping,
    gender,
    variants,
    tags: [c.department, c.subdepartment, c.class].filter((x): x is string => !!x),
    compositionText: null,
    description: "",
    contentHash: hash,
    attrs: { subdepartment: c.subdepartment ?? null, class: c.class ?? null },
  };
}

const FIBER = "(?:cotton|linen|flax|hemp|silk|wool|merino|cashmere|alpaca|mohair|yak|camel|lyocell|tencel|modal|cupro|viscose|rayon|ecovero|acetate|polyester|nylon|polyamide|acrylic|elastane|elasterell|spandex|lycra|other fibers?|leather|suede|nubuck|shearling|sheepskin|lambskin|calfskin|cowhide|goatskin)";
/** A percentage followed within three words by a fiber name — "73% organic cotton", not "50% lower emissions". */
const FIBER_SHARE = new RegExp(`\\d{1,3}\\s?%\\s*(?:[\\w™®'-]+\\s+){0,3}?${FIBER}\\b`, "i");

type DetailsHolder = { attributeValues?: { details?: { localisedValue?: string } } };

/**
 * Candidate "details" HTML blocks, best first. Quince serves several page
 * variants (A/B tests): the main product's attribute values, an older template
 * whose details sit in html widgets, and the rendered details section itself.
 * Related/swatch products embed their own details, so the main product goes first.
 */
function detailsCandidates(html: string, root: unknown): string[] {
  const out: string[] = [];
  const main = findObject<{ productPurchaseV2Data: DetailsHolder | null }>(root, (o) => !!o.productPurchaseV2Data)?.productPurchaseV2Data
    ?? findObject<{ productPurchaseData: DetailsHolder | null }>(root, (o) => !!o.productPurchaseData)?.productPurchaseData;
  const fromMain = main?.attributeValues?.details?.localisedValue;
  if (fromMain) out.push(fromMain);
  const stack = [root];
  while (stack.length) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    const text = (v as { htmlData?: { text?: unknown } }).htmlData?.text;
    if (typeof text === "string") out.push(text);
    for (const x of Object.values(v)) stack.push(x);
  }
  const rendered = html.match(/id="widget-pdp-html-details-[^"]*_content"[^>]*>([\s\S]*?<\/ul>)/)?.[1];
  if (rendered) out.push(rendered);
  return out;
}

/**
 * Turn Quince's prose bullets into the "Label: 60% x, 40% y" shape the parser reads:
 * drop "Made from"-style lead-ins, name linings, and label unlabeled bullets body/trim.
 */
export function normalizeFiberBullet(bullet: string, index: number): string {
  let b = bullet.replace(/\b(?:ethically\s+)?(?:made|crafted|knit|knitted|woven|constructed|cut|spun)\s+(?:from|in|of|with)\s+/gi, "");
  b = b.replace(/^(?:fully\s+)?lined\s+(?:with|in)\s+/i, "Lining: ");
  const hasLabel = /^[^%]{1,60}:\s/.test(b);
  return hasLabel ? b : `${index === 0 ? "Body" : "Trim"}: ${b}`;
}

/**
 * Fiber content from the product page's "details" bullets, e.g.
 * "Made from 73% organic cotton, 26% lyocell, 1% spandex" / "Fully lined with 100% polyester".
 */
export function extractQuinceComposition(html: string): string | null {
  for (const detailsHtml of detailsCandidates(html, nextData(html))) {
    const bullets = [...detailsHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => htmlToText(m[1]).replace(/\s+/g, " ").trim());
    const fiberBullets = (bullets.length ? bullets : [htmlToText(detailsHtml)]).filter((b) => FIBER_SHARE.test(b));
    if (fiberBullets.length) return fiberBullets.map(normalizeFiberBullet).join(" / ");
  }
  return null;
}

export const quinceAdapter: BrandAdapter = {
  brand: "quince",
  mappingVersion: QUINCE_MAPPING_VERSION,

  async *list() {
    for (const { gender, collection, listingGender } of SECTIONS) {
      for (const g of groupItems(await fetchListing(collection), listingGender)) yield toRawProduct(g, gender);
    }
  },

  async fetchDetail(p) {
    return { compositionText: extractQuinceComposition(await brandText("quince", p.url)) };
  },
};
