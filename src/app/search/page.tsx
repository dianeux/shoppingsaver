import type { Metadata } from "next";
import Link from "next/link";
import { Browser } from "@/components/Browser";
import { SiteNotice } from "@/components/SiteNotice";
import { isEmptyQuery, normalize, parseQuery, type ParsedQuery } from "@/domain/search";
import { searchProducts, siteStatus } from "@/lib/catalog";
import { usd } from "@/lib/format";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const q = (await searchParams).q;
  return { title: typeof q === "string" && q.trim() ? `搜尋「${q.trim()}」` : "搜尋" };
}

const EXAMPLES = ["低胸 T恤", "50元以下純棉白色T恤", "寬褲 亞麻", "無印 高領毛衣", "短版 衛衣", "waffle tee"];

/** A chip: what the lexicon understood, with a link that searches again without it. */
function chips(raw: string, p: ParsedQuery) {
  const without = (source: string) => `/search?q=${encodeURIComponent(normalize(raw).replace(source, " ").replace(/\s+/g, " ").trim())}`;
  return [
    ...p.categories.map((c) => ({ kind: "品類", label: c.label, href: without(c.source) })),
    ...p.styles.map((s) => ({ kind: "款式", label: s.label, href: without(s.source) })),
    ...p.colors.map((c) => ({ kind: "顏色", label: c.label, href: without(c.source) })),
    ...p.fibers.map((f) => ({ kind: "材質", label: f.minPct ? `${f.label}（≥${f.minPct}%）` : f.label, href: without(f.source) })),
    ...p.brands.map((b) => ({ kind: "品牌", label: b.label, href: without(b.source) })),
    ...(p.priceMax ? [{ kind: "價格", label: `≤ ${usd(p.priceMax.value)}`, href: without(normalize(p.priceMax.source)) }] : []),
    ...p.keywords.map((k) => ({ kind: "關鍵字", label: k, href: without(k) })),
  ];
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const rawParam = (await searchParams).q;
  const raw = typeof rawParam === "string" ? rawParam.slice(0, 120) : "";
  const parsed = parseQuery(raw);
  const empty = isEmptyQuery(parsed);
  const [{ items, total }, status] = await Promise.all([empty ? Promise.resolve({ items: [], total: 0 }) : searchProducts(parsed), siteStatus()]);

  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8">
      <form action="/search" className="flex gap-2 max-w-2xl mb-4">
        <input
          name="q"
          defaultValue={raw}
          placeholder="例如：低胸 T恤、50元以下純棉白色T恤、寬褲 亞麻"
          aria-label="搜尋商品"
          className="flex-1 border border-ink/30 bg-paper px-3 py-2.5 text-[15px] focus:outline-none focus:border-ink"
        />
        <button className="bg-ink text-paper px-5 text-sm">搜尋</button>
      </form>

      {raw && (
        <div className="mb-6 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-ink-faint mr-1">解讀為</span>
            {chips(raw, parsed).map((c) => (
              <Link key={`${c.kind}:${c.label}`} href={c.href} className="group inline-flex items-center gap-1 border border-rule bg-paper px-2 py-1 hover:border-ink/50" title="移除這個條件">
                <span className="text-ink-faint">{c.kind}</span> {c.label}
                <span aria-hidden className="text-ink-faint group-hover:text-madder">✕</span>
              </Link>
            ))}
            {parsed.unknown.map((u) => (
              <span key={u} className="border border-ochre/50 bg-ochre-wash text-warn px-2 py-1" title="詞典裡沒有這個詞，搜尋時略過">
                看不懂：{u}
              </span>
            ))}
          </div>
          {total > items.length && (
            <p className="text-xs text-ink-soft">共 {total} 件符合，顯示相關度最高的 {items.length} 件。加上款式、顏色或價格可以縮小範圍。</p>
          )}
          <SiteNotice {...status} />
        </div>
      )}

      {empty ? (
        <div className="stitch bg-paper border border-rule p-8 max-w-2xl">
          <p className="font-display text-2xl mb-2">{raw ? "這個搜尋沒有可用的條件" : "用一句話找衣服"}</p>
          <p className="text-sm text-ink-soft mb-4">
            可以用中文或英文描述品類、款式（低胸、短版、寬褲、高腰…）、顏色、材質、品牌和價格上限。
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <Link key={e} href={`/search?q=${encodeURIComponent(e)}`} className="border border-rule px-3 py-1.5 text-sm hover:border-ink">
                {e}
              </Link>
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-ink-faint">沒有符合的商品。試著移除上面的某個條件。</p>
      ) : (
        <Browser products={items} facetL2 />
      )}
    </div>
  );
}
