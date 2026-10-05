'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('exploration ALT bootstrap is devnet-only, idempotent, active-read-back verified, and not frozen', () => {
  const source = read('aof_backend/scripts/initVrfAddressLookupTable.ts');
  assert.match(source, /getGenesisHash\(\)/);
  assert.match(source, /DEVNET_GENESIS_HASH/);
  assert.match(source, /AddressLookupTableProgram\.createLookupTable/);
  assert.match(source, /AddressLookupTableProgram\.extendLookupTable/);
  assert.match(source, /getAddressLookupTable\(address, "confirmed"\)/);
  assert.match(source, /waitUntilActive\(tableAddress\)/);
  assert.match(source, /const absent = desired\.filter/);
  assert.match(source, /persistTableAddress\(tableAddress\)/);
  assert.match(source, /sanitizeRpcError\(error\)/);
  assert.match(source, /poolRows\.flatMap/);
  assert.match(source, /rewardEscrowAddress/);
  assert.doesNotMatch(source, /deactivateLookupTable|freezeLookupTable/);
  assert.match(read('aof_backend/.env.example'), /VRF_ADDRESS_LOOKUP_TABLE=/);
  assert.match(read('aof_backend/package.json'), /"vrf:lut:init"/);
});

test('exploration commit, self-settlement and settler use atomic bounded v0 transactions', () => {
  const route = read('aof_backend/src/routes/exploration.ts');
  const settlement = read('aof_backend/src/lib/vrfSettlement.ts');
  const settler = read('aof_backend/services/vrf-settler/index.ts');
  const runtime = read('aof_backend/src/lib/vrfLookupTableTransactions.ts');
  assert.match(route, /coSignWithVrfLookupTable\(\[ix\], user\)/);
  assert.match(settlement, /mechanic === "exploration"[\s\S]*coSignWithVrfLookupTable\(ixs, player\)/);
  assert.match(settler, /c\.mechanic === "exploration"[\s\S]*sendSignedByWithVrfLookupTable/);
  assert.match(runtime, /compileToV0Message\(\[lookupTable\]\)/);
  assert.match(runtime, /simulateTransaction\(tx\)/);
  assert.match(runtime, /tx\.serialize\(\)\.length/);
  assert.match(runtime, /VRF_V0_PACKET_LIMIT_BYTES = 1_232/);
  assert.match(runtime, /VRF_V0_PACKET_HEADROOM_BYTES = 64/);
  assert.match(runtime, /sendConfirmedVersionedTransaction/);
  assert.match(runtime, /loadVrfAddressLookupTable/);
  assert.match(runtime, /parseDotenv\(readFileSync/);
});

test('wallet guard resolves every ALT before intent/policy checks and fails closed on inactive tables', () => {
  const guard = read('frontend/src/lib/txGuard.ts');
  assert.match(guard, /await collectInstructions\(tx, connection\)/);
  assert.match(guard, /getAddressLookupTable/);
  assert.match(guard, /message\.getAccountKeys\([\s\S]*addressLookupTableAccounts: lookupTables/);
  assert.match(guard, /deactivationSlot/);
  assert.match(guard, /lastExtendedSlot/);
  assert.match(guard, /validateInstructionPolicy\(instructions, user, cfg\)/);
});
