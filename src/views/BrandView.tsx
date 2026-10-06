import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Browser } from "@/components/Browser";
import { SiteNotice } from "@/components/SiteNotice";
import { ACTIVE_BRAND_IDS, BRANDS, isBrandId } from "@/domain/brands";
import type { Gender } from "@/domain/gender";
import { genderLabel, href, positioning, sectionTitle } from "@/i18n/format";
import { getLang } from "@/i18n/server";
import { productsForBrand, siteStatus } from "@/lib/catalog";

export function brandParams() {
  return ACTIVE_BRAND_IDS.map((brand) => ({ brand }));
}

export async function brandMetadata(gender: Gender, brand: string): Promise<Metadata> {
  const { lang, t } = await getLang();
  return { title: sectionTitle(lang, gender, isBrandId(brand) ? BRANDS[brand].name : t.brand.fallbackTitle) };
}

/** F3: one brand across all categories. Scores still come from each item's own L2. */
export async function BrandView({ gender, brand }: { gender: Gender; brand: string }) {
  if (!isBrandId(brand)) notFound();
  const [{ lang, t }, items, status] = await Promise.all([getLang(), productsForBrand(brand, gender), siteStatus()]);

  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8">
      <nav className="font-mono text-[11px] text-ink-faint mb-2">
        <Link href={href(lang, gender, "/")} className="hover:text-ink">{genderLabel(lang, gender)}</Link> / {positioning(lang, brand)}
      </nav>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mb-3">
        <h1 className="font-display text-5xl sm:text-6xl leading-none">{BRANDS[brand].name}</h1>
        <div className="pb-1">
          <SiteNotice {...status} relevant={[brand]} />
        </div>
      </div>
      <p className="text-sm text-ink-soft mb-8 max-w-2xl">{t.brand.note}</p>
      {items.length === 0 ? (
        <p className="py-20 text-center text-ink-faint">{t.brand.empty(genderLabel(lang, gender))}</p>
      ) : (
        <Browser products={items} facetL2 gender={gender} />
      )}
    </div>
  );
}
