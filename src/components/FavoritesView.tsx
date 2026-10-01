"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BRANDS, type BrandId } from "@/domain/brands";
import { DEFAULT_MATERIAL_WEIGHT } from "@/domain/scoring";
import type { FavoriteProduct } from "@/lib/catalog";
import { removeFavorites, useFavorites } from "@/lib/favorites";
import { thumb, usd } from "@/lib/format";
import { FavoriteButton } from "./FavoriteButton";
import { ProductCard, type ScoredProduct } from "./ProductCard";

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
  const scored: ScoredProduct[] = available.map((p) => ({
    ...p,
    score: Math.round(100 * (w * (p.materialScore ?? 0) + (1 - w) * (1 - p.pricePercentile))),
  }));
  const byId = new Map(scored.map((s) => [s.id, s]));

  return (
    <div className="space-y-12">
      {available.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border border-rule px-4 py-3">
          <span className="text-sm text-ink-soft">{groups.brands.length} 家店 · {available.length} 件</span>
          <span className="ml-auto text-sm">
            全部合計 <strong className="text-xl font-medium tabular-nums">{usd(sumPrices(available))}</strong>
          </span>
          <span className="basis-full text-xs text-ink-faint">以每件目前的最低售價計算（不含運費與稅）；已售完或下架的商品不計入。</span>
        </div>
      )}
      {groups.brands.map((g) => {
        const drops = g.items.filter((p) => p.drop).length;
        return (
          <section key={g.brand}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule pb-2 mb-4">
              <h2 className="font-display text-2xl">{BRANDS[g.brand].name}</h2>
              <span className="text-xs text-ink-faint">
                {g.items.length} 件{drops > 0 && <span className="text-madder"> · {drops} 件降價中</span>}
              </span>
              <span className="ml-auto text-sm">
                小計 <strong className="text-lg font-medium tabular-nums">{usd(g.total)}</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {g.items.map((p, i) => <ProductCard key={p.id} p={byId.get(p.id)!} index={i} />)}
            </div>
          </section>
        );
      })}
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

/** Sum in cents so totals don't pick up floating-point dust. */
function sumPrices(items: { salePrice: number }[]): number {
  return items.reduce((cents, p) => cents + Math.round(p.salePrice * 100), 0) / 100;
}
