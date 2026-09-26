import { describe, expect, it } from "vitest";
import { extractMujiComposition } from "./muji";
import { mapMujiCategory } from "./muji-mapping";

const tab = (inner: string) => `
<details class="collapsible-tab"><summary class="collapsible-tab__heading">
  <span>Material &amp; Care</span><svg class="icon-chevron-down"></svg></summary>
  <div class="collapsible-tab__text">${inner}</div>
</details>`;

describe("extractMujiComposition", () => {
  it("reads the fiber line and ignores care notes", () => {
    const html = tab(
      `<p><span class="metafield-multi_line_text_field">55% Hemp, 45% Cotton </span></p>` +
        `<p><span class="metafield-multi_line_text_field">- Color transfer may occur. Wash separately.</span></p>`,
    );
    expect(extractMujiComposition(html)).toBe("55% Hemp, 45% Cotton");
  });
  it("drops care notes that share the fiber line's paragraph", () => {
    const html = tab(`<p><span>100% Polyester<br>- 79% recycled polyester is used for the body.</span></p>`);
    expect(extractMujiComposition(html)).toBe("100% Polyester");
  });
  it("returns null when the tab has only care notes", () => {
    expect(extractMujiComposition(tab(`<p>- Hand wash cold.</p>`))).toBeNull();
  });
  it("returns null when there is no Material & Care tab", () => {
    expect(extractMujiComposition(`<div>Shipping &amp; Returns</div>`)).toBeNull();
  });
});

describe("mapMujiCategory", () => {
  it.each([
    ["Women's Tops", ["Sweaters & Cardigans", "Cardigan"], "sweaters-knits"],
    ["Women's Tops", ["T-Shirt", "Long Sleeve T-Shirt"], "tshirts"],
    ["Women's Bottoms", ["Women's Denim", "Jeans", "Pants"], "jeans"],
    ["Women's Outerwear", ["Down Jacket", "Outerwear"], "down-padded"],
    ["Women's Dresses", ["jumpsuit"], "jumpsuits"],
    ["Socks", ["Socks"], "socks"],
  ])("%s %j → %s", (pt, tags, l2) => expect(mapMujiCategory(pt, tags)).toEqual({ l2 }));

  it.each([
    ["Women's Tops", "Women's Double Knitted Sweatshirt Cardigan", "sweatshirts-hoodies"],
    ["Women's Tops", "Women's Jersey Sleeveless T-Shirt", "tshirts"],
    ["Women's Tops", "Lyocell Blend Camisole Blouse", "shirts-blouses"],
    ["Women's Tops", "Women's Breathable Seersucker Shirt Jacket", "jackets"],
    ["Women's Tops", "Cotton Wool Jumpsuit", "jumpsuits"],
    ["Winter Accessories", "Merino Wool Rib Beanie", "hats"],
  ])("falls back to the title: %s %s → %s", (pt, title, l2) => expect(mapMujiCategory(pt, [], title)).toEqual({ l2 }));

  it("excludes categories outside the taxonomy without alerting", () => {
    expect(mapMujiCategory("Winter Accessories", [], "Wool Blend Touchscreen Gloves")).toEqual({ excluded: true });
  });

  it("leaves unknown source categories unmapped so they raise an alert", () => {
    expect(mapMujiCategory("Women's Tops", ["Mystery"], "Mystery Garment")).toBeNull();
    expect(mapMujiCategory("Stationery", [])).toBeNull();
  });
});
