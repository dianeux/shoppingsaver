import type { L2 } from "@/domain/taxonomy";

/**
 * Accessory type from a product title, shared by every brand's mapping.
 * Order matters: bags first ("Belt Bag", "Ring Handle Bag"), hair before hats.
 * Returns "excluded" for accessories outside the taxonomy (keychains, wallets…)
 * and null when the title doesn't look like an accessory at all.
 */
export function accessoryFromTitle(title: string): L2 | "excluded" | null {
  const t = title.toLowerCase();
  if (/\b(sunglass(es)?|shades)\b/.test(t)) return "sunglasses";
  if (/\b(keychain|key ring|bag charm|card holder|cardholder|wallet|coin purse|pins?|stockings?|umbrella|water bottle|cosmetic bag|lanyard|baby bundle)\b/.test(t)) return "excluded";
  if (/\b(bag|tote|backpack|crossbody|clutch|purse|duffle|duffel|sling|satchel|hobo)s?\b/.test(t)) return "bags";
  if (/\b(headbands?|scrunchies?|barrettes?|claw clips?|hair (clips?|ties?|bands?|claws?|accessor\w*))\b/.test(t)) return "jewelry-hair";
  if (/\b(gloves?|mittens?)\b/.test(t)) return "gloves";
  if (/\bbelts?\b/.test(t)) return "belts";
  if (/\b(earrings?|necklaces?|bracelets?|rings?|hoops?|studs?|pendants?|anklets?|jewelry|cuffs?)\b/.test(t)) return "jewelry-hair";
  if (/\b(hats?|beanies?|caps?|visors?|fedoras?|berets?|balaclavas?)\b/.test(t)) return "hats";
  if (/\b(scarf|scarves|bandanas?|wraps?|snoods?|stoles?)\b/.test(t)) return "scarves";
  if (/\b(socks?|tights)\b/.test(t)) return "socks";
  return null;
}

/** Mapping result for an accessory title, or a fallback when it isn't recognized. */
export function accessoryMapping(title: string, fallback: { l2: L2 } | { excluded: string } | null = { excluded: "accessory outside taxonomy" }) {
  const a = accessoryFromTitle(title);
  if (a === "excluded") return { excluded: "accessory outside taxonomy" } as const;
  return a ? ({ l2: a } as const) : fallback;
}
