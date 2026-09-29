// Proposed devnet Potato terms, in integer atomic units. This is a quote and
// test oracle, NOT authorisation to accept payments: the legacy drum uses raw
// atoms; isolated V2 reserves are coded but paid commits remain hard-disabled.
export const POTATO_DECIMALS = 9;
export const POTATO_UNIT = 10n ** BigInt(POTATO_DECIMALS);
export const POTATO_SPIN_PRICE = 5n * POTATO_UNIT;
export const POTATO_PRIZES = [
  { weightBps: 6000, atoms: 2n * POTATO_UNIT },
  { weightBps: 2500, atoms: 5n * POTATO_UNIT },
  { weightBps: 1000, atoms: 10n * POTATO_UNIT },
  { weightBps: 400, atoms: 20n * POTATO_UNIT },
  { weightBps: 100, atoms: 50n * POTATO_UNIT },
] as const;
export const POTATO_MAX_PRIZE = 50n * POTATO_UNIT;

/** New spins must not use *any* inventory already promised to open spins.
 * This backend check is informational only; the transaction must enforce the
 * same inequality against chain-owned custody atomically (not by RPC reads).
 */
export function canReservePotatoSpin(balance: bigint, reserved: bigint): boolean {
  return balance >= 0n && reserved >= 0n && reserved <= balance &&
    balance - reserved >= POTATO_MAX_PRIZE;
}

/** A settlement/refund must atomically free one spin's maximum obligation and
 * pay no more than the maximum; a refund of 5 units is included. */
export function releasePotatoReserve(reserved: bigint, payout: bigint): bigint | null {
  if (reserved < POTATO_MAX_PRIZE || payout < 0n || payout > POTATO_MAX_PRIZE) return null;
  return reserved - POTATO_MAX_PRIZE;
}

export function formatPotatoAtoms(atoms: bigint): string {
  if (atoms < 0n) throw new RangeError('negative Potato amount');
  const fraction = (atoms % POTATO_UNIT).toString().padStart(POTATO_DECIMALS, '0').replace(/0+$/, '');
  return `${atoms / POTATO_UNIT}${fraction ? '.' + fraction : ''}`;
}
