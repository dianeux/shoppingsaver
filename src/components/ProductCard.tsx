"use client";

import Link from "next/link";
import { useState } from "react";
import { BRANDS } from "@/domain/brands";
import { COLOR_FAMILY_LABEL } from "@/domain/colors";
import type { CardProduct } from "@/lib/types";

const STATUS_COPY = {
  extraction_failed: "成分待補",
  not_disclosed: "品牌未提供成分",
} as const;

export function thumb(url: string | null, width = 600) {
  if (!url) return null;
  if (url.includes("cdn.shopify.com")) return `${url}${url.includes("?") ? "&" : "?"}width=${width}`;
  return url;
}

export const usd = (n: number) => `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;

export interface ScoredProduct extends CardProduct {
  score: number;
  materialPart: number;
  pricePart: number;
}

export function ProductCard({
  p,
  weight,
  range,
  index,
}: {
  p: ScoredProduct;
  weight: number;
  /** min/max score of the current result set, for the relative strip. */
  range: [number, number];
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const onSale = p.salePrice < p.listPrice;
  const rel = range[1] > range[0] ? (p.score - range[0]) / (range[1] - range[0]) : 0.5;
  const img = thumb(p.imageUrl);
  const materialMissing = p.compositionStatus !== "extracted";

  return (
    <article
      className="rise group relative flex flex-col bg-paper border border-rule/70 hover:border-ink/40 transition-colors"
      style={{ animationDelay: `${Math.min(index, 16) * 30}ms` }}
    >
      <a href={p.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-[4/5] overflow-hidden bg-cloth-deep">
        {img ? (
          // Brand CDNs already resize; next/image would re-host every brand image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="h-full w-full grid place-items-center text-ink-faint text-xs">無圖片</div>
        )}
        {p.drop && (
          <span className="absolute left-0 top-3 bg-madder text-paper font-mono text-[11px] px-2 py-1 tracking-wide">
            −{Math.round(p.drop.pct * 100)}%
          </span>
        )}
        {/* Hang tag */}
        <div className="absolute right-3 top-0 flex flex-col items-center">
          <span className="block w-px h-3 bg-ink/50" />
          <div className="stitch bg-paper/95 backdrop-blur-sm border border-ink/15 px-2.5 pt-1.5 pb-2 min-w-[52px] text-center shadow-[0_6px_14px_-8px_rgba(28,26,23,.5)] rotate-[2deg] group-hover:rotate-0 transition-transform">
            <div className="font-mono text-[9px] tracking-[0.18em] text-ink-faint">VALUE</div>
            <div className="font-display text-[28px] leading-none tabular-nums">{p.score}</div>
          </div>
        </div>
      </a>

      <div className="flex flex-col gap-2 p-3 flex-1">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/brand/${p.brand}`}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft hover:text-indigo underline-offset-4 hover:underline"
            title={`看 ${BRANDS[p.brand].name} 全品類`}
          >
            {BRANDS[p.brand].name}
          </Link>
          <div className="flex -space-x-1">
            {p.colors.slice(0, 6).map((c) => (
              <span
                key={c.raw}
                title={c.raw}
                className="h-3 w-3 rounded-full border border-paper ring-1 ring-ink/15"
                style={{ background: c.family ? COLOR_FAMILY_LABEL[c.family].swatch : "var(--cloth-deep)" }}
              />
            ))}
            {p.colors.length > 6 && <span className="pl-2 text-[10px] text-ink-faint">+{p.colors.length - 6}</span>}
          </div>
        </div>

        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[15px] leading-snug hover:underline underline-offset-4 decoration-1 line-clamp-2">
          {p.name}
        </a>

        <div className="flex items-baseline gap-2">
          <span className={`font-mono text-[15px] ${onSale ? "text-madder" : ""}`}>{usd(p.salePrice)}</span>
          {onSale && <span className="font-mono text-xs text-ink-faint line-through">{usd(p.listPrice)}</span>}
          {p.drop && <span className="font-mono text-[11px] text-ink-faint">30 天中位 {usd(p.drop.median30d)}</span>}
        </div>

        {/* Composition, printed like a care label */}
        <p className={`font-mono text-[11px] leading-relaxed ${materialMissing ? "text-warn" : "text-ink-soft"}`}>
          {materialMissing ? STATUS_COPY[p.compositionStatus as keyof typeof STATUS_COPY] : p.compositionText}
        </p>

        {/* Where this item sits within the current results (spreads out a crowded middle). */}
        <div className="mt-auto pt-2">
          <div className="relative h-[3px] bg-rule/70" aria-hidden>
            <span className="absolute -top-[3px] h-[9px] w-[3px] bg-ink" style={{ left: `calc(${rel * 100}% - 1.5px)` }} />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px] text-ink-faint">
            <span>{range[0]}</span>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="text-ink-soft hover:text-ink uppercase tracking-[0.14em]"
            >
              {open ? "收起" : "分數拆解"}
            </button>
            <span>{range[1]}</span>
          </div>
        </div>

        {open && (
          <div className="border-t border-dashed border-rule pt-2 text-xs space-y-1.5">
            <Breakdown
              label="材質"
              value={p.materialScore}
              part={p.materialPart}
              weight={weight}
              color="bg-indigo"
              note={materialMissing ? `${STATUS_COPY[p.compositionStatus as keyof typeof STATUS_COPY]}，以 0 計` : undefined}
            />
            <Breakdown label="價格" value={1 - p.pricePercentile} part={p.pricePart} weight={1 - weight} color="bg-ochre" note={`比本品類 ${Math.round((1 - p.pricePercentile) * 100)}% 的商品便宜`} />
            <p className="font-mono text-[10px] text-ink-faint pt-0.5">
              {p.materialPart} + {p.pricePart} = {p.score}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

function Breakdown({ label, value, part, weight, color, note }: { label: string; value: number | null; part: number; weight: number; color: string; note?: string }) {
  const v = Math.round((value ?? 0) * 100);
  return (
    <div>
      <div className="flex justify-between">
        <span>
          {label} <span className="font-mono">{v}</span>
          <span className="text-ink-faint"> × {Math.round(weight * 100)}%</span>
        </span>
        <span className="font-mono">{part}</span>
      </div>
      <div className="mt-0.5 h-1 bg-cloth-deep">
        <div className={`h-full ${color}`} style={{ width: `${v}%` }} />
      </div>
      {note && <p className="text-[10px] text-ink-faint mt-0.5">{note}</p>}
    </div>
  );
}
