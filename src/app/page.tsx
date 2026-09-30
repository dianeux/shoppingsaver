import Link from "next/link";
import { SiteNotice } from "@/components/SiteNotice";
import { ACTIVE_BRAND_IDS, BRANDS } from "@/domain/brands";
import { HOME_L1, TAXONOMY, type L2 } from "@/domain/taxonomy";
import { coverage, minBrandsPerL2, siteStatus, topValueByL1, type CategoryCover } from "@/lib/catalog";
import { thumb, usd } from "@/lib/format";

export const revalidate = 3600;

export default async function Home() {
  const [cov, status] = await Promise.all([coverage(), siteStatus()]);
  const byL2 = new Map(cov.map((c) => [c.l2, c]));
  const isLive = (l2: L2) => (byL2.get(l2)?.brands.length ?? 0) >= minBrandsPerL2;
  const covers = await topValueByL1(cov.map((c) => c.l2).filter(isLive));
  const groups = HOME_L1.map((l1) => TAXONOMY.find((g) => g.l1 === l1)!);

  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6">
      <section className="rise pt-10 pb-8 sm:pt-14 sm:pb-10 border-b border-rule space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
          {ACTIVE_BRAND_IDS.map((b) => BRANDS[b].name).join(" · ")}
        </p>
        <h1 className="text-lg text-ink">價格和材質之間的取捨，找出 CP 值最高的衣服。</h1>
        <div className="max-w-2xl space-y-3 text-[15px] leading-relaxed text-ink-soft">
          <p>
            預設依<strong className="text-ink font-medium">性價比</strong>排序：材質分（天然 1.0、再生纖維素 0.5、合成 0）和同品類內的價格百分位各佔一半。權重可以自己調。
          </p>
          <SiteNotice {...status} />
        </div>
      </section>

      <div className="py-10 grid gap-x-4 gap-y-10 sm:gap-x-6 grid-cols-2 lg:grid-cols-4">
        {groups.map((g, gi) => (
          <CategoryCard
            key={g.l1}
            l1={g.l1}
            name={g.name}
            cover={covers.get(g.l1)}
            live={g.children.filter((c) => isLive(c.l2)).map((c) => ({ ...c, ...byL2.get(c.l2)! }))}
            delay={160 + gi * 50}
          />
        ))}
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

function CategoryCard({
  l1,
  name,
  cover,
  live,
  delay,
}: {
  l1: string;
  name: string;
  cover: CategoryCover | undefined;
  live: { l2: L2; name: string; products: number; brands: string[] }[];
  delay: number;
}) {
  const img = cover ? thumb(cover.imageUrl, 700) : null;
  return (
    <section className="rise flex flex-col" style={{ animationDelay: `${delay}ms` }}>
      {cover && img ? (
        <Link
          href={`/g/${l1}`}
          className="group relative block aspect-[4/5] overflow-hidden bg-cloth-deep"
          aria-label={`看全部 ${name}（性價比最高：${BRANDS[cover.brand].name} ${cover.name}）`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 via-ink/30 to-transparent pt-16 pb-3 px-3 text-paper">
            <p className="text-[11px] uppercase tracking-[0.14em] text-paper/90">性價比最高</p>
            <p className="text-[13px] leading-snug line-clamp-1">
              {BRANDS[cover.brand].name} · {cover.name}
            </p>
            <p className="font-mono text-[12px] text-paper/85">{usd(cover.salePrice)}</p>
          </div>
        </Link>
      ) : (
        <div className="aspect-[4/5] bg-cloth-deep grid place-items-center p-6 text-center">
          <p className="text-xs text-ink-faint leading-relaxed">還沒有品類達到上線門檻</p>
        </div>
      )}

      <h2 className="mt-4 pb-1.5 border-b border-ink">
        {live.length > 0 ? (
          <Link href={`/g/${l1}`} className="group flex items-baseline gap-2 font-display text-[28px] sm:text-3xl leading-none hover:text-indigo">
            {name}
            <span className="ml-auto font-mono text-[10px] text-ink-faint group-hover:text-indigo whitespace-nowrap">全部 →</span>
          </Link>
        ) : (
          <span className="font-display text-[28px] sm:text-3xl leading-none">{name}</span>
        )}
      </h2>
      <ul>
        {live.map((c) => (
          <li key={c.l2}>
            <Link href={`/c/${c.l2}`} className="group flex items-baseline gap-2 py-2 border-b border-dashed border-rule hover:bg-paper/70 -mx-1.5 px-1.5 transition-colors">
              <span className="text-[15px] group-hover:text-indigo">{c.name}</span>
              <span className="ml-auto font-mono text-[10px] text-ink-faint whitespace-nowrap">
                {c.products} 件<span className="hidden sm:inline"> · {c.brands.length} 家</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
