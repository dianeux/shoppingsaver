"use client";

import Link from "next/link";
import { useState } from "react";
import { BRANDS } from "@/domain/brands";
import { COLOR_FAMILY_LABEL } from "@/domain/colors";
import { useLang } from "@/i18n/client";
import { formatComposition, href } from "@/i18n/format";
import { thumb, usd } from "@/lib/format";
import type { CardProduct } from "@/lib/types";
import { FavoriteButton } from "./FavoriteButton";

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
  const { lang, t } = useLang();

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
            <div className="h-full w-full grid place-items-center text-ink-faint text-xs">{t.card.noImage}</div>
          )}
          {p.drop && (
            <span className="absolute left-0 top-3 bg-madder text-paper font-mono text-[11px] px-2 py-1 tracking-wide">
              −{Math.round(p.drop.pct * 100)}%
            </span>
          )}
          <div className="absolute right-2.5 bottom-2.5 bg-paper px-2 py-1 text-lg font-medium leading-none tabular-nums text-value" title={t.card.score}>
            {p.score}
          </div>
        </a>
        {/* Sibling of the link, not inside it: a button can't nest in an anchor. */}
        <FavoriteButton id={p.id} name={p.name} className="absolute left-2.5 bottom-2.5" />
      </div>

      <div className="flex flex-col pt-3 flex-1">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={href(lang, p.gender, `/brand/${p.brand}`)}
            className="text-xs uppercase tracking-[0.12em] text-ink-soft hover:text-indigo underline-offset-4 hover:underline"
            title={t.card.brandAll(BRANDS[p.brand].name)}
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
            {priceVaries && <span className="text-xs ml-0.5">{t.card.from}</span>}
          </span>
          {p.drop ? (
            <span className="font-mono text-xs text-ink-soft">
              {t.card.beforeDrop} <span className="line-through">{usd(p.drop.baselinePrice)}</span>
            </span>
          ) : (
            onSale && <span className="font-mono text-xs text-ink-soft line-through">{usd(p.listPrice)}</span>
          )}
        </div>
        {priceVaries && p.priceColor && (
          <p className="mt-1 text-xs leading-snug text-ink-soft">
            {t.card.priceColor(p.priceColor, usd(p.maxPrice))}
          </p>
        )}

        {/* Composition, printed like a care label */}
        <p className={`mt-2 text-xs leading-relaxed ${materialMissing ? "text-warn" : "text-ink-soft"}`}>
          {materialMissing
            ? p.compositionStatus === "not_disclosed" ? t.card.notDisclosed : t.card.extractionFailed
            : formatComposition(lang, p.fibers)}
        </p>
        {p.submitted && <SubmittedNote id={p.id} confirmedOn={p.submitted.confirmedOn} />}
      </div>
    </article>
  );
}

/** User-submitted products aren't re-checked nightly: say so, and let visitors report them gone. */
function SubmittedNote({ id, confirmedOn }: { id: string; confirmedOn: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [, m, d] = confirmedOn.split("-").map(Number);
  const { t } = useLang();
  async function report() {
    setState("sending");
    const r = await fetch("/api/submissions/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
    setState(r?.ok ? "done" : "error");
  }
  return (
    <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-xs text-ink-soft">
      <span title={t.card.submittedTitle}>{t.card.submitted(m, d)}</span>
      {state === "done" ? (
        <span>{t.card.reported}</span>
      ) : (
        <button type="button" onClick={report} disabled={state === "sending"} className="underline underline-offset-2 hover:text-ink">
          {state === "error" ? t.card.reportFailed : t.card.report}
        </button>
      )}
    </p>
  );
}
