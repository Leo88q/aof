#!/usr/bin/env node
/**
 * Воспроизводимый инвентарь клиентских файлов (шаг A пункта 12).
 *
 * Инвентарь читается из committed HEAD, а не из потенциально устаревшего index.
 * Перед --check/--write проверяется согласованность HEAD → index → worktree и
 * отсутствие untracked-файлов. Если для текущей ветки есть refs/remotes/origin/<branch>,
 * известный remote advance/divergence тоже блокирует работу. Никакой команды fetch,
 * reset, checkout, rebase или автоматической перегенерации baseline здесь нет.
 *
 *   node scripts/client-inventory.mjs --write   явно пересобрать docs/CLIENT_INVENTORY.txt
 *   node scripts/client-inventory.mjs --check   проверить baseline и чистый snapshot
 *
 * После --write baseline становится изменённым Git-файлом: его нужно отдельно
 * просмотреть, добавить и закоммитить. До этого --check намеренно завершается
 * ошибкой, чтобы не считать незакоммиченный baseline доказательством.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const rootIndex = argv.indexOf('--root');
const ROOT = rootIndex >= 0 ? path.resolve(argv[rootIndex + 1]) : path.resolve(HERE, '..');
const OUT = 'docs/CLIENT_INVENTORY.txt';
const TARGETS = ['frontend', 'game'];
const PREVIEW_LIMIT = 8;

/** Пути, которых не должно быть в инвентаре: generated/cache/absolute/temp. */
export const FORBIDDEN = [
  { re: /(^|\/)node_modules(\/|$)/, what: 'node_modules' },
  { re: /(^|\/)(dist|build|out|coverage|target|__pycache__)(\/|$)/, what: 'generated-каталог' },
  { re: /(^|\/)\.(next|turbo|cache|venv|pytest_cache|ruff_cache|nuxt|output|svelte-kit)(\/|$)/, what: 'generated-каталог' },
  { re: /^\/|^[A-Za-z]:\\|(^|\/)Users\//, what: 'абсолютный путь' },
  { re: /\.(tmp|log|swp|pyc)$/, what: 'временный файл' },
  { re: /[\r\n\0]/, what: 'небезопасное имя файла (управляющий символ)' },
];

function git(args, { binary = false } = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: binary ? 'buffer' : 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function nulList(args) {
  return git(args, { binary: true }).toString('utf8').split('\0').filter(Boolean);
}

function headCommit() {
  try {
    return git(['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  } catch {
    return null;
  }
}

function refExists(ref) {
  const result = spawnSync('git', ['show-ref', '--verify', '--quiet', ref], { cwd: ROOT, stdio: 'ignore' });
  if (result.error) throw result.error;
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(`не удалось проверить Git ref ${ref}`);
}

function knownRemoteProblem() {
  const branch = git(['branch', '--show-current']).trim();
  if (!branch) return null; // detached checkout: не угадываем, к какой ветке его привязать
  const remoteRef = `refs/remotes/origin/${branch}`;
  if (!refExists(remoteRef)) return null; // offline: сравниваем только известный локальный remote ref

  let counts;
  try {
    counts = git(['rev-list', '--left-right', '--count', `HEAD...${remoteRef}`]).trim().split(/\s+/).map(Number);
  } catch {
    return `не удалось сравнить HEAD с origin/${branch}; отказываюсь строить inventory по непроверенному snapshot`;
  }
  const [ahead, behind] = counts;
  if (behind > 0 && ahead === 0) {
    return `HEAD отстаёт от origin/${branch} на ${behind} commit(s); inventory из старого HEAD/index не строится. Сначала безопасно синхронизируйте ветку и разберите локальные изменения`;
  }
  if (behind > 0 && ahead > 0) {
    return `HEAD и origin/${branch} разошлись (ahead=${ahead}, behind=${behind}); требуется ручное безопасное разрешение, baseline не менялся`;
  }
  return null;
}

function repositoryProblems({ checkingBaseline = false, writing = false } = {}) {
  const problems = [];
  const head = headCommit();
  if (!head) {
    problems.push('HEAD отсутствует: сначала создайте committed source snapshot; baseline по одному index не генерируется');
    return problems;
  }

  // Все tracked-файлы проверяются, а не только frontend/game: inventory не
  // должен служить способом замаскировать любой staged/unstaged/untracked diff.
  const staged = nulList(['diff', '--cached', '--name-only', '--no-renames', '-z', 'HEAD', '--']);
  const unstaged = nulList(['diff', '--name-only', '--no-renames', '-z', '--']);
  const untracked = nulList(['ls-files', '--others', '--exclude-standard', '-z', '--']);
  if (staged.length) {
    problems.push(`index не совпадает с HEAD: ${staged.length} staged path(s) (${staged.slice(0, PREVIEW_LIMIT).join(', ')})`);
  }
  if (unstaged.length) {
    problems.push(`worktree не совпадает с index: ${unstaged.length} unstaged path(s) (${unstaged.slice(0, PREVIEW_LIMIT).join(', ')})`);
  }
  if (untracked.length) {
    problems.push(`есть ${untracked.length} untracked path(s), которые нельзя молча исключить из inventory (${untracked.slice(0, PREVIEW_LIMIT).join(', ')})`);
  }

  const remoteProblem = knownRemoteProblem();
  if (remoteProblem) problems.push(remoteProblem);

  const inHead = pathExistsInHead(OUT);
  const existsOnDisk = fs.existsSync(path.join(ROOT, OUT));
  if (checkingBaseline && !inHead) {
    problems.push(`${OUT} отсутствует в committed HEAD; --check не создаёт и не перегенерирует baseline`);
  }
  if (checkingBaseline && !existsOnDisk) {
    problems.push(`${OUT} отсутствует в worktree`);
  }
  if (writing && existsOnDisk && !inHead) {
    problems.push(`${OUT} существует, но не tracked в HEAD; --write отказывается перезаписать untracked-файл`);
  }
  return problems;
}

function pathExistsInHead(relativePath) {
  const files = nulList(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', relativePath]);
  return files.includes(relativePath);
}

/** Файлы committed HEAD; index/worktree обязаны быть проверены до вызова. */
export function trackedFiles() {
  return git(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...TARGETS], { binary: true })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

/** Сравнение UTF-8 path bytes, не localeCompare и не locale-dependent. */
export function sortBytewise(files) {
  return [...files].sort((a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')));
}

export function buildInventory() {
  const files = sortBytewise(trackedFiles());
  const body = `${files.join('\n')}\n`;
  const digest = crypto.createHash('sha256').update(body).digest('hex');
  const counts = TARGETS.map((t) => `${t}: ${files.filter((f) => f === t || f.startsWith(`${t}/`)).length}`);
  const text = [
    '# Инвентарь клиентских файлов (шаг A пункта 12)',
    '',
    'Только committed tracked-файлы из `git ls-tree -r HEAD -- frontend game`.',
    'Перед проверкой подтверждается чистое состояние HEAD/index/worktree; известное',
    'отставание текущей ветки от `origin/<branch>` блокирует сборку inventory.',
    'Сортировка по UTF-8 bytes; абсолютных путей, node_modules и build/cache-каталогов нет.',
    '',
    'Пересобрать явно: `node scripts/client-inventory.mjs --write`; проверить: `--check`.',
    '`--check` ничего не переписывает; после `--write` baseline нужно отдельно просмотреть и закоммитить.',
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
  const problems = repositoryProblems({ checkingBaseline: true });
  if (problems.length) return problems;

  const saved = fs.readFileSync(path.join(ROOT, OUT), 'utf8');
  const { text, files } = buildInventory();
  if (saved !== text) problems.push(`${OUT} устарел для committed HEAD: обновление требует явного --write и отдельного commit`);
  for (const file of files) {
    for (const { re, what } of FORBIDDEN) {
      if (re.test(file)) problems.push(`в inventory попал ${what}: ${file}`);
    }
  }
  if (files.length === 0) problems.push('HEAD не содержит tracked-файлов frontend/game');
  return problems;
}

function main() {
  if (argv.includes('--write')) {
    const problems = repositoryProblems({ writing: true });
    if (problems.length) {
      console.error(`client-inventory: ${problems.length} consistency problem(s); baseline не менялся:`);
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exitCode = 1;
      return;
    }
    const { text, files } = buildInventory();
    fs.mkdirSync(path.dirname(path.join(ROOT, OUT)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, OUT), text);
    console.log(`инвентарь клиентов записан: ${files.length} committed tracked-файлов; теперь проверьте diff, добавьте и закоммитьте baseline`);
    return;
  }
  if (argv.includes('--check')) {
    const problems = checkInventory();
    if (problems.length) {
      console.error(`client-inventory: ${problems.length} problem(s):`);
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exit(1);
    }
    const { files } = buildInventory();
    console.log(`client-inventory: ${files.length} committed tracked-файлов; HEAD/index/worktree согласованы`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
