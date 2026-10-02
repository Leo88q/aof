import { strict as assert } from 'assert';
import { canReserveMindSpin, formatMindAtoms, MIND_DECIMALS, MIND_MAX_PRIZE, MIND_PRIZES, MIND_SPIN_PRICE, MIND_UNIT, releaseMindReserve } from '../src/lib/mindEconomics';

assert.equal(MIND_DECIMALS, 9);
assert.equal(MIND_SPIN_PRICE, 5_000_000_000n);
assert.equal(MIND_MAX_PRIZE, 50_000_000_000n);
assert.equal(MIND_PRIZES.reduce((sum, tier) => sum + tier.weightBps, 0), 10_000);
const expected = MIND_PRIZES.reduce((sum, tier) => sum + BigInt(tier.weightBps) * tier.atoms, 0n);
assert.equal(expected / 10_000n, 4_750_000_000n); // 95% payout before costs
assert.ok(expected < MIND_SPIN_PRICE * 10_000n);
assert.equal(formatMindAtoms(MIND_SPIN_PRICE), '5');
assert.equal(formatMindAtoms(1n), '0.000000001');
assert.equal(formatMindAtoms(12n * MIND_UNIT + 5n), '12.000000005');
assert.throws(() => formatMindAtoms(-1n));
assert.equal(canReserveMindSpin(49n * MIND_UNIT, 0n), false);
assert.equal(canReserveMindSpin(100n * MIND_UNIT, 50n * MIND_UNIT), true);
assert.equal(canReserveMindSpin(100n * MIND_UNIT, 51n * MIND_UNIT), false);
assert.equal(canReserveMindSpin(100n * MIND_UNIT, 101n * MIND_UNIT), false);
assert.equal(canReserveMindSpin(100n * MIND_UNIT, -1n), false);
assert.equal(releaseMindReserve(100n * MIND_UNIT, 50n * MIND_UNIT), 50n * MIND_UNIT);
assert.equal(releaseMindReserve(50n * MIND_UNIT, MIND_SPIN_PRICE), 0n);
assert.equal(releaseMindReserve(49n * MIND_UNIT, MIND_SPIN_PRICE), null);
assert.equal(releaseMindReserve(50n * MIND_UNIT, 51n * MIND_UNIT), null);
console.log('MIND units, odds and concurrent reserve arithmetic passed; on-chain enforcement is still required');
