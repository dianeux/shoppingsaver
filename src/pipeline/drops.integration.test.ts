import "dotenv/config";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs the weekly-drop rules against the real database, simulating nightly runs
 * on past dates. Opt-in: RUN_DB_TESTS=1 npm test. Cleans up after itself.
 */
const enabled = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!enabled)("detectPriceDrops (database)", async () => {
  const { db, pool } = await import("@/db/client");
  const { priceDrops, priceSnapshots, products } = await import("@/db/schema");
  const { detectPriceDrops } = await import("./drops");

  const day = (offset: number) => new Date(Date.UTC(2020, 0, 1 + offset)).toISOString().slice(0, 10);
  let ids: string[] = [];
  let original: Map<string, number>;

  /** One simulated nightly run: set today's prices, snapshot them, detect. */
  async function night(offset: number, prices: Record<string, number>) {
    for (const [id, price] of Object.entries(prices)) {
      await db.update(products).set({ salePrice: price }).where(eq(products.id, id));
      await db.insert(priceSnapshots).values({ productId: id, snapshotDate: day(offset), listPrice: price, salePrice: price });
    }
    await detectPriceDrops(day(offset));
    const rows = await db.select().from(priceDrops).where(inArray(priceDrops.productId, ids));
    return new Map(rows.map((r) => [r.productId, r]));
  }

  beforeAll(async () => {
    const rows = await db.select({ id: products.id, sale: products.salePrice }).from(products).where(eq(products.active, true)).limit(2);
    ids = rows.map((r) => r.id);
    original = new Map(rows.map((r) => [r.id, r.sale]));
  });

  afterAll(async () => {
    await db.delete(priceSnapshots).where(sql`${priceSnapshots.productId} IN ${ids} AND ${priceSnapshots.snapshotDate} < '2021-01-01'`);
    await db.delete(priceDrops).where(inArray(priceDrops.productId, ids));
    for (const [id, sale] of original) await db.update(products).set({ salePrice: sale }).where(eq(products.id, id));
    await pool.end();
  });

  it("follows the enter / restart / rebound / 7-day rules", async () => {
    const [a, b] = ids;
    // Day 0: A $42, B $50.
    let d = await night(0, { [a]: 42, [b]: 50 });
    expect(d.size).toBe(0);

    // Day 1: both cheaper than yesterday → listed, day-0 price recorded.
    d = await night(1, { [a]: 35, [b]: 40 });
    expect(d.get(a)).toMatchObject({ baselinePrice: 42, currentPrice: 35, detectedOn: day(1) });
    expect(d.get(b)).toMatchObject({ baselinePrice: 50, currentPrice: 40 });

    // Day 2: B climbs back to its day-0 price → removed immediately. A unchanged → stays.
    d = await night(2, { [a]: 35, [b]: 50 });
    expect(d.has(b)).toBe(false);
    expect(d.get(a)?.detectedOn).toBe(day(1));

    // Day 3: A drops again → window restarts, day-0 price kept, total drop shown.
    d = await night(3, { [a]: 28, [b]: 50 });
    expect(d.get(a)).toMatchObject({ baselinePrice: 42, currentPrice: 28, detectedOn: day(3) });
    expect(d.get(a)!.dropPct).toBeCloseTo(1 / 3, 5);

    // Day 4: A rises a bit but is still below day 0 → stays.
    d = await night(4, { [a]: 30, [b]: 50 });
    expect(d.get(a)).toMatchObject({ currentPrice: 30, detectedOn: day(3) });

    // Day 9 = 7th day counting the day-3 drop as day 1 → still listed.
    for (const n of [5, 6, 7, 8]) await night(n, { [a]: 30, [b]: 50 });
    d = await night(9, { [a]: 30, [b]: 50 });
    expect(d.has(a)).toBe(true);

    // Day 10: window over → removed even though still cheaper than day 0.
    d = await night(10, { [a]: 30, [b]: 50 });
    expect(d.has(a)).toBe(false);
  });
});
