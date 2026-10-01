'use strict';
/*
 * Охранный тест аудита валют (docs/CURRENCY_TOKENOMICS_AUDIT_2026-10-01.md).
 *
 * F-CURRENCY-01: в aof_market валютный mint платежа (`currency_mint`) не сверяется с MarketConfig.core_mint /
 * gem_mint. Это уязвимость, которую нельзя молча забыть и нельзя «закрыть» одним документом. Тест держит
 * ДВА состояния согласованными: пока привязки в коде нет — документ обязан называть находку ОТКРЫТОЙ; как только
 * привязка появится — документ обязан быть обновлён на ИСПРАВЛЕНО. Ни одно из состояний не может тихо
 * разойтись с кодом. Тест не требует исправления (оно требует сборки Rust и решения владельца) — он требует правды.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'])\/\/.*$/gm, '$1');

const MARKET = 'programs/aof-market/src/lib.rs';
const DOC = 'docs/CURRENCY_TOKENOMICS_AUDIT_2026-10-01.md';

/** Текст структуры аккаунтов от `pub struct Name<'info>` до закрывающей скобки. */
function accountsStruct(source, name) {
  const start = source.indexOf(`pub struct ${name}<'info>`);
  assert.ok(start >= 0, `нет структуры ${name}`);
  const end = source.indexOf('\n}\n', start);
  return source.slice(start, end);
}

/** Атрибут поля `currency_mint`: всё между предыдущим `pub` и самим полем. */
function currencyMintAttribute(structText) {
  const field = structText.indexOf('pub currency_mint');
  assert.ok(field >= 0, 'нет поля currency_mint');
  const before = structText.slice(0, field);
  const attrStart = Math.max(before.lastIndexOf('pub '), before.lastIndexOf('#[account('));
  return structText.slice(Math.max(0, before.lastIndexOf('#[account(')), field);
}

const source = stripComments(read(MARKET));
const isBound = (name) => /core_mint|gem_mint/.test(currencyMintAttribute(accountsStruct(source, name)));
const bindingState = () => (isBound('HotMarketBuy') && isBound('HotMarketSell') ? 'bound' : (!isBound('HotMarketBuy') && !isBound('HotMarketSell') ? 'unbound' : 'partial'));

test('предпосылка находки: core_mint/gem_mint записываются при init и больше нигде не читаются', () => {
  const lines = source.split('\n').filter((line) => /\b(core_mint|gem_mint)\b/.test(line)).map((line) => line.trim());
  // две строки объявления аккаунтов InitConfig и две строки записи в Config; любая другая строка — уже чтение или привязка
  const declared = lines.filter((line) => /^pub (core|gem)_mint: Account<'info, Mint>,$/.test(line));
  const written = lines.filter((line) => /^c\.(core|gem)_mint = ctx\.accounts\.(core|gem)_mint\.key\(\);$/.test(line));
  if (bindingState() === 'unbound') {
    assert.equal(declared.length, 2);
    assert.equal(written.length, 2);
    assert.deepEqual(lines.filter((line) => !declared.includes(line) && !written.includes(line)), [],
      'core_mint/gem_mint начали использоваться ещё где-то в программе: проверьте, не появилась ли привязка валюты, и обновите аудит');
  }
  assert.match(source, /c\.core_mint = ctx\.accounts\.core_mint\.key\(\);/);
  assert.match(source, /c\.gem_mint = ctx\.accounts\.gem_mint\.key\(\);/);
});

test('статус F-CURRENCY-01 в аудите совпадает с кодом', () => {
  const doc = read(DOC);
  const state = bindingState();
  assert.notEqual(state, 'partial', 'привязка есть только в одной из двух инструкций — исправление неполное');
  if (state === 'unbound') {
    assert.match(doc, /F-CURRENCY-01[^\n]*\(ОТКРЫТО\)/, 'привязки валюты в коде нет, а аудит не называет находку ОТКРЫТОЙ');
  } else {
    assert.match(doc, /F-CURRENCY-01[^\n]*\(ИСПРАВЛЕНО\)/, 'привязка валюты в коде появилась — отметьте F-CURRENCY-01 как ИСПРАВЛЕНО и уберите рекомендацию');
    // и тест на чужой валютный mint обязан существовать
    assert.match(read('tests/aof_market.ts'), /(чужой|alien|foreign)[^\n]*валют|валют[^\n]*(чужой|alien|foreign)/i, 'нет validator-теста на чужой валютный mint');
  }
});

test('на чужой валютный mint пока нет validator-теста (тест на чужой ИНСТРУМЕНТАЛЬНЫЙ mint — другое)', () => {
  if (bindingState() !== 'unbound') return;
  const tests = read('tests/aof_market.ts');
  assert.match(tests, /произвольный SPL-минт не продаётся по цене пула/, 'существующий тест про чужой инструментальный mint пропал');
  assert.doesNotMatch(tests, /alien[A-Za-z]*[Cc]urrency|чужой[^\n]*валют/i, 'появился тест на чужую валюту — возможно, привязку уже добавили; обновите аудит');
});

test('положительные контроли: остальные программы привязывают mint и казну к конфигу', () => {
  assert.match(read('programs/aof-quests/src/instructions/quests/quest_claim_reward.rs'), /treasury_mascot\.mint == quest_config\.mascot_mint/);
  assert.match(read('programs/aof-liquidity/src/instructions/lp_deposit.rs'), /address = lp_config\.mascot_mint/);
  assert.match(read('programs/aof-rebirth/src/instructions/do_rebirth.rs'), /address = rebirth_config\.treasury/);
  const core = stripComments(read('aof-core/src/lib.rs'));
  const bound = core.split('#[derive(Accounts)]').slice(1).filter((block) => /address\s*=\s*config\.treasury/.test(block.slice(0, block.indexOf('\n}\n')))).length;
  assert.ok(bound >= 14, `казна в платёжных структурах aof_core привязана к config.treasury в ${bound} местах, аудит утверждает 14`);
});

test('таблица валют в аудите: рынок — SPL (core/gem), маркетплейс и магазин — SOL; комиссии совпадают с константами', () => {
  const doc = read(DOC);
  const constants = read('aof-core/src/constants.rs');
  const bps = { MARKETPLACE_FEE_BPS: 300, AUCTION_FEE_BPS: 400, OFFER_FEE_BPS: 250, RENTAL_FEE_BPS: 500, ORDERBOOK_MAKER_FEE_BPS: 10, ORDERBOOK_TAKER_FEE_BPS: 40 };
  for (const [name, value] of Object.entries(bps)) {
    assert.match(constants, new RegExp(`pub const ${name}: u16 = ${value};`), `константа ${name} изменилась — обновите таблицу валют в аудите`);
  }
  for (const [name, lamports] of Object.entries({ PACK_SMALL_PRICE_LAMPORTS: '100_000_000', PACK_MEDIUM_PRICE_LAMPORTS: '300_000_000', PACK_BIG_PRICE_LAMPORTS: '1_000_000_000', SEASON_PASS_PREMIUM_PRICE_LAMPORTS: '150_000_000', LOTTERY_TICKET_PRICE_LAMPORTS: '800_000' })) {
    assert.match(constants, new RegExp(`pub const ${name}: u64 = ${lamports};`), `константа ${name} изменилась — обновите аудит`);
  }
  for (const needle of ['SPL: `core`', '**SOL**', 'F-CURRENCY-01', 'F-CURRENCY-02', 'F-CURRENCY-03', 'F-CURRENCY-04', 'Что не менялось']) {
    assert.ok(doc.includes(needle), `в аудите валют нет «${needle}»`);
  }
});

test('валюты рынка выбираются явно и необратимо: bringup не угадывает их, а в MarketConfig нет setter\'а', () => {
  const bringup = read('scripts/devnet-bringup.sh');
  assert.match(bringup, /валюты пула необратимы/);
  assert.match(bringup, /MARKET_CORE_MINT.*Config\.potatoMint/s);
  assert.doesNotMatch(source, /pub fn set_(core|gem)_mint|pub fn set_currenc/, 'появился setter валюты рынка — обновите аудит (валюты перестали быть необратимыми)');
});

test('CurrencyMismatch в коде отсутствует (утверждение аудита F-CURRENCY-04)', () => {
  const hit = ['aof-core/src', 'programs', 'aof_backend/src', 'frontend/src', 'tests'].some((dir) => {
    const stack = [path.join(root, dir)];
    while (stack.length) {
      const current = stack.pop();
      if (!fs.existsSync(current)) continue;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'target') continue;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (/\.(rs|ts|tsx|json)$/.test(entry.name) && !/currency-binding/.test(entry.name) && /CurrencyMismatch/.test(fs.readFileSync(full, 'utf8'))) return true;
      }
    }
    return false;
  });
  if (hit) assert.match(read(DOC), /F-CURRENCY-01[^\n]*\(ИСПРАВЛЕНО\)/, 'CurrencyMismatch появился в коде — отметьте F-CURRENCY-01 как ИСПРАВЛЕНО и обновите F-CURRENCY-04');
});
