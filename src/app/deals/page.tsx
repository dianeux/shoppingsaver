import type { Metadata } from "next";
import { Browser } from "@/components/Browser";
import { SiteNotice } from "@/components/SiteNotice";
import { siteStatus, weeklyDrops } from "@/lib/catalog";
import { DROP_MIN, MIN_HISTORY_DAYS } from "@/pipeline/drops";

export const revalidate = 3600;
export const metadata: Metadata = { title: "本週降價" };

/** F15: last 7 days of real drops (vs 30-day median), no login. */
export default async function DealsPage() {
  const [items, status] = await Promise.all([weeklyDrops(), siteStatus()]);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mb-3">
        <h1 className="font-display text-5xl sm:text-6xl leading-none">
          本週<em className="text-madder">降價</em>
        </h1>
        <div className="pb-1">
          <SiteNotice {...status} />
        </div>
      </div>
      <p className="text-sm text-ink-soft mb-8 max-w-2xl">
        只列近 7 天、現價比過去 30 天中位價低至少 {Math.round(DROP_MIN * 100)}% 的商品。常態特價的商品中位價本來就是特價，所以不會出現在這裡。
      </p>
      {items.length === 0 ? (
        <div className="stitch bg-paper border border-rule p-10 text-center max-w-xl mx-auto">
          <p className="font-display text-2xl mb-2">這週還沒有真降價</p>
          <p className="text-sm text-ink-soft">
            降價判定需要至少 {MIN_HISTORY_DAYS} 天的價格快照。每晚索引會累積一筆，資料夠了這裡就會自動出現。
          </p>
        </div>
      ) : (
        <Browser products={items} facetL2 />
      )}
    </div>
  );
}
