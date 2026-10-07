'use strict';
/*
 * Layout/IDL-базис (scripts/layout-baseline.mjs, решение владельца 2026-10-01, п. 9).
 * Переименование ресурсов не имеет права менять бинарный layout: порядок вариантов enum,
 * типы и порядок полей аккаунтов, размеры, коды ошибок и дискриминанты инструкций.
 * Anchor build в песочнице нет — базис статический, финальное подтверждение за тулчейном.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'scripts/layout-baseline.mjs');
const BASELINE = 'docs/LAYOUT_BASELINE.json';
const read = (rel, base = root) => fs.readFileSync(path.join(base, rel), 'utf8');

function run(args, cwd = root) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: stdout };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

function makeRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-layout-'));
  for (const rel of ['aof-core/src', 'programs', 'docs']) {
    fs.cpSync(path.join(root, rel), path.join(tmp, rel), { recursive: true, filter: (src) => !/target/.test(src) });
  }
  fs.copyFileSync(path.join(root, BASELINE), path.join(tmp, BASELINE));
  return tmp;
}
const withRoot = (fn) => { const tmp = makeRoot(); try { return fn(tmp); } finally { fs.rmSync(tmp, { recursive: true, force: true }); } };

test('репозиторий проходит гейт: layout совпадает с базисом', () => {
  const result = run(['--check']);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /layout не изменился \(27 ResourceKind, 6 программ/);
});

test('базис фиксирует порядок enum, дискриминанты инструкций и размеры аккаунтов', () => {
  const baseline = JSON.parse(read(BASELINE));
  assert.equal(baseline.resourceKindCount, 27);
  assert.deepEqual(baseline.resourceKind.slice(0, 5), ['Data', 'Circuit', 'Silicon', 'Neuron', 'Synapse']);
  const core = baseline.programs.find((p) => p.name === 'aof_core');
  const approvedAdditions = baseline.approvedAdditions?.aof_core;
  assert.deepEqual(approvedAdditions?.instructions, [
    { name: 'init_player', discriminator: '721bdb90320fe442' },
    { name: 'exchange_data_energy', discriminator: '789f4fbafa4153c3' },
    { name: 'use_flask', discriminator: 'c312823d390b6587' },
    { name: 'set_issuance_lifetime_baseline', discriminator: '5fa1444d0ed7cd55' },
    { name: 'set_tool_metadata_uris', discriminator: 'c6622920403298aa' },
    { name: 'claim_premium_season_reward', discriminator: 'e8218c145fee48c7' },
  ], 'все новые инструкции зафиксированы в порядке их appended IDL entries и с точным discriminator');
  assert.deepEqual(approvedAdditions?.errors?.AofError, [

    'PlayerNotInitialized', 'InvalidSeasonXpEntitlement', 'SeasonXpEntitlementExpired', 'SeasonXpNonceMismatch',
    'ToolMetadataRegistryFrozen', 'ToolMetadataRegistryNotFrozen', 'InvalidToolMetadataRegistry',
    'InvalidToolMetadataUris', 'InvalidSellerFeeBasisPoints',
  ], 'новые error codes только appended — старые ordinal-коды сохраняются');
  const cursor = approvedAdditions?.accounts?.find((account) => account.name === 'SeasonXpClaimCursor');
  assert.deepEqual(cursor?.typeSequence, ['Pubkey', 'u32', 'u32', 'u8']);
  assert.equal(cursor?.size, 49);
  const premiumClaims = approvedAdditions?.accounts?.find((account) => account.name === 'SeasonPremiumClaims');
  assert.deepEqual(premiumClaims?.typeSequence, ['Pubkey', 'u32', 'u64', 'u8']);
  assert.equal(premiumClaims?.size, 53);
  const metadataRegistry = approvedAdditions?.accounts?.find((account) => account.name === 'ToolMetadataRegistry');
  assert.deepEqual(metadataRegistry?.typeSequence, ['Pubkey', 'bool', 'bool', 'u32', 'u16', 'u8', 'Vec<String>']);
  assert.equal(metadataRegistry?.initSpace, true);
  assert.equal(metadataRegistry?.size, null, 'variable-size metadata URI vec is explicitly max-allocated by Anchor');
  const startMining = core.instructions.find((i) => i.name === 'start_mining');
  assert.equal(startMining.discriminator,
    crypto.createHash('sha256').update('global:start_mining').digest('hex').slice(0, 16),
    'дискриминант = sha256("global:<name>")[0..8]');
  const config = core.accounts.find((a) => a.name === 'Config');
  assert.ok(config.size > 0, 'у Config посчитан размер');
  const material = core.accounts.find((a) => a.name === 'MaterialMints');
  // Базис снят ДО переименования: имена полей в нём — исторические (`food_mint`, `seeds`, …),
  // и по ним же обязан находиться каждый из 27 минтов (4 в Config + 23 в MaterialMints).
  const manifest = JSON.parse(read('docs/RESOURCE_MANIFEST.json'));
  const inConfig = manifest.resources.filter((r) => r.mintSource.startsWith('config.'));
  const inMaterials = manifest.resources.filter((r) => r.mintSource.startsWith('material_mints.'));
  assert.equal(inConfig.length, 4);
  assert.equal(inMaterials.length, 23);
  assert.equal(inConfig.length + inMaterials.length, baseline.resourceKindCount);
  for (const r of [...inConfig, ...inMaterials]) {
    const acc = r.mintSource.startsWith('config.') ? config : material;
    const field = acc.fields.find((f) => f.name === r.historicalField);
    assert.equal(field?.type, 'Pubkey', `${r.kind}: минт ${r.historicalField} обязан быть Pubkey в базисе`);
  }
  // Гейт обязан видеть переименование как rename, а не как поломку layout.
  const check = run(['--check']);
  assert.equal(check.code, 0, check.out);
  assert.match(check.out, /~ переименование без смены layout: MaterialMints\.seeds → neuron: поле переименовано/);
  assert.ok(core.errors.some((e) => e.name === 'AofError' && e.variants.length >= 140));
  assert.equal(baseline.source.includes('anchor build'), true, 'базис обязан указывать на обязательную финальную проверку Anchor');
});

test('явно разрешённое поле account переименовано без изменения layout', () => {
  withRoot((tmp) => {
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /LabTile\.planted_at → started_at: поле переименовано, порядок\/тип i64 сохранены/);
  });
});

test('смена типа/порядка поля или дискриминанта инструкции роняет гейт', () => {
  withRoot((tmp) => {
    const p = path.join(tmp, 'aof-core/src/state.rs');
    const before = fs.readFileSync(p, 'utf8');
    fs.writeFileSync(p, before.replace('pub claimed_bitmap: u64,', 'pub claimed_bitmap: u32,'));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /типы\/порядок полей изменились|размер/);
  });
  withRoot((tmp) => {
    const p = path.join(tmp, 'aof-core/src/state.rs');
    const before = fs.readFileSync(p, 'utf8');
    fs.writeFileSync(p, before.replace('pub started_at: i64,', 'pub activated_at: i64,'));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /неразрешённое переименование поля/);
  });
  withRoot((tmp) => {
    const p = path.join(tmp, 'aof-core/src/lib.rs');
    const before = fs.readFileSync(p, 'utf8');
    fs.writeFileSync(p, before.replace('pub fn start_mining(', 'pub fn start_mining_v2('));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /start_mining: инструкция исчезла|инструкций/);
  });
  withRoot((tmp) => {
    const p = path.join(tmp, 'aof-core/src/state.rs');
    const before = fs.readFileSync(p, 'utf8');
    fs.writeFileSync(p, before.replace('pub next_nonce: u32,', 'pub next_nonce: u64,'));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /SeasonXpClaimCursor: layout approved addition не совпадает/);
  });
});

test('Anchor program root re-exports generated client/CPI accounts modules for the nested metadata instruction', () => {
  const lib = read('aof-core/src/lib.rs');
  assert.match(lib, /pub\(crate\) use instructions::tool_metadata::\{\s*__client_accounts_set_tool_metadata_uris,\s*__cpi_client_accounts_set_tool_metadata_uris,\s*SetToolMetadataUris,\s*\};/);
});
