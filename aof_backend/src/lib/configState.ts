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

export async function miningEnabledOnChain(): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.enabled;

  const [config] = configPda();
  const cfg: any = await (program.account as any)["config"].fetch(config);
  const enabled = Boolean(cfg?.miningEnabled);
  cache = { at: now, enabled };
  return enabled;
}

/** Drop the cached flag, e.g. right after an admin toggles it. */
export function invalidateMiningFlag(): void {
  cache = null;
}
