import type { L2 } from "@/domain/taxonomy";

/**
 * Muji → canonical L2 mapping (PRD ch.7: hand-built, versioned, never decided by the LLM).
 * Muji's product_type is coarse ("Women's Tops"), so rules combine it with tags.
 * Rules are checked in order; the first match wins. Bump the version on any edit.
 */
export const MUJI_MAPPING_VERSION = "muji-2026-09-26.2";

interface Rule {
  productType: RegExp;
  anyTag?: string[];
  l2: L2;
}

const RULES: Rule[] = [
  // Dresses
  { productType: /^Women's Dresses$/, anyTag: ["jumpsuit", "romper", "salopette"], l2: "jumpsuits" },
  { productType: /^Women's Dresses$/, l2: "dresses" },

  // Outerwear
  { productType: /^Women's Outerwear$/, anyTag: ["Down Jacket", "Down Vest", "Padded", "Series_Lightweight Down", "quilted"], l2: "down-padded" },
  { productType: /^Women's Outerwear$/, anyTag: ["Coat"], l2: "coats" },
  { productType: /^Women's Outerwear$/, l2: "jackets" },

  // Bottoms
  { productType: /^Women's Bottoms$/, anyTag: ["Jeans", "Denim Pants", "Type_Denim Pants", "Women's Denim"], l2: "jeans" },
  { productType: /^Women's Bottoms$/, anyTag: ["Skirt", "midi skirt"], l2: "skirts" },
  { productType: /^Women's Bottoms$/, anyTag: ["Shorts"], l2: "shorts" },
  { productType: /^Women's Bottoms$/, l2: "pants" },

  // Tops — most specific first
  { productType: /^Women's Tops$/, anyTag: ["Hoodies & Sweatshirts", "Sweatshirt", "Zip Hoody", "Zip Up Hoodie", "Sweatshirts & Sweatpants"], l2: "sweatshirts-hoodies" },
  { productType: /^Women's Tops$/, anyTag: ["Sweaters & Cardigans", "Sweater", "Cardigan", "Knitwear", "Washable Sweater", "Washable Knit", "sweater vest", "Spring Knitwear"], l2: "sweaters-knits" },
  { productType: /^Women's Tops$/, anyTag: ["Polo"], l2: "polos" },
  { productType: /^Women's Tops$/, anyTag: ["Shirt", "Blouse", "Flannel", "button up"], l2: "shirts-blouses" },
  { productType: /^Women's Tops$/, anyTag: ["T-Shirt", "Long Sleeve T-Shirt", "Tank Top", "Sleeveless"], l2: "tshirts" },

  // Innerwear
  { productType: /^Women's Innerwear$/, anyTag: ["Bra", "Built-In Bra Tanks", "wireless bra", "Seamless Bra", "pullover bra"], l2: "bras" },
  { productType: /^Women's Innerwear$/, anyTag: ["Underwear", "underwear", "panties", "boy shorts", "Category_Panties"], l2: "underwear" },
  { productType: /^Women's Innerwear$/, l2: "base-layers" },

  // Loungewear
  { productType: /^Women's Loungewear$/, anyTag: ["Pajamas", "Summer Pajamas", "Long Sleeve Pajamas", "Short Sleeve Pajamas"], l2: "pajamas" },
  { productType: /^Women's Loungewear$/, l2: "loungewear" },

  // Accessories (unisex on Muji)
  { productType: /^Socks$/, l2: "socks" },
  { productType: /^Winter Accessories$/, anyTag: ["Scarves & Stoles", "scarf", "Stoles", "Wool Woven Scarf", "blanket scarf", "Neck Warmer", "neck gaiter"], l2: "scarves" },
];

/**
 * Fallback when no tag rule matches: many items (especially clearance) carry no
 * category tag at all. Scoped by product_type; order matters ("T-Shirt" before "Shirt",
 * "Sweatshirt Cardigan" is a sweatshirt, "Camisole Blouse" is a blouse).
 */
const TITLE_RULES: { productType: RegExp; title: RegExp; l2: L2 | "excluded" }[] = [
  { productType: /^Women's Tops$/, title: /\bjumpsuit\b/i, l2: "jumpsuits" },
  { productType: /^Women's Tops$/, title: /\bdress\b/i, l2: "dresses" },
  { productType: /^Women's Tops$/, title: /\b(jacket|vest|gilet)\b/i, l2: "jackets" },
  { productType: /^Women's Tops$/, title: /\b(sweatshirt|hoodie|hoody|fleece)\b/i, l2: "sweatshirts-hoodies" },
  { productType: /^Women's Tops$/, title: /\b(sweater|cardigan|knit)\b/i, l2: "sweaters-knits" },
  { productType: /^Women's Tops$/, title: /\b(t-shirt|tee|tank top)\b/i, l2: "tshirts" },
  { productType: /^Women's Tops$/, title: /\bjersey\b/i, l2: "tshirts" },
  { productType: /^Women's Tops$/, title: /\bpullover\b/i, l2: "sweatshirts-hoodies" },
  { productType: /^Women's Tops$/, title: /\b(shirt|blouse|tunic)\b/i, l2: "shirts-blouses" },
  { productType: /^Women's Tops$/, title: /\bcamisole\b/i, l2: "tshirts" },
  { productType: /^Winter Accessories$/, title: /\b(beanie|hat|cap)\b/i, l2: "hats" },
  { productType: /^Winter Accessories$/, title: /\b(scarf|stole|muffler|snood)\b/i, l2: "scarves" },
  // Not in the canonical taxonomy (PRD ch.7) — excluded on purpose, so they don't raise alerts.
  { productType: /^Winter Accessories$/, title: /\b(gloves?|mittens?|earmuffs?)\b/i, l2: "excluded" },
];

export type MujiMapping = { l2: L2 } | { excluded: true } | null;

export function mapMujiCategory(productType: string, tags: string[], title = ""): MujiMapping {
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));
  for (const r of RULES) {
    if (!r.productType.test(productType)) continue;
    if (r.anyTag && !r.anyTag.some((t) => tagSet.has(t.toLowerCase()))) continue;
    return { l2: r.l2 };
  }
  for (const r of TITLE_RULES) {
    if (r.productType.test(productType) && r.title.test(title)) return r.l2 === "excluded" ? { excluded: true } : { l2: r.l2 };
  }
  return null;
}

/** Muji sells some accessories as unisex; men-only items are tagged. */
export function isMujiWomen(productType: string, tags: string[]): boolean {
  if (/^Men's/.test(productType)) return false;
  if (/^Women's/.test(productType)) return true;
  return !tags.includes("Size_Men");
}
