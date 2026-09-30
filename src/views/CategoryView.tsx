import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Browser } from "@/components/Browser";
import { SiteNotice } from "@/components/SiteNotice";
import { GENDER_LABEL, genderPath, sectionTitle, type Gender } from "@/domain/gender";
import { isL2, L2_INDEX, type L2 } from "@/domain/taxonomy";
import { productsForL2, siteStatus } from "@/lib/catalog";

// Pre-render every category; ISR refreshes them hourly after the nightly index.
export function categoryParams() {
  return (Object.keys(L2_INDEX) as L2[]).map((l2) => ({ l2 }));
}

export function categoryMetadata(gender: Gender, l2: string): Metadata {
  return { title: sectionTitle(gender, isL2(l2) ? L2_INDEX[l2].name : "品類") };
}

export async function CategoryView({ gender, l2 }: { gender: Gender; l2: string }) {
  if (!isL2(l2)) notFound();
  const [items, status] = await Promise.all([productsForL2(l2, gender), siteStatus()]);
  const info = L2_INDEX[l2];

  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8">
      <nav className="font-mono text-[11px] text-ink-faint mb-2">
        <Link href={genderPath(gender, "/")} className="hover:text-ink">{GENDER_LABEL[gender]}</Link> /{" "}
        <Link href={genderPath(gender, `/g/${info.l1}`)} className="hover:text-ink">{info.l1Name}</Link>
      </nav>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mb-8">
        <h1 className="font-display text-5xl sm:text-6xl leading-none">{info.name}</h1>
        <div className="pb-1">
          <SiteNotice {...status} />
        </div>
      </div>
      <Browser products={items} gender={gender} />
    </div>
  );
}
