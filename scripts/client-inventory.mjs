#!/usr/bin/env node
/**
 * Воспроизводимый инвентарь клиентских файлов (шаг A пункта 12).
 *
 * Замечание владельца: нельзя хранить environment-dependent дамп `find` — он зависит от
 * рабочей копии (untracked-файлы, порядок обхода, локаль) и потому не является evidence.
 * Инвентарь строится только по tracked-файлам (`git ls-files`), сортируется байтово и
 * содержит sha256 своего содержимого, чтобы гейт мог отличить «файл устарел» от «файл
 * стабилен».
 *
 *   node scripts/client-inventory.mjs --write   пересобрать docs/CLIENT_INVENTORY.txt
 *   node scripts/client-inventory.mjs --check   гейт (свежесть + отсутствие мусора)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const rootIndex = argv.indexOf('--root');
const ROOT = rootIndex >= 0 ? path.resolve(argv[rootIndex + 1]) : path.resolve(HERE, '..');
const OUT = 'docs/CLIENT_INVENTORY.txt';
const TARGETS = ['frontend', 'game'];

/** Пути, которых не должно быть в инвентаре: сгенерированное, зависимости, абсолютные пути. */
export const FORBIDDEN = [
  { re: /(^|\/)node_modules(\/|$)/, what: 'node_modules' },
  { re: /(^|\/)(dist|build|out|coverage|target|__pycache__)(\/|$)/, what: 'generated-каталог' },
  { re: /(^|\/)\.(next|turbo|cache|venv|pytest_cache|ruff_cache|nuxt|output|svelte-kit)(\/|$)/, what: 'generated-каталог' },
  { re: /^\/|^[A-Za-z]:\\|(^|\/)Users\//, what: 'абсолютный путь' },
  { re: /\.(tmp|log|swp|pyc)$/, what: 'временный файл' },
];

export function trackedFiles() {
  const raw = execFileSync('git', ['ls-files', '--', ...TARGETS], { cwd: ROOT, encoding: 'utf8' });
  return raw.split('\n').filter(Boolean);
}

/** Байтовая сортировка: не зависит от локали, в отличие от localeCompare. */
export function sortBytewise(files) {
  return [...files].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function buildInventory() {
  const files = sortBytewise(trackedFiles());
  const body = `${files.join('\n')}\n`;
  const digest = crypto.createHash('sha256').update(body).digest('hex');
  const counts = TARGETS.map((t) => `${t}: ${files.filter((f) => f === t || f.startsWith(`${t}/`)).length}`);
  const text = [
    '# Инвентарь клиентских файлов (шаг A пункта 12)',
    '',
    'Только tracked-файлы: генерируется из `git ls-files -- frontend game`.',
    'Сортировка байтовая (не зависит от локали), абсолютных путей, node_modules и',
    'сборочных каталогов нет — файл воспроизводим и является evidence, а не снимком',
    'рабочей копии.',
    '',
    'Пересобрать: `node scripts/client-inventory.mjs --write`; проверить: `--check`',
    '(`tests/readiness/client-inventory.test.cjs`).',
    '',
    `Файлов: ${files.length} (${counts.join(', ')}).`,
    `sha256: ${digest}`,
    '',
    '```',
    body.trimEnd(),
    '```',
    '',
  ].join('\n');
  return { text, files, digest };
}

export function checkInventory() {
  const problems = [];
  if (!fs.existsSync(path.join(ROOT, OUT))) return [`нет ${OUT}: node scripts/client-inventory.mjs --write`];
  const saved = fs.readFileSync(path.join(ROOT, OUT), 'utf8');
  const { text, files } = buildInventory();
  if (saved !== text) problems.push(`${OUT} устарел: node scripts/client-inventory.mjs --write`);
  for (const file of files) {
    for (const { re, what } of FORBIDDEN) {
      if (re.test(file)) problems.push(`в инвентарь попал ${what}: ${file}`);
    }
  }
  const untracked = files.length === 0 ? ['git ls-files не вернул ни одного файла frontend/game'] : [];
  problems.push(...untracked);
  return problems;
}

function main() {
  if (argv.includes('--write')) {
    const { text, files } = buildInventory();
    fs.writeFileSync(path.join(ROOT, OUT), text);
    console.log(`инвентарь клиентов записан: ${files.length} tracked-файлов`);
    return;
  }
  if (argv.includes('--check')) {
    const problems = checkInventory();
    if (problems.length) {
      console.error(`client-inventory: ${problems.length} проблем(а):`);
      for (const p of problems) console.error(`  - ${p}`);
      process.exit(1);
    }
    const { files } = buildInventory();
    console.log(`client-inventory: ${files.length} tracked-файлов, порядок и содержимое воспроизводимы`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
