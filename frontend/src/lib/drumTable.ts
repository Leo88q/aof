/**
 * Historical raw-atomic-unit quest drum table, NOT an enabled MIND offer.
 * Kept for source-to-program regression tests and old-spin settlement only.
 * Do not show these values as whole external MIND without verified decimals.
 */
export const DRUM_SPIN_COST = 5;

export const DRUM_PRIZES: ReadonlyArray<{ readonly weightBps: number; readonly amount: number }> = [
  { weightBps: 6000, amount: 2 },
  { weightBps: 2500, amount: 5 },
  { weightBps: 1000, amount: 10 },
  { weightBps: 400, amount: 20 },
  { weightBps: 100, amount: 50 },
];

/** Historical expected payout: 4.75 raw atomic units, not whole MIND. */
export const DRUM_EXPECTED_PRIZE = DRUM_PRIZES.reduce((sum, p) => sum + (p.weightBps * p.amount) / 10_000, 0);
