import type { Gender } from "@/domain/gender";
import type { L2 } from "@/domain/taxonomy";

/**
 * Muji → canonical L2 mapping (PRD ch.7: hand-built, versioned, never decided by the LLM).
 * Muji's product_type is coarse ("Women's Tops", "Men's Tops"), so rules combine it
 * with tags; the same rules serve both sections.
 * Rules are checked in order; the first match wins. Bump the version on any edit.
 */
export const MUJI_MAPPING_VERSION = "muji-2026-09-29.1";

interface Rule {
  productType: RegExp;
  anyTag?: string[];
  l2: L2;
}

const RULES: Rule[] = [
  // Dresses
  { productType: /^(?:Wom|M)en's Dresses$/, anyTag: ["jumpsuit", "romper", "salopette"], l2: "jumpsuits" },
  { productType: /^(?:Wom|M)en's Dresses$/, l2: "dresses" },

  // Outerwear
  { productType: /^(?:Wom|M)en's Outerwear$/, anyTag: ["Down Jacket", "Down Vest", "Padded", "Series_Lightweight Down", "quilted"], l2: "down-padded" },
  { productType: /^(?:Wom|M)en's Outerwear$/, anyTag: ["Coat"], l2: "coats" },
  { productType: /^(?:Wom|M)en's Outerwear$/, l2: "jackets" },

  // Bottoms
  { productType: /^(?:Wom|M)en's Bottoms$/, anyTag: ["Jeans", "Denim Pants", "Type_Denim Pants", "Women's Denim"], l2: "jeans" },
  { productType: /^(?:Wom|M)en's Bottoms$/, anyTag: ["Skirt", "midi skirt"], l2: "skirts" },
  { productType: /^(?:Wom|M)en's Bottoms$/, anyTag: ["Shorts"], l2: "shorts" },
  { productType: /^(?:Wom|M)en's Bottoms$/, l2: "pants" },

  // Tops — most specific first
  { productType: /^(?:Wom|M)en's Tops$/, anyTag: ["Hoodies & Sweatshirts", "Sweatshirt", "Zip Hoody", "Zip Up Hoodie", "Sweatshirts & Sweatpants"], l2: "sweatshirts-hoodies" },
  { productType: /^(?:Wom|M)en's Tops$/, anyTag: ["Sweaters & Cardigans", "Sweater", "Cardigan", "Knitwear", "Washable Sweater", "Washable Knit", "sweater vest", "Spring Knitwear"], l2: "sweaters-knits" },
  { productType: /^(?:Wom|M)en's Tops$/, anyTag: ["Polo"], l2: "polos" },
  { productType: /^(?:Wom|M)en's Tops$/, anyTag: ["Shirt", "Blouse", "Flannel", "button up"], l2: "shirts-blouses" },
  { productType: /^(?:Wom|M)en's Tops$/, anyTag: ["T-Shirt", "Long Sleeve T-Shirt", "Tank Top", "Sleeveless"], l2: "tshirts" },

  // Innerwear
  { productType: /^(?:Wom|M)en's Innerwear$/, anyTag: ["Bra", "Built-In Bra Tanks", "wireless bra", "Seamless Bra", "pullover bra"], l2: "bras" },
  { productType: /^(?:Wom|M)en's Innerwear$/, anyTag: ["Underwear", "underwear", "panties", "boy shorts", "Category_Panties"], l2: "underwear" },
  { productType: /^(?:Wom|M)en's Innerwear$/, l2: "base-layers" },

  // Loungewear
  { productType: /^(?:Wom|M)en's Loungewear$/, anyTag: ["Pajamas", "Summer Pajamas", "Long Sleeve Pajamas", "Short Sleeve Pajamas"], l2: "pajamas" },
  { productType: /^(?:Wom|M)en's Loungewear$/, l2: "loungewear" },

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
  { productType: /^(?:Wom|M)en's Tops$/, title: /\bjumpsuit\b/i, l2: "jumpsuits" },
  { productType: /^(?:Wom|M)en's Tops$/, title: /\bdress\b/i, l2: "dresses" },
  { productType: /^(?:Wom|M)en's Tops$/, title: /\b(jacket|vest|gilet)\b/i, l2: "jackets" },
  { productType: /^(?:Wom|M)en's Tops$/, title: /\b(sweatshirt|hoodie|hoody|fleece)\b/i, l2: "sweatshirts-hoodies" },
  { productType: /^(?:Wom|M)en's Tops$/, title: /\b(sweater|cardigan|knit)\b/i, l2: "sweaters-knits" },
  { productType: /^(?:Wom|M)en's Tops$/, title: /\b(t-shirt|tee|tank top)\b/i, l2: "tshirts" },
  { productType: /^(?:Wom|M)en's Tops$/, title: /\bjersey\b/i, l2: "tshirts" },
  { productType: /^(?:Wom|M)en's Tops$/, title: /\bpullover\b/i, l2: "sweatshirts-hoodies" },
  { productType: /^(?:Wom|M)en's Tops$/, title: /\b(shirt|blouse|tunic)\b/i, l2: "shirts-blouses" },
  { productType: /^(?:Wom|M)en's Tops$/, title: /\bcamisole\b/i, l2: "tshirts" },
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

/** Sections a product belongs to. Accessories are mostly unisex (both); gendered ones are tagged. */
export function mujiGenders(productType: string, tags: string[]): Gender[] {
  if (/^Men's/.test(productType) || tags.includes("Size_Men")) return ["men"];
  if (/^Women's/.test(productType) || tags.includes("Size_Women")) return ["women"];
  return ["women", "men"];
}
