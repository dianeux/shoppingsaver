import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// No politeness delay or backoff in tests.
beforeAll(() => {
  process.env.CRAWL_MIN_GAP_MS = "0";
  process.env.CRAWL_RETRY_BASE_MS = "1";
});
afterEach(() => vi.unstubAllGlobals());

const dnsError = () => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }) });
const ok = (body: string, url: string) => Object.defineProperty(new Response(body, { status: 200 }), "url", { value: url });

describe("brandFetch network resilience", () => {
  it("classifies transient network errors", async () => {
    const { isTransientNetworkError } = await import("./fetcher");
    expect(isTransientNetworkError(dnsError())).toBe(true);
    expect(isTransientNetworkError(Object.assign(new Error("t"), { name: "TimeoutError" }))).toBe(true);
    expect(isTransientNetworkError(new Error("boom"))).toBe(false);
  });

  it("retries a DNS blip and doesn't cache a failed robots.txt", async () => {
    const { brandText } = await import("./fetcher");
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls++;
      if (calls <= 2) throw dnsError(); // robots.txt fails twice, then recovers
      return ok(url.endsWith("robots.txt") ? "User-agent: *\nAllow: /" : "hello", url);
    }));
    await expect(brandText("muji", "https://www.muji.us/products/x")).resolves.toBe("hello");
    expect(calls).toBe(4); // robots ×3 (2 failures + success) + page
  });

  it("gives up after the retry budget", async () => {
    const { brandText } = await import("./fetcher");
    vi.stubGlobal("fetch", vi.fn(async () => { throw dnsError(); }));
    await expect(brandText("pact", "https://wearpact.com/women")).rejects.toThrow("fetch failed");
  });
});
