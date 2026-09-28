import { BRANDS, type BrandId } from "@/domain/brands";
import type { SiteStatus } from "@/lib/catalog";

const fmt = new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });

/**
 * F20: data freshness is always visible. F7: a brand that should be on this page
 * but whose last crawl failed or is stale gets named — never silently missing.
 */
export function SiteNotice({ sites, dataAsOf, relevant }: { sites: SiteStatus[]; dataAsOf: Date | null; relevant?: BrandId[] }) {
  const degraded = sites.filter((s) => s.degraded && (!relevant || relevant.includes(s.brand)));
  return (
    <div className="space-y-2">
      <p className="font-mono text-[11px] text-ink-faint">
        資料更新於 {dataAsOf ? `${fmt.format(dataAsOf)}（美東）` : "—"} · 已接入 {sites.map((s) => BRANDS[s.brand].name).join("、") || "尚無品牌"}
      </p>
      {degraded.length > 0 && (
        <p role="status" className="text-xs bg-ochre-wash border border-ochre/40 text-warn px-3 py-2">
          {degraded.map((s) => BRANDS[s.brand].name).join("、")} 最近一次抓取{degraded.some((s) => s.lastRunFailed) ? "失敗" : "過久未更新"}，
          下方顯示的是 {degraded.map((s) => (s.lastSuccessAt ? `${BRANDS[s.brand].name} ${fmt.format(s.lastSuccessAt)}` : BRANDS[s.brand].name)).join("、")} 的資料，價格可能已變動。
        </p>
      )}
    </div>
  );
}
