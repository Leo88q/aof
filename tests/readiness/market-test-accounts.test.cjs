'use strict';
/**
 * Гейт для tests/aof_market.ts — единственного теста, который проверяет
 * событийный рынок на живом валидаторе.
 *
 * Зачем отдельный статический гейт. Этот файл нельзя запустить локально без
 * сборки программ и anchor test, поэтому единственная защита от опечатки в имени
 * аккаунта — сверка с IDL: `anchor test` упал бы уже в CI, а гейт ловит это
 * раньше и говорит, какое имя лишнее. Одновременно проверяется, что файл вообще
 * подключён к `Anchor.toml [scripts] test` — тест, который никто не запускает,
 * ничего не доказывает, и что проверки в нём не выродились в «smoke».
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const camel = (name) => name.replace(/_(\w)/g, (_, letter) => letter.toUpperCase());

/** Имена аккаунтов инструкции из IDL программы (IDL — snake_case, TS-клиент — camelCase). */
function idlAccounts(idl, instruction) {
  const wanted = camel(instruction);
  const entry = (idl.instructions || []).find((ix) => camel(ix.name) === wanted);
  assert.ok(entry, `в IDL нет инструкции ${instruction}`);
  return new Set(entry.accounts.map((account) => camel(account.name)));
}

/** Блоки `.accounts({...})` вместе с именем вызванной инструкции и программы. */
function accountBlocks(source) {
  const blocks = [];
  for (const match of source.matchAll(/\.accounts\(\{/g)) {
    let depth = 1;
    let index = match.index + match[0].length;
    while (depth > 0 && index < source.length) {
      if (source[index] === '{') depth += 1;
      else if (source[index] === '}') depth -= 1;
      index += 1;
    }
    const body = source.slice(match.index + match[0].length, index - 1);
    const head = source.slice(0, match.index);
    const methods = [...head.matchAll(/(\w+)\s*\.\s*methods\s*\.\s*(\w+)\s*\(/g)];
    const call = methods[methods.length - 1];
    blocks.push({
      program: call ? call[1] : null,
      instruction: call ? call[2] : null,
      keys: [...body.matchAll(/(?:^|[,\s{])(\w+)\s*:/g)].map((entry) => entry[1]),
    });
  }
  return blocks;
}

test('tests/aof_market.ts ссылается только на существующие аккаунты IDL', () => {
  const source = read('tests/aof_market.ts');
  const idls = {
    core: JSON.parse(read('aof_backend/src/idl/aof_core.json')),
    market: JSON.parse(read('aof_backend/src/idl/aof_market.json')),
  };
  const blocks = accountBlocks(source);
  assert.ok(blocks.length >= 5, `блоков .accounts({...}) найдено только ${blocks.length}`);

  const problems = [];
  for (const block of blocks) {
    const idl = idls[block.program];
    assert.ok(idl, `неизвестная переменная программы '${block.program}' перед .accounts({...})`);
    const expected = idlAccounts(idl, block.instruction);
    for (const key of block.keys) {
      if (!expected.has(key)) {
        problems.push(`${block.instruction}: лишний аккаунт '${key}' (в IDL: ${[...expected].sort().join(', ')})`);
      }
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('тест рынка подключён к Anchor.toml и проверяет не только «не упало»', () => {
  const anchor = read('Anchor.toml');
  assert.match(anchor, /tests\/aof_market\.ts/, 'Anchor.toml [scripts] test не запускает тест рынка');

  const source = read('tests/aof_market.ts');
  // Покупка/продажа обязаны проверяться по состоянию, а не только по отсутствию
  // исключения: владение инструментом, балансы пула и казны, коды ошибок.
  for (const needle of [
    'toolData.fetch',            // владение читается из сети
    'SlippageExceeded',          // потолок цены действительно отклоняется
    'tool.owner',                // владелец сверяется с покупателем/пулом
    'hotMarketSellIntoQueue',    // продажа вызывается как инструкция
    'core: {}',                  // валюта пула задана явно
  ]) {
    assert.ok(source.includes(needle), `тест рынка не проверяет: ${needle}`);
  }
  assert.ok(!/\bit\.skip\(|\bxit\(|\bxdescribe\(/.test(source), 'тест рынка не должен быть отключён');
});
