// Proposed devnet MIND terms, in integer atomic units. This is a quote and
// test oracle, NOT authorisation to accept payments: the legacy drum uses raw
// atoms; isolated V2 reserves are coded but paid commits remain hard-disabled.
export const MIND_DECIMALS = 9;
export const MIND_UNIT = 10n ** BigInt(MIND_DECIMALS);
export const MIND_SPIN_PRICE = 5n * MIND_UNIT;
export const MIND_PRIZES = [
  { weightBps: 6000, atoms: 2n * MIND_UNIT },
  { weightBps: 2500, atoms: 5n * MIND_UNIT },
  { weightBps: 1000, atoms: 10n * MIND_UNIT },
  { weightBps: 400, atoms: 20n * MIND_UNIT },
  { weightBps: 100, atoms: 50n * MIND_UNIT },
] as const;
export const MIND_MAX_PRIZE = 50n * MIND_UNIT;

/** New spins must not use *any* inventory already promised to open spins.
 * This backend check is informational only; the transaction must enforce the
 * same inequality against chain-owned custody atomically (not by RPC reads).
 */
export function canReserveMindSpin(balance: bigint, reserved: bigint): boolean {
  return balance >= 0n && reserved >= 0n && reserved <= balance &&
    balance - reserved >= MIND_MAX_PRIZE;
}

/** A settlement/refund must atomically free one spin's maximum obligation and
 * pay no more than the maximum; a refund of 5 units is included. */
export function releaseMindReserve(reserved: bigint, payout: bigint): bigint | null {
  if (reserved < MIND_MAX_PRIZE || payout < 0n || payout > MIND_MAX_PRIZE) return null;
  return reserved - MIND_MAX_PRIZE;
}

export function formatMindAtoms(atoms: bigint): string {
  if (atoms < 0n) throw new RangeError('negative MIND amount');
  const fraction = (atoms % MIND_UNIT).toString().padStart(MIND_DECIMALS, '0').replace(/0+$/, '');
  return `${atoms / MIND_UNIT}${fraction ? '.' + fraction : ''}`;
}
