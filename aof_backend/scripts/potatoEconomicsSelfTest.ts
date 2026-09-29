import { strict as assert } from 'assert';
import { canReservePotatoSpin, formatPotatoAtoms, POTATO_DECIMALS, POTATO_MAX_PRIZE, POTATO_PRIZES, POTATO_SPIN_PRICE, POTATO_UNIT, releasePotatoReserve } from '../src/lib/potatoEconomics';

assert.equal(POTATO_DECIMALS, 9);
assert.equal(POTATO_SPIN_PRICE, 5_000_000_000n);
assert.equal(POTATO_MAX_PRIZE, 50_000_000_000n);
assert.equal(POTATO_PRIZES.reduce((sum, tier) => sum + tier.weightBps, 0), 10_000);
const expected = POTATO_PRIZES.reduce((sum, tier) => sum + BigInt(tier.weightBps) * tier.atoms, 0n);
assert.equal(expected / 10_000n, 4_750_000_000n); // 95% payout before costs
assert.ok(expected < POTATO_SPIN_PRICE * 10_000n);
assert.equal(formatPotatoAtoms(POTATO_SPIN_PRICE), '5');
assert.equal(formatPotatoAtoms(1n), '0.000000001');
assert.equal(formatPotatoAtoms(12n * POTATO_UNIT + 5n), '12.000000005');
assert.throws(() => formatPotatoAtoms(-1n));
assert.equal(canReservePotatoSpin(49n * POTATO_UNIT, 0n), false);
assert.equal(canReservePotatoSpin(100n * POTATO_UNIT, 50n * POTATO_UNIT), true);
assert.equal(canReservePotatoSpin(100n * POTATO_UNIT, 51n * POTATO_UNIT), false);
assert.equal(canReservePotatoSpin(100n * POTATO_UNIT, 101n * POTATO_UNIT), false);
assert.equal(canReservePotatoSpin(100n * POTATO_UNIT, -1n), false);
assert.equal(releasePotatoReserve(100n * POTATO_UNIT, 50n * POTATO_UNIT), 50n * POTATO_UNIT);
assert.equal(releasePotatoReserve(50n * POTATO_UNIT, POTATO_SPIN_PRICE), 0n);
assert.equal(releasePotatoReserve(49n * POTATO_UNIT, POTATO_SPIN_PRICE), null);
assert.equal(releasePotatoReserve(50n * POTATO_UNIT, 51n * POTATO_UNIT), null);
console.log('Potato units, odds and concurrent reserve arithmetic passed; on-chain enforcement is still required');
