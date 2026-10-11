'use strict';
/*
 * Охранный тест аудита NFT-стандартов (the on-chain metadata rules).
 *
 * Текущее разделение стандартов: tool assets use SPL Token + immutable legacy Metaplex Token Metadata, without a Master Edition;
 * Bubblegum V2 и MPL Core/compressed assets не используются. Этот guard проверяет оба утверждения отдельно:
 * новая compressed-NFT интеграция требует обновить аудит и пройти pilot из docs/COMPRESSION_DESIGN.md.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'target', '.next', 'coverage']);

function walk(rel, extensions) {
  const out = [];
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (extensions.includes(path.extname(entry.name))) out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  visit(abs);
  return out;
}

// Упоминание Token Metadata в collector_stake.rs описывает, что allowlist path его не парсит.
// охраняется код, а не его описание.
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'])\/\/.*$/gm, '$1');

const FORBIDDEN_CRATES = /name = "(?:mpl-(?:bubblegum|core)(?:-[\w-]+)?|mpl_(?:bubblegum|core)|spl-account-compression|spl-concurrent-merkle-tree|spl-noop|bubblegum[\w-]*)"/;
const COMPRESSION_STANDARD_WORDS = /bubblegum|mpl[-_ ]?core|mplcore|spl[-_]account[-_]compression|concurrent[-_]merkle/i;

test('Cargo.lock и манифесты не тянут Bubblegum, MPL Core или compression', () => {
  assert.doesNotMatch(read('Cargo.lock'), FORBIDDEN_CRATES, 'в Cargo.lock появился крейт Metaplex/compression — обновите the on-chain metadata rules');
  for (const rel of ['Cargo.toml', 'aof-core/Cargo.toml', ...fs.readdirSync(path.join(root, 'programs')).map((d) => `programs/${d}/Cargo.toml`)]) {
    if (!fs.existsSync(path.join(root, rel))) continue;
    assert.doesNotMatch(read(rel), COMPRESSION_STANDARD_WORDS, `${rel}: добавлена зависимость от compressed-NFT стандарта`);
  }
});

test('исходники программ, валидаторные тесты и IDL не реализуют Bubblegum/MPL Core/compressed assets', () => {
  const files = [...walk('aof-core', ['.rs']), ...walk('programs', ['.rs']), ...walk('tests', ['.ts']), ...walk('aof_backend/src/idl', ['.json'])];
  assert.ok(files.length > 100, 'сканирование ничего не нашло — тест сломан');
  const hits = files.filter((rel) => COMPRESSION_STANDARD_WORDS.test(rel.endsWith('.json') ? read(rel) : stripComments(read(rel))));
  assert.deepEqual(hits, [], `compressed NFT стандарт упомянут в КОДЕ программ/тестов/IDL: ${hits.join(', ')} — обновите аудит NFT и пройдите pilot`);
  // и нет аккаунтов Merkle-дерева в инструкциях
  for (const name of ['aof_core', 'aof_market', 'aof_quests', 'aof_rebirth', 'aof_liquidity', 'aof_session_keys']) {
    const idl = JSON.parse(read(`aof_backend/src/idl/${name}.json`));
    for (const ix of idl.instructions) {
      for (const account of ix.accounts || []) {
        assert.doesNotMatch(String(account.name), /merkle|tree_config|leaf|compression/i, `${name}.${ix.name}: аккаунт ${account.name} похож на Bubblegum`);
      }
    }
  }
});

test('упоминания Bubblegum — только в разрешённых слоях (документы, дескрипторы, заглушки, калькулятор)', () => {
  const allowed = [
    /^docs\//, /^reports\/[^/]+\.md$/, /^[A-Z_0-9-]+\.md$/, /^\.claude\/skills\//, /^game\//, /^src\/os\//,
    /^scripts\/(mint-cost-model|test-mint-cost-model)\.py$/, /^tests\/readiness\/nft-standards\.test\.cjs$/,
    /^scripts\/instruction-inventory\.mjs$/,
  ];
  const everything = [
    ...walk('.', ['.md', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.rs', '.gd', '.cs', '.py', '.json', '.sql', '.toml', '.sh']),
  ].filter((rel) => !rel.startsWith('node_modules/') && !rel.includes('/node_modules/') && !/package-lock\.json$/.test(rel));
  const mentions = everything.filter((rel) => /bubblegum/i.test(read(rel)));
  assert.ok(mentions.length >= 10, `ожидали десяток упоминаний (описательные слои), нашли ${mentions.length} — тест сломан`);
  const stray = mentions.filter((rel) => !allowed.some((re) => re.test(rel)));
  assert.deepEqual(stray, [], `Bubblegum упомянут вне описательных слоёв: ${stray.join(', ')} — это уже может быть реализация; обновите the on-chain metadata rules`);
});

test('бэкенд и фронтенд не строят и не читают cNFT: DAS-проверка остаётся TODO', () => {
  const files = [...walk('aof_backend/src', ['.ts']), ...walk('aof_backend/services', ['.ts']), ...walk('frontend/src', ['.ts', '.tsx'])]
    .filter((rel) => !rel.includes('/idl/'));
  const offenders = files.filter((rel) => /getAssetProof|getAssetsByOwner|createTreeV2|mintV2|@metaplex-foundation|mpl-bubblegum|mpl-core/.test(read(rel)));
  assert.deepEqual(offenders, [], `backend/frontend начали работать с Metaplex/DAS: ${offenders.join(', ')}`);
  assert.equal(files.includes('aof_backend/src/lib/skrPrivilege.ts'), false, 'SKR privilege helper was removed');
});

test('tool issuance creates immutable Metaplex metadata on a fixed-supply SPL asset and preserves no-freeze', () => {
  const lib = read('aof-core/src/lib.rs');
  const struct = lib.slice(lib.indexOf('pub struct MintTool<'), lib.indexOf('pub struct BurnTool<'));
  for (const rule of ['mint.decimals == 0', 'mint.supply == 0', 'mint.freeze_authority == anchor_lang::solana_program::program_option::COption::Some(auth.key())', 'mint.mint_authority == anchor_lang::solana_program::program_option::COption::Some(auth.key())']) {
    assert.ok(struct.includes(rule), `MintTool потерял проверку минта: ${rule}`);
  }
  assert.match(struct, /tool_metadata_registry: Box<Account<'info, ToolMetadataRegistry>>/);
  assert.match(struct, /metadata\.key\(\) == anchor_spl::metadata::mpl_token_metadata::accounts::Metadata::find_pda/);
  assert.doesNotMatch(struct, /master_edition|MasterEdition/, 'the metadata-only context has no Master Edition account');

  const mintTool = read('aof-core/src/instructions/mint_tool.rs');
  assert.match(mintTool, /settlement::mint_tool_nft\(/);
  assert.match(mintTool, /&ctx\.accounts\.tool_metadata_registry/);
  const settlement = read('aof-core/src/instructions/settlement.rs');
  assert.match(settlement, /token::mint_to\([\s\S]*?,\s*1\s*,?\s*\)/);
  assert.match(settlement, /CreateMetadataAccountV3/);
  assert.doesNotMatch(settlement, /CreateMasterEditionV3|master_edition|MasterEdition/);
  const metadataCpi = settlement.indexOf('invoke_signed(');
  const revokeMint = settlement.indexOf('token::set_authority(');
  assert.ok(metadataCpi >= 0 && revokeMint > metadataCpi, 'mint authority is revoked after metadata creation');
  assert.equal([...settlement.matchAll(/token::set_authority\(/g)].length, 2, 'both temporary authorities are revoked');
  assert.match(settlement.slice(revokeMint), /AuthorityType::MintTokens,\s*None/);
  assert.match(settlement.slice(revokeMint), /AuthorityType::FreezeAccount,\s*None/,
    'temporary freeze authority is cleared before the atomic issuance completes');
  assert.match(settlement, /registry\.metadata_uri\(canonical_type, rarity\)/);
  assert.match(settlement, /seller_fee_basis_points: registry\.seller_fee_basis_points/);
  assert.match(settlement, /symbol: String::new\(\)/);
  assert.match(settlement, /creators: None,[\s\S]*?collection: None/);
  assert.match(settlement, /is_mutable: false/);
  assert.doesNotMatch(settlement, /max_supply/);
  const registryState = read('aof-core/src/state.rs');
  assert.match(registryState, /self\.initialized && self\.frozen/);
  assert.match(registryState, /self\.populated_mask & \(1u32 << index\) != 0/);
});

test('аудит ссылается на комментарий collector_stake.rs: он на месте', () => {
  assert.match(read('aof-core/src/instructions/collector_stake.rs'), /does not inspect Token Metadata accounts/);
});

test('сжатые NFT не используются', () => {
  assert.match(read('docs/COMPRESSION_DESIGN.md'), /Bubblegum и Light Protocol не используются/);
});
