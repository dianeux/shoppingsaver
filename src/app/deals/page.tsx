import type { Metadata } from "next";
import { Browser } from "@/components/Browser";
import { SiteNotice } from "@/components/SiteNotice";
import { siteStatus, weeklyDrops } from "@/lib/catalog";
import { DROP_WINDOW_DAYS } from "@/pipeline/drops";

export const revalidate = 3600;
export const metadata: Metadata = { title: "本週降價" };

/** F15: products that got cheaper than the day before, kept for 7 days; no login. */
export default async function DealsPage() {
  const [items, status] = await Promise.all([weeklyDrops(), siteStatus()]);
  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mb-3">
        <h1 className="font-display text-5xl sm:text-6xl leading-none">
          本週<em className="text-madder">降價</em>
        </h1>
        <div className="pb-1">
          <SiteNotice {...status} />
        </div>
      </div>
      <p className="text-sm text-ink-soft mb-8 max-w-2xl">
        價格比前一天便宜的商品會出現在這裡，追蹤 {DROP_WINDOW_DAYS} 天；再降一次就重新計時。價格漲回降價前就立即移除。
      </p>
      {items.length === 0 ? (
        <div className="stitch bg-paper border border-rule p-10 text-center max-w-xl mx-auto">
          <p className="font-display text-2xl mb-2">這週還沒有降價商品</p>
          <p className="text-sm text-ink-soft">
            每晚索引會和前一天的價格比對，有商品降價就會出現在這裡。
          </p>
        </div>
      ) : (
        <Browser products={items} facetL2 />
      )}
    </div>
  );
}
