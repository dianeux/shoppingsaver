import { describe, expect, it } from "vitest";
import { productPrice } from "./pricing";
import type { RawVariant } from "./types";

const v = (color: string, price: number, url: string | null, compareAtPrice: number | null = null): RawVariant => ({
  color, size: "M", price, compareAtPrice, available: true, imageUrl: null, url,
});

describe("productPrice", () => {
  it("shows the cheapest color and links to it (The Luxe Rib Long-Sleeve Crew case)", () => {
    const p = productPrice(
      [v("Black", 48, "/black"), v("Washed Heathered Grey", 12, "/grey", 48), v("Heathered Dark Sea", 24, "/sea", 48)],
      "/black",
    );
    expect(p).toEqual({ sale: 12, list: 48, max: 48, color: "Washed Heathered Grey", url: "/grey" });
  });

  it("keeps the usual page when colors tie on price", () => {
    expect(productPrice([v("White", 48, "/white"), v("Black", 48, "/black")], "/black").url).toBe("/black");
  });

  it("falls back to the product page when the site has no per-color URL", () => {
    const p = productPrice([v("Default", 20, null)], "/product");
    expect(p).toMatchObject({ sale: 20, max: 20, url: "/product" });
  });
});
