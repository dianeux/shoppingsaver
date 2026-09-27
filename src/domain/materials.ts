/**
 * Fiber dictionary and the three-tier material coefficient (PRD ch.9).
 */
export type FiberClass = "natural" | "regenerated" | "synthetic";

export const CLASS_COEFFICIENT: Record<FiberClass, number> = {
  natural: 1.0,
  regenerated: 0.5,
  synthetic: 0.0,
};

/**
 * Open question #2 in the PRD: should recycled polyester score above 0?
 * Kept at 0 until decided; the `recycled` flag is stored on every fiber so the
 * nightly job can rescore without re-extracting.
 */
export const RECYCLED_SYNTHETIC_COEFFICIENT = 0.0;

/** Spandex at or below this share is dropped from the denominator (PRD ch.9). */
export const ELASTANE_EXEMPT_MAX_PCT = 5;

export type Fiber =
  | "cotton" | "linen" | "hemp" | "ramie" | "kapok" | "silk" | "wool" | "cashmere" | "alpaca" | "vicuna" | "mohair" | "yak" | "camel" | "down" | "feather" | "leather"
  | "lyocell" | "modal" | "cupro" | "viscose" | "acetate" | "triacetate" | "azlon"
  | "polyester" | "elasterell" | "nylon" | "acrylic" | "elastane" | "polypropylene" | "polyethylene" | "polyurethane" | "metallic" | "faux_leather"
  | "other";

export const FIBERS: Record<Fiber, { class: FiberClass; label: string; synonyms: string[] }> = {
  cotton: { class: "natural", label: "棉", synonyms: ["cotton", "organic cotton", "pima cotton", "supima cotton", "supima", "egyptian cotton"] },
  linen: { class: "natural", label: "亞麻", synonyms: ["linen", "flax", "european flax", "french linen"] },
  hemp: { class: "natural", label: "麻", synonyms: ["hemp"] },
  ramie: { class: "natural", label: "苧麻", synonyms: ["ramie"] },
  kapok: { class: "natural", label: "木棉", synonyms: ["kapok"] },
  silk: { class: "natural", label: "絲", synonyms: ["silk", "mulberry silk"] },
  wool: { class: "natural", label: "羊毛", synonyms: ["wool", "merino wool", "merino", "lambswool", "lamb's wool", "lambs wool", "virgin wool", "extra fine merino wool", "shetland wool"] },
  cashmere: { class: "natural", label: "喀什米爾", synonyms: ["cashmere", "mongolian cashmere"] },
  alpaca: { class: "natural", label: "羊駝毛", synonyms: ["alpaca", "baby alpaca"] },
  vicuna: { class: "natural", label: "小羊駝毛", synonyms: ["vicuña", "vicuna"] },
  mohair: { class: "natural", label: "馬海毛", synonyms: ["mohair"] },
  yak: { class: "natural", label: "犛牛毛", synonyms: ["yak"] },
  camel: { class: "natural", label: "駱駝毛", synonyms: ["camel", "camel hair"] },
  // Not a textile fiber, but scored as natural by product decision (PRD open question 3).
  leather: {
    class: "natural",
    label: "天然皮革",
    synonyms: ["leather", "genuine leather", "top grain leather", "full grain leather", "suede", "nubuck", "shearling", "sheepskin", "lambskin", "calfskin", "cowhide", "goatskin", "sheep leather", "lamb leather", "cow leather", "goat leather", "sheep suede", "goat suede"],
  },
  // Fill materials; they normally sit in a "Filling" part, which isn't scored.
  down: { class: "natural", label: "羽絨", synonyms: ["down", "duck down", "goose down", "white duck down"] },
  feather: { class: "natural", label: "羽毛", synonyms: ["feather", "feathers", "waterfowl feathers", "duck feathers", "goose feathers"] },
  lyocell: { class: "regenerated", label: "天絲", synonyms: ["lyocell", "tencel", "tencel lyocell", "tencel™ lyocell"] },
  modal: { class: "regenerated", label: "莫代爾", synonyms: ["modal", "tencel modal", "micro modal", "micromodal"] },
  cupro: { class: "regenerated", label: "銅氨", synonyms: ["cupro", "cupra", "bemberg"] },
  viscose: { class: "regenerated", label: "嫘縈", synonyms: ["viscose", "rayon", "ecovero", "ecovero viscose", "lenzing ecovero viscose"] },
  acetate: { class: "regenerated", label: "醋酸纖維", synonyms: ["acetate"] },
  triacetate: { class: "regenerated", label: "三醋酸纖維", synonyms: ["triacetate"] },
  // FTC generic name for regenerated protein fiber (e.g. soy); natural feedstock, chemical process — same tier as rayon.
  azlon: { class: "regenerated", label: "大豆蛋白纖維", synonyms: ["azlon", "soy fiber", "soybean fiber", "soy protein fiber"] },
  polyester: { class: "synthetic", label: "聚酯", synonyms: ["polyester", "recycled polyester", "pet", "poly"] },
  // FTC generic name for bicomponent stretch polyester (PET/PTT); not spandex, so no exemption.
  elasterell: { class: "synthetic", label: "彈性聚酯", synonyms: ["elasterell-p", "elasterell p", "elasterell"] },
  nylon: { class: "synthetic", label: "尼龍", synonyms: ["nylon", "polyamide", "recycled nylon", "recycled polyamide"] },
  acrylic: { class: "synthetic", label: "壓克力", synonyms: ["acrylic", "modacrylic"] },
  elastane: { class: "synthetic", label: "彈性纖維", synonyms: ["elastane", "spandex", "lycra", "elastic", "polyurethane elastic"] },
  polypropylene: { class: "synthetic", label: "聚丙烯", synonyms: ["polypropylene"] },
  polyethylene: { class: "synthetic", label: "聚乙烯", synonyms: ["polyethylene"] },
  faux_leather: {
    class: "synthetic",
    label: "人造皮革",
    synonyms: ["faux leather", "vegan leather", "pu leather", "polyurethane leather", "synthetic leather", "imitation leather", "leatherette", "pleather", "faux suede", "vegan suede", "faux shearling"],
  },
  metallic: { class: "synthetic", label: "金屬纖維", synonyms: ["metallic", "metallic fiber", "lurex"] },
  polyurethane: { class: "synthetic", label: "聚氨酯", synonyms: ["polyurethane", "pu"] },
  // FTC lets fibers under 5% be listed as "other fiber(s)"; unknown type, so never scored (see composition.ts).
  other: { class: "synthetic", label: "其他纖維", synonyms: ["other fiber", "other fibers", "other"] },
};

const SYNONYM_INDEX: Map<string, Fiber> = new Map(
  (Object.entries(FIBERS) as [Fiber, (typeof FIBERS)[Fiber]][]).flatMap(([fiber, info]) =>
    info.synonyms.map((s) => [s, fiber] as const),
  ),
);

export interface ResolvedFiber {
  fiber: Fiber;
  recycled: boolean;
  organic: boolean;
}

/** Map a free-text fiber name ("Organic Cotton", "Recycled Polyester") to a canonical fiber. */
const FAUX = /\b(faux|vegan|synthetic|imitation|artificial)\b/;

export function resolveFiber(raw: string): ResolvedFiber | null {
  const r = resolveFiberName(raw);
  // "Vegan suede", "synthetic shearling"…: any leather word with a faux qualifier is man-made.
  if (r?.fiber === "leather" && FAUX.test(raw.toLowerCase())) return { ...r, fiber: "faux_leather" };
  return r;
}

function resolveFiberName(raw: string): ResolvedFiber | null {
  const name = raw
    .toLowerCase()
    .replace(/[®™*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const recycled = /\brecycled\b/.test(name);
  const organic = /\borganic\b/.test(name);
  const direct = SYNONYM_INDEX.get(name);
  if (direct) return { fiber: direct, recycled, organic };
  const stripped = name.replace(/\b(recycled|organic|certified|gots|premium|fine|long[- ]staple|grade[- ]a)\b/g, "").replace(/\s+/g, " ").trim();
  const hit = SYNONYM_INDEX.get(stripped);
  if (hit) return { fiber: hit, recycled, organic };
  // Longest synonym contained in the name, e.g. "100% mulberry silk charmeuse".
  let best: [string, Fiber] | null = null;
  for (const [syn, fiber] of SYNONYM_INDEX) {
    if (new RegExp(`\\b${syn.replace(/[.*+?^${}()|[\]\\']/g, "\\$&")}\\b`).test(stripped) && (!best || syn.length > best[0].length)) {
      best = [syn, fiber];
    }
  }
  return best ? { fiber: best[1], recycled, organic } : null;
}

export function fiberCoefficient(fiber: Fiber, recycled: boolean): number {
  const cls = FIBERS[fiber].class;
  if (cls === "synthetic" && recycled) return RECYCLED_SYNTHETIC_COEFFICIENT;
  return CLASS_COEFFICIENT[cls];
}
