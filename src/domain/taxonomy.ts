/**
 * Canonical taxonomy (PRD ch.7), women's MVP. Uniqlo's tree is the backbone;
 * brand-specific tech lines (HEATTECH, AIRism…) are attribute tags, never nodes.
 * Each L2 is one browse page and the scope of the price percentile.
 */
export const TAXONOMY = [
  {
    l1: "tops",
    name: "Tops",
    children: [
      { l2: "tshirts", name: "T 恤" },
      { l2: "shirts-blouses", name: "襯衫與上衣" },
      { l2: "sweaters-knits", name: "毛衣與針織" },
      { l2: "sweatshirts-hoodies", name: "衛衣與連帽" },
      { l2: "polos", name: "Polo 衫" },
    ],
  },
  {
    l1: "outerwear",
    name: "Outerwear",
    children: [
      { l2: "jackets", name: "夾克" },
      { l2: "coats", name: "大衣" },
      { l2: "down-padded", name: "羽絨與鋪棉" },
    ],
  },
  {
    l1: "bottoms",
    name: "Bottoms",
    children: [
      { l2: "jeans", name: "牛仔褲" },
      { l2: "pants", name: "長褲" },
      { l2: "skirts", name: "裙子" },
      { l2: "shorts", name: "短褲" },
    ],
  },
  {
    l1: "dresses",
    name: "Dresses",
    children: [
      { l2: "dresses", name: "洋裝" },
      { l2: "jumpsuits", name: "連身褲" },
    ],
  },
  {
    l1: "innerwear",
    name: "Innerwear",
    children: [
      { l2: "bras", name: "內衣" },
      { l2: "underwear", name: "內褲" },
      { l2: "base-layers", name: "打底" },
    ],
  },
  {
    l1: "loungewear",
    name: "Loungewear",
    children: [
      { l2: "loungewear", name: "家居服" },
      { l2: "pajamas", name: "睡衣" },
    ],
  },
  {
    l1: "activewear",
    name: "Activewear",
    children: [
      { l2: "active-tops", name: "運動上衣" },
      { l2: "active-bottoms", name: "運動下著" },
    ],
  },
  {
    l1: "accessories",
    name: "Accessories",
    children: [
      { l2: "socks", name: "襪子" },
      { l2: "scarves", name: "圍巾" },
      { l2: "hats", name: "帽子" },
      { l2: "bags", name: "包款" },
    ],
  },
  {
    l1: "extended",
    name: "擴充",
    children: [{ l2: "formal", name: "正裝與宴會服" }],
  },
] as const;

export type L1 = (typeof TAXONOMY)[number]["l1"];
export type L2 = (typeof TAXONOMY)[number]["children"][number]["l2"];

export const L2_INDEX: Record<L2, { l1: L1; name: string; l1Name: string }> = Object.fromEntries(
  TAXONOMY.flatMap((g) => g.children.map((c) => [c.l2, { l1: g.l1, name: c.name, l1Name: g.name }])),
) as Record<L2, { l1: L1; name: string; l1Name: string }>;

export function isL2(v: string): v is L2 {
  return v in L2_INDEX;
}

/** PRD ch.5: an L2 page goes live only when at least this many brands stock it. */
export const MIN_BRANDS_PER_L2 = 4;
