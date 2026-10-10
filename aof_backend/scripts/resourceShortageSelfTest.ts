import { strict as assert } from "assert";
import {
  REPAIR_CIRCUIT,
  REPAIR_SILICON,
  RESOURCE_UNIT,
  SIGNAL_BATCH,
  compareTokenBalances,
  formatMicros,
  formatRawUnits,
  regeneratedEnergy,
} from "../src/lib/resourceShortageCore";

assert.equal(formatRawUnits(6n * RESOURCE_UNIT), "6");
assert.equal(formatRawUnits(RESOURCE_UNIT / 2n), "0.5");
assert.equal(formatMicros(60_000n), "0.06");
assert.equal(regeneratedEnergy(1, 20, 100, 100 + 30 * 60), 2);
assert.equal(regeneratedEnergy(20, 20, 100, 1_000), 20);

const short = compareTokenBalances(
  { SYNAPSE: 1n * RESOURCE_UNIT, SILICON: 1n * RESOURCE_UNIT },
  [{ resource: "SYNAPSE", need: 6n * RESOURCE_UNIT }, { resource: "SILICON", need: 1n * RESOURCE_UNIT }],
);
assert.deepEqual(short, [{ resource: "SYNAPSE", have: "1", need: "6" }]);
assert.equal(compareTokenBalances({}, [{ resource: "SYNAPSE", need: 1n }]), null);
assert.equal(SIGNAL_BATCH[0].synapse, 6n);
assert.equal(REPAIR_SILICON.uncommon, 2n * RESOURCE_UNIT + RESOURCE_UNIT / 2n);
assert.equal(REPAIR_CIRCUIT.legendary, 5n * RESOURCE_UNIT);
console.log("resourceShortageSelfTest ok");
