"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BRANDS, type BrandId } from "@/domain/brands";
import { DEFAULT_MATERIAL_WEIGHT } from "@/domain/scoring";
import type { FavoriteProduct } from "@/lib/catalog";
import { removeFavorites, useFavorites } from "@/lib/favorites";
import { thumb, usd } from "@/lib/format";
import { FavoriteButton } from "./FavoriteButton";
import { COLOR_FAMILY_LABEL } from "@/domain/colors";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; products: Map<string, FavoriteProduct> };

export function FavoritesView() {
  const ids = useFavorites();
  const [state, setState] = useState<State>({ status: "loading" });

  // Fetch only when the list gains ids we haven't loaded; removals filter locally.
  const known = state.status === "ready" ? state.products : null;
  const missing = ids.filter((id) => !known?.has(id));
  const missingKey = missing.join(",");
  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: missingKey.split(",") }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(({ products }: { products: FavoriteProduct[] }) => {
        if (cancelled) return;
        // Products are only ever deactivated, never deleted, so an id the server doesn't know is bogus.
        const found = new Set(products.map((p) => p.id));
        const unknown = missingKey.split(",").filter((id) => !found.has(id));
        if (unknown.length) removeFavorites(unknown);
        setState((s) => {
          const next = new Map(s.status === "ready" ? s.products : []);
          for (const p of products) next.set(p.id, p);
          return { status: "ready", products: next };
        });
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [missingKey]);

  const groups = useMemo(() => {
    const list = known ? ids.map((id) => known.get(id)).filter((p): p is FavoriteProduct => !!p) : [];
    const byBrand = new Map<BrandId, FavoriteProduct[]>();
    for (const p of list.filter((p) => p.availability === "available")) byBrand.set(p.brand, [...(byBrand.get(p.brand) ?? []), p]);
    // Biggest baskets first; within a brand, items on the drops list lead.
    const brands = [...byBrand].map(([brand, items]) => ({
      brand,
      items: [...items.filter((p) => p.drop), ...items.filter((p) => !p.drop)],
      total: sumPrices(items),
    }));
    brands.sort((a, b) => b.items.length - a.items.length || b.total - a.total);
    return { brands, unavailable: list.filter((p) => p.availability !== "available") };
  }, [ids, known]);

  if (ids.length === 0) {
    return (
      <div className="stitch bg-paper border border-rule p-10 text-center max-w-xl mx-auto">
        <p className="font-display text-2xl mb-2">還沒有收藏任何商品</p>
        <p className="text-sm text-ink-soft">
          在商品圖左下角點愛心就能加入最愛。清單存在這台裝置的瀏覽器裡，不需要登入。
        </p>
        <Link href="/" className="inline-block mt-5 border border-ink px-5 py-2 text-sm hover:bg-ink hover:text-paper transition-colors">
          去逛逛
        </Link>
      </div>
    );
  }
  if (state.status === "error") return <p className="py-16 text-center text-warn">載入最愛時發生錯誤，請重新整理頁面。</p>;
  if (state.status === "loading" && !known) return <p className="py-16 text-center text-ink-faint">載入中…</p>;

  const available = groups.brands.flatMap((g) => g.items);
  const w = DEFAULT_MATERIAL_WEIGHT;
  const scoreOf = (p: FavoriteProduct) => Math.round(100 * (w * (p.materialScore ?? 0) + (1 - w) * (1 - p.pricePercentile)));

  return (
    <div className="max-w-4xl space-y-14">
      {available.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border border-rule px-4 py-3">
          <span className="text-sm text-ink-soft">{groups.brands.length} 家店 · {available.length} 件</span>
          <span className="ml-auto text-sm">
            全部合計 <strong className="text-xl font-medium tabular-nums">{usd(sumPrices(available))}</strong>
            {available.some(varies) && <span className="text-xs ml-0.5">起</span>}
          </span>
          <span className="basis-full text-xs text-ink-faint">以每件目前的最低售價計算（不含運費與稅）；已售完或下架的商品不計入。</span>
        </div>
      )}
      {groups.brands.map((g) => (
        <section key={g.brand} aria-label={`${BRANDS[g.brand].name}，${g.items.length} 件`}>
          <ul className="divide-y divide-rule">
            {g.items.map((p) => <FavoriteRow key={p.id} p={p} score={scoreOf(p)} />)}
          </ul>
          <div className="flex items-baseline justify-end gap-5 border-t border-ink pt-3">
            <span className="text-xs uppercase tracking-[0.18em] text-ink-soft">{BRANDS[g.brand].name}</span>
            <span className="text-sm text-ink-soft">
              Total{" "}
              <strong className="text-xl font-medium text-ink tabular-nums">{usd(g.total)}</strong>
              {g.items.some(varies) && <span className="text-xs ml-0.5">起</span>}
            </span>
          </div>
        </section>
      ))}
      {groups.unavailable.length > 0 && (
        <section>
          <div className="flex flex-wrap items-baseline gap-3 border-b border-rule pb-2 mb-4">
            <h2 className="font-display text-2xl">買不到了</h2>
            <span className="text-xs text-ink-faint">{groups.unavailable.length} 件已售完或已下架；補貨後會自動回到上面</span>
            <button
              type="button"
              onClick={() => removeFavorites(groups.unavailable.map((p) => p.id))}
              className="ml-auto text-xs underline underline-offset-2 text-ink-soft hover:text-ink"
            >
              全部移除
            </button>
          </div>
          <ul className="divide-y divide-dashed divide-rule">
            {groups.unavailable.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5 opacity-70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.imageUrl ? <img src={thumb(p.imageUrl, 160)!} alt="" className="h-16 w-13 object-cover bg-cloth-deep grayscale" /> : <div className="h-16 w-13 bg-cloth-deep" />}
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">{BRANDS[p.brand].name}</p>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-sm line-clamp-1 hover:underline">{p.name}</a>
                  <p className="font-mono text-[11px] text-ink-faint">
                    {p.availability === "sold_out" ? "已售完" : "已下架"} · 最後價格 {usd(p.salePrice)}
                  </p>
                </div>
                <FavoriteButton id={p.id} name={p.name} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {available.length === 0 && groups.unavailable.length === 0 && (
        <p className="py-16 text-center text-ink-faint">收藏的商品已不在目錄中。</p>
      )}
    </div>
  );
}

/** Some colors cost more than the price shown, so the total is a "from" figure. */
const varies = (p: FavoriteProduct) => p.maxPrice > p.salePrice;

/** One favorite as a cart-style row: photo, details, price on the right (under the details on phones). */
function FavoriteRow({ p, score }: { p: FavoriteProduct; score: number }) {
  const onSale = p.salePrice < p.listPrice || !!p.drop;
  const was = p.drop ? p.drop.baselinePrice : p.salePrice < p.listPrice ? p.listPrice : null;
  const price = (
    <span className="whitespace-nowrap">
      <span className={`text-lg font-medium tabular-nums ${onSale ? "text-madder" : ""}`}>{usd(p.salePrice)}</span>
      {varies(p) && <span className={`text-xs ml-0.5 ${onSale ? "text-madder" : ""}`}>起</span>}
      {was !== null && <span className="ml-2 text-sm text-ink-faint line-through tabular-nums">{usd(was)}</span>}
    </span>
  );
  return (
    <li className="grid grid-cols-[104px_1fr] sm:grid-cols-[136px_1fr_auto] gap-x-5 sm:gap-x-8 py-5">
      <div className="relative">
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/5] overflow-hidden bg-cloth-deep">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb(p.imageUrl, 320)!} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="h-full w-full grid place-items-center text-xs text-ink-faint">無圖片</span>
          )}
        </a>
        <FavoriteButton id={p.id} name={p.name} className="absolute left-1.5 bottom-1.5 !h-7 !w-7" />
        <span className="absolute right-1.5 bottom-1.5 bg-paper px-1.5 py-0.5 text-xs font-medium leading-none tabular-nums text-value" title="性價比分數（0–100）">
          {score}
        </span>
      </div>

      <div className="min-w-0 flex flex-col gap-1.5 pt-0.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-[0.16em] text-ink-soft">{BRANDS[p.brand].name}</span>
          <span className="flex -space-x-1 shrink-0">
            {p.colors.slice(0, 5).map((c) => (
              <span
                key={c.raw}
                title={c.raw}
                className="h-3.5 w-3.5 rounded-full border border-paper ring-1 ring-ink/20"
                style={{ background: c.family ? COLOR_FAMILY_LABEL[c.family].swatch : "var(--cloth-deep)" }}
              />
            ))}
            {p.colors.length > 5 && <span className="pl-2 text-xs text-ink-faint">+{p.colors.length - 5}</span>}
          </span>
        </div>
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[15px] leading-snug hover:underline underline-offset-4 decoration-1 line-clamp-2">
          {p.name}
        </a>
        <div className="sm:hidden">{price}</div>
        {p.drop && <span className="self-start text-xs text-madder">降價 {Math.round(p.drop.pct * 100)}%・比前一天便宜</span>}
        {varies(p) && p.priceColor && <p className="text-xs text-ink-soft">{p.priceColor} 的價格；其他顏色最高 {usd(p.maxPrice)}</p>}
        {p.compositionText && <p className="text-xs text-ink-soft">{p.compositionText}</p>}
      </div>

      <div className="hidden sm:block pt-0.5 text-right">{price}</div>
    </li>
  );
}

/** Sum in cents so totals don't pick up floating-point dust. */
function sumPrices(items: { salePrice: number }[]): number {
  return items.reduce((cents, p) => cents + Math.round(p.salePrice * 100), 0) / 100;
}
