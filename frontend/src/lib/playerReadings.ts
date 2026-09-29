export interface PlayerSnapshot {
  owner: string;
  hasTent: boolean;
  villagers: number;
  villagersAvailable: number;
  historianCount: number;
  medallionCount: number;
}

/** The fields on the canonical Player PDA in aof-core/src/state.rs.
 * Legacy "daysPlayed", "rebirthCount" and "questsCompleted" are NOT
 * members of Player and must never be inferred from absent fields. */
export function readPlayerSnapshot(raw: unknown, owner: string): PlayerSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const count = (key: string, max: number) =>
    typeof row[key] === 'number' && Number.isSafeInteger(row[key]) && (row[key] as number) >= 0 && (row[key] as number) <= max;
  if (row.owner !== owner || typeof row.hasTent !== 'boolean' ||
      !count('villagers', 0xffffffff) || !count('villagersAvailable', 0xffffffff) ||
      !count('historianCount', 255) || !count('medallionCount', 255) ||
      (row.villagersAvailable as number) > (row.villagers as number)) return null;
  return {
    owner, hasTent: row.hasTent,
    villagers: row.villagers as number,
    villagersAvailable: row.villagersAvailable as number,
    historianCount: row.historianCount as number,
    medallionCount: row.medallionCount as number,
  };
}
