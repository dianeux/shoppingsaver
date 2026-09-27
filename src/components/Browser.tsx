"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { BRANDS, type BrandId } from "@/domain/brands";
import { COLOR_FAMILIES, COLOR_FAMILY_LABEL, type ColorFamily } from "@/domain/colors";
import { FIBERS, type Fiber } from "@/domain/materials";
import { DEFAULT_MATERIAL_WEIGHT } from "@/domain/scoring";
import { L2_INDEX, type L2 } from "@/domain/taxonomy";
import type { CardProduct } from "@/lib/types";
import { ProductCard, type ScoredProduct } from "./ProductCard";

type SortKey = "value" | "price-asc" | "price-desc" | "material";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "value", label: "性價比" },
  { key: "price-asc", label: "價格低→高" },
  { key: "price-desc", label: "價格高→低" },
  { key: "material", label: "材質分" },
];

const PAGE = 48;

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

/**
 * The material weight lives in the URL (?w=70) so a tuned list can be shared.
 * The server snapshot is the default, so static pages hydrate cleanly.
 */
const weightListeners = new Set<() => void>();
function subscribeWeight(cb: () => void) {
  weightListeners.add(cb);
  window.addEventListener("popstate", cb);
  return () => {
    weightListeners.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}
function readWeight(): number {
  const raw = new URLSearchParams(window.location.search).get("w");
  const w = raw === null ? NaN : Number(raw);
  return w >= 0 && w <= 100 ? w / 100 : DEFAULT_MATERIAL_WEIGHT;
}
function writeWeight(w: number) {
  const url = new URL(window.location.href);
  if (Math.abs(w - DEFAULT_MATERIAL_WEIGHT) < 1e-9) url.searchParams.delete("w");
  else url.searchParams.set("w", String(Math.round(w * 100)));
  window.history.replaceState(window.history.state, "", url);
  weightListeners.forEach((cb) => cb());
}

/**
 * @param facetL2 `true` = sub-category as a multi-select filter (brand / deals pages);
 *   `"switch"` = single-select sub-category switcher with "全部", always visible (L1 group page).
 */
export function Browser({ products, facetL2 = false }: { products: CardProduct[]; facetL2?: boolean | "switch" }) {
  const weight = useSyncExternalStore(subscribeWeight, readWeight, () => DEFAULT_MATERIAL_WEIGHT);
  const setWeight = writeWeight;
  const [sort, setSort] = useState<SortKey>("value");
  const [brands, setBrands] = useState<Set<BrandId>>(new Set());
  const [colors, setColors] = useState<Set<ColorFamily>>(new Set());
  const [fibers, setFibers] = useState<Set<string>>(new Set());
  const [l2s, setL2s] = useState<Set<L2>>(new Set());
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const facets = useMemo(() => {
    const count = <K extends string>(keys: (p: CardProduct) => K[]) => {
      const m = new Map<K, number>();
      for (const p of products) for (const k of keys(p)) m.set(k, (m.get(k) ?? 0) + 1);
      return m;
    };
    return {
      brands: count((p) => [p.brand]),
      colors: count((p) => p.colorFamilies),
      fibers: count((p) => (p.dominantFiber ? [p.dominantFiber] : [])),
      l2s: count((p) => [p.l2]),
      maxPrice: Math.ceil(Math.max(0, ...products.map((p) => p.salePrice))),
    };
  }, [products]);

  const results = useMemo(() => {
    const filtered = products.filter(
      (p) =>
        (brands.size === 0 || brands.has(p.brand)) &&
        (colors.size === 0 || p.colorFamilies.some((c) => colors.has(c))) &&
        (fibers.size === 0 || (p.dominantFiber && fibers.has(p.dominantFiber))) &&
        (l2s.size === 0 || l2s.has(p.l2)) &&
        (priceMax === null || p.salePrice <= priceMax),
    );
    // Rescore locally: slider changes never hit the server (PRD ch.11).
    const scored: ScoredProduct[] = filtered.map((p) => {
      const score = Math.round(100 * (weight * (p.materialScore ?? 0) + (1 - weight) * (1 - p.pricePercentile)));
      const materialPart = Math.round(100 * weight * (p.materialScore ?? 0));
      return { ...p, score, materialPart, pricePart: score - materialPart };
    });
    const byPrice = (a: ScoredProduct, b: ScoredProduct) => a.salePrice - b.salePrice;
    const cmp: Record<SortKey, (a: ScoredProduct, b: ScoredProduct) => number> = {
      value: (a, b) => b.score - a.score || byPrice(a, b),
      "price-asc": byPrice,
      "price-desc": (a, b) => -byPrice(a, b),
      material: (a, b) => (b.materialScore ?? -1) - (a.materialScore ?? -1) || byPrice(a, b),
    };
    return scored.sort(cmp[sort]);
  }, [products, brands, colors, fibers, l2s, priceMax, weight, sort]);

  const range: [number, number] = results.length
    ? [Math.min(...results.map((r) => r.score)), Math.max(...results.map((r) => r.score))]
    : [0, 100];
  // The switcher is navigation, not a filter: it isn't counted or cleared with the filters.
  const l2IsFilter = facetL2 === true;
  const activeFilters = brands.size + colors.size + fibers.size + (l2IsFilter ? l2s.size : 0) + (priceMax !== null ? 1 : 0);
  const l2Options = (Object.keys(L2_INDEX) as L2[]).filter((l2) => facets.l2s.has(l2));
  const pos = Math.round(weight * 100);

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-8">
      {/* Controls */}
      <aside className="lg:sticky lg:top-20 self-start space-y-4 lg:space-y-7">
        <section aria-labelledby="w-label" className="stitch bg-paper border border-rule p-4">
          <div id="w-label" className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">權重</span>
            {pos !== 50 && (
              <button type="button" onClick={() => setWeight(DEFAULT_MATERIAL_WEIGHT)} className="text-[11px] text-ink-soft hover:text-ink underline underline-offset-2">
                回到 50/50
              </button>
            )}
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <div className="text-xs text-ochre">價格</div>
              <div className="font-display text-3xl leading-none tabular-nums text-ochre">{100 - pos}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-indigo">材質</div>
              <div className="font-display text-3xl leading-none tabular-nums text-indigo">{pos}</div>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={pos}
            onChange={(e) => setWeight(Number(e.target.value) / 100)}
            className="balance mt-2"
            style={{ ["--pos" as string]: `${pos}%` }}
            aria-label="材質權重"
            aria-valuetext={`材質 ${pos}%，價格 ${100 - pos}%`}
          />
          <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">往右拉，材質更重要；往左拉，價格更重要。列表即時重排。</p>
        </section>

        {facetL2 === "switch" && l2Options.length > 1 && (
          <section aria-labelledby="sub-label">
            <h3 id="sub-label" className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint mb-2">子分類</h3>
            <div role="radiogroup" aria-labelledby="sub-label" className="flex flex-wrap lg:flex-col gap-1.5 lg:gap-0">
              {[null, ...l2Options].map((l2) => {
                const on = l2 === null ? l2s.size === 0 : l2s.has(l2);
                const count = l2 === null ? products.length : facets.l2s.get(l2)!;
                return (
                  <button
                    key={l2 ?? "all"}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setL2s(l2 === null ? new Set() : new Set([l2]));
                      setShown(PAGE);
                    }}
                    className={`group flex items-baseline gap-2 text-sm px-2.5 py-1.5 lg:px-2 lg:py-2 border lg:border-0 lg:border-b lg:border-dashed transition-colors text-left ${
                      on
                        ? "bg-ink text-paper border-ink lg:bg-transparent lg:text-ink lg:border-rule lg:font-medium"
                        : "bg-paper border-rule lg:bg-transparent hover:border-ink/50 lg:hover:bg-paper/70"
                    }`}
                  >
                    <span aria-hidden className={`hidden lg:inline-block w-1.5 h-1.5 rounded-full self-center ${on ? "bg-indigo" : "bg-transparent"}`} />
                    <span>{l2 === null ? "全部" : L2_INDEX[l2].name}</span>
                    <span className={`ml-auto font-mono text-[10px] ${on ? "text-paper/70 lg:text-ink-faint" : "text-ink-faint"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          className="lg:hidden w-full flex items-center justify-between border border-rule bg-paper px-3 py-2 text-sm"
        >
          <span>篩選{activeFilters > 0 && <span className="ml-1 font-mono text-xs">({activeFilters})</span>}</span>
          <span aria-hidden className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`}>▾</span>
        </button>

        <div className={`${filtersOpen ? "block" : "hidden"} lg:block space-y-7`}>
          {l2IsFilter && facets.l2s.size > 1 && (
            <Facet title="品類">
              {[...facets.l2s].sort((a, b) => b[1] - a[1]).map(([l2, n]) => (
                <Chip key={l2} on={l2s.has(l2)} onClick={() => setL2s(toggle(l2s, l2))} count={n}>
                  {L2_INDEX[l2].name}
                </Chip>
              ))}
            </Facet>
          )}

          {facets.brands.size > 1 && (
            <Facet title="品牌">
              {[...facets.brands].sort((a, b) => b[1] - a[1]).map(([b, n]) => (
                <Chip key={b} on={brands.has(b)} onClick={() => setBrands(toggle(brands, b))} count={n}>
                  {BRANDS[b].name}
                </Chip>
              ))}
            </Facet>
          )}

          <Facet title="色族">
            {COLOR_FAMILIES.filter((c) => facets.colors.has(c)).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColors(toggle(colors, c))}
                aria-pressed={colors.has(c)}
                title={`${COLOR_FAMILY_LABEL[c].label}（${facets.colors.get(c)}）`}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${colors.has(c) ? "border-ink scale-110" : "border-paper ring-1 ring-ink/15 hover:scale-105"}`}
                style={{ background: COLOR_FAMILY_LABEL[c].swatch }}
              >
                <span className="sr-only">{COLOR_FAMILY_LABEL[c].label}</span>
              </button>
            ))}
          </Facet>

          {facets.fibers.size > 0 && (
            <Facet title="主要材質">
              {[...facets.fibers].sort((a, b) => b[1] - a[1]).map(([f, n]) => (
                <Chip key={f} on={fibers.has(f)} onClick={() => setFibers(toggle(fibers, f))} count={n}>
                  {FIBERS[f as Fiber]?.label ?? f}
                </Chip>
              ))}
            </Facet>
          )}

          {facets.maxPrice > 0 && (
            <Facet title="價格上限">
              <div className="w-full">
                <input
                  type="range"
                  min={0}
                  max={facets.maxPrice}
                  step={1}
                  value={priceMax ?? facets.maxPrice}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPriceMax(v >= facets.maxPrice ? null : v);
                  }}
                  className="w-full accent-ink"
                  aria-label="價格上限"
                />
                <div className="flex justify-between font-mono text-[11px] text-ink-soft">
                  <span>$0</span>
                  <span>{priceMax === null ? "不限" : `≤ $${priceMax}`}</span>
                </div>
              </div>
            </Facet>
          )}
        </div>
      </aside>

      {/* Results */}
      <section aria-live="polite">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule pb-3 mb-5">
          <p className="text-sm text-ink-soft">
            <span className="font-mono text-ink">{results.length}</span> 件
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBrands(new Set()); setColors(new Set()); setFibers(new Set()); setPriceMax(null);
                  if (l2IsFilter) setL2s(new Set());
                }}
                className="ml-3 text-xs underline underline-offset-2 hover:text-ink"
              >
                清除 {activeFilters} 個篩選
              </button>
            )}
          </p>
          <div role="radiogroup" aria-label="排序" className="ml-auto flex gap-1 text-xs">
            {SORTS.map((s) => (
              <button
                key={s.key}
                role="radio"
                aria-checked={sort === s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={`px-2.5 py-1 border transition-colors ${sort === s.key ? "bg-ink text-paper border-ink" : "border-rule hover:border-ink/50"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {results.length === 0 ? (
          <p className="py-20 text-center text-ink-faint">沒有符合條件的商品。試著放寬篩選。</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {results.slice(0, shown).map((p, i) => (
                <ProductCard key={p.id} p={p} weight={weight} range={range} index={i} />
              ))}
            </div>
            {shown < results.length && (
              <div className="mt-8 text-center">
                <button type="button" onClick={() => setShown((n) => n + PAGE)} className="border border-ink px-5 py-2 text-sm hover:bg-ink hover:text-paper transition-colors">
                  再看 {Math.min(PAGE, results.length - shown)} 件（還有 {results.length - shown} 件）
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Facet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint mb-2">{title}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function Chip({ on, onClick, count, children }: { on: boolean; onClick: () => void; count: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`text-xs px-2 py-1 border transition-colors ${on ? "bg-ink text-paper border-ink" : "bg-paper border-rule hover:border-ink/50"}`}
    >
      {children} <span className={`font-mono text-[10px] ${on ? "text-paper/70" : "text-ink-faint"}`}>{count}</span>
    </button>
  );
}
