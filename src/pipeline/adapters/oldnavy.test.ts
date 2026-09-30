import { describe, expect, it } from "vitest";
import { extractOldNavyComposition, groupStyles, toRawProduct, type OldNavyPage } from "./oldnavy";
import { mapOldNavyCategory } from "./oldnavy-mapping";

const color = (ccId: string, ccName: string, effective: string, regular: string, inventoryStatus = "In Stock") => ({
  ccId, ccName, effectivePrice: effective, regularPrice: regular, inventoryStatus,
  images: [{ type: "VLI", path: `/webcontent/${ccId}.jpg` }],
});

describe("groupStyles / toRawProduct", () => {
  it("merges a style's colorways across pages and keeps regular vs effective price", () => {
    const pages: OldNavyPage[] = [
      { pagination: { pageNumberTotal: "2" }, categories: [{ subCategoryName: "T-Shirts & Tanks", ccList: [{ ccId: "1" }, { ccId: "2" }] }],
        products: [{ styleId: "900", styleName: "EveryWear Crew-Neck T-Shirt", webProductType: "womens tops", styleColors: [color("1", "Black", "12.99", "12.99")] }] },
      { pagination: { pageNumberTotal: "2" }, categories: [],
        products: [{ styleId: "900", styleName: "EveryWear Crew-Neck T-Shirt", webProductType: "womens tops", styleColors: [color("2", "Red", "8.00", "12.99", "Out of Stock")] }] },
    ];
    const [g] = groupStyles(pages);
    const p = toRawProduct(g);
    expect(p).toMatchObject({ sourceId: "900", l2: "tshirts", url: "https://oldnavy.gap.com/browse/product.do?pid=1" });
    expect(p.variants.map((v) => [v.color, v.price, v.compareAtPrice, v.available])).toEqual([["Black", 12.99, null, true], ["Red", 8, 12.99, false]]);
  });
});

describe("extractOldNavyComposition", () => {
  it("reads fiber bullets from the escaped Fabric & care block", () => {
    const html = String.raw`{\"id\":\"fabric\",\"name\":\"Fabric\",\"label\":\"Fabric & care\",\"description\":null,\"bullets\":[\"60% cotton, 40% polyester\",\"machine wash cold\",\"imported\"],\"links\":null}`;
    expect(extractOldNavyComposition(html)).toBe("60% cotton, 40% polyester");
  });
  it("returns null when there is no fabric block", () => {
    expect(extractOldNavyComposition("<html></html>")).toBeNull();
  });
});

describe("mapOldNavyCategory", () => {
  const m = (name: string, subCategory: string | null, webProductType: string | null, subBrand: string | null = null) =>
    mapOldNavyCategory({ name, subCategory, webProductType, subBrand });
  it.each([
    ["EveryWear Crew-Neck T-Shirt", "T-Shirts & Tanks", "womens tops", null, "tshirts"],
    ["Extra High-Waisted PowerSoft Leggings", "Activewear", "womens activewear", "ON_SPORT", "active-bottoms"],
    ["PowerSoft Longline Sports Bra", "Activewear", "womens activewear", "ON_SPORT", "bras"],
    ["Funnel-Neck Core Puffer Jacket", "Coats & Jackets", "womens jackets", null, "down-padded"],
    ["High-Waisted Wow Wide-Leg Jeans", "Jeans", "womens jeans", null, "jeans"],
    ["Satin Cami Slip Dress", "Dresses & Jumpsuits", "womens dresses", null, "dresses"],
    ["Seamless Bikini Underwear", "Bras & Underwear", "womens bras & underwear", null, "underwear"],
    ["Canvas Tote Bag", "Bags & Accessories", "womens accessories", null, "bags"],
  ])("%s → %s", (name, sub, wpt, brand, l2) => expect(m(name, sub, wpt, brand)).toEqual({ l2 }));

  it("excludes dropship sellers, the other section's items, footwear, swimwear and non-taxonomy accessories", () => {
    expect(m("Peanuts Graphic T-Shirt", "T-Shirts & Tanks", "Dropship")).toEqual({ excluded: "marketplace seller" });
    expect(m("Buffalo Bills Graphic T-Shirt for Men", "T-Shirts & Tanks", "mens tees")).toEqual({ excluded: "other section" });
    // The men's listing mixes in women's pieces the same way.
    expect(mapOldNavyCategory({ name: "Ribbed Tank Top", subCategory: "T-Shirts & Tanks", webProductType: "womens tees", subBrand: null }, "men")).toEqual({ excluded: "other section" });
    expect(mapOldNavyCategory({ name: "Crew-Neck T-Shirt", subCategory: "T-Shirts & Tanks", webProductType: "mens tees", subBrand: null }, "men")).toEqual({ l2: "tshirts" });
    expect(m("Faux-Suede Ankle Boots", "Shoes", "womens boots")).toEqual({ excluded: "footwear" });
    expect(m("Ribbed Bikini Top", "Swimsuits", "womens swimwear")).toEqual({ excluded: "swimwear" });
    expect(m("Gold-Tone Hoop Earrings", "Bags & Accessories", "womens accessories")).toEqual({ excluded: "accessory outside taxonomy" });
  });
});

describe("mapOldNavyCategory (men's sub-categories)", () => {
  const m = (name: string, subCategory: string, webProductType: string) =>
    mapOldNavyCategory({ name, subCategory, webProductType, subBrand: null }, "men");
  it.each([
    ["Soft-Washed Graphic T-Shirt", "Graphic T- Shirts", "mens tees", "tshirts"],
    ["Pique Polo Shirt", "Polos", "mens tees", "polos"],
    ["Regular-Fit Oxford Shirt", "Button Downs", "mens shirts", "shirts-blouses"],
    ["Cozy Crew-Neck Sweater", "Sweaters", "mens sweaters", "sweaters-knits"],
    ["Logo Tapered Jogger Sweatpants", "Sweatshirts & Sweatpants", "mens sweatpants & sweatshirts", "pants"],
    ["Oversized Pullover Hoodie", "Sweatshirts & Sweatpants", "mens sweatpants & sweatshirts", "sweatshirts-hoodies"],
    ["Flannel Pajama Pants", "Pajamas & Loungewear", "mens sleepwear", "pajamas"],
    ["Soft-Knit Boxer Briefs", "Socks & Underwear", "mens accessories", "underwear"],
    ["Crew Socks", "Socks & Underwear", "z mens socks", "socks"],
    ["Canvas Baseball Cap", "Accessories", "z mens hats", "hats"],
  ])("%s → %s", (name, sub, wpt, l2) => expect(m(name, sub, wpt)).toEqual({ l2 }));
});
