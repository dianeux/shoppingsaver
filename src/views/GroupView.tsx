import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Browser } from "@/components/Browser";
import { SiteNotice } from "@/components/SiteNotice";
import { GENDER_LABEL, genderPath, sectionTitle, type Gender } from "@/domain/gender";
import { homeL1, isHomeL1, TAXONOMY } from "@/domain/taxonomy";
import { coverage, minBrandsPerL2, productsForL1, siteStatus } from "@/lib/catalog";

export function groupParams(gender: Gender) {
  return homeL1(gender).map((l1) => ({ l1 }));
}

export function groupMetadata(gender: Gender, l1: string): Metadata {
  return { title: sectionTitle(gender, isHomeL1(l1, gender) ? TAXONOMY.find((g) => g.l1 === l1)!.name : "品類") };
}

/** An L1 group (e.g. Tops) with every live sub-category mixed; switch sub-categories on the left. */
export async function GroupView({ gender, l1 }: { gender: Gender; l1: string }) {
  if (!isHomeL1(l1, gender)) notFound();
  const group = TAXONOMY.find((g) => g.l1 === l1)!;
  const cov = await coverage(gender);
  const live = cov.filter((c) => c.brands.length >= minBrandsPerL2).map((c) => c.l2);
  const [items, status] = await Promise.all([productsForL1(l1, live, gender), siteStatus()]);

  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8">
      <nav className="font-mono text-[11px] text-ink-faint mb-2">
        <Link href={genderPath(gender, "/")} className="hover:text-ink">{GENDER_LABEL[gender]}</Link>
      </nav>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mb-3">
        <h1 className="font-display text-5xl sm:text-6xl leading-none">{group.name}</h1>
        <div className="pb-1">
          <SiteNotice {...status} />
        </div>
      </div>
      <p className="text-sm text-ink-soft mb-8 max-w-2xl">
        性價比的價格分只和同一個子分類比較，所以混排時每件的分數仍代表它在自己子分類裡的位置。
      </p>
      {items.length === 0 ? (
        <p className="py-20 text-center text-ink-faint">這個分類還沒有子分類達到上線門檻（至少 {minBrandsPerL2} 家品牌有貨）。</p>
      ) : (
        <Browser products={items} facetL2="switch" gender={gender} />
      )}
    </div>
  );
}
