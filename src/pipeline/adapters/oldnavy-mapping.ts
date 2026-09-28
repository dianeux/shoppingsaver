import type { L2 } from "@/domain/taxonomy";

/**
 * Old Navy → canonical L2 mapping (PRD ch.7: hand-built, versioned).
 * The search API tags each colorway with a sub-category ("T-Shirts & Tanks",
 * "Coats & Jackets"…) and each style with a webProductType. Rules run in order.
 * Bump the version on any edit.
 */
export const OLDNAVY_MAPPING_VERSION = "oldnavy-2026-09-27.1";

export interface OldNavyStyleInfo {
  name: string;
  subCategory: string | null;
  webProductType: string | null;
  subBrand: string | null;
}

export type OldNavyMapping = { l2: L2 } | { excluded: string } | null;

const ACTIVE_BOTTOM = /\b(leggings?|shorts|joggers?|pants|skort|skirt|tights|capris?)\b/;

export function mapOldNavyCategory({ name, subCategory, webProductType, subBrand }: OldNavyStyleInfo): OldNavyMapping {
  const t = name.toLowerCase();
  const wpt = (webProductType ?? "").toLowerCase();

  // Multipacks don't share a price basis with single items (same rule as Pact and Quince).
  if (/\b\d+-pack\b/.test(t)) return { excluded: "multipack" };
  // Third-party dropship sellers and licensed men's/kids' merch are outside the product (PRD ch.5).
  if (wpt === "dropship") return { excluded: "marketplace seller" };
  if (/^(mens|toddler|baby|boys|girls|home)\b/.test(wpt) || /\bfor (men|boys|girls|kids|toddlers?)\b/.test(t)) return { excluded: "not women's" };
  if (/\b(shoes|boots|sandals|flip flops)\b/.test(wpt) || subCategory === "Shoes") return { excluded: "footwear" };
  if (/swim/.test(wpt) || subCategory === "Swimsuits") return { excluded: "swimwear" };

  // Old Navy's own activewear line.
  if (subBrand === "ON_SPORT" || subCategory === "Activewear" || wpt === "womens activewear") {
    if (/\b(bra|bralette)\b/.test(t)) return { l2: "bras" };
    return { l2: ACTIVE_BOTTOM.test(t) ? "active-bottoms" : "active-tops" };
  }

  switch (subCategory) {
    case "T-Shirts & Tanks":
      return { l2: /\bpolo\b/.test(t) ? "polos" : "tshirts" };
    case "Blouses":
    case "Button-Down Shirts":
      return { l2: "shirts-blouses" };
    case "Sweaters & Cardigans":
      return { l2: "sweaters-knits" };
    case "Sweatshirts & Hoodies":
      return { l2: "sweatshirts-hoodies" };
    case "Jeans":
      return { l2: /\bshorts\b/.test(t) ? "shorts" : /\bskirt\b/.test(t) ? "skirts" : "jeans" };
    case "Pants":
    case "Sweatpants":
    case "Fashion Leggings":
      return { l2: "pants" };
    case "Shorts":
      return { l2: "shorts" };
    case "Skirts & Skorts":
      return { l2: "skirts" };
    case "Dresses & Jumpsuits":
      return { l2: /\b(jumpsuit|romper|overalls?)\b/.test(t) ? "jumpsuits" : "dresses" };
    case "Coats & Jackets":
    case "Puffer Jackets & Vests":
      if (/\b(puffer|quilted|down)\b/.test(t)) return { l2: "down-padded" };
      if (/\b(coat|trench|parka)\b/.test(t)) return { l2: "coats" };
      return { l2: "jackets" };
    case "Bras & Underwear":
      if (/\b(bra|bralette)s?\b/.test(t)) return { l2: "bras" };
      if (/\b(bodysuit|cami|camisole|slip|tank)\b/.test(t)) return { l2: "base-layers" };
      return { l2: "underwear" };
    case "Pajamas":
      return { l2: /\blounge\b/.test(t) ? "loungewear" : "pajamas" };
    case "Socks & Tights":
      return { l2: "socks" };
    case "Bags & Accessories":
      if (/\b(bag|tote|backpack|crossbody|clutch|purse)\b/.test(t)) return { l2: "bags" };
      if (/\b(hat|beanie|cap|bucket)\b/.test(t)) return { l2: "hats" };
      if (/\b(scarf|bandana)\b/.test(t)) return { l2: "scarves" };
      return { excluded: "accessory outside taxonomy" };
    default:
      return null;
  }
}
