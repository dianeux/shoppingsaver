import { describe, expect, it } from "vitest";
import { mujiGenders } from "@/pipeline/adapters/muji-mapping";
import { genderOfPath, genderPath, productId, sectionTitle } from "./gender";
import { homeL1, isHomeL1 } from "./taxonomy";

describe("sections", () => {
  it("keeps women's URLs and puts men's under /men", () => {
    expect(genderPath("women", "/g/tops")).toBe("/g/tops");
    expect(genderPath("men", "/g/tops")).toBe("/men/g/tops");
    expect(genderPath("men", "/")).toBe("/men");
  });

  it("reads the section from a path", () => {
    expect(genderOfPath("/")).toBe("women");
    expect(genderOfPath("/c/tshirts")).toBe("women");
    expect(genderOfPath("/men")).toBe("men");
    expect(genderOfPath("/men/c/tshirts")).toBe("men");
    expect(genderOfPath("/menswear")).toBe("women"); // not a section prefix
  });

  it("keeps women's product ids stable and gives men's rows their own", () => {
    expect(productId("muji", "123", "women")).toBe("muji:123");
    expect(productId("muji", "123", "men")).toBe("muji:men:123");
  });

  it("titles men's pages", () => {
    expect(sectionTitle("women", "Tops")).toBe("Tops");
    expect(sectionTitle("men", "Tops")).toBe("男裝 Tops");
  });

  it("drops the dresses group from the men's home", () => {
    expect(homeL1("women")).toContain("dresses");
    expect(homeL1("men")).not.toContain("dresses");
    expect(isHomeL1("dresses", "men")).toBe(false);
  });

  it("lists unisex Muji accessories in both sections", () => {
    expect(mujiGenders("Men's Tops", [])).toEqual(["men"]);
    expect(mujiGenders("Women's Tops", [])).toEqual(["women"]);
    expect(mujiGenders("Socks", ["Size_Men"])).toEqual(["men"]);
    expect(mujiGenders("Socks", [])).toEqual(["women", "men"]);
  });
});
