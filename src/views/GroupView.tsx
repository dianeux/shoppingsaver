import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Browser } from "@/components/Browser";
import { SiteNotice } from "@/components/SiteNotice";
import type { Gender } from "@/domain/gender";
import { homeL1, isHomeL1 } from "@/domain/taxonomy";
import { genderLabel, href, l1Name, sectionTitle } from "@/i18n/format";
import { getLang } from "@/i18n/server";
import { coverage, minBrandsPerL2, productsForL1, siteStatus } from "@/lib/catalog";

export function groupParams(gender: Gender) {
  return homeL1(gender).map((l1) => ({ l1 }));
}

export async function groupMetadata(gender: Gender, l1: string): Promise<Metadata> {
  const { lang, t } = await getLang();
  return { title: sectionTitle(lang, gender, isHomeL1(l1, gender) ? l1Name(lang, l1) : t.group.fallbackTitle) };
}

/** An L1 group (e.g. Tops) with every live sub-category mixed; switch sub-categories on the left. */
export async function GroupView({ gender, l1 }: { gender: Gender; l1: string }) {
  if (!isHomeL1(l1, gender)) notFound();
  const [{ lang, t }, cov] = await Promise.all([getLang(), coverage(gender)]);
  const live = cov.filter((c) => c.brands.length >= minBrandsPerL2).map((c) => c.l2);
  const [items, status] = await Promise.all([productsForL1(l1, live, gender), siteStatus()]);

  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8">
      <nav className="font-mono text-[11px] text-ink-faint mb-2">
        <Link href={href(lang, gender, "/")} className="hover:text-ink">{genderLabel(lang, gender)}</Link>
      </nav>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mb-3">
        <h1 className="font-display text-5xl sm:text-6xl leading-none">{l1Name(lang, l1)}</h1>
        <div className="pb-1">
          <SiteNotice {...status} />
        </div>
      </div>
      <p className="text-sm text-ink-soft mb-8 max-w-2xl">{t.group.note}</p>
      {items.length === 0 ? (
        <p className="py-20 text-center text-ink-faint">{t.group.empty(minBrandsPerL2)}</p>
      ) : (
        <Browser products={items} facetL2="switch" gender={gender} />
      )}
    </div>
  );
}
