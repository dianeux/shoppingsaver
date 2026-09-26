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
    p = rawFetch(`${origin}/robots.txt`).then(async (r) => (r.ok ? parseRobots(await r.text()) : { allow: [], disallow: [] }));
    robotsCache.set(origin, p);
  }
  return p;
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
    const res = await rawFetch(url, init);
    // A redirect off the official host would bypass the whitelist.
    assertOfficial(brand, res.url || url);
    if (res.ok) return res;
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || attempt >= MAX_RETRIES) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
  }
}

export async function brandJson<T>(brand: BrandId, url: string): Promise<T> {
  return (await brandFetch(brand, url, { headers: { Accept: "application/json" } })).json() as Promise<T>;
}

export async function brandText(brand: BrandId, url: string): Promise<string> {
  // Shopify content-negotiates: an Accept that prefers JSON returns the product JSON, not the page.
  return (await brandFetch(brand, url, { headers: { Accept: "text/html" } })).text();
}
