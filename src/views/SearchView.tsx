import type { Metadata } from "next";
import Link from "next/link";
import { Browser } from "@/components/Browser";
import { SiteNotice } from "@/components/SiteNotice";
import type { Gender } from "@/domain/gender";
import { isEmptyQuery, normalize, parseQuery, type ParsedQuery } from "@/domain/search";
import type { Dict } from "@/i18n/dict";
import { href, lexiconLabel, sectionTitle } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import { getLang } from "@/i18n/server";
import { searchProducts, siteStatus } from "@/lib/catalog";
import { usd } from "@/lib/format";

export async function searchMetadata(gender: Gender, q: unknown): Promise<Metadata> {
  const { lang, t } = await getLang();
  return { title: sectionTitle(lang, gender, typeof q === "string" && q.trim() ? t.search.titleFor(q.trim()) : t.search.title) };
}

/** A chip: what the lexicon understood, with a link that searches again without it. */
function chips(lang: Locale, t: Dict, gender: Gender, raw: string, p: ParsedQuery) {
  const without = (source: string) => `${href(lang, gender, "/search")}?q=${encodeURIComponent(normalize(raw).replace(source, " ").replace(/\s+/g, " ").trim())}`;
  const k = t.search.kinds;
  const label = (l: string) => lexiconLabel(lang, l);
  return [
    ...p.categories.map((c) => ({ kind: k.category, label: label(c.label), href: without(c.source) })),
    ...p.styles.map((s) => ({ kind: k.style, label: label(s.label), href: without(s.source) })),
    ...p.colors.map((c) => ({ kind: k.color, label: label(c.label), href: without(c.source) })),
    ...p.fibers.map((f) => ({ kind: k.fiber, label: f.minPct ? `${label(f.label)} (≥${f.minPct}%)` : label(f.label), href: without(f.source) })),
    ...p.brands.map((b) => ({ kind: k.brand, label: b.label, href: without(b.source) })),
    ...(p.priceMax ? [{ kind: k.price, label: `≤ ${usd(p.priceMax.value)}`, href: without(normalize(p.priceMax.source)) }] : []),
    ...p.keywords.map((kw) => ({ kind: k.keyword, label: kw, href: without(kw) })),
  ];
}

export async function SearchView({ gender, q }: { gender: Gender; q: unknown }) {
  const raw = typeof q === "string" ? q.slice(0, 120) : "";
  const parsed = parseQuery(raw);
  const empty = isEmptyQuery(parsed);
  const [{ lang, t }, { items, total }, status] = await Promise.all([
    getLang(),
    empty ? Promise.resolve({ items: [], total: 0 }) : searchProducts(parsed, gender),
    siteStatus(),
  ]);
  const searchPath = href(lang, gender, "/search");

  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8">
      <form action={searchPath} className="flex gap-2 max-w-2xl mb-4">
        <input
          name="q"
          defaultValue={raw}
          placeholder={t.search.placeholder}
          aria-label={t.search.label}
          className="flex-1 border border-ink/30 bg-paper px-3 py-2.5 text-[15px] focus:outline-none focus:border-ink"
        />
        <button className="bg-ink text-paper px-5 text-sm">{t.search.submit}</button>
      </form>

      {raw && (
        <div className="mb-6 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-ink-faint mr-1">{t.search.interpretedAs}</span>
            {chips(lang, t, gender, raw, parsed).map((c) => (
              <Link key={`${c.kind}:${c.label}`} href={c.href} className="group inline-flex items-center gap-1 border border-rule bg-paper px-2 py-1 hover:border-ink/50" title={t.search.remove}>
                <span className="text-ink-faint">{c.kind}</span> {c.label}
                <span aria-hidden className="text-ink-faint group-hover:text-madder">✕</span>
              </Link>
            ))}
            {parsed.corrections.map((c) => (
              <span key={c.from} className="border border-rule px-2 py-1 text-ink-soft" title={t.search.correctedTitle}>
                {t.search.corrected}{c.from} → {c.to}
              </span>
            ))}
            {parsed.unknown.map((u) => (
              <span key={u} className="border border-ochre/50 bg-ochre-wash text-warn px-2 py-1" title={t.search.unknownTitle}>
                {t.search.unknown}{u}
              </span>
            ))}
          </div>
          {total > items.length && <p className="text-xs text-ink-soft">{t.search.truncated(total, items.length)}</p>}
          <SiteNotice {...status} />
        </div>
      )}

      {empty ? (
        <div className="stitch bg-paper border border-rule p-8 max-w-2xl">
          <p className="font-display text-2xl mb-2">{raw ? t.search.noConditions : t.search.intro}</p>
          <p className="text-sm text-ink-soft mb-4">{t.search.help}</p>
          <div className="flex flex-wrap gap-2">
            {t.search.examples.map((e) => (
              <Link key={e} href={`${searchPath}?q=${encodeURIComponent(e)}`} className="border border-rule px-3 py-1.5 text-sm hover:border-ink">
                {e}
              </Link>
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-ink-faint">{t.search.noResults}</p>
      ) : (
        <Browser products={items} facetL2 gender={gender} />
      )}
    </div>
  );
}
