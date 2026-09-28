import { describe, expect, it } from "vitest";
import { groupStyles, toRawProduct, type PactColorway, type PactStyle } from "./pact";
import { mapPactCategory } from "./pact-mapping";

function colorway(over: Partial<PactColorway> & Pick<PactColorway, "id" | "styleCode" | "color">): PactColorway {
  return {
    collectionCode: "W-CLOUDK",
    category: ["all bottoms", "pants", "sweatpants"],
    packSize: 1,
    gender: "women",
    fabric: "97% Organic Cotton/3% Elastane",
    fiber: ["97% Organic Cotton", "3% Elastane"],
    romance: "",
    price: { msrp: 78, sale: 78 },
    sizes: {
      sm: { display: "s", inStock: true, price: { msrp: 78, sale: 78 } },
      md: { display: "m", inStock: false, price: { msrp: 78, sale: 78 } },
    },
    tracking: { url: `https://wearpact.com/women/apparel/all bottoms/cloudknit jogger/wa1-${over.id}`, img: { large: [`//static.wearpact.com/img/${over.id}.jpg`] } },
    ...over,
  };
}

const style = (...cws: PactColorway[]): PactStyle => ({ packs: { "1 pack": { default: Object.fromEntries(cws.map((c) => [`${c.id}:${c.color}`, c])) } } });

describe("groupStyles / toRawProduct", () => {
  const styles: Record<string, PactStyle> = {
    "cloudknit jogger": style(colorway({ id: "w29-blk", styleCode: "w29", color: "black", defaultColor: true })),
    "clearance cloudknit jogger": style(
      colorway({
        id: "w29-ngr", styleCode: "w29", color: "nickel grey",
        price: { msrp: 78, sale: 39 },
        sizes: { sm: { display: "s", inStock: true, price: { msrp: 78, sale: 39 } } },
        tracking: { url: "https://wearpact.com/women/apparel/all bottoms/clearance cloudknit jogger/wa1-w29-ngr" },
      }),
    ),
    "everyday classic fit thong 5-pack": style(colorway({ id: "w7c-mix", styleCode: "w7c", color: "mixed", packSize: 5, category: ["undies"] })),
  };

  it("merges a style's regular and clearance listings and keeps multipacks out", () => {
    const { groups, excluded } = groupStyles(styles);
    expect(groups).toHaveLength(1);
    expect(groups[0].keys).toEqual(["cloudknit jogger", "clearance cloudknit jogger"]);
    expect(excluded).toEqual([{ key: "everyday classic fit thong 5-pack", reason: "multipack" }]);
  });

  it("builds one product named and linked from the regular listing, with every colorway", () => {
    const p = toRawProduct(groupStyles(styles).groups[0]);
    expect(p).toMatchObject({
      sourceId: "w29",
      name: "Cloudknit Jogger",
      url: "https://wearpact.com/women/apparel/all%20bottoms/cloudknit%20jogger/wa1-w29-blk",
      l2: "pants",
      compositionText: "97% Organic Cotton, 3% Elastane",
      imageUrl: "https://static.wearpact.com/img/w29-blk.jpg",
    });
    expect([...new Set(p.variants.map((v) => v.color))]).toEqual(["Black", "Nickel Grey"]);
    expect(p.variants.find((v) => v.color === "Nickel Grey")).toMatchObject({ price: 39, compareAtPrice: 78, available: true });
    expect(p.variants.find((v) => v.size === "M")?.available).toBe(false);
  });
});

describe("mapPactCategory", () => {
  const m = (name: string, categories: string[], collectionCode: string | null = null, packSize = 1) =>
    mapPactCategory({ name, categories, collectionCode, packSize });

  it.each([
    ["fit & flare midi dress", ["all dresses & skirts", "dresses"], null, "dresses"],
    ["cool stretch cropped jumpsuit", ["dresses"], null, "jumpsuits"],
    ["softspun essential crewneck tee", ["all tops", "tees", "tops & shirts"], null, "tshirts"],
    ["linen relaxed shirt", ["tops & shirts"], null, "shirts-blouses"],
    ["essential cardigan", ["cardigans", "sweaters"], null, "sweaters-knits"],
    ["cloudknit hoodie", ["hoodies & sweatshirts"], null, "sweatshirts-hoodies"],
    ["on the go-to legging", ["leggings"], "W-ONTHGO", "active-bottoms"],
    ["on the go-to square neck tank", ["tees", "tops & shirts"], "W-ONTHGO", "active-tops"],
    ["cool stretch lounge pant", ["sleep bottoms", "sleepwear", "sweatpants"], null, "loungewear"],
    ["breezy cotton sleep pant", ["sleep bottoms", "sleepwear"], null, "pajamas"],
    ["everyday classic t-shirt bra", ["bras"], null, "bras"],
    ["lace waist brief", ["undies"], null, "underwear"],
    ["no-show socks", ["accessories", "socks"], null, "socks"],
    ["pact floral canvas tote", ["accessories", "bags & hats"], null, "bags"],
  ])("%s → %s", (name, cats, coll, l2) => expect(m(name, cats, coll)).toEqual({ l2 }));

  it("excludes multipacks and sets", () => {
    expect(m("lace waist brief 3-pack", ["undies"], null, 3)).toEqual({ excluded: "multipack" });
    expect(m("cloudknit ritual set", ["pants"], null, 1)).toEqual({ excluded: "multipack" });
  });

  it("leaves unknown categories unmapped so they raise an alert", () => {
    expect(m("mystery thing", ["gift cards"])).toBeNull();
  });
});
