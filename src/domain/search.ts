import type { BrandId } from "./brands";
import type { ColorFamily } from "./colors";
import type { Fiber } from "./materials";
import type { L2 } from "./taxonomy";

/**
 * Semantic search with a curated fashion lexicon (no model, no API): a query
 * like "50元以下純棉白色低胸T恤" is split into hard filters (category, color,
 * fiber, brand, price) and style terms that expand into English phrases matched
 * against product names and descriptions ("低胸" → deep v-neck, scoop neck…,
 * but not boatneck or crew neck). Unknown words are reported, not ignored.
 */

interface CategoryEntry { kind: "category"; label: string; l2: L2[] }
interface StyleEntry { kind: "style"; label: string; include: string[]; exclude?: string[] }
interface ColorEntry { kind: "color"; label: string; families: ColorFamily[] }
interface FiberEntry { kind: "fiber"; label: string; fibers: Fiber[]; minPct?: number }
interface BrandEntry { kind: "brand"; label: string; brand: BrandId }
type Entry = CategoryEntry | StyleEntry | ColorEntry | FiberEntry | BrandEntry;

const category = (label: string, l2: L2[]): CategoryEntry => ({ kind: "category", label, l2 });
const style = (label: string, include: string[], exclude?: string[]): StyleEntry => ({ kind: "style", label, include, exclude });
const color = (label: string, ...families: ColorFamily[]): ColorEntry => ({ kind: "color", label, families });
const fiber = (label: string, fibers: Fiber[], minPct?: number): FiberEntry => ({ kind: "fiber", label, fibers, minPct });
const brand = (label: string, b: BrandId): BrandEntry => ({ kind: "brand", label, brand: b });

const TOPS: L2[] = ["tshirts", "shirts-blouses", "sweaters-knits", "sweatshirts-hoodies", "polos"];
const OUTER: L2[] = ["jackets", "coats", "down-padded"];

const LOW_NECK = ["deep v", "v neck", "vneck", "scoop", "square neck", "u neck", "sweetheart", "plunge", "plunging", "low cut", "cowl", "off the shoulder", "one shoulder"];
const HIGH_NECK = ["turtleneck", "turtle neck", "mock neck", "mockneck", "high neck", "funnel neck", "funnel"];
const CREW = ["crew", "crewneck", "crew neck"];
const BOAT = ["boatneck", "boat neck"];
const V = ["v neck", "vneck", "deep v"];

/** Neckline words, so a style can exclude the necklines that contradict it when the name states one. */
const necklinesExcept = (...keep: string[][]) => [LOW_NECK, HIGH_NECK, CREW, BOAT].flat().filter((w) => !keep.flat().includes(w));

/** Words users type → meaning. Longer terms win ("深藍" before "藍", "短褲" before "短T"). */
const LEXICON: [string[], Entry][] = [
  // Categories
  [["t恤", "t-shirt", "tshirt", "tshirts", "t shirt", "tee", "tees", "短t", "tank", "背心"], category("T 恤", ["tshirts"])],
  [["上衣", "top", "tops"], category("上衣", TOPS)],
  [["襯衫", "shirt", "shirts", "blouse", "blouses", "女衫"], category("襯衫與上衣", ["shirts-blouses"])],
  [["毛衣", "針織", "針織衫", "開襟衫", "sweater", "sweaters", "cardigan", "cardigans", "knit"], category("毛衣與針織", ["sweaters-knits"])],
  [["衛衣", "帽t", "連帽", "大學t", "hoodie", "hoodies", "sweatshirt", "sweatshirts"], category("衛衣與連帽", ["sweatshirts-hoodies"])],
  [["polo衫", "polo"], category("Polo 衫", ["polos"])],
  [["外套", "outerwear"], category("外套", OUTER)],
  [["夾克", "西裝外套", "jacket", "jackets", "blazer"], category("夾克", ["jackets"])],
  [["大衣", "風衣", "coat", "coats", "trench"], category("大衣", ["coats"])],
  [["羽絨", "羽絨衣", "鋪棉", "puffer", "down jacket"], category("羽絨與鋪棉", ["down-padded"])],
  [["牛仔褲", "jeans", "denim"], category("牛仔褲", ["jeans"])],
  [["長褲", "褲子", "褲", "pants", "pant", "trousers", "trouser"], category("長褲", ["pants", "jeans"])],
  [["棉褲", "衛褲", "sweatpants", "sweatpant", "sweat pants", "sweat pant"], style("棉褲", ["sweatpant", "sweat pant", "jogger", "fleece pant"])],
  [["裙子", "裙", "半身裙", "skirt", "skirts", "skort"], category("裙子", ["skirts"])],
  [["短褲", "shorts"], category("短褲", ["shorts"])],
  [["洋裝", "連身裙", "dress", "dresses"], category("洋裝", ["dresses"])],
  [["連身褲", "jumpsuit", "romper"], category("連身褲", ["jumpsuits"])],
  [["內衣", "胸罩", "bra", "bralette"], category("內衣", ["bras"])],
  [["內褲", "underwear", "panties"], category("內褲", ["underwear"])],
  [["打底", "bodysuit", "camisole"], category("打底", ["base-layers"])],
  [["家居服", "lounge", "loungewear"], category("家居服", ["loungewear"])],
  [["睡衣", "pajamas", "pajama", "pj"], category("睡衣", ["pajamas"])],
  [["運動上衣", "運動內衣", "sports bra"], category("運動上衣", ["active-tops"])],
  [["運動褲", "瑜伽褲", "緊身褲", "legging", "leggings", "joggers"], category("運動下著", ["active-bottoms", "pants"])],
  [["襪子", "襪", "socks"], category("襪子", ["socks"])],
  [["圍巾", "scarf"], category("圍巾", ["scarves"])],
  [["帽子", "毛帽", "hat", "beanie", "cap"], category("帽子", ["hats"])],
  [["包包", "包", "托特包", "bag", "tote"], category("包款", ["bags"])],

  // Necklines
  [["低胸", "深v", "大領口", "low cut", "low-cut", "plunge"], style("低胸", LOW_NECK, [...CREW, ...BOAT, ...HIGH_NECK, "high v neck", "high v"])],
  [["v領", "v-neck", "v neck"], style("V 領", V, necklinesExcept(V))],
  [["圓領", "crew neck", "crewneck"], style("圓領", CREW, necklinesExcept(CREW))],
  [["方領", "square neck"], style("方領", ["square neck"], necklinesExcept(["square neck"]))],
  [["一字領", "船領", "boatneck", "boat neck"], style("一字領", BOAT, necklinesExcept(BOAT))],
  [["高領", "turtleneck", "mock neck"], style("高領", HIGH_NECK, necklinesExcept(HIGH_NECK))],
  [["露肩", "off the shoulder", "off-shoulder"], style("露肩", ["off the shoulder", "one shoulder"])],
  [["平口", "strapless"], style("平口", ["strapless", "tube"])],
  [["細肩帶", "吊帶", "cami"], style("細肩帶", ["cami", "camisole", "strappy", "spaghetti"])],
  // Sleeves
  [["無袖", "sleeveless"], style("無袖", ["sleeveless", "tank", "muscle"])],
  [["短袖", "short sleeve"], style("短袖", ["short sleeve", "short-sleeve", "cap sleeve", "tee"], ["long sleeve"])],
  [["長袖", "long sleeve"], style("長袖", ["long sleeve", "long-sleeve"])],
  [["七分袖", "3/4 sleeve"], style("七分袖", ["3/4 sleeve", "three quarter", "elbow sleeve"])],
  // Fit & length
  [["短版", "cropped", "crop"], style("短版", ["cropped", "crop"])],
  [["長版", "longline"], style("長版", ["longline", "maxi", "tunic"])],
  [["寬鬆", "oversize", "oversized", "relaxed"], style("寬鬆", ["oversized", "relaxed", "boxy", "loose", "slouchy", "baggy"])],
  [["修身", "合身", "fitted", "slim"], style("修身", ["fitted", "slim", "form", "skinny"])],
  [["寬褲", "闊腿", "wide leg"], style("寬褲", ["wide leg", "wide-leg", "palazzo", "barrel"])],
  [["直筒", "straight"], style("直筒", ["straight"])],
  [["喇叭", "flare"], style("喇叭", ["flare", "bootcut", "boot cut"])],
  [["緊身", "skinny"], style("緊身", ["skinny", "fitted", "legging"])],
  [["高腰", "high rise", "high waisted"], style("高腰", ["high rise", "high-rise", "high waisted", "high-waisted"])],
  [["低腰", "low rise"], style("低腰", ["low rise", "low-rise"])],
  [["長裙", "maxi"], style("長裙", ["maxi"])],
  [["迷你", "mini"], style("迷你", ["mini"])],
  // Pattern & feel
  [["條紋", "stripe", "striped"], style("條紋", ["stripe", "striped", "breton"])],
  [["格紋", "格子", "plaid"], style("格紋", ["plaid", "check", "gingham", "tartan"])],
  [["碎花", "花卉", "floral"], style("碎花", ["floral", "flower", "ditsy"])],
  [["羅紋", "螺紋", "ribbed", "rib"], style("羅紋", ["rib", "ribbed"])],
  [["透氣", "涼感", "涼爽", "breathable"], style("透氣", ["linen", "breathable", "cool touch", "airy", "gauze", "seersucker", "mesh"])],
  [["保暖", "warm"], style("保暖", ["fleece", "thermal", "warm", "sherpa", "down", "wool", "cashmere", "heattech", "brushed"])],
  [["防水", "防潑水", "waterproof", "water repellent"], style("防水", ["water repellent", "water-resistant", "waterproof", "rain"])],

  // Colors
  [["白色", "白", "white"], color("白", "white")],
  [["黑色", "黑", "black"], color("黑", "black")],
  [["灰色", "灰", "gray", "grey"], color("灰", "gray")],
  [["米色", "米白", "卡其", "奶茶色", "beige", "khaki"], color("米", "beige")],
  [["咖啡色", "棕色", "咖啡", "棕", "brown"], color("棕", "brown")],
  [["深藍", "海軍藍", "navy"], color("深藍", "navy")],
  [["藍色", "藍", "blue"], color("藍", "blue", "navy")],
  [["綠色", "軍綠", "綠", "green", "olive"], color("綠", "green")],
  [["紅色", "酒紅", "紅", "red"], color("紅", "red")],
  [["粉色", "粉紅", "粉", "pink"], color("粉", "pink")],
  [["紫色", "紫", "purple"], color("紫", "purple")],
  [["黃色", "黃", "yellow"], color("黃", "yellow")],
  [["橘色", "橘", "orange"], color("橘", "orange")],
  [["花紋", "印花", "pattern", "print"], color("花紋", "pattern")],

  // Fibers
  [["純棉", "100%棉", "全棉"], fiber("純棉", ["cotton"], 95)],
  [["棉", "cotton"], fiber("棉", ["cotton"])],
  [["亞麻", "麻", "linen"], fiber("亞麻", ["linen", "hemp", "ramie"])],
  [["羊毛", "wool", "merino"], fiber("羊毛", ["wool"])],
  [["喀什米爾", "羊絨", "cashmere"], fiber("喀什米爾", ["cashmere"])],
  [["真絲", "絲", "蠶絲", "silk"], fiber("絲", ["silk"])],
  [["天絲", "萊賽爾", "tencel", "lyocell"], fiber("天絲", ["lyocell"])],
  [["莫代爾", "modal"], fiber("莫代爾", ["modal"])],
  [["聚酯", "滌綸", "polyester"], fiber("聚酯", ["polyester"])],
  [["真皮", "皮革", "leather"], fiber("皮革", ["leather"])],

  // Brands
  [["無印良品", "無印", "muji"], brand("Muji", "muji")],
  [["pact"], brand("Pact", "pact")],
  [["quince"], brand("Quince", "quince")],
  [["everlane"], brand("Everlane", "everlane")],
  [["old navy", "oldnavy", "老海軍"], brand("Old Navy", "oldnavy")],
];

/** Every label the lexicon can show (for checking translations). */
export const LEXICON_LABELS = [...new Set(LEXICON.map(([, entry]) => entry.label))];

/** Every term, longest first, so greedy matching prefers the most specific phrase. */
const TERMS: { term: string; entry: Entry }[] = LEXICON.flatMap(([terms, entry]) => terms.map((term) => ({ term: normalize(term), entry }))).sort(
  (a, b) => b.term.length - a.term.length,
);

export interface ParsedQuery {
  categories: { label: string; l2: L2[]; source: string }[];
  styles: { label: string; include: string[]; exclude: string[]; source: string }[];
  colors: { label: string; families: ColorFamily[]; source: string }[];
  fibers: { label: string; fibers: Fiber[]; minPct?: number; source: string }[];
  brands: { label: string; brand: BrandId; source: string }[];
  priceMax: { value: number; source: string } | null;
  /** Leftover English words, matched literally against name/description. */
  keywords: string[];
  /** Leftover text the lexicon doesn't know (e.g. Chinese words not in it). */
  unknown: string[];
  /** Misspelled English words that were read as a lexicon word ("paints" → "pants"). */
  corrections: { from: string; to: string }[];
}

/** Lowercase, fold full-width characters, and treat hyphens as spaces ("V-Neck" ≈ "v neck"). */
export function normalize(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

const isAscii = (s: string) => /^[\x20-\x7e]+$/.test(s);

const PRICE_PATTERNS = [
  /\$?\s*(\d+(?:\.\d+)?)\s*(?:元|塊|美金|美元|dollars?|usd)?\s*(?:以下|以內|內|or less|and under|or under)/,
  /(?:under|below|less than|低於|少於|不到|不超過|<)\s*\$?\s*(\d+(?:\.\d+)?)/,
];

/** English words the lexicon knows, for spelling correction. */
const VOCAB = [...new Set(TERMS.flatMap(({ term }) => (isAscii(term) ? term.split(" ") : [])).filter((w) => /^[a-z]{3,}$/.test(w)))];

/** Edit distance with adjacent transpositions ("pnats" → "pants" is 1). */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Closest lexicon word for an unknown English word: 1 typo allowed from 4 letters, 2 from 8. */
function correct(word: string): string | null {
  if (word.length < 4) return null;
  const allowed = word.length >= 8 ? 2 : 1;
  let best: { w: string; d: number } | null = null;
  for (const w of VOCAB) {
    if (Math.abs(w.length - word.length) > allowed) continue;
    const d = editDistance(word, w);
    if (d <= allowed && (!best || d < best.d)) best = { w, d };
  }
  return best?.w ?? null;
}

export function parseQuery(input: string): ParsedQuery {
  const first = parseExact(input);
  // Leftover English words may be typos of lexicon words; re-read the query with them fixed.
  const corrections = first.keywords
    .map((from) => ({ from, to: correct(from) }))
    .filter((c): c is { from: string; to: string } => !!c.to && c.to !== c.from);
  if (!corrections.length) return first;
  const fixed = corrections.reduce((q, c) => q.replace(new RegExp(`(?<![a-z0-9])${c.from}(?![a-z0-9])`), c.to), normalize(input));
  return { ...parseExact(fixed), corrections };
}

function parseExact(input: string): ParsedQuery {
  let q = ` ${normalize(input)} `;
  const out: ParsedQuery = { categories: [], styles: [], colors: [], fibers: [], brands: [], priceMax: null, keywords: [], unknown: [], corrections: [] };

  for (const re of PRICE_PATTERNS) {
    const m = q.match(re);
    if (m) {
      out.priceMax = { value: Number(m[1]), source: m[0].trim() };
      q = q.replace(m[0], " ");
      break;
    }
  }

  for (const { term, entry } of TERMS) {
    // English terms need word boundaries ("tee" must not match inside "teeth"); Chinese terms don't.
    const re = isAscii(term) ? new RegExp(`(?<![a-z0-9])${term.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(?![a-z0-9])`) : null;
    while (re ? re.test(q) : q.includes(term)) {
      q = re ? q.replace(re, " ") : q.replace(term, " ");
      const source = term;
      switch (entry.kind) {
        case "category": out.categories.push({ label: entry.label, l2: entry.l2, source }); break;
        case "style": out.styles.push({ label: entry.label, include: entry.include, exclude: entry.exclude ?? [], source }); break;
        case "color": out.colors.push({ label: entry.label, families: entry.families, source }); break;
        case "fiber": out.fibers.push({ label: entry.label, fibers: entry.fibers, minPct: entry.minPct, source }); break;
        case "brand": out.brands.push({ label: entry.label, brand: entry.brand, source }); break;
      }
    }
  }

  // "色" / "的" / "款" etc. are glue once the real words are gone.
  const leftover = q.replace(/女裝|女生|女性|女用|男裝|男生|男性|男用|[色的款式件系列有要找想買和與跟或及,，、。.!！?？/+&]|\b(and|or|with|for|the|a|in|women'?s?)\b/g, " ").split(/\s+/).filter(Boolean);
  for (const w of leftover) (isAscii(w) && w.length >= 2 ? out.keywords : out.unknown).push(w);
  return out;
}

/** True when the query produced nothing usable. */
export function isEmptyQuery(p: ParsedQuery): boolean {
  return !p.categories.length && !p.styles.length && !p.colors.length && !p.fibers.length && !p.brands.length && !p.priceMax && !p.keywords.length;
}

export interface SearchableProduct {
  brand: BrandId;
  l2: L2;
  name: string;
  description: string;
  colorFamilies: ColorFamily[];
  salePrice: number;
  fibers: { fiber: Fiber; percentage: number }[];
}

/** Space-padded normalized text so phrase matching respects word edges: " v neck " in " drapey v neck top ". */
function haystack(p: SearchableProduct): { name: string; all: string } {
  const name = ` ${normalize(p.name)} `;
  return { name, all: `${name}${normalize(p.description)} ` };
}

const has = (text: string, phrase: string) => text.includes(` ${normalize(phrase)} `) || text.includes(` ${normalize(phrase)}s `);

/**
 * Relevance of a product for a parsed query, or null when it fails a hard filter.
 * Hard filters: categories, colors, fibers, brands, price, excluded styles.
 * Each style must match at least one of its phrases; name hits weigh more than description hits.
 */
export function scoreProduct(p: SearchableProduct, q: ParsedQuery): number | null {
  if (q.categories.length && !q.categories.some((c) => c.l2.includes(p.l2))) return null;
  if (q.brands.length && !q.brands.some((b) => b.brand === p.brand)) return null;
  if (q.colors.length && !q.colors.some((c) => c.families.some((f) => p.colorFamilies.includes(f)))) return null;
  if (q.priceMax && p.salePrice > q.priceMax.value) return null;
  for (const f of q.fibers) {
    const pct = p.fibers.filter((x) => f.fibers.includes(x.fiber)).reduce((s, x) => s + x.percentage, 0);
    if (pct === 0 || (f.minPct && pct < f.minPct)) return null;
  }

  const { name, all } = haystack(p);
  let score = 1;
  for (const s of q.styles) {
    // Exclusions look at the name only: a description may mention other styles in passing.
    if (s.exclude.some((x) => has(name, x))) return null;
    const inName = s.include.filter((x) => has(name, x)).length;
    const inAll = s.include.filter((x) => has(all, x)).length;
    if (inAll === 0) return null;
    score += inName * 3 + (inAll - inName);
  }
  for (const k of q.keywords) {
    if (has(name, k)) score += 3;
    else if (has(all, k)) score += 1;
    else return null;
  }
  return score;
}
