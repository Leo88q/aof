'use strict';
/*
 * Охранный тест аудита NFT-стандартов (docs/NFT_STANDARDS_AUDIT_2026-10-01.md).
 *
 * Аудит утверждает: Bubblegum V2, MPL Core и Metaplex Token Metadata в AOF НЕ используются — ни в программах,
 * ни в backend, ни в клиентах: есть только план, дескрипторы и заглушки. Это утверждение должно оставаться
 * проверяемым, а не просто написанным: как только кто-то добавит зависимость или CPI, тест падает и требует
 * обновить аудит (и пройти пилот из docs/COMPRESSION_DESIGN.md), а не оставить документ врать.
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

// В комментариях эти слова допустимы (collector_stake.rs прямо объясняет: «не зависит от mpl-token-metadata»):
// охраняется код, а не его описание.
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'])\/\/.*$/gm, '$1');

const FORBIDDEN_CRATES = /name = "(mpl-[\w-]+|mpl_[\w]+|spl-account-compression|spl-concurrent-merkle-tree|spl-noop|bubblegum[\w-]*)"/;
const NFT_STANDARD_WORDS = /bubblegum|mpl[-_ ]?core|mplcore|mpl[-_]token[-_]metadata|spl[-_]account[-_]compression|concurrent[-_]merkle/i;

test('Cargo.lock и манифесты не тянут Bubblegum, MPL Core, Token Metadata и compression', () => {
  assert.doesNotMatch(read('Cargo.lock'), FORBIDDEN_CRATES, 'в Cargo.lock появился крейт Metaplex/compression — обновите docs/NFT_STANDARDS_AUDIT_2026-10-01.md');
  for (const rel of ['Cargo.toml', 'aof-core/Cargo.toml', ...fs.readdirSync(path.join(root, 'programs')).map((d) => `programs/${d}/Cargo.toml`)]) {
    if (!fs.existsSync(path.join(root, rel))) continue;
    assert.doesNotMatch(read(rel), NFT_STANDARD_WORDS, `${rel}: добавлена зависимость от NFT-стандарта`);
  }
});

test('исходники программ, валидаторные тесты и IDL не используют NFT-стандарты', () => {
  const files = [...walk('aof-core', ['.rs']), ...walk('programs', ['.rs']), ...walk('tests', ['.ts']), ...walk('aof_backend/src/idl', ['.json'])];
  assert.ok(files.length > 100, 'сканирование ничего не нашло — тест сломан');
  const hits = files.filter((rel) => NFT_STANDARD_WORDS.test(rel.endsWith('.json') ? read(rel) : stripComments(read(rel))));
  assert.deepEqual(hits, [], `NFT-стандарт упомянут в КОДЕ программ/тестов/IDL: ${hits.join(', ')} — обновите аудит NFT и пройдите пилот`);
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
  assert.deepEqual(stray, [], `Bubblegum упомянут вне описательных слоёв: ${stray.join(', ')} — это уже может быть реализация; обновите docs/NFT_STANDARDS_AUDIT_2026-10-01.md`);
});

test('бэкенд и фронтенд не строят и не читают cNFT: DAS-проверка остаётся TODO', () => {
  const files = [...walk('aof_backend/src', ['.ts']), ...walk('aof_backend/services', ['.ts']), ...walk('frontend/src', ['.ts', '.tsx'])]
    .filter((rel) => !rel.includes('/idl/'));
  const offenders = files.filter((rel) => /getAssetProof|getAssetsByOwner|createTreeV2|mintV2|@metaplex-foundation|mpl-bubblegum|mpl-core/.test(read(rel)));
  assert.deepEqual(offenders, [], `backend/frontend начали работать с Metaplex/DAS: ${offenders.join(', ')}`);
  assert.match(read('aof_backend/src/lib/skrPrivilege.ts'), /TODO: проверка владения NFT Saga\/Seeker через Metaplex DAS API/,
    'TODO про DAS исчез: значит, проверка владения NFT реализована — обновите аудит');
});

test('инструмент — SPL-токен: mint_tool требует decimals=0, supply=0, без freeze authority, mint authority = PDA программы', () => {
  const lib = read('aof-core/src/lib.rs');
  const struct = lib.slice(lib.indexOf('pub struct MintTool<'), lib.indexOf('pub struct BurnTool<'));
  for (const rule of ['mint.decimals == 0', 'mint.supply == 0', 'mint.freeze_authority.is_none()', 'mint.mint_authority == anchor_lang::solana_program::program_option::COption::Some(auth.key())']) {
    assert.ok(struct.includes(rule), `MintTool потерял проверку минта: ${rule}`);
  }
  assert.match(read('aof-core/src/instructions/mint_tool.rs'), /token::mint_to\(cpi_ctx, 1\)/);
});

test('аудит ссылается на комментарий collector_stake.rs: он на месте', () => {
  assert.match(read('aof-core/src/instructions/collector_stake.rs'), /not depend on mpl-token-metadata/);
});

test('документ аудита утверждает то же, что проверяет тест', () => {
  const doc = read('docs/NFT_STANDARDS_AUDIT_2026-10-01.md');
  for (const needle of ['**Нет.**', 'MPL Core', 'legacy NFT', 'SPL-токен', 'ToolData', 'nft-standards.test.cjs', 'COMPRESSION_DESIGN.md']) {
    assert.ok(doc.includes(needle), `в аудите нет «${needle}»`);
  }
  assert.match(read('docs/COMPRESSION_DESIGN.md'), /Ни Bubblegum, ни Light Protocol в текущий контракт не добавлены/);
});
