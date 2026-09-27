/**
 * [F-06] Drum of Luck prize table shown to players. Mirrors DRUM_PRIZES and
 * DRUM_SPIN_COST_MASCOT in programs/aof-quests/src/instructions/drum/*.rs;
 * tests/readiness/rng-economy.test.cjs fails if the two ever differ, so the
 * odds on screen are always the odds the program pays.
 */
export const DRUM_SPIN_COST = 5;

export const DRUM_PRIZES: ReadonlyArray<{ readonly weightBps: number; readonly amount: number }> = [
  { weightBps: 6000, amount: 2 },
  { weightBps: 2500, amount: 5 },
  { weightBps: 1000, amount: 10 },
  { weightBps: 400, amount: 20 },
  { weightBps: 100, amount: 50 },
];

/** Expected prize per spin in mascots (4.75 → 95% return to player). */
export const DRUM_EXPECTED_PRIZE = DRUM_PRIZES.reduce((sum, p) => sum + (p.weightBps * p.amount) / 10_000, 0);
