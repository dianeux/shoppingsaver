import { describe, expect, it } from "vitest";
import { LEXICON_LABELS } from "@/domain/search";
import { DICTS } from "./dict";
import { fiberLabel, formatComposition, href, missingLexiconLabels, sectionTitle } from "./format";
import { localePath, splitLocale } from "./locales";

describe("locale paths", () => {
  it("keeps Chinese URLs unprefixed and puts English under /en", () => {
    expect(localePath("zh", "/g/tops")).toBe("/g/tops");
    expect(localePath("en", "/g/tops")).toBe("/en/g/tops");
    expect(localePath("en", "/")).toBe("/en");
    expect(href("en", "men", "/c/tshirts")).toBe("/en/men/c/tshirts");
    expect(href("zh", "men", "/")).toBe("/men");
  });

  it("splits a public path into language and path", () => {
    expect(splitLocale("/en/men/g/tops")).toEqual({ lang: "en", path: "/men/g/tops" });
    expect(splitLocale("/en")).toEqual({ lang: "en", path: "/" });
    expect(splitLocale("/men")).toEqual({ lang: "zh", path: "/men" });
    expect(splitLocale("/english-thing")).toEqual({ lang: "zh", path: "/english-thing" });
  });
});

describe("translations", () => {
  it("names every search-dictionary label in English", () => {
    expect(missingLexiconLabels(LEXICON_LABELS)).toEqual([]);
  });

  it("formats fiber content per language", () => {
    const main = [
      { fiber: "polyester" as const, percentage: 40, recycled: true, organic: false },
      { fiber: "cotton" as const, percentage: 60, recycled: false, organic: true },
    ];
    expect(formatComposition("zh", main)).toBe("60% 有機棉 · 40% 再生聚酯");
    expect(formatComposition("en", main)).toBe("60% organic cotton · 40% recycled polyester");
    expect(fiberLabel("en", "elasterell")).toBe("elasterell-P");
  });

  it("titles men's pages in each language", () => {
    expect(sectionTitle("zh", "women", "Tops")).toBe("Tops");
    expect(sectionTitle("zh", "men", "T 恤")).toBe("男裝 T 恤");
    expect(sectionTitle("en", "men", "T-shirts")).toBe("Men's T-shirts");
  });

  it("has the same sections in both dictionaries", () => {
    expect(Object.keys(DICTS.en).sort()).toEqual(Object.keys(DICTS.zh).sort());
    expect(Object.keys(DICTS.en.l2).sort()).toEqual(Object.keys(DICTS.zh.l2).sort());
  });
});
