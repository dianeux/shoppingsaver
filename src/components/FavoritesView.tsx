"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BRANDS } from "@/domain/brands";
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
    const available = list.filter((p) => p.availability === "available");
    return {
      dropped: available.filter((p) => p.drop),
      others: available.filter((p) => !p.drop),
      unavailable: list.filter((p) => p.availability !== "available"),
    };
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

  const available = [...groups.dropped, ...groups.others];
  const scored: ScoredProduct[] = available.map((p) => {
    const w = DEFAULT_MATERIAL_WEIGHT;
    const score = Math.round(100 * (w * (p.materialScore ?? 0) + (1 - w) * (1 - p.pricePercentile)));
    const materialPart = Math.round(100 * w * (p.materialScore ?? 0));
    return { ...p, score, materialPart, pricePart: score - materialPart };
  });
  const range: [number, number] = scored.length ? [Math.min(...scored.map((s) => s.score)), Math.max(...scored.map((s) => s.score))] : [0, 100];
  const byId = new Map(scored.map((s) => [s.id, s]));

  return (
    <div className="space-y-12">
      {groups.dropped.length > 0 && (
        <Section title="降價中" note={`${groups.dropped.length} 件比前一天便宜`} accent>
          {groups.dropped.map((p, i) => <ProductCard key={p.id} p={byId.get(p.id)!} weight={DEFAULT_MATERIAL_WEIGHT} range={range} index={i} />)}
        </Section>
      )}
      {groups.others.length > 0 && (
        <Section title={groups.dropped.length ? "其他最愛" : "我的最愛"} note={`${groups.others.length} 件`}>
          {groups.others.map((p, i) => <ProductCard key={p.id} p={byId.get(p.id)!} weight={DEFAULT_MATERIAL_WEIGHT} range={range} index={i} />)}
        </Section>
      )}
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

function Section({ title, note, accent = false, children }: { title: string; note: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline gap-3 border-b border-rule pb-2 mb-4">
        <h2 className={`font-display text-2xl ${accent ? "text-madder" : ""}`}>{title}</h2>
        <span className="text-xs text-ink-faint">{note}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">{children}</div>
    </section>
  );
}
