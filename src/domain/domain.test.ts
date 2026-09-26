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
  ])("%s → %s", (raw, fam) => expect(colorFamily(raw)).toBe(fam));
});
