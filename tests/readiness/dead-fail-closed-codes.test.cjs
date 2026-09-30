'use strict';
/**
 * Таблица отказов для игрока не должна пополняться мёртвыми кодами.
 *
 * Зачем гейт. `frontend/src/i18n/apiErrorCopy.ts` — единственный словарь
 * «почему кнопка не работает», и он уже дважды переживал механики, которые
 * включали: `HOT_MARKET_DISABLED_UNTIL_CANONICAL_TOOL_TRANSFER`,
 * `TOOL_GRANT_DISABLED_UNTIL_ACCOUNT_MAP_IS_IMPLEMENTED`,
 * `REBIRTH_DISABLED_UNTIL_FULL_RESET_IMPLEMENTED`,
 * `LOTTERY_PURCHASE_REQUIRES_BOUNDED_PRICE`. Каждый такой код — обещание
 * игроку, что механика закрыта; если его больше никто не возвращает, обещание
 * ложное и живёт в семи языках.
 *
 * Правило: каждый код обязан встречаться как минимум в одном месте, где он
 * может быть возвращён или обработан (backend, программы, сервисы, тесты), а не
 * только в самой таблице. Если код нужен для внешнего источника — он
 * добавляется в ALLOWLIST с причиной, чтобы решение было видно в ревью.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const TABLE = 'frontend/src/i18n/apiErrorCopy.ts';

/** Коды, которые намеренно живут только в таблице. Причина обязательна. */
const ALLOWLIST = new Map([]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'target', '.next', 'coverage',
  'out', '.cache', '.vite', '.turbo', '__pycache__',
]);
const CODE_SUFFIXES = new Set([
  '.ts', '.tsx', '.rs', '.py', '.mjs', '.cjs', '.js', '.json', '.toml', '.yml', '.yaml',
]);

/** Все коды из таблицы (в порядке объявления). */
function tableCodes(source) {
  const start = source.indexOf('export const apiErrorCodes = [');
  assert.notEqual(start, -1, 'не найден список apiErrorCodes');
  const end = source.indexOf('] as const;', start);
  assert.notEqual(end, -1, 'не найден конец списка apiErrorCodes');
  return [...source.slice(start, end).matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

/** Текст всего репозитория, кроме самой таблицы, каталогов сборки и снапшотов. */
function repoCorpus() {
  const chunks = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const suffix = path.extname(entry.name);
      if (!CODE_SUFFIXES.has(suffix)) continue;
      const relative = path.relative(root, path.join(dir, entry.name));
      if (relative === TABLE) continue;
      try {
        chunks.push(fs.readFileSync(path.join(dir, entry.name), 'utf8'));
      } catch {
        // Бинарный или недоступный файл — не повод падать: важны коды, а не он.
      }
    }
  };
  walk(root);
  return chunks.join('\n');
}

test('в таблице отказов нет кодов, которые никто не может вернуть', () => {
  const source = fs.readFileSync(path.join(root, TABLE), 'utf8');
  const codes = tableCodes(source);
  assert.ok(codes.length >= 40, `в таблице только ${codes.length} кодов — проверьте парсер`);

  const corpus = repoCorpus();
  const allowlisted = new Set();
  for (const [code, reason] of ALLOWLIST) {
    assert.ok(typeof reason === 'string' && reason.trim().length > 10,
      `${code}: в ALLOWLIST нужна причина, иначе запись бессмысленна`);
    allowlisted.add(code);
  }
  const dead = codes.filter((code) => !corpus.includes(code) && !allowlisted.has(code));
  assert.deepEqual(dead, [],
    'эти коды есть только в таблице: либо механика снова работает и код надо убрать, ' +
    'либо он возвращается извне — тогда добавьте его в ALLOWLIST гейта с причиной');
});

test('в списке кодов нет повторов и пустых значений', () => {
  const source = fs.readFileSync(path.join(root, TABLE), 'utf8');
  const codes = tableCodes(source);
  assert.equal(new Set(codes).size, codes.length, 'дубликаты в apiErrorCodes');
  for (const code of codes) {
    assert.match(code, /^[A-Z][A-Z0-9_]{4,}$/, `подозрительный код: ${code}`);
  }
});
