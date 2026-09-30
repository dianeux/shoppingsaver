"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BRANDS } from "@/domain/brands";
import {
  CLIP_BRANDS, clipTarget, draftFromClip, REPORTS_TO_HIDE, SUBMISSION_ERROR_COPY, SUBMISSION_TTL_DAYS,
  validateSubmission, type ClipPayload, type SubmissionInput,
} from "@/domain/clip";
import { formatComposition, materialScore, parseComposition } from "@/domain/composition";
import { GENDER_LABEL, GENDERS, genderPath, type Gender } from "@/domain/gender";
import { homeL1, L2_INDEX, TAXONOMY } from "@/domain/taxonomy";
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
  if (!payload) return <Install />;
  if (!clipTarget(payload.url)) {
    return (
      <Panel>
        <p className="text-warn">這個頁面不是支援的商品頁：{payload.url}</p>
        <p className="mt-2 text-sm text-ink-soft">請在 Uniqlo、GU、Zara 或 H&amp;M 美國官網的單一商品頁使用書籤。</p>
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
  useEffect(() => {
    // React refuses javascript: URLs in JSX, so the bookmarklet is set on the element directly.
    link.current?.setAttribute("href", bookmarkletHref(window.location.origin));
  }, []);
  const brands = (Object.keys(CLIP_BRANDS) as (keyof typeof CLIP_BRANDS)[]).map((b) => BRANDS[b].name).join("、");
  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-3 text-[15px] leading-relaxed text-ink-soft">
        <p>
          {brands} 不允許自動抓取，所以這幾個品牌的商品要由你在瀏覽時加入：在商品頁點一下書籤，就會帶著名稱、價格、顏色和成分回到這裡，確認後加入比較。
        </p>
        <p className="text-sm">資料是你的瀏覽器讀取你正在看的頁面，我們的伺服器不會連到品牌網站。</p>
      </section>

      <section className="border border-rule p-6 space-y-4">
        <h2 className="font-mono text-sm uppercase tracking-[0.14em] text-ink-faint">1. 安裝（只要一次）</h2>
        <p className="text-sm text-ink-soft">把下面的按鈕拖到瀏覽器的書籤列（看不到書籤列：⌘ + Shift + B）。</p>
        <a
          ref={link}
          href="#"
          onClick={(e) => {
            e.preventDefault();
            alert("請把這個按鈕拖到書籤列，再到品牌的商品頁點它。");
          }}
          className="inline-block border-2 border-ink px-4 py-2 text-sm font-medium cursor-grab select-none"
        >
          ＋ 加到 ShoppingSaver
        </a>
      </section>

      <section className="border border-rule p-6 space-y-2">
        <h2 className="font-mono text-sm uppercase tracking-[0.14em] text-ink-faint">2. 在商品頁點書籤</h2>
        <ol className="list-decimal pl-5 text-sm text-ink-soft space-y-1">
          <li>打開 {brands} 美國官網的一件商品。</li>
          <li>H&amp;M、Zara 的成分藏在收合區塊裡：先點開「Materials」或「Composition」。</li>
          <li>點書籤列上的「＋ 加到 ShoppingSaver」，確認資料後按「加入」。</li>
        </ol>
      </section>

      <p className="text-xs text-ink-faint leading-relaxed">
        加入的商品所有人都看得到，標示為「用戶提供」。我們無法自動確認它是否還在賣：超過 {SUBMISSION_TTL_DAYS} 天沒人重新加入就會自動隱藏，
        或被 {REPORTS_TO_HIDE} 位訪客回報已下架時提早隱藏。電腦版瀏覽器適用；手機的書籤小工具不好安裝。
      </p>
    </div>
  );
}

type Estimate = { compared: number; cheaperThan: number | null; valueScore: number };

function Review({ payload }: { payload: ClipPayload }) {
  const target = clipTarget(payload.url)!;
  const draft = useMemo(() => draftFromClip(payload), [payload]);
  const [form, setForm] = useState<SubmissionInput>(draft.input);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" } | { kind: "done"; created: boolean } | { kind: "error"; messages: string[] }>({ kind: "idle" });
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
      history.replaceState(null, "", "/add");
    } else setStatus({ kind: "error", messages: body.messages ?? [body.error ?? "加入失敗，請稍後再試。"] });
  }

  if (status.kind === "done") {
    const where = genderPath(form.gender!, `/c/${form.l2}`);
    return (
      <Panel>
        <p className="text-lg">{status.created ? "已加入目錄" : "已更新價格與確認日期"}：{form.name}</p>
        <p className="mt-2 text-sm text-ink-soft">頁面每小時更新，最晚一小時內會出現在分類頁。</p>
        <Link href={where} className="inline-block mt-4 border border-ink px-4 py-2 text-sm hover:bg-ink hover:text-paper">
          去 {GENDER_LABEL[form.gender!]}「{L2_INDEX[form.l2!].name}」看看
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
          <div className="w-full aspect-[4/5] bg-cloth-deep grid place-items-center text-xs text-ink-faint">無圖片</div>
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
          <label className={label} htmlFor="name">名稱</label>
          <input id="name" className={input} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <fieldset>
            <legend className={label}>分區</legend>
            <div className="flex gap-4 text-sm">
              {GENDERS.map((g) => (
                <label key={g} className="flex items-center gap-1.5">
                  <input type="radio" name="gender" checked={form.gender === g} onChange={() => set("gender", g as Gender)} /> {GENDER_LABEL[g]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label className={label} htmlFor="l2">品類</label>
            <select id="l2" className={input} value={form.l2 ?? ""} onChange={(e) => set("l2", (e.target.value || null) as SubmissionInput["l2"])}>
              <option value="">請選擇</option>
              {TAXONOMY.filter((g) => homeL1(form.gender ?? "women").includes(g.l1)).map((g) => (
                <optgroup key={g.l1} label={g.name}>
                  {g.children.map((c) => (
                    <option key={c.l2} value={c.l2}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          <div>
            <label className={label} htmlFor="price">售價（USD）</label>
            <input id="price" type="number" step="0.01" min="1" className={input} value={form.price ?? ""} onChange={(e) => set("price", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className={label} htmlFor="list">原價（可空白）</label>
            <input id="list" type="number" step="0.01" className={input} value={form.listPrice ?? ""} onChange={(e) => set("listPrice", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className={label} htmlFor="color">這個價格的顏色</label>
            <select id="color" className={input} value={form.priceColor ?? ""} onChange={(e) => set("priceColor", e.target.value || null)}>
              <option value="">—</option>
              {form.colors.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={label} htmlFor="comp">成分</label>
          <textarea id="comp" rows={2} className={input} value={form.compositionText} onChange={(e) => set("compositionText", e.target.value)} placeholder="例如：60% cotton, 40% polyester" />
          {!form.compositionText && (
            <p className="mt-1.5 text-sm text-warn">
              沒有抓到成分。回到商品頁點開「Materials」或「Composition」區塊，再按一次書籤；或直接把成分貼在這裡。
            </p>
          )}
          {form.compositionText && (
            <p className={`mt-1.5 text-sm ${parsed.ok ? "text-ink-soft" : "text-warn"}`}>
              {parsed.ok ? `讀成：${formatComposition(parsed.composition.main)}（材質分 ${Math.round((material ?? 0) * 100)}）` : "讀不懂這段成分，請寫成「百分比 + 纖維」。"}
            </p>
          )}
        </div>

        {est && estKey && (
          <p className="border-l-2 border-value pl-3 text-sm text-ink-soft">
            {est.compared > 0
              ? <>在目錄的 {est.compared} 件同類商品中，比 {est.cheaperThan}% 便宜；性價比分數約 <strong className="text-value text-base">{est.valueScore}</strong>。</>
              : <>目錄裡還沒有這個分類的同類商品可以比較。</>}
          </p>
        )}

        {!check.ok && (
          <ul className="text-sm text-warn list-disc pl-5">
            {check.errors.map((e) => <li key={e}>{SUBMISSION_ERROR_COPY[e]}</li>)}
          </ul>
        )}
        {status.kind === "error" && (
          <ul className="text-sm text-warn list-disc pl-5">
            {status.messages.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}

        <div className="flex items-center gap-4">
          <button type="submit" disabled={!check.ok || status.kind === "saving"} className="bg-ink text-paper px-6 py-2.5 text-sm disabled:opacity-40">
            {status.kind === "saving" ? "加入中…" : "加入目錄"}
          </button>
          <p className="text-xs text-ink-faint">加入後所有人都看得到，標示為「用戶提供」。</p>
        </div>
      </form>
    </div>
  );
}
