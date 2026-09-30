"use client";

import Link from "next/link";
import { BRANDS } from "@/domain/brands";
import { COLOR_FAMILY_LABEL } from "@/domain/colors";
import { thumb, usd } from "@/lib/format";
import type { CardProduct } from "@/lib/types";
import { FavoriteButton } from "./FavoriteButton";

const STATUS_COPY = {
  extraction_failed: "成分待補",
  not_disclosed: "品牌未提供成分",
} as const;

export interface ScoredProduct extends CardProduct {
  score: number;
}

export function ProductCard({
  p,
  index,
}: {
  p: ScoredProduct;
  index: number;
}) {
  const onSale = p.salePrice < p.listPrice;
  // Colors are priced differently: the card shows (and links to) the cheapest one.
  const priceVaries = p.maxPrice > p.salePrice;
  const img = thumb(p.imageUrl);
  const materialMissing = p.compositionStatus !== "extracted";

  return (
    <article
      className="rise group relative flex flex-col"
      style={{ animationDelay: `${Math.min(index, 16) * 30}ms` }}
    >
      <div className="relative">
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
          <div className="absolute right-2.5 bottom-2.5 bg-paper px-2 py-1 text-lg font-medium leading-none tabular-nums text-value" title="性價比分數（0–100）">
            {p.score}
          </div>
        </a>
        {/* Sibling of the link, not inside it: a button can't nest in an anchor. */}
        <FavoriteButton id={p.id} name={p.name} className="absolute left-2.5 bottom-2.5" />
      </div>

      <div className="flex flex-col pt-3 flex-1">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/brand/${p.brand}`}
            className="text-xs uppercase tracking-[0.12em] text-ink-soft hover:text-indigo underline-offset-4 hover:underline"
            title={`看 ${BRANDS[p.brand].name} 全品類`}
          >
            {BRANDS[p.brand].name}
          </Link>
          <div className="flex -space-x-1">
            {p.colors.slice(0, 6).map((c) => (
              <span
                key={c.raw}
                title={c.raw}
                className="h-3.5 w-3.5 rounded-full border border-paper ring-1 ring-ink/20"
                style={{ background: c.family ? COLOR_FAMILY_LABEL[c.family].swatch : "var(--cloth-deep)" }}
              />
            ))}
            {p.colors.length > 6 && <span className="pl-2 text-xs text-ink-soft">+{p.colors.length - 6}</span>}
          </div>
        </div>

        <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 text-[15px] leading-snug text-ink hover:underline underline-offset-4 decoration-1 line-clamp-2">
          {p.name}
        </a>

        <div className="mt-2 flex items-baseline gap-2">
          <span className={`font-mono text-[15px] font-medium ${onSale || p.drop ? "text-madder" : ""}`}>
            {usd(p.salePrice)}
            {priceVaries && <span className="text-xs ml-0.5">起</span>}
          </span>
          {p.drop ? (
            <span className="font-mono text-xs text-ink-soft">
              降價前 <span className="line-through">{usd(p.drop.baselinePrice)}</span>
            </span>
          ) : (
            onSale && <span className="font-mono text-xs text-ink-soft line-through">{usd(p.listPrice)}</span>
          )}
        </div>
        {priceVaries && p.priceColor && (
          <p className="mt-1 text-xs leading-snug text-ink-soft">
            {p.priceColor} 的價格；其他顏色最高 {usd(p.maxPrice)}
          </p>
        )}

        {/* Composition, printed like a care label */}
        <p className={`mt-2 text-xs leading-relaxed ${materialMissing ? "text-warn" : "text-ink-soft"}`}>
          {materialMissing ? STATUS_COPY[p.compositionStatus as keyof typeof STATUS_COPY] : p.compositionText}
        </p>
      </div>
    </article>
  );
}

