'use strict';
/*
 * Честность копирайта сезонного пропуска (решение владельца 2026-10-01, п. 7).
 *
 * Игрок — payer своей транзакции: он оплачивает rent аккаунта-пропуска и комиссию сети.
 * Значит слово «бесплатно» рядом с кнопкой инициации недопустимо: цена пропуска — 0 игровых
 * токенов, но сетевые расходы несёт игрок, и рядом обязана быть live-котировка (rent из RPC).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const COPY = 'frontend/src/i18n/seasonPassCopy.ts';
const PAGE = 'frontend/src/pages/profile/SeasonPassPage.tsx';
const QUOTE = 'frontend/src/lib/seasonPassQuote.ts';
const STATE = 'aof-core/src/state.rs';
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const LANGUAGES = ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'];
// Слова, обещающие отсутствие любых списаний, — их в initPass/initPassNote быть не должно.
const FREE_WORD_RE = /(бесплат|free|grat|gratuit|miễn\s*phí|mien\s*phi|walang\s*bayad)/i;
// В каждой локали в примечании обязаны быть обе мысли: цена пропуска 0 игровых токенов
// и сетевые расходы/rent платит игрок.
const PRICE_ZERO = {
  ru: /0\s*игровых\s*токенов/i, en: /0\s*game\s*tokens/i, pt: /0\s*tokens/i, es: /0\s*tokens/i,
  vi: /0\s*token/i, id: /0\s*token/i, fil: /0\s*game\s*token/i,
};
const PLAYER_PAYS = {
  ru: /игрок/i, en: /player/i, pt: /jogador/i, es: /jugador/i,
  vi: /người\s*chơi/i, id: /pemain/i, fil: /manlalaro/i,
};

/** Проверка копирайта: вынесена, чтобы мутационный тест мог прогнать её на подменённом тексте. */
function checkCopy(text) {
  const errors = [];
  for (const lang of LANGUAGES) {
    const blockRe = new RegExp(`\\n  ${lang}: \\{([\\s\\S]*?)\\n  \\},`);
    const block = blockRe.exec(text);
    if (!block) { errors.push(`${lang}: нет блока локали`); continue; }
    for (const key of ['initPass', 'initPassNote', 'quoteTitle', 'quoteRent', 'quoteFee', 'quoteUnavailable']) {
      if (!new RegExp(`\\b${key}\\b`).test(block[1])) errors.push(`${lang}: нет ключа ${key}`);
    }
    const initPass = /\binitPass:\s*'([^']*)'/.exec(block[1])?.[1] ?? '';
    const initPassNote = /\binitPassNote:\s*'([^']*)'/.exec(block[1])?.[1] ?? '';
    if (FREE_WORD_RE.test(initPass) || FREE_WORD_RE.test(initPassNote)) {
      errors.push(`${lang}: initPass/initPassNote обещают бесплатность, хотя игрок платит rent и комиссию`);
    }
    if (!PRICE_ZERO[lang].test(initPassNote)) errors.push(`${lang}: в initPassNote нет нулевой цены пропуска (0 игровых токенов)`);
    if (!PLAYER_PAYS[lang].test(initPassNote)) errors.push(`${lang}: в initPassNote не сказано, что сетевые расходы платит игрок`);
  }
  if (!/freeInit/.test(text) === false) errors.push('остался старый ключ freeInit с обещанием бесплатности');
  return errors;
}

/** Размер аккаунта SeasonPass: 8 байт дискриминатора + фиксированные поля структуры. */
function seasonPassSize() {
  const src = read(STATE);
  const body = /pub struct SeasonPass\s*\{([\s\S]*?)\n\}/.exec(src)?.[1] ?? '';
  const sizes = { Pubkey: 32, u8: 1, u16: 2, u32: 4, u64: 8, i64: 8, bool: 1 };
  let total = 0;
  for (const line of body.split('\n')) {
    const m = /pub\s+\w+\s*:\s*([A-Za-z0-9_]+)(?:<[^>]*>)?\s*(?:,|$)/.exec(line.trim());
    if (m) {
      if (!(m[1] in sizes)) throw new Error(`неизвестный тип поля SeasonPass: ${m[1]}`);
      total += sizes[m[1]];
    }
  }
  return 8 + total;
}

test('копирайт всех локалей честен: цена 0 игровых токенов, сетевые расходы платит игрок', () => {
  const errors = checkCopy(read(COPY));
  assert.deepEqual(errors, []);
});

test('мутация копирайта с обещанием «бесплатно» роняет проверку', () => {
  const mutated = read(COPY).replace("initPass: 'Получить сезонный пропуск'", "initPass: 'Активировать бесплатный пропуск'");
  const errors = checkCopy(mutated);
  assert.ok(errors.some((e) => /ru: initPass\/initPassNote обещают бесплатность/.test(e)), errors.join('; '));
});

test('страница показывает live-котировку rent и комиссии до подписи', () => {
  const page = read(PAGE);
  assert.match(page, /fetchSeasonPassQuote/, 'страница обязана брать котировку из lib/seasonPassQuote');
  assert.match(page, /c\.quoteRent\(/, 'страница рендерит rent из котировки');
  assert.match(page, /c\.quoteFee\(/, 'страница рендерит комиссию сети из котировки');
  assert.match(page, /initPassNote/, 'страница рендерит примечание о сетевых расходах');
  assert.doesNotMatch(page, /freeInit/, 'старого «бесплатного» текста на странице быть не должно');
  const quote = read(QUOTE);
  assert.match(quote, /getMinimumBalanceForRentExemption\(SEASON_PASS_ACCOUNT_SIZE\)/,
    'rent обязан запрашиваться у RPC для реального размера аккаунта');
  assert.match(quote, /getRecentPrioritizationFees/, 'приоритетная комиссия берётся из последних слотов');
});

test('размер аккаунта пропуска в котировке совпадает со структурой SeasonPass', () => {
  const expected = seasonPassSize();
  const declared = Number(/SEASON_PASS_ACCOUNT_SIZE = 8 \+ (\d+)/.exec(read(QUOTE))?.[1]);
  assert.equal(declared + 8, expected, `в seasonPassQuote.ts ${declared + 8} байт, а структура в Rust даёт ${expected}`);
});
