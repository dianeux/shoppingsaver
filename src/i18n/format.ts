import { BRANDS, type BrandId } from "@/domain/brands";
import type { ColorFamily } from "@/domain/colors";
import type { FiberShare } from "@/domain/composition";
import { genderPath, type Gender } from "@/domain/gender";
import { FIBERS, type Fiber } from "@/domain/materials";
import type { L1, L2 } from "@/domain/taxonomy";
import { getDict } from "./dict";
import { localePath, type Locale } from "./locales";

/** Public URL for a section path in a language: href("en", "men", "/g/tops") → "/en/men/g/tops". */
export function href(lang: Locale, gender: Gender, path: string): string {
  return localePath(lang, genderPath(gender, path));
}

export const genderLabel = (lang: Locale, g: Gender) => getDict(lang).gender[g];
export const l1Name = (lang: Locale, l1: L1) => getDict(lang).l1[l1];
export const l2Name = (lang: Locale, l2: L2) => getDict(lang).l2[l2];
export const colorLabel = (lang: Locale, c: ColorFamily) => getDict(lang).colors[c];
export const positioning = (lang: Locale, b: BrandId) => getDict(lang).positioning[b];
export const brandName = (b: BrandId) => BRANDS[b].name;

/** Page title within a section; women's pages keep the plain title. */
export function sectionTitle(lang: Locale, gender: Gender, title: string): string {
  return gender === "women" ? title : getDict(lang).sectionTitle(getDict(lang).gender[gender], title);
}

/** English fiber names where the first synonym isn't the right display name. */
const FIBER_EN: Partial<Record<Fiber, string>> = { elasterell: "elasterell-P", vicuna: "vicuña", faux_leather: "faux leather" };

export function fiberLabel(lang: Locale, f: Fiber): string {
  return lang === "zh" ? FIBERS[f].label : (FIBER_EN[f] ?? FIBERS[f].synonyms[0]);
}

export type FiberPart = Pick<FiberShare, "fiber" | "percentage" | "recycled" | "organic">;

/** "60% 有機棉 · 40% 聚酯" / "60% organic cotton · 40% polyester", largest share first. */
export function formatComposition(lang: Locale, main: FiberPart[]): string {
  const d = getDict(lang).composition;
  return [...main]
    .sort((a, b) => b.percentage - a.percentage)
    .map((f) => `${f.percentage}% ${f.recycled ? d.recycled : ""}${f.organic ? d.organic : ""}${fiberLabel(lang, f.fiber)}`)
    .join(" · ");
}

/** English for the search lexicon's labels (the lexicon itself reads both languages). */
const LEXICON_EN: Record<string, string> = {
  "T 恤": "T-shirts", 上衣: "Tops", 襯衫與上衣: "Shirts & blouses", 毛衣與針織: "Sweaters & knits", 衛衣與連帽: "Sweatshirts & hoodies",
  "Polo 衫": "Polos", 外套: "Outerwear", 夾克: "Jackets", 大衣: "Coats", 羽絨與鋪棉: "Down & padded", 牛仔褲: "Jeans", 長褲: "Pants",
  棉褲: "Sweatpants", 裙子: "Skirts", 短褲: "Shorts", 洋裝: "Dresses", 連身褲: "Jumpsuits", 內衣: "Bras", 內褲: "Underwear",
  打底: "Base layers", 家居服: "Loungewear", 睡衣: "Pajamas", 運動上衣: "Active tops", 運動下著: "Active bottoms", 襪子: "Socks",
  圍巾: "Scarves", 帽子: "Hats", 包款: "Bags",
  低胸: "Low neckline", "V 領": "V-neck", 圓領: "Crew neck", 方領: "Square neck", 一字領: "Boat neck", 高領: "High neck",
  露肩: "Off-shoulder", 平口: "Strapless", 細肩帶: "Spaghetti strap", 無袖: "Sleeveless", 短袖: "Short sleeve", 長袖: "Long sleeve",
  七分袖: "3/4 sleeve", 短版: "Cropped", 長版: "Longline", 寬鬆: "Relaxed", 修身: "Fitted", 寬褲: "Wide-leg", 直筒: "Straight",
  喇叭: "Flare", 緊身: "Skinny", 高腰: "High-rise", 低腰: "Low-rise", 長裙: "Maxi", 迷你: "Mini", 條紋: "Striped", 格紋: "Plaid",
  碎花: "Floral", 羅紋: "Ribbed", 透氣: "Breathable", 保暖: "Warm", 防水: "Water-repellent",
  白: "White", 黑: "Black", 灰: "Gray", 米: "Beige", 棕: "Brown", 深藍: "Navy", 藍: "Blue", 綠: "Green", 紅: "Red", 粉: "Pink",
  紫: "Purple", 黃: "Yellow", 橘: "Orange", 花紋: "Pattern",
  純棉: "100% cotton", 棉: "Cotton", 亞麻: "Linen", 羊毛: "Wool", 喀什米爾: "Cashmere", 絲: "Silk", 天絲: "Lyocell",
  莫代爾: "Modal", 聚酯: "Polyester", 皮革: "Leather",
};

export function lexiconLabel(lang: Locale, label: string): string {
  return lang === "zh" ? label : (LEXICON_EN[label] ?? label);
}

/** For tests: every lexicon label that lacks an English name. */
export function missingLexiconLabels(labels: string[]): string[] {
  const brands = new Set(Object.values(BRANDS).map((b) => b.name));
  return labels.filter((l) => !(l in LEXICON_EN) && !brands.has(l));
}
