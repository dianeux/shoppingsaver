import type { L2 } from "@/domain/taxonomy";

/**
 * Pact → canonical L2 mapping (PRD ch.7: hand-built, versioned).
 * Every Pact colorway carries a list of its site categories ("all bottoms",
 * "pants", "sweatpants"…) plus a collection code. Rules run in order; first match wins.
 * Bump the version on any edit.
 */
export const PACT_MAPPING_VERSION = "pact-2026-09-27.1";

/** Pact's own movement line — its pieces go to the Sports (activewear) group. */
const ACTIVE_COLLECTIONS = new Set(["W-ONTHGO"]);

export interface PactStyleInfo {
  name: string;
  categories: string[];
  collectionCode: string | null;
  packSize: number;
}

export type PactMapping = { l2: L2 } | { excluded: string } | null;

export function mapPactCategory({ name, categories, collectionCode, packSize }: PactStyleInfo): PactMapping {
  const has = (...c: string[]) => c.some((x) => categories.includes(x));
  const title = name.toLowerCase();

  // Multipacks and sets share a style code with the single item but not its price basis.
  if (packSize > 1 || /\b\d+-pack\b|\bset\b|\bbundle\b/.test(title)) return { excluded: "multipack" };

  if (has("socks")) return { l2: "socks" };
  if (has("bags & hats")) return { l2: /\b(hat|cap|beanie)\b/.test(title) ? "hats" : "bags" };
  if (has("bras")) return { l2: "bras" };
  if (has("undies")) return { l2: "underwear" };

  if (collectionCode && ACTIVE_COLLECTIONS.has(collectionCode)) {
    return { l2: has("leggings", "pants", "shorts", "skirts", "all bottoms") ? "active-bottoms" : "active-tops" };
  }

  if (has("dresses")) return { l2: /\b(jumpsuit|romper|overall)\b/.test(title) ? "jumpsuits" : "dresses" };
  if (has("sleepwear", "sleep tops", "sleep bottoms")) return { l2: /\b(sleep|pajama|pj)\b/.test(title) ? "pajamas" : "loungewear" };
  if (has("skirts")) return { l2: "skirts" };
  if (has("shorts")) return { l2: "shorts" };
  if (has("pants", "sweatpants", "leggings")) return { l2: "pants" };
  if (has("hoodies & sweatshirts", "sweatshirts & hoodies")) return { l2: "sweatshirts-hoodies" };
  if (has("sweaters", "cardigans")) return { l2: "sweaters-knits" };
  if (has("jackets")) return { l2: "jackets" };
  if (has("tees", "tees & tanks")) return { l2: "tshirts" };
  if (has("tops & shirts")) return { l2: "shirts-blouses" };
  return null;
}
