import { describe, expect, it } from "vitest";
import { extractEverlaneComposition, groupColorways, splitTitle, toRawProduct } from "./everlane";
import { mapEverlaneCategory } from "./everlane-mapping";
import type { ShopifyProduct } from "./shopify";

const colorway = (handle: string, title: string, available: boolean, over: Partial<ShopifyProduct> = {}): ShopifyProduct => ({
  id: handle.length,
  title,
  handle,
  body_html: null,
  product_type: "Knit Tops",
  tags: ["female", "Product Group: 1627", "subcategory: tees and tanks"],
  options: [{ name: "Size", position: 1, values: ["S", "M"] }],
  variants: [
    { id: 1, option1: "S", option2: null, option3: null, price: "30.00", compare_at_price: null, available, featured_image: null },
    { id: 2, option1: "M", option2: null, option3: null, price: "30.00", compare_at_price: null, available: false, featured_image: null },
  ],
  images: [{ src: `https://cdn.shopify.com/${handle}.jpg` }],
  ...over,
});

describe("everlane grouping", () => {
  it("splits name and color out of the title", () => {
    expect(splitTitle("The Box-Cut Tee in Essential Cotton | White | No Pocket")).toEqual({ name: "The Box-Cut Tee in Essential Cotton", color: "White / No Pocket" });
  });

  it("groups colorways by product group and leads with an in-stock one", () => {
    const groups = groupColorways([
      colorway("tee-black", "The Box-Cut Tee | Black", false),
      colorway("tee-white", "The Box-Cut Tee | White", true),
      colorway("retired", "Old Tee | Red", false, { tags: ["female", "Product Group: 9", "subcategory: tees and tanks"] }),
    ]);
    expect(groups).toHaveLength(1); // the fully retired group is dropped
    const p = toRawProduct(groups[0]);
    expect(p).toMatchObject({ sourceId: "1627", name: "The Box-Cut Tee", url: "https://www.everlane.com/products/tee-white", l2: "tshirts" });
    expect(p.variants.map((v) => [v.color, v.size, v.available])).toEqual([
      ["Black", "S", false], ["Black", "M", false], ["White", "S", true], ["White", "M", false],
    ]);
  });
});

describe("extractEverlaneComposition", () => {
  it("reads the Materials list and stops before Care", () => {
    const html = `<div id="ProductAccordion-Materials--template--1__main">Materials:<ul><li>100% Organic Cotton, Exclusive of Elastic</li></ul>
      <div>Organic cotton uses crop rotation…</div>Care:<ul><li>Machine Wash Cold</li></ul></div>`;
    expect(extractEverlaneComposition(html)).toBe("100% Organic Cotton, Exclusive of Elastic");
  });
  it("returns null without a Materials accordion", () => {
    expect(extractEverlaneComposition("<div>Care:<ul><li>Dry clean</li></ul></div>")).toBeNull();
  });
});

describe("mapEverlaneCategory", () => {
  it.each([
    ["Knit Tops", "tees and tanks", "The Box-Cut Tee | White", "tshirts"],
    ["Knit Tops", "sweatshirts", "The Track Crew | Grey", "sweatshirts-hoodies"],
    ["Denim", "pants", "The Way-High Jean | Blue", "jeans"],
    ["Denim", "shorts", "The Denim Short | Blue", "shorts"],
    ["Outerwear", "functional ow", "The ReNew Puffer | Black", "down-padded"],
    ["Outerwear", "tailored ow", "The Wool Overcoat | Camel", "coats"],
    ["Outerwear", "blazers", "The Oversized Blazer | Black", "jackets"],
    ["Dresses", "jumpsuits", "The Utility Jumpsuit | Olive", "jumpsuits"],
    ["Body", "bras", "The Wireless Bra | Black", "bras"],
    ["", null, "Everlane x Peace & Quiet Cashmere Hoodie | Grey", "sweatshirts-hoodies"],
    ["", null, "Tailored Drape Mini Skort | Black", "skirts"],
  ])("%s / %s / %s → %s", (type, sub, title, l2) => expect(mapEverlaneCategory(type, sub, title)).toEqual({ l2 }));

  it("excludes footwear, swimwear and home goods", () => {
    expect(mapEverlaneCategory("Sandals", "flat sandals", "The Day Sandal")).toEqual({ excluded: "footwear" });
    expect(mapEverlaneCategory("Swimwear", "swim bottoms", "The Bikini Bottom")).toEqual({ excluded: "swimwear" });
    expect(mapEverlaneCategory("", null, "Everlane x Peace & Quiet Welcome Mat")).toEqual({ excluded: "not apparel" });
  });
});
