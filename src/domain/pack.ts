/**
 * Multipacks ("Crew Socks 6-Pack", "3-Pack Boxer Briefs") are compared by unit
 * price: the card shows the pack price, scores and price sorting use price ÷ pack size.
 */
const PATTERNS = [/\b(\d{1,2})\s*-?\s*pack\b/i, /\bpack of (\d{1,2})\b/i, /\bset of (\d{1,2})\b/i];

/** Number of identical items in a listing, from its name; 1 when it's a single item. */
export function packSizeOf(name: string): number {
  for (const re of PATTERNS) {
    const n = Number(name.match(re)?.[1]);
    if (n >= 2 && n <= 24) return n;
  }
  return 1;
}

/** Price of one item in the pack. */
export const unitPrice = (price: number, packSize: number) => price / Math.max(1, packSize);
