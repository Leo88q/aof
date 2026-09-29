import { program } from "../provider";
import { configPda } from "./pda";

/**
 * [AUDIT F-27] Source of truth for the mining kill-switch is the on-chain
 * `Config.mining_enabled` flag, not a process environment variable. The old
 * check (`MINING_ENABLED = !isProduction && env === "true"`) only gated the
 * HTTP routes: anyone who built the transaction themselves — or used a
 * different backend instance with a different `.env` — mined anyway.
 *
 * The value is cached briefly because `start-mining`/`collect-mining` are hot
 * paths and `Config` is a singleton PDA.
 */
const CACHE_TTL_MS = 10_000;
let cache: { at: number; enabled: boolean } | null = null;
let pending: Promise<boolean> | null = null;
let epoch = 0;

export async function miningEnabledOnChain(): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.enabled;
  if (pending) return pending;

  const requestedAtEpoch = epoch;
  const request = (async () => {
    try {
      const [config] = configPda();
      const cfg: any = await (program.account as any)["config"].fetch(config);
      // Invalid or missing data, including the string "true", must not enable
      // wallet-signed transactions when the program state is unreadable.
      const enabled = cfg?.miningEnabled === true;
      if (epoch !== requestedAtEpoch) return false; // admin toggled during fetch
      cache = { at: Date.now(), enabled };
      return enabled;
    } catch {
      // Express 4 does not catch rejected async handlers. Fail closed instead
      // of throwing outside the mining routes' try/catch blocks.
      if (epoch === requestedAtEpoch) cache = { at: Date.now(), enabled: false };
      return false;
    }
  })();
  pending = request;
  try {
    return await request;
  } finally {
    if (pending === request) pending = null;
  }
}

/** Drop the cached flag, e.g. right after an admin toggles it. */
export function invalidateMiningFlag(): void {
  ++epoch;
  cache = null;
  pending = null;
}
