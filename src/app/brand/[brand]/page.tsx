import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Browser } from "@/components/Browser";
import { SiteNotice } from "@/components/SiteNotice";
import { ACTIVE_BRAND_IDS, BRANDS, isBrandId } from "@/domain/brands";
import { productsForBrand, siteStatus } from "@/lib/catalog";

export const revalidate = 3600;

export function generateStaticParams() {
  return ACTIVE_BRAND_IDS.map((brand) => ({ brand }));
}

export async function generateMetadata({ params }: PageProps<"/brand/[brand]">): Promise<Metadata> {
  const { brand } = await params;
  return { title: isBrandId(brand) ? BRANDS[brand].name : "品牌" };
}

/** F3: one brand across all categories. Scores still come from each item's own L2. */
export default async function BrandPage({ params }: PageProps<"/brand/[brand]">) {
  const { brand } = await params;
  if (!isBrandId(brand)) notFound();
  const [items, status] = await Promise.all([productsForBrand(brand), siteStatus()]);
  const info = BRANDS[brand];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <nav className="font-mono text-[11px] text-ink-faint mb-2">
        <Link href="/" className="hover:text-ink">品牌</Link> / {info.positioning}
      </nav>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mb-3">
        <h1 className="font-display text-5xl sm:text-6xl leading-none">{info.name}</h1>
        <div className="pb-1">
          <SiteNotice {...status} relevant={[brand]} />
        </div>
      </div>
      <p className="text-sm text-ink-soft mb-8 max-w-2xl">性價比分數仍是和同品類其他品牌比較的結果，所以可以在這頁直接看出這個品牌哪些品類最划算。</p>
      {items.length === 0 ? <p className="py-20 text-center text-ink-faint">這個品牌還沒接入。</p> : <Browser products={items} facetL2 />}
    </div>
  );
}
