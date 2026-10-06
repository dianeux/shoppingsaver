import Link from "next/link";
import { SiteNotice } from "@/components/SiteNotice";
import { ACTIVE_BRAND_IDS, BRANDS } from "@/domain/brands";
import type { Gender } from "@/domain/gender";
import { homeL1, TAXONOMY, type L1, type L2 } from "@/domain/taxonomy";
import type { Dict } from "@/i18n/dict";
import { href, l1Name, l2Name, positioning } from "@/i18n/format";
import { localePath, type Locale } from "@/i18n/locales";
import { getLang } from "@/i18n/server";
import { coverage, minBrandsPerL2, siteStatus, topValueByL1, type CategoryCover } from "@/lib/catalog";
import { thumb, usd } from "@/lib/format";

/** A section's home page: category cards with the top-value product as cover. */
export async function HomeView({ gender }: { gender: Gender }) {
  const [{ lang, t }, cov, status] = await Promise.all([getLang(), coverage(gender), siteStatus()]);
  const byL2 = new Map(cov.map((c) => [c.l2, c]));
  const isLive = (l2: L2) => (byL2.get(l2)?.brands.length ?? 0) >= minBrandsPerL2;
  const covers = await topValueByL1(cov.map((c) => c.l2).filter(isLive), gender);
  const groups = homeL1(gender).map((l1) => TAXONOMY.find((g) => g.l1 === l1)!);

  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6">
      <section className="rise pt-10 pb-8 sm:pt-14 sm:pb-10 border-b border-rule space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
          {ACTIVE_BRAND_IDS.map((b) => BRANDS[b].name).join(" · ")}
        </p>
        <h1 className="text-lg text-ink">{t.home.tagline}</h1>
        <div className="max-w-2xl space-y-3 text-[15px] leading-relaxed text-ink-soft">
          <p>
            {t.home.sortedBy}<strong className="text-ink font-medium">{t.home.value}</strong>{t.home.sortedRest}
          </p>
          <p className="text-sm">
            {t.home.clipPrompt}<Link href={localePath(lang, "/add")} className="underline underline-offset-2 hover:text-ink">{t.home.clipLink}</Link>
          </p>
          <SiteNotice {...status} />
        </div>
      </section>

      <section className="pt-8">
        <h2 className="font-mono text-sm uppercase tracking-[0.14em] text-ink-faint mb-3">{t.home.byBrand}</h2>
        <div className="flex flex-wrap gap-2">
          {status.sites.map((s) => (
            <Link key={s.brand} href={href(lang, gender, `/brand/${s.brand}`)} className="border border-rule bg-paper px-3 py-1.5 text-sm hover:border-ink">
              {BRANDS[s.brand].name} <span className="text-ink-faint text-xs">{positioning(lang, s.brand)}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="py-10 grid gap-x-4 gap-y-10 sm:gap-x-6 grid-cols-2 lg:grid-cols-4">
        {groups.map((g, gi) => (
          <CategoryCard
            key={g.l1}
            lang={lang}
            t={t}
            gender={gender}
            l1={g.l1}
            cover={covers.get(g.l1)}
            live={g.children.filter((c) => isLive(c.l2)).map((c) => byL2.get(c.l2)!)}
            delay={160 + gi * 50}
          />
        ))}
      </div>

      {cov.every((c) => c.brands.length < minBrandsPerL2) && (
        <p className="py-16 text-center text-ink-faint">{t.home.noLive(minBrandsPerL2)}</p>
      )}
    </div>
  );
}

function CategoryCard({
  lang,
  t,
  gender,
  l1,
  cover,
  live,
  delay,
}: {
  lang: Locale;
  t: Dict;
  gender: Gender;
  l1: L1;
  cover: CategoryCover | undefined;
  live: { l2: L2; products: number; brands: string[] }[];
  delay: number;
}) {
  const img = cover ? thumb(cover.imageUrl, 700) : null;
  const name = l1Name(lang, l1);
  return (
    <section className="rise flex flex-col" style={{ animationDelay: `${delay}ms` }}>
      {cover && img ? (
        <Link
          href={href(lang, gender, `/g/${l1}`)}
          className="group relative block aspect-[4/5] overflow-hidden bg-cloth-deep"
          aria-label={t.home.seeAll(name, BRANDS[cover.brand].name, cover.name)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 via-ink/30 to-transparent pt-16 pb-3 px-3 text-paper">
            <p className="text-[11px] uppercase tracking-[0.14em] text-paper/90">{t.home.topValue}</p>
            <p className="text-[13px] leading-snug line-clamp-1">
              {BRANDS[cover.brand].name} · {cover.name}
            </p>
            <p className="font-mono text-[12px] text-paper/85">{usd(cover.salePrice)}</p>
          </div>
        </Link>
      ) : (
        <div className="aspect-[4/5] bg-cloth-deep grid place-items-center p-6 text-center">
          <p className="text-xs text-ink-faint leading-relaxed">{t.home.noLiveShort}</p>
        </div>
      )}

      <h2 className="mt-4 pb-1.5 border-b border-ink">
        {live.length > 0 ? (
          <Link href={href(lang, gender, `/g/${l1}`)} className="group flex items-baseline gap-2 font-display text-[28px] sm:text-3xl leading-none hover:text-indigo">
            {name}
            <span className="ml-auto font-mono text-[10px] text-ink-faint group-hover:text-indigo whitespace-nowrap">{t.home.all}</span>
          </Link>
        ) : (
          <span className="font-display text-[28px] sm:text-3xl leading-none">{name}</span>
        )}
      </h2>
      <ul>
        {live.map((c) => (
          <li key={c.l2}>
            <Link href={href(lang, gender, `/c/${c.l2}`)} className="group flex items-baseline gap-2 py-2 border-b border-dashed border-rule hover:bg-paper/70 -mx-1.5 px-1.5 transition-colors">
              <span className="text-[15px] group-hover:text-indigo">{l2Name(lang, c.l2)}</span>
              <span className="ml-auto font-mono text-[10px] text-ink-faint whitespace-nowrap">
                {t.home.count(c.products)}<span className="hidden sm:inline">{t.home.brands(c.brands.length)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
