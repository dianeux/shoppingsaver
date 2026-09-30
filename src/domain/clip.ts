import type { BrandId } from "./brands";
import { parseComposition } from "./composition";
import { isGender, type Gender } from "./gender";
import { parseQuery } from "./search";
import { isL2, type L2 } from "./taxonomy";

/**
 * Bookmarklet ("clip") submissions for brands we can't crawl. The bookmarklet runs
 * in the visitor's own browser on a product page they're viewing and hands the page's
 * structured data to /add, which turns it into a draft here; nothing is fetched from
 * the brand's site by us.
 */

interface ClipBrand {
  /** Official product-page hosts; anything else is refused. */
  hosts: string[];
  /** Hosts product images may come from (shown hotlinked on cards). */
  imageHosts: string[];
  /** Product id from the page URL, shared by all colors of a product. */
  productId: RegExp;
}

export const CLIP_BRANDS: Partial<Record<BrandId, ClipBrand>> = {
  // productpage.1243667053.html = product 1243667, color 053
  hm: { hosts: ["www2.hm.com"], imageHosts: ["image.hm.com"], productId: /\/productpage\.(\d{7})\d{3}\.html/ },
  uniqlo: { hosts: ["www.uniqlo.com"], imageHosts: ["image.uniqlo.com"], productId: /\/products\/(E?\d{6}-\d{3})/ },
  gu: { hosts: ["www.gu-global.com"], imageHosts: ["image.uniqlo.com", "www.gu-global.com"], productId: /\/products\/(E?\d{6}-\d{3})/ },
  zara: { hosts: ["www.zara.com"], imageHosts: ["static.zara.net"], productId: /-p(\d{8})\.html/ },
};

/** Days a user-submitted product stays listed after its last confirmation. */
export const SUBMISSION_TTL_DAYS = 30;
/** "Gone" reports that hide a user-submitted product before it expires. */
export const REPORTS_TO_HIDE = 2;

/** What the bookmarklet sends (via the URL fragment, so it never reaches a server log). */
export interface ClipPayload {
  v: 1;
  url: string;
  title: string;
  /** Raw JSON-LD script contents. */
  ld: string[];
  /** og:* and description meta tags. */
  meta: Record<string, string>;
  /** Visible page text (innerText). */
  text: string;
  /** Full text including collapsed sections (textContent), for panels like "Materials". */
  hidden: string;
}

/** A product as it will be submitted; every field is editable on the preview page. */
export interface SubmissionInput {
  url: string;
  name: string;
  gender: Gender | null;
  l2: L2 | null;
  price: number | null;
  listPrice: number | null;
  colors: string[];
  priceColor: string | null;
  imageUrl: string | null;
  compositionText: string;
}

export function clipTarget(rawUrl: string): { brand: BrandId; sourceId: string; url: string } | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  for (const [brand, info] of Object.entries(CLIP_BRANDS) as [BrandId, ClipBrand][]) {
    if (!info.hosts.includes(u.hostname)) continue;
    const id = u.pathname.match(info.productId)?.[1];
    return id ? { brand, sourceId: id, url: `${u.origin}${u.pathname}` } : null;
  }
  return null;
}

type Json = Record<string, unknown>;

function ldObjects(ld: string[]): Json[] {
  const out: Json[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") {
      out.push(v as Json);
      if ("@graph" in v) visit((v as Json)["@graph"]);
    }
  };
  for (const s of ld) {
    try {
      visit(JSON.parse(s));
    } catch {
      // a malformed block is skipped
    }
  }
  return out;
}

const isType = (o: Json, t: string) => (Array.isArray(o["@type"]) ? (o["@type"] as string[]).includes(t) : o["@type"] === t);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const firstImage = (v: unknown) => (Array.isArray(v) ? str(v[0]) : str(v)) || null;

interface Variant {
  color: string;
  price: number | null;
  inStock: boolean;
  image: string | null;
}

function variantsOf(group: Json): Variant[] {
  const items = Array.isArray(group.hasVariant) ? (group.hasVariant as Json[]) : [group];
  return items.map((v) => {
    const offer = (Array.isArray(v.offers) ? v.offers[0] : v.offers) as Json | undefined;
    const price = Number(str(offer?.price) || str((offer?.priceSpecification as Json | undefined)?.price));
    const availability = str(offer?.availability);
    return {
      color: str(v.color),
      price: Number.isFinite(price) && price > 0 ? price : null,
      inStock: !availability || /InStock|LimitedAvailability|OnlineOnly/i.test(availability),
      image: firstImage(v.image),
    };
  });
}

/** "100% COTTON RIBBED T-SHIRT" → "100% Cotton Ribbed T-Shirt"; mixed-case names are kept. */
function tidyName(name: string): string {
  return name === name.toUpperCase() ? name.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, s: string, c: string) => s + c.toUpperCase()) : name;
}

function guessGender(p: ClipPayload, group: Json | null, crumbs: string[]): Gender | null {
  const audience = str((group?.audience as Json | undefined)?.suggestedGender).toLowerCase();
  if (audience === "female" || audience === "women") return "women";
  if (audience === "male" || audience === "men") return "men";
  const hay = [crumbs.join(" "), new URL(p.url).pathname, p.title].join(" ").toLowerCase();
  if (/\bwom[ae]n'?s?\b|\/wom[ae]n[/-]/.test(hay)) return "women";
  if (/\bm[ae]n'?s?\b|\/m[ae]n[/-]/.test(hay)) return "men";
  return null;
}

/** The most specific sub-category the lexicon reads in the name, else in the breadcrumbs. */
function guessL2(name: string, crumbs: string[]): L2 | null {
  for (const text of [name, crumbs.slice(-3).join(" ")]) {
    const cats = parseQuery(text).categories;
    const best = [...cats].sort((a, b) => a.l2.length - b.l2.length)[0];
    if (best) return best.l2[0];
  }
  return null;
}

/**
 * Fiber lists in either order — "60% cotton, 40% polyester" and "Cotton 60%, Polyester 40%" —
 * optionally labeled ("Shell: …"). Kept apart so one shape can't swallow the other's words.
 */
const LABEL = "(?:[A-Za-z][\\w ®™'-]{0,30}:\\s*)?";
const FIBER_WORDS = "[A-Za-z][A-Za-z ®™'-]{1,30}";
const PCT = "\\d{1,3}(?:\\.\\d)?\\s?%";
const RUNS = [
  new RegExp(`(?:${LABEL}${PCT}\\s*${FIBER_WORDS}[,/;.\\s]*){1,10}`, "g"),
  new RegExp(`(?:${LABEL}${FIBER_WORDS}?\\s${PCT}[,/;.\\s]*){1,10}`, "g"),
];
const runsIn = (text: string) => RUNS.flatMap((re) => text.match(re) ?? []);
/** Words that end a fiber list ("100% Cotton Imported"). */
const TAIL = /\s*\b(imported|made in|machine|hand wash|wash|care|dry|do not|model|size|fit|origin)\b[\s\S]*$/i;

/** Fiber content from the page: JSON-LD material, then text near a composition heading, then anywhere. */
function findComposition(p: ClipPayload, objects: Json[]): string | null {
  const candidates: string[] = [];
  for (const o of objects) {
    const m = str(o.material);
    if (/\d\s?%/.test(m)) candidates.push(m);
  }
  for (const text of [p.hidden, p.text]) {
    const at = text.search(/\b(composition|materials?|fabric)\b/i);
    if (at >= 0) candidates.push(...runsIn(text.slice(at, at + 800)));
  }
  for (const text of [p.text, p.hidden]) candidates.push(...runsIn(text));
  for (const c of candidates) {
    const cleaned = c.replace(TAIL, "").replace(/[,/;.\s]+$/, "").trim();
    if (cleaned && parseComposition(cleaned).ok) return cleaned;
  }
  return null;
}

/** Turn a clipped page into an editable draft; `missing` lists what the visitor must fill in. */
export function draftFromClip(p: ClipPayload): { input: SubmissionInput; missing: (keyof SubmissionInput)[] } {
  const objects = ldObjects(p.ld);
  const group = objects.find((o) => isType(o, "ProductGroup")) ?? objects.find((o) => isType(o, "Product")) ?? null;
  const crumbs = objects
    .filter((o) => isType(o, "BreadcrumbList"))
    .flatMap((o) => ((o.itemListElement as Json[] | undefined) ?? []).map((i) => str(i.name)));
  const name = tidyName(str(group?.name) || p.meta["og:title"] || p.title.split("|")[0]).trim();
  const variants = group ? variantsOf(group) : [];
  const buyable = variants.filter((v) => v.inStock && v.price !== null);
  const pool = buyable.length ? buyable : variants.filter((v) => v.price !== null);
  const cheapest = pool.reduce<Variant | null>((best, v) => (!best || v.price! < best.price! ? v : best), null);
  const target = clipTarget(p.url);
  const input: SubmissionInput = {
    url: target?.url ?? p.url,
    name,
    gender: guessGender(p, group, crumbs),
    l2: guessL2(name, crumbs),
    price: cheapest?.price ?? null,
    listPrice: null,
    colors: [...new Set(variants.map((v) => v.color).filter(Boolean))].slice(0, 30),
    priceColor: cheapest?.color || null,
    imageUrl: cheapest?.image ?? p.meta["og:image"] ?? null,
    compositionText: findComposition(p, objects) ?? "",
  };
  const missing = (["name", "gender", "l2", "price", "compositionText"] as const).filter((k) => !input[k]);
  return { input, missing };
}

export type SubmissionError =
  | "unsupported_url" | "name" | "gender" | "l2" | "price" | "list_price" | "composition" | "image" | "colors";

export const SUBMISSION_ERROR_COPY: Record<SubmissionError, string> = {
  unsupported_url: "只接受 Uniqlo、GU、Zara、H&M 美國官網的商品頁",
  name: "請填商品名稱",
  gender: "請選女裝或男裝",
  l2: "請選品類",
  price: "價格要在 $1–$2,000 之間",
  list_price: "原價不能低於售價",
  composition: "成分要寫出各纖維的百分比，例如「60% 棉, 40% 聚酯」",
  image: "圖片只能來自品牌官方圖庫",
  colors: "顏色清單格式不正確",
};

/** Shared by the preview page and the API (which never trusts the client's checks). */
export function validateSubmission(raw: unknown):
  | { ok: true; value: SubmissionInput & { brand: BrandId; sourceId: string; gender: Gender; l2: L2; price: number } }
  | { ok: false; errors: SubmissionError[] } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const errors: SubmissionError[] = [];
  const target = typeof r.url === "string" ? clipTarget(r.url) : null;
  if (!target) errors.push("unsupported_url");
  const name = typeof r.name === "string" ? r.name.trim().slice(0, 200) : "";
  if (name.length < 2) errors.push("name");
  const gender = typeof r.gender === "string" && isGender(r.gender) ? r.gender : null;
  if (!gender) errors.push("gender");
  const l2 = typeof r.l2 === "string" && isL2(r.l2) ? r.l2 : null;
  if (!l2) errors.push("l2");
  const price = typeof r.price === "number" && r.price >= 1 && r.price <= 2000 ? Math.round(r.price * 100) / 100 : null;
  if (price === null) errors.push("price");
  const listPrice = r.listPrice == null || r.listPrice === "" ? null : Number(r.listPrice);
  if (listPrice !== null && (!Number.isFinite(listPrice) || (price !== null && listPrice < price))) errors.push("list_price");
  const compositionText = typeof r.compositionText === "string" ? r.compositionText.trim().slice(0, 1000) : "";
  if (!compositionText || !parseComposition(compositionText).ok) errors.push("composition");
  let imageUrl: string | null = null;
  if (typeof r.imageUrl === "string" && r.imageUrl) {
    try {
      const u = new URL(r.imageUrl);
      if (u.protocol === "https:" && target && CLIP_BRANDS[target.brand]!.imageHosts.includes(u.hostname)) imageUrl = u.toString();
      else errors.push("image");
    } catch {
      errors.push("image");
    }
  }
  const colors = Array.isArray(r.colors) ? r.colors : [];
  if (colors.length > 30 || colors.some((c) => typeof c !== "string" || c.length > 40)) errors.push("colors");
  const priceColor = typeof r.priceColor === "string" ? r.priceColor.slice(0, 40) : null;
  if (errors.length || !target || !gender || !l2 || price === null) return { ok: false, errors };
  return {
    ok: true,
    value: {
      brand: target.brand, sourceId: target.sourceId, url: target.url, name, gender, l2, price,
      listPrice: listPrice && listPrice > price ? listPrice : null,
      colors: colors as string[], priceColor, imageUrl, compositionText,
    },
  };
}
