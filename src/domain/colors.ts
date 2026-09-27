/**
 * Color families (PRD ch.8: 12–16 normalized families). Brand color names are
 * kept as-is for display; the family is only for filtering.
 */
export const COLOR_FAMILIES = [
  "black", "white", "gray", "beige", "brown", "navy", "blue", "green",
  "red", "pink", "purple", "yellow", "orange", "pattern",
] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number];

export const COLOR_FAMILY_LABEL: Record<ColorFamily, { label: string; swatch: string }> = {
  black: { label: "黑", swatch: "#1d1d1f" },
  white: { label: "白", swatch: "#f7f5f0" },
  gray: { label: "灰", swatch: "#9a9a9a" },
  beige: { label: "米", swatch: "#d9c7a7" },
  brown: { label: "棕", swatch: "#7a5234" },
  navy: { label: "深藍", swatch: "#1f2a4d" },
  blue: { label: "藍", swatch: "#4f7cc4" },
  green: { label: "綠", swatch: "#5f7d4f" },
  red: { label: "紅", swatch: "#b8322f" },
  pink: { label: "粉", swatch: "#e7a3b3" },
  purple: { label: "紫", swatch: "#7d5aa6" },
  yellow: { label: "黃", swatch: "#e8c547" },
  orange: { label: "橘", swatch: "#e0833a" },
  pattern: { label: "花紋", swatch: "conic-gradient(#b8322f 0 25%, #4f7cc4 0 50%, #e8c547 0 75%, #5f7d4f 0)" },
};

// Checked in order; first hit wins. More specific words come first
// ("navy" before "blue", "off white" before "white", "rose" before "red").
const RULES: [RegExp, ColorFamily][] = [
  [/\b(stripe[sd]?|striped|border|check(ed)?|plaid|gingham|print(ed)?|floral|dot(s|ted)?|pattern|leopard|camo|multi|houndstooth|argyle|tie[- ]?dye|jacquard|paisley|ditsy|spots|flora|petals?|leaves|patch)\b/, "pattern"],
  // Brand print names that don't say "print" (checked against the swatch image).
  [/\b(dayspring|contrast|grain|stems|diamonds)\b/, "pattern"],
  [/\b(navy|midnight|indigo|dark blue|marine|admiral)\b/, "navy"],
  [/\b(off[- ]?white|ivory|cream|ecru|kinari|natural|snow|chalk|bone|vanilla|porcelain|whiteout|frost|white)\b/, "white"],
  [/\b(charcoal|heather|gr[ae]y|silver|ash|slate|graphite|smoke|smoky gray|stone gray|cinder|flagstone|coal|shale|greyed)\b/, "gray"],
  [/\b(black|jet|onyx|ink|noir)\b/, "black"],
  [/\b(beige|oatmeal|oat|sand|khaki|camel|tan|taupe|greige|mushroom|ecru|flax|linen|nude|biscuit|wheat|light brown|oak|sesame|champagne|parchment|oyster|latte|cortado|cafe au lait|almond|driftwood|sugar stone|oatmilk|vicuna)\b/, "beige"],
  [/\b(brown|mocha|chocolate|coffee|espresso|cocoa|chestnut|rust|cognac|caramel|walnut|umber|sienna|tobacco|brick brown|fudge|toffee|pecan|teak|fig|mink|morel|clay|baywood)\b/, "brown"],
  [/\b(blue|denim|sky|azure|cobalt|teal|aqua|turquoise|cyan|sax|chambray|powder blue|steel|celestial|ocean|rinse|wash|woodstock)\b/, "blue"],
  [/\b(green|olive|sage|khaki green|forest|mint|moss|emerald|jade|pistachio|lime|army|seagrass|agave|aloe|artichoke|caper|spruce|evergreen|loden|seaweed|pine|cargo)\b/, "green"],
  [/\b(pink|rose|blush|coral pink|salmon|fuchsia|magenta|peach|ballet slipper|dogwood|rhubarb)\b/, "pink"],
  [/\b(red|burgundy|wine|bordeaux|maroon|brick|cherry|crimson|scarlet|ruby|raspberry|oxblood|chile|merlot)\b/, "red"],
  [/\b(purple|lavender|lilac|violet|plum|mauve|grape|orchid|aubergine)\b/, "purple"],
  [/\b(yellow|mustard|lemon|gold|butter|ochre|citron|canary)\b/, "yellow"],
  [/\b(orange|terracotta|apricot|tangerine|coral|pumpkin|copper|amber)\b/, "orange"],
];

/** Returns null when no rule matches; callers log these to tune the rules (target ≥ 90% accuracy). */
export function colorFamily(raw: string): ColorFamily | null {
  const name = raw.toLowerCase().replace(/[_/]+/g, " ");
  for (const [re, fam] of RULES) if (re.test(name)) return fam;
  return null;
}
