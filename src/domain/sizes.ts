/** Normalized size labels, in display order. */
const LETTER_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

const ALIASES: Record<string, string> = {
  "2XS": "XXS", "XX-SMALL": "XXS", "X-SMALL": "XS", "EXTRA SMALL": "XS", SMALL: "S", MEDIUM: "M",
  LARGE: "L", "X-LARGE": "XL", "EXTRA LARGE": "XL", "2XL": "XXL", "XX-LARGE": "XXL", XXXL: "3XL",
  "ONE SIZE": "ONE SIZE", OS: "ONE SIZE", "O/S": "ONE SIZE", FREE: "ONE SIZE",
};

export function normalizeSize(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, " ");
  if (ALIASES[s]) return ALIASES[s];
  if (LETTER_ORDER.includes(s)) return s;
  // Muji socks "23-25cm", waist sizes "26", etc. stay as-is.
  return s;
}

function rank(size: string): number {
  const i = LETTER_ORDER.indexOf(size);
  if (i >= 0) return i;
  const n = parseFloat(size);
  return Number.isFinite(n) ? 100 + n : 1000;
}

export function sortSizes(sizes: Iterable<string>): string[] {
  return [...new Set(sizes)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
