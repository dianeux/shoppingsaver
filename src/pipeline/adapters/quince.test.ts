import { describe, expect, it } from "vitest";
import { parseComposition } from "@/domain/composition";
import { extractQuinceComposition, groupItems, normalizeFiberBullet, toRawProduct, type QuinceProductItem } from "./quince";
import { mapQuinceCategory } from "./quince-mapping";

const card = (color: string, price: number, atcDisabled = false) => ({
  displayConfig: { value: color },
  url: `women/linen-shirt?Color=${color}`,
  images: [{ url: `https://images.quince.com/x/${color}.jpg` }],
  price: { salePrice: price },
  atcDisabled,
});

const item = (cards: ReturnType<typeof card>[]): QuinceProductItem => ({
  productId: "245",
  title: "100% European Linen Long Sleeve Shirt",
  slug: "women/linen-shirt",
  gender: "female",
  classification: { department: "Woven Tops", subdepartment: "Linen", class: "Long Sleeve" },
  cardVariants: cards,
});

describe("groupItems / toRawProduct", () => {
  it("merges the repeated color cards of one product", () => {
    const groups = groupItems([item([card("White", 42), card("Flax", 42)]), item([card("Flax", 42), card("Black", 42, true)])]);
    expect(groups).toHaveLength(1);
    const p = toRawProduct(groups[0]);
    expect(p).toMatchObject({ sourceId: "245", url: "https://www.quince.com/women/linen-shirt", l2: "shirts-blouses", excluded: false });
    expect(p.variants.map((v) => [v.color, v.available])).toEqual([["White", true], ["Flax", true], ["Black", false]]);
    expect(p.variants.every((v) => v.compareAtPrice === null && v.size === "")).toBe(true);
  });
});

const pdp = (details: string) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { pageData: { widgets: [{ data: { productPurchaseV2Data: { attributeValues: { details: { localisedValue: details } } } } }] } } },
  })}</script></html>`;

describe("extractQuinceComposition", () => {
  it("picks the fiber bullet from the details list", () => {
    expect(
      extractQuinceComposition(pdp("<ul><li>Premium comfort-stretch denim</li><li>Made from 73% organic cotton, 26% lyocell, 1% spandex</li><li>Machine wash</li></ul>")),
    ).toBe("Body: 73% organic cotton, 26% lyocell, 1% spandex");
  });
  it("keeps explicit labels", () => {
    expect(extractQuinceComposition(pdp("<ul><li>Shell: 100% wool</li><li>Lining: 100% cupro</li></ul>"))).toBe("Shell: 100% wool / Lining: 100% cupro");
  });
  it("ignores percentages that aren't fiber content, even next to a fiber word", () => {
    expect(extractQuinceComposition(pdp("<ul><li>50% lighter than our classic tee</li></ul>"))).toBeNull();
    expect(
      extractQuinceComposition(pdp("<ul><li>Materials: 51% organic cotton, 49% cashmere</li><li>Derived from renewable wood sources with up to 50% lower emissions compared to generic viscose</li></ul>")),
    ).toBe("Materials: 51% organic cotton, 49% cashmere");
  });
  it("falls back to html widgets on the older page template", () => {
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      w: [{ data: { productPurchaseData: { title: "x" } } }, { data: { htmlData: { text: "<ul><li>Made from 100% merino wool</li><li>16 gauge knit</li></ul>" } } }],
    })}</script></html>`;
    expect(extractQuinceComposition(html)).toBe("Body: 100% merino wool");
  });
  it("reads the main product's details, not a related product's", () => {
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      related: [{ attributeValues: { details: { localisedValue: "<ul><li>Soft</li></ul>" } } }],
      main: { productPurchaseV2Data: { attributeValues: { details: { localisedValue: "<ul><li>Made from 100% silk</li></ul>" } } } },
    })}</script></html>`;
    expect(extractQuinceComposition(html)).toBe("Body: 100% silk");
  });
});

describe("normalizeFiberBullet → parseComposition (real Quince bullets)", () => {
  const parse = (bullets: string[]) => parseComposition(bullets.map(normalizeFiberBullet).join(" / "));
  it.each([
    [["Made from 100% recycled polyester", "Fully lined in 100% recycled polyester mesh for added breathability"], ["polyester"]],
    [["Made from 87% recycled nylon 13% spandex", "Fully lined with 100% polyester"], ["nylon", "elastane"]],
    [["Made from 90% RWS-certified wool, 10% cashmere", "Fully lined with 100% polyester twill"], ["wool", "cashmere"]],
    [["Crafted from 55% recycled Italian wool, 35% recycled polyester, 5% recycled nylon, 5% other fibers", "Fully lined with 55% polyester, 45% viscose"], ["wool", "polyester", "nylon", "other"]],
    [["Crafted from 100% Grade-A Mongolian cashmere", "100% polyester faux shirt underlayer"], ["cashmere"]],
    [["Made from 100% organic cotton", "Fully lined with 100% cotton flannel"], ["cotton"]],
    [["Black, Faded Black: Made from 65% cotton, 18% recycled polyester, 10% viscose, 5% lycra, 2% polyester", "Frosted Blue: Made from 94% organic cotton, 5% elasterell-p, 1% lycra"], ["cotton", "polyester", "viscose", "elastane", "polyester"]],
  ])("%j", (bullets, fibers) => {
    const r = parse(bullets);
    expect(r.ok && r.composition.main.map((f) => f.fiber)).toEqual(fibers);
  });
});

describe("mapQuinceCategory", () => {
  const m = (title: string, department: string, subdepartment: string, cls: string) => mapQuinceCategory(title, { department, subdepartment, class: cls });
  it.each([
    ["Bella Stretch Barrel Jeans", "Bottoms", "Denim", "Pants", "jeans"],
    ["100% European Linen High Waisted Shorts", "Bottoms", "Linen", "Shorts", "shorts"],
    ["Responsible Down Long Puffer Jacket", "Outerwear", "Down", "Jackets", "down-padded"],
    ["Comfort Stretch Long Trench Coat", "Outerwear", "Cotton/Twill", "Casual", "coats"],
    ["Italian Wool Oversized Blazer", "Outerwear", "Wool", "Blazer", "jackets"],
    ["Mongolian Cashmere Full-Zip Hoodie", "Sweaters", "Cashmere", "Hoodie", "sweaters-knits"],
    ["Cotton Modal V-Neck Tee", "Knit Tops", "Tees", "V-Neck", "tshirts"],
    ["Silk Bridesmaid Dress", "Dresses and Skirts", "Bridesmaids", "Dresses", "formal"],
    ["Ultra-Form High-Rise Crossover Legging", "Active", "Bottoms", "Leggings", "active-bottoms"],
    ["Power-Up Long Line Strappy Sports Bra", "Active", "Tops", "Bras", "active-tops"],
    ["100% Washable Silk Robe", "Lounge", "Silk", "Robes", "loungewear"],
  ])("%s → %s", (title, d, s, c, l2) => expect(m(title, d, s, c)).toEqual({ l2 }));

  it("excludes swimwear and multipacks", () => {
    expect(m("Italian V-Neck Bikini Top", "Swimwear", "Bikini", "Top")).toEqual({ excluded: "swimwear" });
    expect(m("Organic Cotton Hipster (6-pack)", "Intimates", "Cotton", "Underwear")).toEqual({ excluded: "multipack" });
  });

  it("leaves unknown departments unmapped so they raise an alert", () => {
    expect(m("Leather Belt", "Accessories", "Leather", "Belts")).toBeNull();
  });
});

describe("mapQuinceCategory — swimwear outside the Swimwear department", () => {
  it("excludes men's swim trunks filed under Bottoms", () => {
    expect(mapQuinceCategory('Italian Swim Trunks - 7"', { department: "Bottoms", subdepartment: "Shorts", class: "Shorts" })).toEqual({ excluded: "swimwear" });
  });
});
