export const BRAND_IDS = ["hm", "zara", "uniqlo", "gu", "oldnavy", "muji", "pact", "everlane", "quince"] as const;
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
  /**
   * Set when the site refuses automated clients that identify themselves; we
   * don't disguise the crawler to get around it (PRD ch.11), so the brand stays out.
   */
  blocked?: string;
}

export const BRANDS: Record<BrandId, BrandInfo> = {
  hm: { id: "hm", name: "H&M", positioning: "快時尚", officialHosts: ["www2.hm.com"], blocked: "rejects user agents containing \"bot\"" },
  zara: { id: "zara", name: "Zara", positioning: "快時尚", officialHosts: ["www.zara.com"], blocked: "403 Access Denied to crawlers" },
  uniqlo: { id: "uniqlo", name: "Uniqlo", positioning: "機能基本款", officialHosts: ["www.uniqlo.com"], blocked: "no response to non-browser clients" },
  gu: { id: "gu", name: "GU", positioning: "快時尚", officialHosts: ["www.gu-global.com"], blocked: "no response to non-browser clients" },
  oldnavy: { id: "oldnavy", name: "Old Navy", positioning: "平價基本款", officialHosts: ["oldnavy.gap.com", "api.gap.com"] }, // search API host
  everlane: { id: "everlane", name: "Everlane", positioning: "透明定價基本款", officialHosts: ["www.everlane.com"] },
  muji: { id: "muji", name: "Muji", positioning: "無印基本款", officialHosts: ["www.muji.us"] },
  pact: { id: "pact", name: "Pact", positioning: "有機棉基本款", officialHosts: ["wearpact.com"] },
  // Quince's storefront pages its product lists from its own API host.
  quince: { id: "quince", name: "Quince", positioning: "工廠直營精品基本款", officialHosts: ["www.quince.com", "api-prod-public.onequince.com"] },
};

/** Brands we index (the rest are listed only for the record of why they're missing). */
export const ACTIVE_BRAND_IDS: BrandId[] = BRAND_IDS.filter((b) => !BRANDS[b].blocked);

export function isBrandId(v: string): v is BrandId {
  return (BRAND_IDS as readonly string[]).includes(v);
}
