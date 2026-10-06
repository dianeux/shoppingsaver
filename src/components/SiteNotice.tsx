import { BRANDS, type BrandId } from "@/domain/brands";
import { getLang } from "@/i18n/server";
import type { SiteStatus } from "@/lib/catalog";

const formatter = (lang: string) =>
  new Intl.DateTimeFormat(lang === "zh" ? "zh-TW" : "en-US", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });

/**
 * F20: data freshness is always visible. F7: when a brand on this page has stale
 * data (last crawl failed or too old), a notice says which data is shown.
 */
export async function SiteNotice({ sites, dataAsOf, relevant }: { sites: SiteStatus[]; dataAsOf: Date | null; relevant?: BrandId[] }) {
  const { lang, t } = await getLang();
  const fmt = formatter(lang);
  const degraded = sites.filter((s) => s.degraded && (!relevant || relevant.includes(s.brand)));
  return (
    <div className="space-y-2">
      <p className="font-mono text-[11px] text-ink-faint">
        {t.notice.updated} {dataAsOf ? `${fmt.format(dataAsOf)}${t.notice.eastern}` : "—"} · {t.notice.connected}{" "}
        {t.notice.list(sites.map((s) => BRANDS[s.brand].name)) || t.notice.none}
      </p>
      {degraded.length > 0 && (
        <p role="status" className="text-xs bg-ochre-wash border border-ochre/40 text-warn px-3 py-2">
          {t.notice.stale(t.notice.list(degraded.map((s) => (s.lastSuccessAt ? `${BRANDS[s.brand].name} ${fmt.format(s.lastSuccessAt)}` : BRANDS[s.brand].name))))}
        </p>
      )}
    </div>
  );
}
