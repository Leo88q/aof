// Operator-selected season is a pointer, never an entitlement. Each read must
// separately verify the referenced Season PDA and its 42-day on-chain clock.
export function activeSeasonId(raw: string | undefined): number | null {
  if (!raw || !/^(0|[1-9][0-9]{0,9})$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 0 && n <= 0xffff_ffff ? n : null;
}

export function seasonWindow(rawId: unknown, rawStart: unknown, expectedId: number, now: number): { startTime: number; endTime: number } | null {
  const id = Number(rawId);
  const startTime = Number(rawStart);
  if (id !== expectedId || !Number.isSafeInteger(startTime) || startTime <= 0 ||
      !Number.isSafeInteger(now) || now < startTime) return null;
  const endTime = startTime + 42 * 86_400;
  if (!Number.isSafeInteger(endTime) || now >= endTime) return null;
  return { startTime, endTime };
}
