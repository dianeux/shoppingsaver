import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Browser } from "@/components/Browser";
import { SiteNotice } from "@/components/SiteNotice";
import type { Gender } from "@/domain/gender";
import { isL2, L2_INDEX, type L2 } from "@/domain/taxonomy";
import { genderLabel, href, l1Name, l2Name, sectionTitle } from "@/i18n/format";
import { getLang } from "@/i18n/server";
import { productsForL2, siteStatus } from "@/lib/catalog";

// Pre-render every category; ISR refreshes them hourly after the nightly index.
export function categoryParams() {
  return (Object.keys(L2_INDEX) as L2[]).map((l2) => ({ l2 }));
}

export async function categoryMetadata(gender: Gender, l2: string): Promise<Metadata> {
  const { lang, t } = await getLang();
  return { title: sectionTitle(lang, gender, isL2(l2) ? l2Name(lang, l2) : t.group.fallbackTitle) };
}

export async function CategoryView({ gender, l2 }: { gender: Gender; l2: string }) {
  if (!isL2(l2)) notFound();
  const [{ lang }, items, status] = await Promise.all([getLang(), productsForL2(l2, gender), siteStatus()]);
  const l1 = L2_INDEX[l2].l1;

  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8">
      <nav className="font-mono text-[11px] text-ink-faint mb-2">
        <Link href={href(lang, gender, "/")} className="hover:text-ink">{genderLabel(lang, gender)}</Link> /{" "}
        <Link href={href(lang, gender, `/g/${l1}`)} className="hover:text-ink">{l1Name(lang, l1)}</Link>
      </nav>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mb-8">
        <h1 className="font-display text-5xl sm:text-6xl leading-none">{l2Name(lang, l2)}</h1>
        <div className="pb-1">
          <SiteNotice {...status} />
        </div>
      </div>
      <Browser products={items} gender={gender} />
    </div>
  );
}
