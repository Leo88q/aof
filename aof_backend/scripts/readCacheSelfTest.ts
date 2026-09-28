/**
 * Offline self-test of src/lib/readCache.ts — the TTL + single-flight cache in
 * front of the `/query/*` chain reads. Pure module: no Prisma, no RPC, no env.
 */
import assert from "node:assert/strict";
import { ReadCache, envNonNegativeInt } from "../src/lib/readCache";

(async () => {
  // ---- single-flight: N concurrent identical reads = one upstream call, all get the same value
  {
    let clock = 1_000;
    const cache = new ReadCache<number>(0, 10, () => clock);
    let loads = 0;
    let release!: (v: number) => void;
    const gate = new Promise<number>((r) => { release = r; });
    const loader = () => { loads++; return gate; };
    const waiters = [cache.get("a", loader), cache.get("a", loader), cache.get("a", loader)];
    assert.equal(loads, 1, "only the first caller loads");
    assert.equal(cache.stats().inflight, 1);
    release(42);
    assert.deepEqual(await Promise.all(waiters), [42, 42, 42]);
    assert.deepEqual(cache.stats(), { hits: 0, misses: 1, coalesced: 2, evictions: 0, size: 0, inflight: 0 }, "ttl 0 stores nothing");
    // With ttl 0 a later read loads again (no staleness at all).
    assert.equal(await cache.get("a", async () => { loads++; return 7; }), 7);
    assert.equal(loads, 2);
  }

  // ---- TTL: fresh values are reused, expired ones reloaded exactly at the boundary
  {
    let clock = 10_000;
    const cache = new ReadCache<string>(2_000, 10, () => clock);
    let loads = 0;
    const loader = () => { loads++; return Promise.resolve(`v${loads}`); };
    assert.equal(await cache.get("cfg", loader), "v1");
    clock += 1_999;
    assert.equal(await cache.get("cfg", loader), "v1", "still fresh 1 ms before expiry");
    clock += 1;
    assert.equal(await cache.get("cfg", loader), "v2", "expired exactly at ttl");
    assert.equal(loads, 2);
    assert.deepEqual(cache.stats(), { hits: 1, misses: 2, coalesced: 0, evictions: 0, size: 1, inflight: 0 });
    // Distinct keys never collide.
    assert.equal(await cache.get("other", async () => "x"), "x");
    assert.equal(await cache.get("cfg", loader), "v2");
    // null (missing account) is a cached value, not an error.
    const nulls = new ReadCache<null | string>(1_000, 10, () => clock);
    let nullLoads = 0;
    const nullLoader = async () => { nullLoads++; return null; };
    assert.equal(await nulls.get("missing", nullLoader), null);
    assert.equal(await nulls.get("missing", nullLoader), null);
    assert.equal(nullLoads, 1, "negative results are cached for one TTL");
  }

  // ---- errors: every waiter of the failed flight rejects, nothing is stored, the next read retries
  {
    let clock = 0;
    const cache = new ReadCache<number>(5_000, 10, () => clock);
    let loads = 0;
    const failing = () => { loads++; return Promise.reject(new Error("rpc down")); };
    const results = await Promise.allSettled([cache.get("k", failing), cache.get("k", failing)]);
    assert.deepEqual(results.map((r) => r.status), ["rejected", "rejected"]);
    assert.equal(loads, 1);
    assert.equal(cache.stats().size, 0, "a failure is never cached");
    assert.equal(cache.stats().inflight, 0, "the failed flight is cleared");
    assert.equal(await cache.get("k", async () => 5), 5, "retry after failure loads again");
  }

  // ---- bounded: oldest writes are evicted past maxEntries; re-writing a key refreshes its position
  {
    let clock = 0;
    const cache = new ReadCache<number>(60_000, 3, () => clock);
    for (const key of ["a", "b", "c"]) await cache.get(key, async () => 1);
    await cache.get("a", async () => 99); // hit, position unchanged
    await cache.get("d", async () => 4); // evicts a (oldest write)
    assert.equal(cache.stats().size, 3);
    assert.equal(cache.stats().evictions, 1);
    let reloaded = 0;
    assert.equal(await cache.get("a", async () => { reloaded++; return 2; }), 2);
    assert.equal(reloaded, 1, "evicted key reloads");
    assert.equal(await cache.get("b", async () => { reloaded++; return 3; }), 3, "b was evicted by a's re-insert");
    assert.equal(cache.stats().size, 3);
  }

  // ---- invalidate: one key or everything
  {
    const cache = new ReadCache<number>(60_000, 10, () => 0);
    await cache.get("a", async () => 1);
    await cache.get("b", async () => 2);
    cache.invalidate("a");
    assert.equal(cache.stats().size, 1);
    assert.equal(await cache.get("a", async () => 10), 10);
    cache.invalidate();
    assert.equal(cache.stats().size, 0);
    assert.equal(await cache.get("b", async () => 20), 20);
  }

  // ---- construction and env parsing fail loud
  {
    assert.throws(() => new ReadCache(-1), /ttlMs/);
    assert.throws(() => new ReadCache(NaN), /ttlMs/);
    assert.throws(() => new ReadCache(1, 0), /maxEntries/);
    assert.throws(() => new ReadCache(1, 2.5), /maxEntries/);
    assert.equal(envNonNegativeInt("QUERY_CACHE_TTL_MS", 0, {}), 0);
    assert.equal(envNonNegativeInt("QUERY_CACHE_TTL_MS", 0, { QUERY_CACHE_TTL_MS: "" }), 0);
    assert.equal(envNonNegativeInt("QUERY_CACHE_TTL_MS", 0, { QUERY_CACHE_TTL_MS: "2500" }), 2500);
    assert.equal(envNonNegativeInt("QUERY_CACHE_TTL_MS", 7, { QUERY_CACHE_TTL_MS: "0" }), 0);
    for (const bad of ["-1", "1.5", "abc", "1e3"]) assert.throws(() => envNonNegativeInt("X", 0, { X: bad }), /non-negative integer/);
  }

  console.log("read cache self-test: single-flight, ttl boundary, negative caching, error propagation, eviction, invalidate, env parsing passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
