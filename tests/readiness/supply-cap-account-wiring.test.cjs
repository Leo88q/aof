'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const rust = fs.readFileSync(path.join(root, 'aof-core/src/lib.rs'), 'utf8');
const idl = JSON.parse(fs.readFileSync(path.join(root, 'aof_backend/src/idl/aof_core.json'), 'utf8'));

const cappedMintPaths = [
  { context: 'HarvestSynapse', handler: 'harvest_synapse.rs', instruction: 'harvest_synapse', field: 'issuance_cap_synapse' },
  { context: 'CollectSignal', handler: 'collect_signal.rs', instruction: 'collect_signal', field: 'issuance_cap_signal' },
  { context: 'CollectModel', handler: 'collect_model.rs', instruction: 'collect_model', field: 'issuance_cap_model' },
  { context: 'CollectPower', handler: 'collect_power.rs', instruction: 'collect_power', field: 'issuance_cap_power' },
  { context: 'ClaimSeasonReward', handler: 'season.rs', instruction: 'claim_season_reward', field: 'issuance_cap_circuit' },
  { context: 'ClaimPremiumSeasonReward', handler: 'season.rs', instruction: 'claim_premium_season_reward', field: 'issuance_cap_circuit' },
];

test('mint handlers, Anchor contexts, and IDL use the same issuance-cap account names', () => {
  for (const pathInfo of cappedMintPaths) {
    const start = rust.indexOf(`pub struct ${pathInfo.context}<`);
    assert.notEqual(start, -1, `${pathInfo.context}: Anchor account context missing`);
    const end = rust.indexOf('\n}', start);
    assert.notEqual(end, -1, `${pathInfo.context}: context block is unterminated`);
    const context = rust.slice(start, end);
    assert.match(context, new RegExp(`pub ${pathInfo.field}: Box<Account<'info, IssuanceCap>>`),
      `${pathInfo.context}: cap field ${pathInfo.field} missing`);

    const handler = fs.readFileSync(path.join(root, 'aof-core/src/instructions', pathInfo.handler), 'utf8');
    assert.match(handler, new RegExp(`ctx\\.accounts\\.${pathInfo.field}\\b`),
      `${pathInfo.instruction}: handler does not use ${pathInfo.field}`);

    const instruction = idl.instructions.find((ix) => ix.name === pathInfo.instruction);
    assert.ok(instruction, `${pathInfo.instruction}: IDL instruction missing`);
    assert.ok(instruction.accounts.some((account) => account.name === pathInfo.field),
      `${pathInfo.instruction}: IDL account ${pathInfo.field} missing`);
  }
});
