import { describe, expect, it } from "vitest";
import { editDistance, parseQuery, scoreProduct, type SearchableProduct } from "./search";

const product = (name: string, over: Partial<SearchableProduct> = {}): SearchableProduct => ({
  brand: "everlane", l2: "tshirts", name, description: "", colorFamilies: ["white"], salePrice: 30,
  fibers: [{ fiber: "cotton", percentage: 100 }], ...over,
});

describe("parseQuery", () => {
  it("低胸 Tshirt → T-shirt category + low-neck style", () => {
    const q = parseQuery("低胸 Tshirt");
    expect(q.categories.map((c) => c.label)).toEqual(["T 恤"]);
    expect(q.styles.map((s) => s.label)).toEqual(["低胸"]);
    expect(q.unknown).toEqual([]);
  });

  it("reads price, pure cotton, color and category from one Chinese phrase", () => {
    const q = parseQuery("50元以下純棉白色T恤");
    expect(q.priceMax?.value).toBe(50);
    expect(q.fibers).toMatchObject([{ label: "純棉", fibers: ["cotton"], minPct: 95 }]);
    expect(q.colors.map((c) => c.label)).toEqual(["白"]);
    expect(q.categories.map((c) => c.label)).toEqual(["T 恤"]);
    expect(q.unknown).toEqual([]);
  });

  it("prefers the longest term: 深藍 is navy, 短褲 is shorts, 鋪棉 isn't cotton", () => {
    expect(parseQuery("深藍短褲").colors.map((c) => c.label)).toEqual(["深藍"]);
    expect(parseQuery("深藍短褲").categories.map((c) => c.label)).toEqual(["短褲"]);
    const q = parseQuery("鋪棉外套");
    expect(q.fibers).toEqual([]);
    expect(q.categories.map((c) => c.label).sort()).toEqual(["外套", "羽絨與鋪棉"].sort());
  });

  it("handles brands and English queries", () => {
    const q = parseQuery("muji wide leg linen pants under $60");
    expect(q.brands.map((b) => b.brand)).toEqual(["muji"]);
    expect(q.styles.map((s) => s.label)).toEqual(["寬褲"]);
    expect(q.fibers.map((f) => f.label)).toEqual(["亞麻"]);
    expect(q.priceMax?.value).toBe(60);
  });

  it("reports words the lexicon doesn't know instead of dropping them", () => {
    const q = parseQuery("仙女風 洋裝");
    expect(q.categories.map((c) => c.label)).toEqual(["洋裝"]);
    expect(q.unknown).toEqual(["仙女風"]);
  });

  it("keeps leftover English words as literal keywords", () => {
    expect(parseQuery("waffle tee").keywords).toEqual(["waffle"]);
  });
});

describe("scoreProduct", () => {
  const lowNeckTee = parseQuery("低胸 Tshirt");

  it("matches low necklines and ranks name hits first", () => {
    expect(scoreProduct(product("Cotton Modal Scoop Neck Tee"), lowNeckTee)).toBeGreaterThan(1);
    expect(scoreProduct(product("Luxe Rib Deep U-Neck Top"), lowNeckTee)).toBeGreaterThan(1);
    expect(scoreProduct(product("100% Organic Cotton Boxy V-Neck Tee"), lowNeckTee)).toBeGreaterThan(1);
  });

  it("rejects the opposite necklines and plain tees", () => {
    expect(scoreProduct(product("Boatneck Cap-Sleeve Top"), lowNeckTee)).toBeNull();
    expect(scoreProduct(product("Mock Neck Long-Sleeve Tee"), lowNeckTee)).toBeNull();
    expect(scoreProduct(product("The Box-Cut Tee"), lowNeckTee)).toBeNull();
  });

  it("excludes necklines the name contradicts, even when the description mentions the style", () => {
    const turtle = parseQuery("高領毛衣");
    const sweater = (name: string, description = "") => product(name, { l2: "sweaters-knits", description });
    expect(scoreProduct(sweater("Wool Turtleneck Sweater"), turtle)).not.toBeNull();
    expect(scoreProduct(sweater("Wool Bouclé Crewneck Vest", "Layer it over a turtleneck."), turtle)).toBeNull();
    expect(scoreProduct(product("Snug High V-Neck T-Shirt"), lowNeckTee)).toBeNull();
  });

  it("uses the description when the name is silent, but never excludes on it", () => {
    const p = product("The Organic Cotton Tee", { description: "A flattering deep scoop neckline, lower than our crew neck." });
    expect(scoreProduct(p, lowNeckTee)).toBe(2);
  });

  it("applies hard filters: category, color, fiber share, price", () => {
    const q = parseQuery("50元以下純棉白色低胸T恤");
    expect(scoreProduct(product("Scoop Neck Tee"), q)).not.toBeNull();
    expect(scoreProduct(product("Scoop Neck Tee", { l2: "dresses" }), q)).toBeNull();
    expect(scoreProduct(product("Scoop Neck Tee", { colorFamilies: ["black"] }), q)).toBeNull();
    expect(scoreProduct(product("Scoop Neck Tee", { salePrice: 58 }), q)).toBeNull();
    expect(scoreProduct(product("Scoop Neck Tee", { fibers: [{ fiber: "cotton", percentage: 60 }, { fiber: "polyester", percentage: 40 }] }), q)).toBeNull();
  });
});

describe("spelling correction", () => {
  it("reads a misspelled phrase as the lexicon term", () => {
    const q = parseQuery("sweat paints");
    expect(q.styles.map((s) => s.label)).toEqual(["棉褲"]);
    expect(q.keywords).toEqual([]);
    expect(q.corrections).toEqual([{ from: "paints", to: "pants" }]);
  });

  it("fixes single typos and transpositions in category, color and fiber words", () => {
    expect(parseQuery("pnats").categories.map((c) => c.label)).toEqual(["長褲"]);
    expect(parseQuery("blak tee").colors.map((c) => c.label)).toEqual(["黑"]);
    expect(parseQuery("linnen shirt").fibers.map((f) => f.label)).toEqual(["亞麻"]);
  });

  it("leaves real words the lexicon doesn't know alone", () => {
    const q = parseQuery("waffle tee");
    expect(q.keywords).toEqual(["waffle"]);
    expect(q.corrections).toEqual([]);
  });

  it("measures edits with transpositions", () => {
    expect(editDistance("paints", "pants")).toBe(1);
    expect(editDistance("pnats", "pants")).toBe(1);
    expect(editDistance("tee", "tee")).toBe(0);
  });
});
