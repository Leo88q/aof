#!/usr/bin/env node
/**
 * Экономические разрывы ресурсов — отдельный отчёт (решение владельца от 2026-10-01, п. 5).
 *
 * Разрыв — это НЕ «мёртвый код» и НЕ повод понизить статус ресурса: ресурс остаётся
 * `active-player`, если он бывает балансом игрока, а отсутствие источника/стока живёт
 * отдельной осью `economy_issue`. Отчёт нужен, чтобы у каждого разрыва был видимый
 * pre-deployment product blocker с точными путями в коде, и чтобы его нельзя было
 * «закрыть» наличием generic admin-минта (технически выпустить можно любой kind, но
 * это проектная выдача, а не путь получения игроком).
 *
 *   node scripts/resource-economy-gaps.mjs --write   пересобрать docs/RESOURCE_ECONOMY_GAPS.{json,md}
 *   node scripts/resource-economy-gaps.mjs --check   гейт
 *   --root <dir>                                     считать репозиторий из другого каталога (тесты)
 *
 * Источник данных — только docs/RESOURCE_EVIDENCE.json (он сам гейтится
 * tests/readiness/resource-evidence.test.cjs). Никаких ручных списков разрывов здесь нет.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const rootIndex = argv.indexOf('--root');
const ROOT = rootIndex >= 0 ? path.resolve(argv[rootIndex + 1]) : path.resolve(HERE, '..');
const EVIDENCE = 'docs/RESOURCE_EVIDENCE.json';
const OUT_JSON = 'docs/RESOURCE_ECONOMY_GAPS.json';
const OUT_MD = 'docs/RESOURCE_ECONOMY_GAPS.md';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const short = (id) => id.replace(/^aof-core\/src\/(instructions\/)?/, '').replace(/\/handler$/, '');

/** Разрыв по ресурсу: источники, стоки и что именно отсутствует. */
export function gapFor(resource) {
  const f = resource.flow.flags;
  const sources = [
    ...resource.flow.playerSource.map(short),
    ...resource.flow.miningOutput.map(short),
    ...resource.flow.craftOutput.map((r) => `${r} (выход)`),
  ];
  const sinks = [
    ...resource.flow.playerSink.map(short),
    ...resource.flow.projectSink.map((s) => `${short(s)} (проектный)`),
    ...resource.flow.craftInput.map((r) => `${r} (вход)`),
  ];
  return {
    kind: resource.kind,
    display: resource.display,
    status: resource.status,
    playerHeld: f.player_held,
    sources: [...new Set(sources)].sort(),
    sinks: [...new Set(sinks)].sort(),
    recipes: [...resource.flow.craftInput.map((r) => `${r}: вход`), ...resource.flow.craftOutput.map((r) => `${r}: выход`)].sort(),
    genericPaths: [
      ...(f.has_admin_source ? resource.flow.adminMint.map(short) : []),
      ...(f.generic_claim_output ? resource.flow.playerClaim.map(short) : []),
    ],
    // Короткая форма для таблицы: по одному разу на файл, с указанием вида пути.
    genericPathsShort: [
      ...(f.has_admin_source ? [`admin: ${[...new Set(resource.flow.adminMint.map((e) => short(e).split('#')[0]))].sort().join(', ')}`] : []),
      ...(f.generic_claim_output ? [`claim: ${[...new Set(resource.flow.playerClaim.map((e) => short(e).split('#')[0]))].sort().join(', ')}`] : []),
    ],
    gap: resource.economyIssue ?? null,
    blocker: resource.economyIssue
      ? (resource.economyIssue === 'missing_source'
        ? 'pre-deployment product blocker: ресурс тратится игроком, но получить его игрок не может'
        : 'pre-deployment product blocker: ресурс выпускается, но нигде не потребляется')
      : null,
  };
}

export function buildGaps() {
  if (!exists(EVIDENCE)) throw new Error(`нет ${EVIDENCE}: node scripts/resource-usage.mjs --write`);
  const evidence = JSON.parse(read(EVIDENCE));
  const rows = evidence.resources.map(gapFor);
  return {
    schemaVersion: 1,
    note: 'Экономические разрывы (economy_issue) — отдельная ось от статуса ресурса; '
      + 'pre-deployment product blockers, а не основание менять классификацию. '
      + 'Наличие generic admin-минта/claim не закрывает missing_player_source.',
    renameBlocking: false,
    blockers: {
      missingSource: rows.filter((r) => r.gap === 'missing_source').map((r) => r.kind),
      missingSink: rows.filter((r) => r.gap === 'missing_sink').map((r) => r.kind),
    },
    recipeView: evidence.productGaps,
    resources: rows,
  };
}

export function toMarkdown(gaps) {
  const lines = [
    '# Экономические разрывы ресурсов (pre-deployment product blockers)',
    '',
    'Отчёт собирается `node scripts/resource-economy-gaps.mjs --write` и проверяется `--check`',
    '(`tests/readiness/resource-economy-gaps.test.cjs`). Источник — `docs/RESOURCE_EVIDENCE.json`;',
    'ручных списков разрывов нет.',
    '',
    '**Статус ресурса и экономическая связность — разные оси.** Ресурс остаётся `active-player`,',
    'если он бывает балансом игрока (в ATA игрока, сжигается из него, вход/выход рецепта), даже',
    'если источника у него сейчас нет. `economy_issue` (`missing_source`/`missing_sink`) — это',
    'дефект экономики, а не повод называть ресурс internal или мёртвым.',
    '',
    '**Разрывы не блокируют чистое переименование identifiers** (пункты 5 и 8 решения владельца):',
    'переименование не меняет ни рецепты, ни источники, ни стоки. Они остаются pre-deployment',
    'product blockers до отдельного решения владельца об экономике.',
    '',
    `* без доказанного player source (${gaps.blockers.missingSource.length}): ${gaps.blockers.missingSource.join(', ') || '—'};`,
    `* без стока (${gaps.blockers.missingSink.length}): ${gaps.blockers.missingSink.join(', ') || '—'}.`,
    '',
    '## Таблица по ресурсам',
    '',
    '| Resource | Player-held | Sources | Sinks | Recipes | Generic paths | Gap |',
    '|---|---:|---|---|---|---|---|',
  ];
  for (const r of gaps.resources) {
    lines.push(`| ${r.kind} | ${r.playerHeld ? '✅' : '—'} | ${r.sources.join(', ') || '—'} | `
      + `${r.sinks.join(', ') || '—'} | ${r.recipes.join(', ') || '—'} | ${r.genericPathsShort.join('; ') || '—'} | `
      + `${r.gap ?? '—'} |`);
  }
  lines.push('', '## Блокеры деплоя', '');
  for (const [issue, kinds] of [['missing_source', gaps.blockers.missingSource], ['missing_sink', gaps.blockers.missingSink]]) {
    lines.push(`### ${issue} (${kinds.length})`, '');
    for (const kind of kinds) {
      const row = gaps.resources.find((r) => r.kind === kind);
      lines.push(`* **${kind}** — ${row.blocker}; источники: ${row.sources.join(', ') || 'нет'}; `
        + `стоки: ${row.sinks.join(', ') || 'нет'}; generic-пути: ${row.genericPaths.join(', ') || '—'}.`);
    }
    lines.push('');
  }
  lines.push('Изменение рецептов, источников и стоков — только по отдельному решению владельца (п. 8).', '');
  return `${lines.join('\n')}\n`;
}

export function check(gaps) {
  const errors = [];
  if (!exists(OUT_JSON)) errors.push(`нет ${OUT_JSON}: node scripts/resource-economy-gaps.mjs --write`);
  if (!exists(OUT_MD)) errors.push(`нет ${OUT_MD}: node scripts/resource-economy-gaps.mjs --write`);
  if (exists(OUT_JSON)) {
    const committed = JSON.parse(read(OUT_JSON));
    if (JSON.stringify(committed) !== JSON.stringify(gaps)) {
      errors.push(`${OUT_JSON} устарел: node scripts/resource-economy-gaps.mjs --write`);
    }
  }
  if (exists(OUT_MD) && read(OUT_MD) !== toMarkdown(gaps)) {
    errors.push(`${OUT_MD} устарел: node scripts/resource-economy-gaps.mjs --write`);
  }
  // Каждый разрыв обязан быть подтверждён evidence (нельзя закрыть generic-путём).
  for (const r of gaps.resources) {
    if (r.gap && !r.blocker) errors.push(`${r.kind}: разрыв без пометки pre-deployment blocker`);
    if (r.gap === 'missing_source' && (r.sources.length > 0)) {
      errors.push(`${r.kind}: missing_source, но источники не пусты (${r.sources.join(', ')})`);
    }
    if (r.gap === 'missing_sink' && (r.sinks.length > 0)) {
      errors.push(`${r.kind}: missing_sink, но стоки не пусты (${r.sinks.join(', ')})`);
    }
    if (r.gap && r.genericPaths.length === 0) {
      errors.push(`${r.kind}: разрыв не связан с generic-путями — evidence неполон`);
    }
  }
  return errors;
}

function main() {
  const gaps = buildGaps();
  if (argv.includes('--write')) {
    fs.writeFileSync(path.join(ROOT, OUT_JSON), `${JSON.stringify(gaps, null, 2)}\n`);
    fs.writeFileSync(path.join(ROOT, OUT_MD), toMarkdown(gaps));
    console.log(`экономические разрывы записаны: без источника ${gaps.blockers.missingSource.length}, без стока ${gaps.blockers.missingSink.length}`);
    return;
  }
  if (argv.includes('--check')) {
    const errors = check(gaps);
    if (errors.length) { console.error(`resource-economy-gaps: ${errors.length} проблем(а):`); for (const e of errors) console.error(`  - ${e}`); process.exit(1); }
    console.log(`resource-economy-gaps: разрывов без источника ${gaps.blockers.missingSource.length}, без стока ${gaps.blockers.missingSink.length} (pre-deployment blockers, rename не блокируют)`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
