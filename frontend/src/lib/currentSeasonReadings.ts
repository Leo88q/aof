// Operator selects the season ID; the backend must prove an active Season PDA.
// This response is only a pointer, NEVER an entitlement or payment approval.
export type ActiveSeason = { seasonId: number; startTime: number; endTime: number };
export function readActiveSeason(raw: unknown, now: number = Math.floor(Date.now() / 1000)): ActiveSeason | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const { seasonId, startTime, endTime } = value;
  if (value.source !== 'onchain' || typeof seasonId !== 'number' || !Number.isInteger(seasonId) ||
      seasonId < 0 || seasonId > 0xffffffff || typeof startTime !== 'number' || !Number.isSafeInteger(startTime) ||
      startTime <= 0 || typeof endTime !== 'number' || !Number.isSafeInteger(endTime) ||
      endTime !== startTime + 42 * 86_400 || !Number.isSafeInteger(now) ||
      now < startTime || now >= endTime) return null;
  return { seasonId, startTime, endTime };
}
