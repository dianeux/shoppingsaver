import type { Metadata } from "next";
import { Browser } from "@/components/Browser";
import { SiteNotice } from "@/components/SiteNotice";
import type { Gender } from "@/domain/gender";
import { sectionTitle } from "@/i18n/format";
import { getLang } from "@/i18n/server";
import { siteStatus, weeklyDrops } from "@/lib/catalog";
import { DROP_WINDOW_DAYS } from "@/pipeline/drops";

export async function dealsMetadata(gender: Gender): Promise<Metadata> {
  const { lang, t } = await getLang();
  return { title: sectionTitle(lang, gender, t.deals.title) };
}

/** F15: products that got cheaper than the day before, kept for 7 days; no login. */
export async function DealsView({ gender }: { gender: Gender }) {
  const [{ t }, items, status] = await Promise.all([getLang(), weeklyDrops(gender), siteStatus()]);
  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mb-3">
        <h1 className="font-display text-5xl sm:text-6xl leading-none">
          {t.deals.heading[0]}<em className="text-madder">{t.deals.heading[1]}</em>
        </h1>
        <div className="pb-1">
          <SiteNotice {...status} />
        </div>
      </div>
      <p className="text-sm text-ink-soft mb-8 max-w-2xl">{t.deals.note(DROP_WINDOW_DAYS)}</p>
      {items.length === 0 ? (
        <div className="stitch bg-paper border border-rule p-10 text-center max-w-xl mx-auto">
          <p className="font-display text-2xl mb-2">{t.deals.emptyTitle}</p>
          <p className="text-sm text-ink-soft">{t.deals.emptyNote}</p>
        </div>
      ) : (
        <Browser products={items} facetL2 gender={gender} />
      )}
    </div>
  );
}
