import { getExpiredCommits } from "./secretStore";

/**
 * Reports expired commits for operational handling. A generic worker cannot
 * safely submit a reveal because each commit type requires different PDAs,
 * accounts, and (for user flows) the original wallet. Marking the record as
 * revealed here would be false and would hide an unrecoverable game state.
 */
export async function runCommitRevealer(): Promise<void> {
  try {
    const expired = await getExpiredCommits(50);
    if (expired.length === 0) return;

    console.error(
      `[CommitRevealer] ${expired.length} expired commits require a typed on-chain reveal/refund worker`
    );
    for (const record of expired) {
      console.error(`[CommitRevealer] unresolved commit: ${record.key}`);
    }
  } catch (e) {
    console.error("[CommitRevealer] Error:", e);
  }
}

export function startCommitRevealer(intervalMs: number = 60_000): NodeJS.Timeout {
  console.log(`✅ [CommitRevealer] Started (every ${intervalMs / 1000}s)`);
  return setInterval(runCommitRevealer, intervalMs);
}
