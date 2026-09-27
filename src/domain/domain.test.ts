import { describe, expect, it } from "vitest";
import { materialScore, parseComposition } from "./composition";
import { colorFamily } from "./colors";
import { percentiles, priceScore, valueScore } from "./scoring";

function mainOf(text: string) {
  const r = parseComposition(text);
  if (!r.ok) throw new Error(`parse failed: ${r.reason} ${r.unknownFibers ?? ""}`);
  return r.composition.main;
}

describe("PRD ch.9 worked example (sweaters)", () => {
  // Percentiles are given in the PRD; this checks the material coefficients and the formula.
  const rows = [
    { name: "Quince cashmere", comp: "100% Cashmere", pct: 0.8, material: 1.0, value: 60 },
    { name: "Uniqlo wool blend", comp: "70% Wool, 30% Nylon", pct: 0.45, material: 0.7, value: 63 },
    { name: "H&M acrylic", comp: "100% Acrylic", pct: 0.1, material: 0.0, value: 45 },
    { name: "Zara blend", comp: "50% Viscose, 30% Polyester, 20% Cotton", pct: 0.6, material: 0.45, value: 43 },
  ];
  for (const r of rows) {
    it(r.name, () => {
      const m = materialScore(mainOf(r.comp));
      expect(m).toBeCloseTo(r.material, 3);
      expect(valueScore(m, priceScore(r.pct))).toBe(r.value);
    });
  }
});

describe("parseComposition", () => {
  it("exempts elastane ≤ 5% from the denominator", () => {
    expect(materialScore(mainOf("95% Cotton, 5% Spandex"))).toBe(1);
  });
  it("counts elastane > 5%", () => {
    expect(materialScore(mainOf("90% Cotton 10% Elastane"))).toBe(0.9);
  });
  it("uses the body part, not the rib or lining", () => {
    const r = parseComposition("Body: 100% Organic Cotton. Rib: 95% Cotton, 5% Polyurethane Elastic");
    expect(r.ok && r.composition.main[0].organic).toBe(true);
    expect(r.ok && r.composition.parts).toHaveLength(2);
  });
  it("prefers shell over lining even when lining is listed first", () => {
    const r = parseComposition("Lining: 100% Polyester / Shell: 100% Wool");
    expect(r.ok && r.composition.main[0].fiber).toBe("wool");
  });
  it("knows kapok and multi-part labels like 'Body, Pocket'", () => {
    const r = parseComposition("Body, Pocket: 85% Cotton, 15% Kapok / Pocket Lining: 65% Polyester, 35% Cotton");
    expect(r.ok && r.composition.main.map((f) => f.fiber)).toEqual(["cotton", "kapok"]);
    expect(r.ok && materialScore(r.composition.main)).toBe(1);
  });
  it("tolerates a mistyped secondary part but not a mistyped main part", () => {
    const r = parseComposition("Body: 100% Cotton / Ribbed Knit: 63% Cotton, 34% Polyester");
    expect(r.ok && r.composition.parts).toHaveLength(1);
    expect(parseComposition("Body: 63% Cotton, 34% Polyester / Rib: 100% Cotton").ok).toBe(false);
  });
  it("reads parenthesized part labels and Elasterell-P", () => {
    const r = parseComposition("Body, Pocket Bag (Back): 51% Polyester, 49% Elasterell-P / Pocket Bag (Front): 100% Polyester");
    expect(r.ok && materialScore(r.composition.main)).toBe(0);
    expect(r.ok && r.composition.main.map((f) => f.fiber)).toEqual(["polyester", "elasterell"]);
  });
  it("scores a down jacket on its shell, not its filling", () => {
    const r = parseComposition("Outer Shell: 100% Nylon / Lining: 100% Nylon / Filling: 90% Down, 10% Waterfowl Feathers");
    expect(r.ok && r.composition.main[0].fiber).toBe("nylon");
    expect(r.ok && r.composition.parts).toHaveLength(3);
  });
  it("drops an unparseable filling line instead of failing the jacket", () => {
    const r = parseComposition("Outer Shell, Linings: 100% Nylon / Filling: Down (Minimum 90% Down)");
    expect(r.ok && r.composition.parts).toHaveLength(1);
  });
  it("leaves unnamed 'other fibers' out of the score", () => {
    const main = mainOf("55% recycled Italian wool, 35% recycled polyester, 5% recycled nylon, 5% other fibers");
    expect(materialScore(main)).toBeCloseTo(55 / 95, 3);
  });
  it("refuses to score a garment from its lining alone", () => {
    expect(parseComposition("Lining: 100% polyester")).toEqual({ ok: false, reason: "no_main_part" });
  });
  it.each([
    ["Materials: Skirt: 100% recycled polyester; Built-in shorts: 77% recycled nylon, 23% spandex", ["polyester"]],
    ["Materials: Top - 57% cotton, 38% modal, 5% spandex. Skirt - 100% organic cotton poplin", ["cotton", "modal", "elastane"]],
    ["Body: Shell 95% Tencel™, 5% spandex, lining 95% polyester, 5% spandex", ["lyocell", "elastane"]],
    ["Shell and Lining: 100% recycled polyester Cuffs: 90% nylon, 10% elastane Fill: 90% goose down, 10% goose feathers", ["polyester"]],
    ["Shell and Lining: 100% recycled nylon ( soft satin finish ); Fill: 90% goose down, 10% goose feathers", ["nylon"]],
    ["Body: Outer is 100% poly sherpa. Cuff and hem are 90% nylon, 10% spandex. Lining is 50% polyester, 50% cotton", ["polyester"]],
    ["Body: 57% cashmere, 24% silk, 13% polyamide, 6% metallic", ["cashmere", "silk", "nylon", "metallic"]],
    ["Body: 100% vicuña", ["vicuna"]],
    ["Black, Faded Black, Greyed Out: 65% organic cotton, 18% recycled polyester, 10% viscose, 5% lycra, 2% polyester", ["cotton", "polyester", "viscose", "elastane", "polyester"]],
    ["Black, Faded Black, Greyed Out: 65% cotton, 35% polyester / Deep Rinse, Seaside Blue, Midnight Blue, Frosted Blue: 94% organic cotton, 5% elasterell-p, 1% lycra", ["cotton", "polyester"]],
  ])("real-world labels: %s", (text, fibers) => expect(mainOf(text).map((f) => f.fiber)).toEqual(fibers));
  it.each([
    ["Body: 100% top grain sheep leather / Lining: 100% polyester", "leather", 1],
    ["100% lambskin suede", "leather", 1],
    ["Shell: 100% shearling", "leather", 1],
    ["Shell: 100% faux leather / Lining: 100% polyester", "faux_leather", 0],
    ["100% vegan suede", "faux_leather", 0],
    ["100% polyurethane leather", "faux_leather", 0],
  ])("leather: %s → %s (%d)", (text, fiber, score) => {
    const main = mainOf(text);
    expect(main[0].fiber).toBe(fiber);
    expect(materialScore(main)).toBe(score);
  });
  it("handles name-first order", () => {
    expect(materialScore(mainOf("Linen 55% Cotton 45%"))).toBe(1);
  });
  it("treats rayon/lyocell as regenerated", () => {
    expect(materialScore(mainOf("100% Lyocell"))).toBe(0.5);
    expect(materialScore(mainOf("100% Rayon"))).toBe(0.5);
  });
  it("fails loudly on unknown fibers instead of guessing", () => {
    const r = parseComposition("80% Cotton, 20% Unobtainium");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.unknownFibers).toEqual(["Unobtainium"]);
  });
  it("fails when percentages don't add up", () => {
    expect(parseComposition("60% Cotton, 20% Polyester").ok).toBe(false);
  });
  it("fails on marketing copy with no percentages", () => {
    expect(parseComposition("Made from soft, breathable linen").ok).toBe(false);
  });
});

describe("percentiles", () => {
  it("is not flattened by one outlier", () => {
    const p = percentiles([10, 20, 30, 40, 1000]);
    expect(p).toEqual([0.1, 0.3, 0.5, 0.7, 0.9]);
  });
  it("gives ties the same mid-rank", () => {
    expect(percentiles([10, 10, 20, 30])).toEqual([0.25, 0.25, 0.625, 0.875]);
  });
});

describe("colorFamily", () => {
  it.each([
    ["Off White", "white"],
    ["Navy", "navy"],
    ["Dark Gray", "gray"],
    ["Oatmeal", "beige"],
    ["Brick Stripe", "pattern"],
    ["Smoky Green", "green"],
    ["Dark Mocha Brown", "brown"],
    ["Light Pink", "pink"],
    ["Washed Flagstone", "gray"],
    ["Parchment", "beige"],
    ["Vanilla", "white"],
    ["Flora Spots", "pattern"],
    ["Washed Seagrass", "green"],
    ["Heather Morel Grey", "gray"],
    ["Medium Wash", "blue"],
    ["Whiteout Raw Hem", "white"],
    ["Creamy Cortado", "beige"],
    ["Verdant Pine", "green"],
  ])("%s → %s", (raw, fam) => expect(colorFamily(raw)).toBe(fam));
});
