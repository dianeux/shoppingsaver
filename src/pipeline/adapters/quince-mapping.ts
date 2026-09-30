import type { L2 } from "@/domain/taxonomy";

/**
 * Quince → canonical L2 mapping (PRD ch.7: hand-built, versioned).
 * Quince classifies every product as department / subdepartment / class
 * (e.g. "Bottoms / Denim / Pants"). Rules run in order; first match wins.
 * Bump the version on any edit.
 */
export const QUINCE_MAPPING_VERSION = "quince-2026-09-30.1";

export interface QuinceClassification {
  department?: string | null;
  subdepartment?: string | null;
  class?: string | null;
}

export type QuinceMapping = { l2: L2 } | { excluded: string } | null;

export function mapQuinceCategory(title: string, c: QuinceClassification): QuinceMapping {
  const dept = c.department ?? "";
  const sub = c.subdepartment ?? "";
  const cls = c.class ?? "";
  const t = title.toLowerCase();

  // Multipacks don't share a price basis with single items (same rule as Pact).
  if (/\b\d+-pack\b/.test(t)) return { excluded: "multipack" };
  // Men's swim trunks sit under Bottoms / Shorts; swimwear is outside the taxonomy either way.
  if (/\bswim\b/.test(t)) return { excluded: "swimwear" };

  switch (dept) {
    case "Swimwear":
      return { excluded: "swimwear" }; // not in the canonical taxonomy
    case "Sweaters":
      return { l2: "sweaters-knits" };
    case "Knit Tops":
      return { l2: "tshirts" };
    case "Woven Tops":
      return { l2: "shirts-blouses" };
    case "Bottoms":
      if (sub === "Denim" || /\bjeans?\b/.test(t)) return { l2: "jeans" };
      return { l2: cls === "Shorts" ? "shorts" : "pants" };
    case "Outerwear":
      if (sub === "Down" || /\bpuffer\b/.test(t)) return { l2: "down-padded" };
      if (cls === "Coat" || /\b(coat|trench|parka)\b/.test(t)) return { l2: "coats" };
      return { l2: "jackets" };
    case "Dresses and Skirts":
      if (sub === "Bridesmaids") return { l2: "formal" };
      if (cls === "Skirts") return { l2: "skirts" };
      if (cls === "Jumpsuits") return { l2: "jumpsuits" };
      return { l2: "dresses" };
    case "Active":
      return { l2: sub === "Bottoms" ? "active-bottoms" : "active-tops" };
    case "Lounge":
      return { l2: cls === "Pajamas" ? "pajamas" : "loungewear" };
    case "Intimates":
      if (cls === "Bralette") return { l2: "bras" };
      if (cls === "Underwear") return { l2: "underwear" };
      return { l2: "base-layers" };
    default:
      return null;
  }
}
