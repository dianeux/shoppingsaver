import { describe, expect, it } from "vitest";
import { clipTarget, draftFromClip, validateSubmission, type ClipPayload } from "./clip";

const payload = (p: Partial<ClipPayload>): ClipPayload => ({ v: 1, url: "", title: "", ld: [], meta: {}, text: "", hidden: "", ...p });

// Shapes taken from the brands' product pages (JSON-LD ProductGroup + page text).
const hm = payload({
  url: "https://www2.hm.com/en_us/productpage.1243667053.html",
  title: "Women's Burgundy Oversized Sweatshirt | H&M US",
  ld: [
    JSON.stringify({ "@type": "BreadcrumbList", itemListElement: [{ name: "HM.com" }, { name: "Women" }, { name: "Basics" }, { name: "Tops" }] }),
    JSON.stringify({
      "@type": "ProductGroup", name: "Oversized Sweatshirt", material: "Cotton/Polyester",
      audience: { "@type": "PeopleAudience", suggestedGender: "female" },
      hasVariant: [
        { color: "Light beige", image: "https://image.hm.com/a.jpg", offers: { price: 22.99, availability: "https://schema.org/OutOfStock" } },
        { color: "Burgundy", image: "https://image.hm.com/b.jpg", offers: { price: 22.99, availability: "https://schema.org/InStock" } },
      ],
    }),
  ],
  meta: { "og:image": "https://image.hm.com/og.jpg" },
  text: "OVERSIZED SWEATSHIRT\nFLASH SALE: 25% OFF\nMATERIALS\nCOMPOSITION\nCotton 60%, Polyester 40%\nMATERIALS IN THIS PRODUCT EXPLAINED",
});

const uniqlo = payload({
  url: "https://www.uniqlo.com/us/en/products/E424873-000/00?colorDisplayCode=00",
  title: "Women's Crew Neck T-Shirt | UNIQLO US",
  ld: [JSON.stringify({ "@graph": [
    { "@type": "BreadcrumbList", itemListElement: [{ name: "WOMEN" }, { name: "T-Shirts, Sweats & Fleece" }, { name: "T-Shirts and Tank Tops" }] },
    { "@type": "ProductGroup", name: "Crew Neck T-Shirt", material: "100% Cotton Imported", hasVariant: [
      { color: "WHITE", image: ["https://image.uniqlo.com/w.jpg"], offers: { price: "19.9", availability: "https://schema.org/InStock" } },
      { color: "BLACK", image: ["https://image.uniqlo.com/b.jpg"], offers: { price: "14.9", availability: "https://schema.org/InStock" } },
    ] },
  ] })],
});

const zara = payload({
  url: "https://www.zara.com/us/en/100-cotton-ribbed-t-shirt-p00264816.html?v1=568654495",
  title: "100% COTTON RIBBED T-SHIRT - Black | ZARA United States",
  ld: [JSON.stringify({ "@type": "ProductGroup", name: "100% COTTON RIBBED T-SHIRT", hasVariant: [{ color: "Black", offers: { price: 25.9 } }] })],
  text: "WOMAN\nSELECTED ITEMS 40% OFF\nT-shirt made from 100% cotton.",
});

describe("clipTarget", () => {
  it("accepts official product pages and derives a per-product id", () => {
    expect(clipTarget(hm.url)).toEqual({ brand: "hm", sourceId: "1243667", url: "https://www2.hm.com/en_us/productpage.1243667053.html" });
    expect(clipTarget(uniqlo.url)?.sourceId).toBe("E424873-000");
    expect(clipTarget(zara.url)).toMatchObject({ brand: "zara", sourceId: "00264816", url: "https://www.zara.com/us/en/100-cotton-ribbed-t-shirt-p00264816.html" });
  });

  it("refuses other hosts, lookalikes and non-product pages", () => {
    expect(clipTarget("https://www2.hm.com.evil.example/en_us/productpage.1243667053.html")).toBeNull();
    expect(clipTarget("http://www2.hm.com/en_us/productpage.1243667053.html")).toBeNull();
    expect(clipTarget("https://www.uniqlo.com/us/en/women/tops")).toBeNull();
    expect(clipTarget("https://www.everlane.com/products/x")).toBeNull();
  });
});

describe("draftFromClip", () => {
  it("reads H&M: name, gender, cheapest in-stock color, composition from the opened Materials panel", () => {
    const { input, missing } = draftFromClip(hm);
    expect(input).toMatchObject({
      name: "Oversized Sweatshirt", gender: "women", l2: "sweatshirts-hoodies", price: 22.99,
      priceColor: "Burgundy", imageUrl: "https://image.hm.com/b.jpg", compositionText: "Cotton 60%, Polyester 40%",
    });
    expect(input.colors).toEqual(["Light beige", "Burgundy"]);
    expect(missing).toEqual([]);
  });

  it("reads Uniqlo: composition from JSON-LD material, without the trailing 'Imported'", () => {
    const { input } = draftFromClip(uniqlo);
    expect(input).toMatchObject({ gender: "women", l2: "tshirts", price: 14.9, priceColor: "BLACK", compositionText: "100% Cotton" });
    expect(input.url).toBe("https://www.uniqlo.com/us/en/products/E424873-000/00");
  });

  it("tidies all-caps names and reports what is missing", () => {
    const { input, missing } = draftFromClip(zara);
    expect(input.name).toBe("100% Cotton Ribbed T-Shirt");
    expect(input.l2).toBe("tshirts");
    // The description's "100% cotton" counts only because it parses as a full composition.
    expect(input.compositionText).toBe("100% cotton");
    expect(missing).toEqual(["gender"]);
  });

  it("never takes promo percentages for fiber content", () => {
    const { input } = draftFromClip(payload({ ...hm, text: "FLASH SALE: 25% OFF UNTIL MIDNIGHT", ld: [hm.ld[1].replace("Cotton/Polyester", "")] }));
    expect(input.compositionText).toBe("");
  });
});

describe("validateSubmission", () => {
  const good = { ...draftFromClip(hm).input };

  it("accepts a complete draft and fixes brand and id from the URL", () => {
    const r = validateSubmission(good);
    expect(r.ok && r.value).toMatchObject({ brand: "hm", sourceId: "1243667", gender: "women", l2: "sweatshirts-hoodies", price: 22.99 });
  });

  it("rejects bad fields", () => {
    const r = validateSubmission({ ...good, url: "https://example.com/p", price: 0, compositionText: "soft cotton", imageUrl: "https://tracker.example/x.png", gender: "kids" });
    expect(r.ok ? [] : r.errors).toEqual(expect.arrayContaining(["unsupported_url", "price", "composition", "gender"]));
  });

  it("rejects images from outside the brand's image host", () => {
    const r = validateSubmission({ ...good, imageUrl: "https://tracker.example/x.png" });
    expect(r.ok ? [] : r.errors).toEqual(["image"]);
  });

  it("drops a list price that isn't above the sale price", () => {
    const r = validateSubmission({ ...good, listPrice: 22.99 });
    expect(r.ok && r.value.listPrice).toBeNull();
    expect(validateSubmission({ ...good, listPrice: 10 }).ok).toBe(false);
  });
});
