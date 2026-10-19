import { describe, expect, it } from "vitest";
import { accessoryFromTitle } from "@/pipeline/adapters/accessories";
import { packSizeOf, unitPrice } from "./pack";

describe("packSizeOf", () => {
  it.each([
    ["Quarter Crew Socks 3-Pack for Women", 3],
    ["5-Pack Soft-Washed Boxer Shorts", 5],
    ["Organic Cotton Hipster (6-pack)", 6],
    ["Everyday Thong Pack of 4", 4],
    ["Crew Neck T-Shirt", 1],
    ["Pajama Set", 1],
    ["The 100-Pack Mystery", 1],
  ])("%s → %i", (name, n) => expect(packSizeOf(name)).toBe(n));

  it("divides the pack price", () => expect(unitPrice(12, 6)).toBe(2));
});

describe("accessoryFromTitle", () => {
  it.each([
    ["Neoprene Belt Bag", "bags"],
    ["Macrame Ring Handle Bag", "bags"],
    ["Mongolian Cashmere Twist Headband", "jewelry-hair"],
    ["Claw Clip 2-Pack", "jewelry-hair"],
    ["Gold-Tone Hoop Earrings", "jewelry-hair"],
    ["Fairisle Mittens for Women", "gloves"],
    ["Faux-Leather Belt", "belts"],
    ["Cable-Knit Beanie", "hats"],
    ["Oversized Blanket Scarf", "scarves"],
    ["Croc-Embossed Card Holder", "excluded"],
    ["Stitch Plush Keychain Bag Charm", "excluded"],
    ["Crew-Neck T-Shirt", null],
  ] as const)("%s → %s", (title, expected) => expect(accessoryFromTitle(title)).toBe(expected));
});
