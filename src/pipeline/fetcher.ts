import { BRANDS, type BrandId } from "@/domain/brands";

/**
 * Polite, whitelisted HTTP client for brand sites (PRD ch.11):
 *  - only official hosts for the brand (no keyword-discovered entry points)
 *  - honours robots.txt for our UA / `*`
 *  - one request at a time per host with a minimum gap
 *  - identifies itself instead of pretending to be a browser
 */
export const USER_AGENT = "ShoppingSaverBot/0.1 (+personal non-commercial portfolio project; nightly catalog index)";

const MIN_GAP_MS = Number(process.env.CRAWL_MIN_GAP_MS ?? 1200);
const MAX_RETRIES = 3;
/** Per-request ceiling, so a site that stalls connections can't hang the nightly job. */
const REQUEST_TIMEOUT_MS = Number(process.env.CRAWL_TIMEOUT_MS ?? 60_000);

/** Network-level failures worth retrying: DNS blips, resets, timeouts. */
const TRANSIENT_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]);

const RETRY_BASE_MS = Number(process.env.CRAWL_RETRY_BASE_MS ?? 2000);

function errorCode(err: Error): string {
  return (err.cause as { code?: string } | undefined)?.code ?? (err as { code?: string }).code ?? err.name;
}

export function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "TimeoutError" || err.name === "AbortError" || TRANSIENT_CODES.has(errorCode(err));
}

export class DisallowedError extends Error {}

interface RobotsRules {
  disallow: string[];
  allow: string[];
}

function parseRobots(txt: string): RobotsRules {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    const k = key.toLowerCase();
    if (k === "user-agent") {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], allow: [], disallow: [] }));
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (k === "allow" && value) cur.allow.push(value);
    if (k === "disallow" && value) cur.disallow.push(value);
  }
  const ours = groups.filter((g) => g.agents.some((a) => a !== "*" && USER_AGENT.toLowerCase().includes(a)));
  const chosen = ours.length ? ours : groups.filter((g) => g.agents.includes("*"));
  return { allow: chosen.flatMap((g) => g.allow), disallow: chosen.flatMap((g) => g.disallow) };
}

function ruleMatches(rule: string, path: string): number {
  // Returns match length (for longest-match precedence) or -1.
  const anchored = rule.endsWith("$");
  const pattern = rule.replace(/\$$/, "").replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const re = new RegExp(`^${pattern}${anchored ? "$" : ""}`);
  return re.test(path) ? rule.length : -1;
}

export function robotsAllows(rules: RobotsRules, path: string): boolean {
  const allow = Math.max(-1, ...rules.allow.map((r) => ruleMatches(r, path)));
  const disallow = Math.max(-1, ...rules.disallow.map((r) => ruleMatches(r, path)));
  return allow >= disallow;
}

const robotsCache = new Map<string, Promise<RobotsRules>>();
const lastRequestAt = new Map<string, number>();
const hostQueue = new Map<string, Promise<unknown>>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rawFetch(url: string, init?: RequestInit): Promise<Response> {
  const host = new URL(url).host;
  // Serialize per host and enforce the minimum gap.
  const prev = hostQueue.get(host) ?? Promise.resolve();
  const run = prev.then(async () => {
    const wait = (lastRequestAt.get(host) ?? 0) + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await fetch(url, {
        ...init,
        headers: { "User-Agent": USER_AGENT, ...init?.headers },
        redirect: "follow",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } finally {
      lastRequestAt.set(host, Date.now());
    }
  });
  hostQueue.set(host, run.catch(() => undefined));
  return run;
}

function robotsFor(origin: string): Promise<RobotsRules> {
  let p = robotsCache.get(origin);
  if (!p) {
    p = withNetworkRetry(() => rawFetch(`${origin}/robots.txt`)).then(async (r) => (r.ok ? parseRobots(await r.text()) : { allow: [], disallow: [] }));
    // Don't cache a failure: the next request should try again rather than inherit it.
    p.catch(() => robotsCache.delete(origin));
    robotsCache.set(origin, p);
  }
  return p;
}

/** Retry transient network errors with exponential backoff (2s, 4s, 8s by default). */
async function withNetworkRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientNetworkError(err) || attempt >= MAX_RETRIES) throw err;
      console.warn(`[fetch] ${errorCode(err as Error)}, retry ${attempt + 1}/${MAX_RETRIES}`);
      await sleep(RETRY_BASE_MS * 2 ** attempt);
    }
  }
}

export function assertOfficial(brand: BrandId, url: string) {
  const host = new URL(url).host;
  if (!BRANDS[brand].officialHosts.includes(host)) {
    throw new DisallowedError(`${host} is not an official ${BRANDS[brand].name} host`);
  }
}

export async function brandFetch(brand: BrandId, url: string, init?: RequestInit): Promise<Response> {
  assertOfficial(brand, url);
  const u = new URL(url);
  const rules = await robotsFor(u.origin);
  if (!robotsAllows(rules, u.pathname + u.search)) throw new DisallowedError(`robots.txt disallows ${u.pathname}`);

  for (let attempt = 0; ; attempt++) {
    const res = await withNetworkRetry(() => rawFetch(url, init));
    // A redirect off the official host would bypass the whitelist.
    assertOfficial(brand, res.url || url);
    if (res.ok) return res;
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || attempt >= MAX_RETRIES) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
  }
}

export async function brandJson<T>(brand: BrandId, url: string, init?: RequestInit): Promise<T> {
  const res = await brandFetch(brand, url, { ...init, headers: { Accept: "application/json", ...init?.headers } });
  return res.json() as Promise<T>;
}

/** POST a JSON body and parse JSON. */
export function brandPostJson<T>(brand: BrandId, url: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  return brandJson<T>(brand, url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
}

/** POST a form-encoded body and parse JSON (sites whose storefront API is an XHR form post). */
export function brandPostForm<T>(brand: BrandId, url: string, form: Record<string, string>): Promise<T> {
  return brandJson<T>(brand, url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: new URLSearchParams(form).toString(),
  });
}

export async function brandText(brand: BrandId, url: string): Promise<string> {
  // Shopify content-negotiates: an Accept that prefers JSON returns the product JSON, not the page.
  return (await brandFetch(brand, url, { headers: { Accept: "text/html" } })).text();
}
