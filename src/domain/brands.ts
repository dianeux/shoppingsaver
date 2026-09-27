export const BRAND_IDS = ["hm", "zara", "uniqlo", "gu", "muji", "pact", "quince"] as const;
export type BrandId = (typeof BRAND_IDS)[number];

export interface BrandInfo {
  id: BrandId;
  name: string;
  positioning: string;
  /**
   * Official US-site hosts. The fetcher refuses any URL whose host is not listed
   * here, which keeps counterfeit mirrors (mujiusasale.com, mujist.shop) out.
   */
  officialHosts: string[];
}

export const BRANDS: Record<BrandId, BrandInfo> = {
  hm: { id: "hm", name: "H&M", positioning: "快時尚", officialHosts: ["www2.hm.com"] },
  zara: { id: "zara", name: "Zara", positioning: "快時尚", officialHosts: ["www.zara.com"] },
  uniqlo: { id: "uniqlo", name: "Uniqlo", positioning: "機能基本款", officialHosts: ["www.uniqlo.com"] },
  gu: { id: "gu", name: "GU", positioning: "快時尚", officialHosts: ["www.gu-global.com"] },
  muji: { id: "muji", name: "Muji", positioning: "無印基本款", officialHosts: ["www.muji.us"] },
  pact: { id: "pact", name: "Pact", positioning: "有機棉基本款", officialHosts: ["wearpact.com"] },
  // Quince's storefront pages its product lists from its own API host.
  quince: { id: "quince", name: "Quince", positioning: "工廠直營精品基本款", officialHosts: ["www.quince.com", "api-prod-public.onequince.com"] },
};

export function isBrandId(v: string): v is BrandId {
  return (BRAND_IDS as readonly string[]).includes(v);
}
