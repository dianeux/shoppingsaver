import type { L2 } from "@/domain/taxonomy";

/**
 * Everlane → canonical L2 mapping (PRD ch.7: hand-built, versioned).
 * Everlane sets a Shopify product_type plus a "subcategory: …" tag. Collaboration
 * items come with an empty product_type and fall back to the title.
 * Bump the version on any edit.
 */
export const EVERLANE_MAPPING_VERSION = "everlane-2026-09-29.1";

export type EverlaneMapping = { l2: L2 } | { excluded: string } | null;

const NOT_APPAREL = new Set(["Flats + Other", "Sandals", "Boots", "Footwear", "Swimwear"]);

function outerwear(title: string): L2 {
  if (/\b(puffer|down|quilted)\b/.test(title)) return "down-padded";
  if (/\b(?:over|top)?coat\b|\b(trench|parka)\b/.test(title)) return "coats";
  return "jackets";
}

function byTitle(title: string): EverlaneMapping {
  if (/\b(mary jane|flat|sandal|boot|sneaker|loafer|heel)s?\b/.test(title)) return { excluded: "footwear" };
  if (/\b(mat|journal|candle|mug|pillow|blanket|notebook)s?\b/.test(title)) return { excluded: "not apparel" };
  if (/\b(sweatshirt|hoodie)\b/.test(title)) return { l2: "sweatshirts-hoodies" };
  if (/\bjeans?\b/.test(title)) return { l2: "jeans" };
  if (/\b(sweatpants?|joggers?)\b/.test(title)) return { l2: "pants" };
  if (/\b(pants?|trousers?)\b/.test(title)) return { l2: "pants" };
  if (/\b(skirt|skort)\b/.test(title)) return { l2: "skirts" };
  if (/\bshorts?\b(?!\s+sleeve)/.test(title)) return { l2: "shorts" };
  if (/\bdress\b/.test(title)) return { l2: "dresses" };
  if (/\b(shirt|button-up|blouse)\b/.test(title)) return { l2: "shirts-blouses" };
  if (/\b(sweater|cardigan)\b/.test(title)) return { l2: "sweaters-knits" };
  if (/\b(tee|tank)\b/.test(title)) return { l2: "tshirts" };
  if (/\b(scarf|bandana)\b/.test(title)) return { l2: "scarves" };
  if (/\b(tote|bag|backpack|crossbody)\b/.test(title)) return { l2: "bags" };
  if (/\b(beanie|hat|cap)\b/.test(title)) return { l2: "hats" };
  if (/\b(jacket|coat|blazer)\b/.test(title)) return { l2: outerwear(title) };
  return null;
}

export function mapEverlaneCategory(productType: string, subcategory: string | null, rawTitle: string): EverlaneMapping {
  const title = rawTitle.toLowerCase();
  const sub = subcategory?.toLowerCase() ?? null;
  if (NOT_APPAREL.has(productType)) return { excluded: productType === "Swimwear" ? "swimwear" : "footwear" };
  switch (productType) {
    case "Knit Tops":
      if (sub === "sweatshirts" || /\b(sweatshirt|hoodie)\b/.test(title)) return { l2: "sweatshirts-hoodies" };
      if (sub === "bodysuits") return { l2: "base-layers" };
      if (/\bpolo\b/.test(title)) return { l2: "polos" };
      return { l2: "tshirts" };
    case "Sweaters":
      return { l2: "sweaters-knits" };
    case "Woven Tops":
    case "Shirting": // men's
      return { l2: "shirts-blouses" };
    case "Bottoms":
      if (sub === "shorts") return { l2: "shorts" };
      if (sub === "skirts") return { l2: "skirts" };
      if (sub === "active") return { l2: "active-bottoms" };
      return { l2: "pants" };
    case "Denim":
      if (sub === "shorts") return { l2: "shorts" };
      if (sub === "skirts") return { l2: "skirts" };
      if (/\bjacket\b/.test(title)) return { l2: "jackets" };
      return { l2: "jeans" };
    case "Dresses":
      return { l2: sub === "jumpsuits" || /\b(jumpsuit|romper)\b/.test(title) ? "jumpsuits" : "dresses" };
    case "Outerwear":
      return { l2: sub === "blazers" ? "jackets" : outerwear(title) };
    case "Body":
      if (sub === "bras") return { l2: "bras" };
      if (sub === "underwear") return { l2: "underwear" };
      return { l2: "base-layers" };
    case "Bags":
      return { l2: "bags" };
    case "Accessories":
      if (sub === "scarves") return { l2: "scarves" };
      if (sub === "beanies" || sub === "hats") return { l2: "hats" };
      return null;
    case "":
      return byTitle(title);
    default:
      return null;
  }
}
