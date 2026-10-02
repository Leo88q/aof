import { strict as assert } from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Keypair, PublicKey } from '@solana/web3.js';
import { TOOL_RESOURCE_MINT, miningRewardMint } from '../src/lib/toolResourceMint';

const mint = () => Keypair.generate().publicKey;
const circuit = mint(), silicon = mint(), dataset = mint(), neuron = mint();
const config = { circuitMint: circuit, siliconMint: silicon, dataMint: mint() };
const materials = { dataset: dataset, neuron: neuron, signal: mint() };
const expected: Record<string, PublicKey> = {
  plasma_cutter: circuit, silicon_extractor: silicon,
  data_harvester: dataset, quantum_transmitter: dataset, neural_seeder: neuron,
};
assert.deepEqual(Object.keys(TOOL_RESOURCE_MINT).sort(), Object.keys(expected).sort());
for (const [tool, reward] of Object.entries(expected)) {
  assert.ok(miningRewardMint(tool, config, materials)?.equals(reward), tool);
  assert.ok(miningRewardMint(tool.toUpperCase(), config, materials)?.equals(reward), tool + ' uppercase');
}
for (const old of ['axe', 'pick', 'spear', 'bow', 'reaper', 'sword', '', null]) {
  assert.equal(miningRewardMint(old, config, materials), null);
}
assert.equal(miningRewardMint('plasma_cutter', null, materials), null);
assert.equal(miningRewardMint('neural_seeder', config, null), null);
assert.equal(miningRewardMint('plasma_cutter', { ...config, circuitMint: PublicKey.default }, materials), null);
assert.equal(miningRewardMint('neural_seeder', config, { ...materials, neuron: 'not a public key' }), null);

// Match the Rust program's five tool-to-kind arms and registry fields.
const collect = readFileSync(join(__dirname, '../../aof-core/src/instructions/collect_mining.rs'), 'utf8');
const state = readFileSync(join(__dirname, '../../aof-core/src/state.rs'), 'utf8');
for (const tool of Object.keys(expected)) assert.ok(collect.includes(`"${tool}"`), tool);
for (const [kind, field] of [['Circuit', 'circuit_mint'], ['Silicon', 'silicon_mint'], ['Dataset', 'dataset'], ['Neuron', 'neuron']]) {
  assert.match(state, new RegExp(`ResourceKind::${kind}\\s*=>\\s*(?:config|material_mints)\\.${field}`));
}
console.log('Canonical mining payout mints: 5/5; historical/invalid/zero mints rejected.');
