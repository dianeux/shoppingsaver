import Link from "next/link";
import { SiteNotice } from "@/components/SiteNotice";
import { BRANDS } from "@/domain/brands";
import { TAXONOMY } from "@/domain/taxonomy";
import { coverage, minBrandsPerL2, siteStatus } from "@/lib/catalog";

export const revalidate = 3600;

export default async function Home() {
  const [cov, status] = await Promise.all([coverage(), siteStatus()]);
  const byL2 = new Map(cov.map((c) => [c.l2, c]));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="pt-12 pb-10 sm:pt-20 sm:pb-14 grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end border-b border-rule">
        <div className="rise">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint mb-4">
            H&amp;M · Zara · Uniqlo · GU · Muji · Pact · Quince
          </p>
          <h1 className="font-display text-[clamp(34px,6vw,68px)] leading-[1.02] tracking-tight [word-break:keep-all]">
            不是找最低價，
            <br />
            <em className="text-indigo">是看清楚</em>每個價格帶
            <br />
            買到什麼。
          </h1>
        </div>
        <div className="rise space-y-4 text-[15px] leading-relaxed text-ink-soft" style={{ animationDelay: "120ms" }}>
          <p>七家基本款品牌的女裝，材質、顏色、尺寸寫法統一，放在同一頁比較。</p>
          <p>
            預設依<strong className="text-ink font-medium">性價比</strong>排序：材質分（天然 1.0、再生纖維素 0.5、合成 0）和同品類內的價格百分位各佔一半。權重可以自己調。
          </p>
          <SiteNotice {...status} />
        </div>
      </section>

      <div className="py-10 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {TAXONOMY.map((g, gi) => {
          const live = g.children.filter((c) => (byL2.get(c.l2)?.brands.length ?? 0) >= minBrandsPerL2);
          if (live.length === 0) return null;
          return (
            <section key={g.l1} className="rise" style={{ animationDelay: `${160 + gi * 40}ms` }}>
              <h2 className="font-display text-3xl border-b border-ink pb-1 mb-1">{g.name}</h2>
              <ul>
                {live.map((c) => {
                  const cv = byL2.get(c.l2)!;
                  return (
                    <li key={c.l2}>
                      <Link href={`/c/${c.l2}`} className="group flex items-baseline gap-3 py-2.5 border-b border-dashed border-rule hover:bg-paper/70 -mx-2 px-2 transition-colors">
                        <span className="text-[17px] group-hover:text-indigo">{c.name}</span>
                        <span className="ml-auto font-mono text-[11px] text-ink-faint">
                          {cv.products} 件 · {cv.brands.length} 家
                        </span>
                        <span aria-hidden className="text-ink-faint group-hover:translate-x-0.5 transition-transform">→</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {cov.every((c) => c.brands.length < minBrandsPerL2) && (
        <p className="py-16 text-center text-ink-faint">還沒有品類達到上線門檻（至少 {minBrandsPerL2} 家品牌有貨）。先跑一次 <code className="font-mono">npm run index</code>。</p>
      )}

      <section className="border-t border-rule pt-8 pb-4">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint mb-3">依品牌瀏覽</h2>
        <div className="flex flex-wrap gap-2">
          {status.sites.map((s) => (
            <Link key={s.brand} href={`/brand/${s.brand}`} className="border border-rule bg-paper px-3 py-1.5 text-sm hover:border-ink">
              {BRANDS[s.brand].name} <span className="text-ink-faint text-xs">{BRANDS[s.brand].positioning}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
