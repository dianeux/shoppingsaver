"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BRANDS } from "@/domain/brands";
import {
  CLIP_BRANDS, clipTarget, draftFromClip, REPORTS_TO_HIDE, SUBMISSION_TTL_DAYS,
  validateSubmission, type ClipPayload, type SubmissionError, type SubmissionInput,
} from "@/domain/clip";
import { materialScore, parseComposition } from "@/domain/composition";
import { GENDERS, type Gender } from "@/domain/gender";
import { homeL1, TAXONOMY } from "@/domain/taxonomy";
import { useLang } from "@/i18n/client";
import { formatComposition, href, l1Name, l2Name } from "@/i18n/format";
import { bookmarkletHref } from "@/lib/bookmarklet";
import { thumb } from "@/lib/format";

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function readPayload(hash: string): ClipPayload | null {
  if (hash.length < 2) return null;
  try {
    const p = JSON.parse(decodeURIComponent(hash.slice(1))) as ClipPayload;
    return p?.v === 1 && typeof p.url === "string" ? p : null;
  } catch {
    return null;
  }
}

/** /add — install the bookmarklet, or review what it clipped and add it to the catalog. */
export function AddProduct() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const payload = useMemo(() => readPayload(hash), [hash]);
  const { t } = useLang();
  if (!payload) return <Install />;
  if (!clipTarget(payload.url)) {
    return (
      <Panel>
        <p className="text-warn">{t.add.unsupported(payload.url)}</p>
        <p className="mt-2 text-sm text-ink-soft">{t.add.unsupportedHelp}</p>
      </Panel>
    );
  }
  return <Review key={hash} payload={payload} />;
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="border border-rule p-6 max-w-2xl">{children}</div>;
}

function Install() {
  const link = useRef<HTMLAnchorElement>(null);
  const { lang, t } = useLang();
  useEffect(() => {
    // React refuses javascript: URLs in JSX, so the bookmarklet is set on the element directly.
    link.current?.setAttribute("href", bookmarkletHref(window.location.origin));
  }, []);
  const brands = (Object.keys(CLIP_BRANDS) as (keyof typeof CLIP_BRANDS)[]).map((b) => BRANDS[b].name).join(lang === "zh" ? "、" : ", ");
  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-3 text-[15px] leading-relaxed text-ink-soft">
        <p>{t.add.intro(brands)}</p>
        <p className="text-sm">{t.add.privacy}</p>
      </section>

      <section className="border border-rule p-6 space-y-4">
        <h2 className="font-mono text-sm uppercase tracking-[0.14em] text-ink-faint">{t.add.step1}</h2>
        <p className="text-sm text-ink-soft">{t.add.step1Help}</p>
        <a
          ref={link}
          href="#"
          onClick={(e) => {
            e.preventDefault();
            alert(t.add.dragAlert);
          }}
          className="inline-block border-2 border-ink px-4 py-2 text-sm font-medium cursor-grab select-none"
        >
          {t.add.button}
        </a>
      </section>

      <section className="border border-rule p-6 space-y-2">
        <h2 className="font-mono text-sm uppercase tracking-[0.14em] text-ink-faint">{t.add.step2}</h2>
        <ol className="list-decimal pl-5 text-sm text-ink-soft space-y-1">
          <li>{t.add.step2a(brands)}</li>
          <li>{t.add.step2b}</li>
          <li>{t.add.step2c}</li>
        </ol>
      </section>

      <p className="text-xs text-ink-faint leading-relaxed">
        {t.add.fineprint(SUBMISSION_TTL_DAYS, REPORTS_TO_HIDE)}
      </p>
    </div>
  );
}

type Estimate = { compared: number; cheaperThan: number | null; valueScore: number };

function Review({ payload }: { payload: ClipPayload }) {
  const target = clipTarget(payload.url)!;
  const { lang, t } = useLang();
  const draft = useMemo(() => draftFromClip(payload), [payload]);
  const [form, setForm] = useState<SubmissionInput>(draft.input);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" } | { kind: "done"; created: boolean } | { kind: "error"; messages: string[] }>({ kind: "idle" });
  const errorText = (e: SubmissionError) => t.add.errors[e];
  const [est, setEst] = useState<Estimate | null>(null);
  const set = <K extends keyof SubmissionInput>(k: K, v: SubmissionInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const parsed = parseComposition(form.compositionText);
  const material = parsed.ok ? materialScore(parsed.composition.main) : null;
  const check = validateSubmission(form);
  const estKey = form.gender && form.l2 && form.price ? `${form.gender}|${form.l2}|${form.price}|${form.compositionText}` : "";

  useEffect(() => {
    if (!estKey) return;
    const [g, l2, price, comp] = estKey.split("|");
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/submissions/estimate?${new URLSearchParams({ g, l2, price, comp })}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((e: Estimate | null) => setEst(e))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [estKey]);

  async function submit() {
    setStatus({ kind: "saving" });
    const r = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).catch(() => null);
    const body = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) {
      setStatus({ kind: "done", created: !!body.created });
      history.replaceState(null, "", window.location.pathname);
    } else {
      const codes: SubmissionError[] | undefined = body.errors;
      const message = body.error === "rate_limited" ? t.add.rateLimited : body.error === "conflict" ? t.add.conflict : t.add.failed;
      setStatus({ kind: "error", messages: codes?.length ? codes.map(errorText) : [message] });
    }
  }

  if (status.kind === "done") {
    const where = href(lang, form.gender!, `/c/${form.l2}`);
    return (
      <Panel>
        <p className="text-lg">{status.created ? t.add.created : t.add.updated}: {form.name}</p>
        <p className="mt-2 text-sm text-ink-soft">{t.add.hourly}</p>
        <Link href={where} className="inline-block mt-4 border border-ink px-4 py-2 text-sm hover:bg-ink hover:text-paper">
          {t.add.goTo(t.gender[form.gender!], l2Name(lang, form.l2!))}
        </Link>
      </Panel>
    );
  }

  const input = "w-full border border-ink/30 bg-paper px-3 py-2 text-sm focus:outline-none focus:border-ink";
  const label = "block font-mono text-sm uppercase tracking-[0.14em] text-ink-faint mb-1.5";
  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-8 max-w-4xl">
      <div>
        {form.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb(form.imageUrl, 480) ?? form.imageUrl} alt="" className="w-full aspect-[4/5] object-cover bg-cloth-deep" />
        ) : (
          <div className="w-full aspect-[4/5] bg-cloth-deep grid place-items-center text-xs text-ink-faint">{t.card.noImage}</div>
        )}
        <p className="mt-2 text-sm">{BRANDS[target.brand].name}</p>
        <a href={form.url} target="_blank" rel="noopener noreferrer" className="text-xs text-ink-soft underline break-all">{form.url}</a>
      </div>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (check.ok) submit();
        }}
      >
        <div>
          <label className={label} htmlFor="name">{t.add.name}</label>
          <input id="name" className={input} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <fieldset>
            <legend className={label}>{t.add.section}</legend>
            <div className="flex gap-4 text-sm">
              {GENDERS.map((g) => (
                <label key={g} className="flex items-center gap-1.5">
                  <input type="radio" name="gender" checked={form.gender === g} onChange={() => set("gender", g as Gender)} /> {t.gender[g]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label className={label} htmlFor="l2">{t.add.category}</label>
            <select id="l2" className={input} value={form.l2 ?? ""} onChange={(e) => set("l2", (e.target.value || null) as SubmissionInput["l2"])}>
              <option value="">{t.add.choose}</option>
              {TAXONOMY.filter((g) => homeL1(form.gender ?? "women").includes(g.l1)).map((g) => (
                <optgroup key={g.l1} label={l1Name(lang, g.l1)}>
                  {g.children.map((c) => (
                    <option key={c.l2} value={c.l2}>{l2Name(lang, c.l2)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          <div>
            <label className={label} htmlFor="price">{t.add.price}</label>
            <input id="price" type="number" step="0.01" min="1" className={input} value={form.price ?? ""} onChange={(e) => set("price", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className={label} htmlFor="list">{t.add.listPrice}</label>
            <input id="list" type="number" step="0.01" className={input} value={form.listPrice ?? ""} onChange={(e) => set("listPrice", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className={label} htmlFor="color">{t.add.priceColor}</label>
            <select id="color" className={input} value={form.priceColor ?? ""} onChange={(e) => set("priceColor", e.target.value || null)}>
              <option value="">—</option>
              {form.colors.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={label} htmlFor="comp">{t.add.composition}</label>
          <textarea id="comp" rows={2} className={input} value={form.compositionText} onChange={(e) => set("compositionText", e.target.value)} placeholder={t.add.compositionPlaceholder} />
          {!form.compositionText && (
            <p className="mt-1.5 text-sm text-warn">
              {t.add.noComposition}
            </p>
          )}
          {form.compositionText && (
            <p className={`mt-1.5 text-sm ${parsed.ok ? "text-ink-soft" : "text-warn"}`}>
              {parsed.ok ? t.add.readAs(formatComposition(lang, parsed.composition.main), Math.round((material ?? 0) * 100)) : t.add.unreadable}
            </p>
          )}
        </div>

        {est && estKey && (
          <p className="border-l-2 border-value pl-3 text-sm text-ink-soft">
            {est.compared > 0
              ? <>{t.add.estimate(est.compared, est.cheaperThan)} <strong className="text-value text-base">{est.valueScore}</strong></>
              : t.add.noComparable}
          </p>
        )}

        {!check.ok && (
          <ul className="text-sm text-warn list-disc pl-5">
            {check.errors.map((e) => <li key={e}>{errorText(e)}</li>)}
          </ul>
        )}
        {status.kind === "error" && (
          <ul className="text-sm text-warn list-disc pl-5">
            {status.messages.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}

        <div className="flex items-center gap-4">
          <button type="submit" disabled={!check.ok || status.kind === "saving"} className="bg-ink text-paper px-6 py-2.5 text-sm disabled:opacity-40">
            {status.kind === "saving" ? t.add.saving : t.add.submit}
          </button>
          <p className="text-xs text-ink-faint">{t.add.publicNote}</p>
        </div>
      </form>
    </div>
  );
}
