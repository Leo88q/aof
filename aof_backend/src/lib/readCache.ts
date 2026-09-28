/**
 * Small TTL + single-flight cache for chain reads.
 *
 * Why (capacity review 2026-09-28): every `/query/*` request was one Solana
 * RPC call (`getAccountInfo`, and `getProgramAccounts` for lists) with no
 * reuse, so the RPC quota — not the backend — set the player ceiling, and any
 * anonymous client could spend that quota on our behalf (amplification). This
 * cache does two things:
 *
 *   1. single-flight: concurrent identical reads share ONE upstream call, even
 *      with ttlMs = 0. A hundred players polling `/query/config` in the same
 *      50 ms window cost one RPC request;
 *   2. TTL: with ttlMs > 0 a fresh value is reused for that long. The farm
 *      panels poll every 5 s, so 2 000 ms is invisible to players and cuts the
 *      RPC traffic of a busy screen by more than half.
 *
 * Errors are never cached (every waiter of the failed flight gets the error);
 * `null` results are (a missing account stays missing for one TTL). Time is
 * injectable for tests. Bounded: the oldest entries are evicted past
 * `maxEntries`, so a scan over random addresses cannot grow memory forever.
 */
export type ReadCacheStats = { hits: number; misses: number; coalesced: number; evictions: number; size: number; inflight: number };

export class ReadCache<T = unknown> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();
  private readonly inflight = new Map<string, Promise<T>>();
  private hits = 0;
  private misses = 0;
  private coalesced = 0;
  private evictions = 0;

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 5_000,
    private readonly now: () => number = () => Date.now(),
  ) {
    if (!Number.isFinite(ttlMs) || ttlMs < 0) throw new Error("ReadCache: ttlMs must be >= 0");
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("ReadCache: maxEntries must be a positive integer");
  }

  /** Value for `key`: cached if fresh, otherwise loaded once for all concurrent callers. */
  async get(key: string, loader: () => Promise<T>): Promise<T> {
    if (this.ttlMs > 0) {
      const hit = this.entries.get(key);
      if (hit) {
        if (hit.expiresAt > this.now()) {
          this.hits++;
          return hit.value;
        }
        this.entries.delete(key);
      }
    }
    const pending = this.inflight.get(key);
    if (pending) {
      this.coalesced++;
      return pending;
    }
    this.misses++;
    const flight = (async () => {
      try {
        const value = await loader();
        if (this.ttlMs > 0) this.store(key, value);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, flight);
    return flight;
  }

  /** Drop one key (after a write the caller knows about) or everything. */
  invalidate(key?: string): void {
    if (key === undefined) this.entries.clear();
    else this.entries.delete(key);
  }

  stats(): ReadCacheStats {
    return { hits: this.hits, misses: this.misses, coalesced: this.coalesced, evictions: this.evictions, size: this.entries.size, inflight: this.inflight.size };
  }

  private store(key: string, value: T): void {
    this.entries.delete(key); // re-insert so insertion order == recency of write
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
      this.evictions++;
    }
  }
}

/** Positive integer from env, `fallback` when unset/empty, throws on garbage (fail loud at boot). */
export function envNonNegativeInt(name: string, fallback: number, env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  if (!/^\d{1,12}$/.test(raw.trim())) throw new Error(`${name} must be a non-negative integer (got ${JSON.stringify(raw)})`);
  return Number(raw.trim());
}
