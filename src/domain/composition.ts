import { ELASTANE_EXEMPT_MAX_PCT, FIBERS, fiberCoefficient, resolveFiber, type Fiber, type FiberClass } from "./materials";

/** One fiber in a composition (PRD ch.8). `coefficient: null` = excluded from scoring. */
export interface FiberShare {
  fiber: Fiber;
  raw: string;
  percentage: number;
  category: FiberClass;
  coefficient: number | null;
  recycled: boolean;
  organic: boolean;
}

export interface CompositionPart {
  /** "Body", "Shell", "Lining"… or null for a single-part garment. */
  label: string | null;
  fibers: FiberShare[];
}

export interface Composition {
  /** The part used for scoring: body / shell / main fabric. */
  main: FiberShare[];
  parts: CompositionPart[];
}

export type CompositionStatus = "extracted" | "extraction_failed" | "not_disclosed";

export type ParseResult =
  | { ok: true; composition: Composition }
  | { ok: false; reason: string; unknownFibers?: string[] };

const SECONDARY_LABELS = /^(lining|linings|pocket|pockets|pocketing|rib|ribbing|trim|trims|lace|contrast|cuff|cuffs|hem|collar|interlining|filling|fill|padding|insulation|embroidery|elastic|waistband|gusset|mesh|sleeves?|built-in|liner)/i;
const PRIMARY_LABELS = /^(body|shell|main|outer|self|front|fabric|main fabric|outer shell|exterior)/i;

// "60% cotton", "60 % Organic Cotton", "cotton 60%"
const PCT_FIRST = /(\d{1,3}(?:\.\d+)?)\s*%\s*([a-z][a-z'’™®\- ]*?[a-z™®])(?=\s*(?:[,/;.+&|]|\band\b|\d|$))/gi;
const NAME_FIRST = /([a-z][a-z'’™®\- ]*?[a-z™®])\s*(\d{1,3}(?:\.\d+)?)\s*%/gi;

function parseFibers(segment: string): { fibers: FiberShare[]; unknown: string[] } | null {
  const text = segment.replace(/ /g, " ");
  // Try both orders and keep the reading whose shares add up closest to 100%.
  const pctFirst = [...text.matchAll(PCT_FIRST)].map((m) => ({ pct: Number(m[1]), name: m[2] }));
  const nameFirst = [...text.matchAll(NAME_FIRST)].map((m) => ({ pct: Number(m[2]), name: m[1] }));
  const off = (ps: { pct: number }[]) => (ps.length ? Math.abs(100 - ps.reduce((s, p) => s + p.pct, 0)) : Infinity);
  const pairs = off(nameFirst) < off(pctFirst) ? nameFirst : pctFirst;
  if (pairs.length === 0) return null;

  const fibers: FiberShare[] = [];
  const unknown: string[] = [];
  for (const { pct, name } of pairs) {
    const r = resolveFiber(name);
    if (!r) {
      unknown.push(name.trim());
      continue;
    }
    fibers.push({
      fiber: r.fiber,
      raw: name.trim(),
      percentage: pct,
      category: FIBERS[r.fiber].class,
      coefficient: fiberCoefficient(r.fiber, r.recycled),
      recycled: r.recycled,
      organic: r.organic,
    });
  }
  return { fibers, unknown };
}

/** Small spandex shares and unnamed "other fibers" are dropped from the score's denominator. */
function applyExemptions(fibers: FiberShare[]): FiberShare[] {
  return fibers.map((f) =>
    (f.fiber === "elastane" && f.percentage <= ELASTANE_EXEMPT_MAX_PCT) || f.fiber === "other" ? { ...f, coefficient: null } : f,
  );
}

function sumPct(fibers: FiberShare[]) {
  return fibers.reduce((s, f) => s + f.percentage, 0);
}

/** Garment parts that brands name without a colon ("Shell 95% Tencel, lining 95% polyester"). */
const BARE_PART = /\b(shell|lining|body|outer|cuffs?(?:\s+and\s+hem)?|hem|trim|fill|filling|rib|ribbing|pocketing|sleeves?|top|skirt|bottom)\s+(?:is\s+|are\s+)?(?=\d{1,3}\s?%)/gi;

/**
 * Normalize the many ways brands write part labels into "Label: …" separated by ";":
 *   "Top - 57% cotton"            → "Top: 57% cotton"
 *   "…polyester Cuffs: 90% nylon" → "…polyester; Cuffs: 90% nylon"
 *   "Shell 95% x, lining 95% y"   → "; Shell: 95% x, ; lining: 95% y"
 * Parenthetical asides ("( soft satin finish )") are dropped.
 */
export function normalizeLabels(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // vicuña → vicuna
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b([A-Z][A-Za-z-]*(?:\s+[A-Za-z-]+){0,2})\s+[-–—]\s+(?=\d{1,3}\s?%)/g, "; $1: ")
    .replace(BARE_PART, (_, part: string) => `; ${part}: `)
    // Only split where a label directly follows a fiber share, so "Body, Pocket: …" stays one label.
    .replace(/(\d{1,3}\s?%\s*[A-Za-z™®'-]+(?:\s+[a-z™®'-]+){0,3})\s+([A-Z][A-Za-z-]*(?:\s+(?:and|&)\s+[A-Za-z-]+)?)\s*:\s*(?=\d)/g, "$1; $2: ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministic parser for the common "Body: 60% Cotton, 40% Polyester / Rib: …"
 * shape. Anything it cannot fully account for is returned as a failure so the
 * caller can fall back to the LLM extractor rather than guess.
 */
export function parseComposition(input: string): ParseResult {
  const text = normalizeLabels(input);
  if (!text) return { ok: false, reason: "empty" };

  // Split on "Label:" boundaries. Labels are short words before a colon.
  const segments: { label: string | null; body: string }[] = [];
  const labelRe = /(?:^|[.;/\n]|\s{2,})\s*([A-Za-z][A-Za-z ,&()-]{1,80}):\s*/g;
  const marks = [...text.matchAll(labelRe)].map((m) => ({ label: m[1].trim(), start: m.index!, end: m.index! + m[0].length }));
  if (marks.length === 0) {
    segments.push({ label: null, body: text });
  } else {
    if (marks[0].start > 0 && /\d\s*%/.test(text.slice(0, marks[0].start))) {
      segments.push({ label: null, body: text.slice(0, marks[0].start) });
    }
    marks.forEach((m, i) => segments.push({ label: m.label, body: text.slice(m.end, marks[i + 1]?.start ?? text.length) }));
  }

  const parsedParts: (CompositionPart & { unknown: string[] })[] = [];
  for (const seg of segments) {
    const parsed = parseFibers(seg.body);
    if (!parsed) continue;
    if (parsed.fibers.length || parsed.unknown.length) {
      parsedParts.push({ label: seg.label, fibers: applyExemptions(parsed.fibers), unknown: parsed.unknown });
    }
  }
  if (parsedParts.length === 0) return { ok: false, reason: "no_percentages" };

  const sumsTo100 = (p: CompositionPart) => {
    const s = sumPct(p.fibers);
    return s >= 98 && s <= 102;
  };
  const main =
    parsedParts.find((p) => p.label && PRIMARY_LABELS.test(p.label)) ??
    parsedParts.find((p) => !p.label || !SECONDARY_LABELS.test(p.label));
  // Only a lining/trim was readable (e.g. a leather jacket's shell isn't a textile fiber):
  // scoring the lining would misstate the garment, so report it instead.
  if (!main) return { ok: false, reason: "no_main_part" };

  // Only the scored (main) part must be fully understood and add up; an odd lining,
  // rib or filling line ("Down (Minimum 90% Down)") is dropped, not fatal.
  if (main.unknown.length) return { ok: false, reason: "unknown_fiber", unknownFibers: main.unknown };
  if (!sumsTo100(main)) return { ok: false, reason: `part_sum_${sumPct(main.fibers)}` };
  const kept = parsedParts
    .filter((p) => p === main || (p.unknown.length === 0 && sumsTo100(p)))
    .map(({ label, fibers }) => ({ label, fibers }));
  return { ok: true, composition: { main: main.fibers, parts: kept } };
}

/**
 * Material score (0–1): percentage-weighted coefficient over fibers that count.
 * Returns null when nothing is scorable (caller treats that as missing data).
 */
export function materialScore(main: FiberShare[]): number | null {
  const counted = main.filter((f) => f.coefficient !== null);
  const denom = sumPct(counted);
  if (denom === 0) return null;
  const num = counted.reduce((s, f) => s + f.percentage * (f.coefficient as number), 0);
  return Math.round((num / denom) * 1000) / 1000;
}

/** Dominant fiber, used by the "main material" filter (F4). */
export function dominantFiber(main: FiberShare[]): Fiber | null {
  if (!main.length) return null;
  return [...main].sort((a, b) => b.percentage - a.percentage)[0].fiber;
}

export function formatComposition(main: FiberShare[]): string {
  return [...main]
    .sort((a, b) => b.percentage - a.percentage)
    .map((f) => `${f.percentage}% ${f.recycled ? "再生" : ""}${f.organic ? "有機" : ""}${FIBERS[f.fiber].label}`)
    .join(" · ");
}
