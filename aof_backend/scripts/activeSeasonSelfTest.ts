import { strict as assert } from 'assert';
import { activeSeasonId, seasonWindow } from '../src/lib/activeSeason';

for (const raw of [undefined, '', '-1', '1.0', '01', 'nan', '4294967296', '1e2', ' 1 ']) {
  assert.equal(activeSeasonId(raw), null, `fail closed on ${raw}`);
}
assert.equal(activeSeasonId('0'), 0);
assert.equal(activeSeasonId('2'), 2);
assert.equal(activeSeasonId('4294967295'), 4294967295);
const start = 1_700_000_000;
assert.deepEqual(seasonWindow(2, start, 2, start), { startTime: start, endTime: start + 42 * 86_400 });
assert.equal(seasonWindow(2, start, 2, start + 42 * 86_400), null);
assert.equal(seasonWindow(2, start, 2, start - 1), null);
assert.equal(seasonWindow(1, start, 2, start), null);
assert.equal(seasonWindow(2, 0, 2, start), null);
console.log('Active season pointer: strict u32 and 42-day on-chain clock checks passed');
