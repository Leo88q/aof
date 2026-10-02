#!/usr/bin/env node
/**
 * Step C cross-layer drift gate.
 *
 * Counts active legacy identifiers across product code, generated clients, tests,
 * scripts, and active documentation. Historical mapping descriptors, frozen layout
 * baselines, and immutable database migration snapshots are excluded only through
 * the explicit EXCLUSIONS table below; there is no keep/allowlist for active code.
 *
 *   node scripts/resource-drift.mjs --write  refresh docs/RESOURCE_DRIFT.md
 *   node scripts/resource-drift.mjs --check  require zero active drift and fresh report
 *   --root <dir>                             test against another checkout
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { STEP_C_RENAMES, instructionDiscriminator } from './layout-baseline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ARGV = process.argv.slice(2);
const ROOT_INDEX = ARGV.indexOf('--root');
const ROOT = ROOT_INDEX >= 0 ? path.resolve(ARGV[ROOT_INDEX + 1]) : path.resolve(HERE, '..');
const WRITE = ARGV.includes('--write');
const CHECK = ARGV.includes('--check');
const REPORT = 'docs/RESOURCE_DRIFT.md';
const EXTENSIONS = new Set([
  '.cjs', '.cs', '.css', '.gd', '.gdshader', '.graphql', '.html', '.js', '.json', '.md', '.mdx',
  '.mjs', '.prisma', '.py', '.rs', '.scss', '.sh', '.sql', '.toml', '.ts', '.tsx', '.tscn',
  '.txt', '.xml', '.yaml', '.yml',
]);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'target', 'dist', 'build', 'coverage', '.next', '.cache']);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const pascal = (s) => s.split(/[_-]/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join('');
const camel = (s) => { const p = pascal(s); return p ? p[0].toLowerCase() + p.slice(1) : p; };
const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[-\s]+/g, '_').toLowerCase();
const upperSnake = (s) => snake(s).toUpperCase();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Explicit, reasoned exclusions. Each entry is a mapping/test descriptor, a generated
 * historical report, or an immutable migration snapshot. Runtime/product source is
 * intentionally not eligible for exclusion.
 */
const EXCLUSIONS = {
  'REBRAND_MAP.md': 'explicit pre-deployment old-to-canonical mapping record',
  'docs/RESOURCE_MANIFEST.json': 'canonical catalog descriptor retains historical aliases for transition auditing',
  'docs/RESOURCE_MANIFEST.md': 'generated old-to-canonical mapping descriptor',
  'docs/RESOURCE_RENAME_PLAN.md': 'generated historical identifier mapping and scan plan',
  'docs/RESOURCE_DRIFT.md': 'generated drift report includes required old-to-new mapping tables',
  'docs/LAYOUT_BASELINE.json': 'frozen pre-rename enum/account layout and discriminator baseline',
  'scripts/layout-baseline.mjs': 'explicit rename map and frozen layout comparison logic',
  'scripts/resource-drift.mjs': 'drift detector contains its own regex tokens and rename-map parser; it is tooling, not product source',
  'scripts/resource-manifest.mjs': 'resource catalog builder with historical field/IDL aliases',
  'scripts/resource-rename-plan.mjs': 'legacy identifier detector and explicit rename plan',
  'scripts/resource-usage.mjs': 'resource evidence classifier whose input catalog records historical aliases',
  'tests/readiness/layout-baseline.test.cjs': 'tests the explicit before/after rename mapping and historical layout baseline',
  'tests/readiness/resource-manifest.test.cjs': 'asserts the historical-to-canonical catalog mappings',
  'tests/readiness/resource-rename-plan.test.cjs': 'negative detector fixtures intentionally contain retired identifiers',
  'aof_backend/prisma/migrations/0_init/migration.sql': 'immutable initial database schema; retired columns are renamed by the following migration',
  'aof_backend/prisma/migrations/202610010001_mind_economy_metrics/migration.sql': 'explicit data-preserving historical column rename; old column names are required migration inputs',
  'aof_backend/prisma/postgres/migrations/0_baseline/migration.sql': 'generated historical PostgreSQL baseline; old column names are transformed by its appended migration history',
};

/** Historical audits may be excluded only when visibly marked as historical. */
const HISTORICAL_DOCS = {
  'AUDIT_AND_CHANGES.md': 'pre-NeuroForge audit and implementation log',
  'AUDIT_FULL.md': 'pre-NeuroForge audit snapshot',
  'AUDIT_FULL_RU.md': 'pre-NeuroForge Russian audit snapshot',
  'AUDIT_REPORT_2026-09-05.md': 'dated pre-canonical security and economy audit',
  'AUDIT_FULL_2026-09-21.md': 'dated pre-canonical full audit',
  'ANALYSIS.md': 'superseded 2026-08-29 audit',
  'RELEASE_READINESS_AUDIT_2026-09-15.md': 'dated pre-canonical release audit',
  'resp_idl.md': 'raw pre-canonical IDL dump',
  'idl_raw.json': 'raw pre-canonical IDL snapshot; no active tooling consumes this file',
  'audit-visual-2026-09-25.md': 'dated pre-canonical visual audit',
  'REMEDIATION_STATUS.md': 'superseded audit remediation snapshot',
  'AUDIT_2026-09-20.md': 'dated pre-canonical engineering audit',
  'AOF_EXPANSION_FULL_SOURCE.md': 'frozen pre-canonical source dump',
  'SECURITY_CHECKLIST_REVIEW_2026-09-25.md': 'dated pre-canonical security review',
  'SECURITY_CHECKLIST_ATTACKS_2026-09-28.md': 'dated security attack review',
  'SECURITY_CHECKLIST_GAMES_2026-09-26.md': 'dated security game review',
  'FINAL_REPORT_V3.md': 'superseded Watchtower v3 audit report',
  'PROMPT_AUDIT_FULL_STACK_V2.md': 'superseded audit prompt archive',
  'progress.md': 'older feature-progress snapshot superseded by the current Step C report',
  'docs/REBRAND_STATUS_2026-09-24.md': 'dated pre-Step-C rebrand status snapshot',
  'docs/UI_STYLE_AUDIT_2026-09-28.md': 'dated UI style audit snapshot',
  'docs/LAB_UI_AUDIT_2026-09-28.md': 'dated lab UI audit snapshot',
  'docs/CURRENCY_TOKENOMICS_AUDIT_2026-10-01.md': 'pre-canonical tokenomics audit snapshot; superseded by current code and reports',
  'docs/TEST_DEPLOY_READINESS_2026-09-28.md': 'dated pre-Step-C deployment readiness snapshot',
  'docs/SITE_STAND_ART_2026-09-30.md': 'dated site-art implementation note',
  'docs/MAC_DEVNET_2026-09-30.md': 'read-only historical machine/devnet validation record; deployment notes are not authorization',
  'docs/TRANSLATION_FINDINGS.md': 'localization audit findings snapshot',
  'docs/I18N_STATUS.md': 'dated localization status snapshot',
  'docs/MINING_DEVNET_AND_MONETIZATION_PLAN.md': 'superseded devnet-first plan snapshot',
  'docs/UNBLOCK_PLAN_2026-09-30.md': 'dated pre-canonical blocker snapshot',
  'docs/HISTORICAL_MIND_DEVNET_SETUP.md': 'pre-canonical read-only devnet setup note',
  'reports/AOF_FINDINGS.md': 'external baseline findings review snapshot',
  'reports/aof-audit.json': 'external audit report snapshot',
  'frontend/phase1_context.txt': 'frozen design/config context snapshot, not imported by the frontend',
};

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
      .split(/\r?\n/).filter(Boolean).map((p) => p.replaceAll('\\', '/')).sort();
  } catch {
    const out = [];
    const walk = (dir) => {
      for (const ent of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (SKIP_DIRS.has(ent.name)) continue;
        const rel = path.posix.join(dir, ent.name);
        if (ent.isDirectory()) walk(rel);
        else out.push(rel);
      }
    };
    walk('');
    return out.sort();
  }
}

function isEligibleText(rel) {
  return EXTENSIONS.has(path.extname(rel).toLowerCase()) && exists(rel);
}

function resourceCatalog() {
  const manifest = JSON.parse(read('docs/RESOURCE_MANIFEST.json'));
  if (!Array.isArray(manifest.resources)) throw new Error('RESOURCE_MANIFEST.json has no resources array');
  return manifest.resources;
}

function addToken(tokenMap, token, category, canonical) {
  if (!token) return;
  if (!tokenMap.has(token)) tokenMap.set(token, { token, categories: new Set(), canonical: new Set() });
  const item = tokenMap.get(token);
  item.categories.add(category);
  if (canonical) item.canonical.add(canonical);
}

function identifierForms(raw) {
  const values = new Set([raw, camel(raw), pascal(raw), snake(raw), upperSnake(raw)]);
  return [...values].filter(Boolean);
}

function legacyCatalog(resources) {
  const tokens = new Map();
  const canonicalResourceMap = [];
  for (const item of resources) {
    const canonical = item.apiName;
    const aliases = new Set([
      ...(item.legacyAliases ?? []),
      item.historicalField,
      item.historicalIdlName,
    ].filter(Boolean));
    for (const alias of aliases) {
      for (const form of identifierForms(alias)) addToken(tokens, form, 'resource', canonical);
    }
    for (const alias of item.legacyAliases ?? []) canonicalResourceMap.push({ old: alias, canonical, kind: item.kind });
    if (item.historicalField) canonicalResourceMap.push({ old: item.historicalField, canonical: item.mintSource, kind: item.kind });
    if (item.historicalIdlName) canonicalResourceMap.push({ old: item.historicalIdlName, canonical: item.kind, kind: item.kind });
  }
  for (const [oldName, newName] of Object.entries(STEP_C_RENAMES.instructions)) {
    for (const form of identifierForms(oldName)) addToken(tokens, form, 'instruction', newName);
  }
  for (const [oldName, newName] of Object.entries(STEP_C_RENAMES.helpers ?? {})) {
    for (const form of identifierForms(oldName)) addToken(tokens, form, 'rust-local-helper', newName);
  }
  for (const [oldName, newName] of Object.entries(STEP_C_RENAMES.accounts)) {
    for (const form of identifierForms(oldName)) addToken(tokens, form, 'account', newName);
  }
  for (const [account, fields] of Object.entries(STEP_C_RENAMES.accountFields)) {
    for (const [oldName, newName] of Object.entries(fields)) {
      for (const form of identifierForms(oldName)) addToken(tokens, form, 'account-field', `${account}.${newName}`);
    }
  }
  for (const [oldName, newName] of Object.entries(STEP_C_RENAMES.pdaSeeds ?? {})) {
    addToken(tokens, oldName, 'pda-seed-bytes', newName);
  }
  for (const [oldName, newName] of Object.entries(STEP_C_RENAMES.errorVariants)) {
    for (const form of identifierForms(oldName)) addToken(tokens, form, 'error-variant', newName);
  }
  return { tokens, canonicalResourceMap };
}

function isAnchorSeedsMechanism(token, rel, line) {
  if (!['seeds', 'Seeds', 'SEEDS'].includes(token)) return false;
  // Anchor's `seeds = [...]`, local PDA signer seed buffers and generic PDA
  // metadata are not the retired resource identifier. Do not treat a resource
  // field assignment such as `material_mints.seeds = neuron` as Anchor syntax.
  const generatedIdl = rel.startsWith('aof_backend/src/idl/');
  const payerMatrixSeedMetadata = rel === 'docs/PAYER_MATRIX.json' && /"seeds"\s*:/.test(line);
  const externalPdaMetadata = (rel.startsWith('docs/vendor/') || rel === 'watchtower/integration-manifest.json')
    && /"seeds"\s*:\s*\[/.test(line);
  const anchor = /(?<![A-Za-z0-9_.])seeds\s*=\s*\[/.test(line)
    || /(?:let|const|var)\s+seeds\b/.test(line)
    || /\bseeds\s*:\s*(?:\(|(?:Buffer|Uint8Array))/.test(line)
    || /findProgramAddressSync|createProgramAddressSync|signer_seeds|&\s*\[\s*seeds\b|\bseeds\.(?:push|extend|concat)|\bfind\(seeds\b/.test(line)
    || /["']seeds["']\s*:\s*seeds\b/.test(line)
    || /\b(?:studioPda|pda)\.seeds\b/i.test(line)
    || (generatedIdl && /(?:["']seeds["']|\bseeds)\s*:\s*\[/.test(line))
    || payerMatrixSeedMetadata
    || externalPdaMetadata;
  if (anchor) return true;
  const pdaContext = /\bPDA\b|findProgramAddress|createProgramAddress|signer_seeds/i.test(line);
  const directResourceIdentifier = /::\s*Seeds\b|\bResourceKind\s*::\s*Seeds\b|\.(?:seeds)\b|\bseeds\s*:\s*(?:Pubkey|u8|u64|["'{])|["']seeds["']\s*(?:[:,=])/.test(line);
  const contextualResourceIdentifier = /(?:resource|mint|balance|inventory|cost|kind|token|field|variant|material_mints)[^\n]{0,48}\bseeds\b/i.test(line);
  if (directResourceIdentifier || (contextualResourceIdentifier && !pdaContext)) return false;
  return true;
}

function isNonResourceActionAlias(token, line) {
  // `water` is still the established neighbor-action API value in these route
  // branches; it is not a resource key, balance, mint, recipe, or PDA field.
  if (token.toLowerCase() !== 'water') return false;
  return /\baction\s*===\s*["']water["']/.test(line)
    || /!\s*\[\s*["']water["'][^\]]*\]\.includes\(action\)/.test(line);
}

function firstLineIsHistorical(text) {
  return text.split(/\r?\n/).slice(0, 5).some((line) => /\bHISTORICAL\b|\bИСТОРИЧЕСК(ИЙ|АЯ|ОЕ)\b/i.test(line));
}

function activeFiles(files) {
  const invalidExclusions = [];
  for (const [rel] of Object.entries(EXCLUSIONS)) {
    if (!exists(rel)) invalidExclusions.push(`declared exclusion is missing: ${rel}`);
  }
  const selected = [];
  for (const rel of files) {
    if (!isEligibleText(rel)) continue;
    if (rel in EXCLUSIONS) continue;
    if (rel in HISTORICAL_DOCS) {
      if (!firstLineIsHistorical(read(rel))) invalidExclusions.push(`historical audit lacks explicit marker: ${rel}`);
      continue;
    }
    selected.push(rel);
  }
  return { selected, invalidExclusions };
}

function scanFiles(files, catalog) {
  const hits = [];
  const entries = [...catalog.tokens.values()].sort((a, b) => b.token.length - a.token.length || a.token.localeCompare(b.token));
  const byToken = new Map(entries.map((entry) => [entry.token, entry]));
  const alternatives = entries.map((entry) => esc(entry.token)).join('|');
  const re = new RegExp(`(?<![A-Za-z0-9_])(${alternatives})(?![A-Za-z0-9_])`, 'g');
  for (const rel of files) {
    const lines = read(rel).split(/\r?\n/);
    lines.forEach((line, ix) => {
      re.lastIndex = 0;
      for (const match of line.matchAll(re)) {
        const entry = byToken.get(match[1]);
        if (isAnchorSeedsMechanism(entry.token, rel, line)) continue;
        if (isNonResourceActionAlias(entry.token, line)) continue;
        hits.push({
          file: rel,
          line: ix + 1,
          token: entry.token,
          categories: [...entry.categories].sort(),
          canonical: [...entry.canonical].sort(),
          text: line.trim().slice(0, 220),
        });
      }
    });
  }
  return hits;
}

function parseRustEnum(source) {
  const body = /pub enum ResourceKind\s*\{([\s\S]*?)\n\}/.exec(source)?.[1] ?? '';
  return [...body.matchAll(/^\s*([A-Z][A-Za-z0-9_]*)\s*,/gm)].map((m) => m[1]);
}

function parseIdlEnum(idl) {
  const type = (idl.types ?? []).find((item) => item.name === 'ResourceKind');
  return type?.type?.variants?.map((item) => item.name) ?? [];
}

function duplicateValues(items) {
  const seen = new Set();
  const duplicate = new Set();
  for (const item of items) { if (seen.has(item)) duplicate.add(item); seen.add(item); }
  return [...duplicate];
}

function entriesInObject(source, declaration, pattern) {
  const body = declaration.exec(source)?.[1] ?? '';
  return [...body.matchAll(pattern)].map((m) => ({ key: m[1], value: m[2] }));
}

function deriveIntegrity(resources) {
  const rust = read('aof-core/src/lib.rs');
  const state = read('aof-core/src/state.rs');
  const constants = read('aof-core/src/constants.rs');
  const idl = JSON.parse(read('aof_backend/src/idl/aof_core.json'));
  const backendPda = read('aof_backend/src/lib/pda.ts');
  const backendResources = read('aof_backend/src/routes/resources.ts');
  const backendAdmin = read('aof_backend/src/routes/admin.ts');
  const frontendAssets = read('frontend/src/lib/visualAssets.ts');
  const rustKinds = parseRustEnum(rust);
  const idlKinds = parseIdlEnum(idl);
  const expectedKinds = resources.map((r) => r.kind);
  const failures = [];
  const equalOrder = (label, actual, expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(`${label} mismatch (expected ${expected.length}: ${expected.join(', ')}, got ${actual.length}: ${actual.join(', ')})`);
  };
  const addSetCheck = (label, actual, expected) => {
    const missing = expected.filter((item) => !actual.includes(item));
    const extra = actual.filter((item) => !expected.includes(item));
    const duplicate = duplicateValues(actual);
    if (missing.length || extra.length || duplicate.length) failures.push(`${label}: missing=[${missing.join(', ')}], extra=[${extra.join(', ')}], duplicate=[${duplicate.join(', ')}]`);
  };

  equalOrder('Rust ResourceKind → manifest', rustKinds, expectedKinds);
  equalOrder('committed IDL ResourceKind → Rust', idlKinds, rustKinds);
  if (duplicateValues(rustKinds).length) failures.push(`Rust ResourceKind has duplicate variants: ${duplicateValues(rustKinds).join(', ')}`);
  if (duplicateValues(idlKinds).length) failures.push(`IDL ResourceKind has duplicate variants: ${duplicateValues(idlKinds).join(', ')}`);

  const mintBlock = /pub fn mint_for_kind\([\s\S]*?\n\}/.exec(state)?.[0] ?? '';
  const mintArms = [...mintBlock.matchAll(/ResourceKind::([A-Za-z0-9_]+)\s*=>\s*(config|material_mints)\.([a-z0-9_]+)/g)]
    .map((m) => ({ kind: m[1], source: `${m[2]}.${m[3]}` }));
  const mintKinds = mintArms.map((arm) => arm.kind);
  addSetCheck('Rust mint_for_kind match', mintKinds, rustKinds);
  const expectedMintSource = new Map(resources.map((r) => [r.kind, r.mintSource]));
  for (const arm of mintArms) if (expectedMintSource.get(arm.kind) !== arm.source) failures.push(`mint_for_kind ${arm.kind} maps to ${arm.source}, expected ${expectedMintSource.get(arm.kind)}`);
  const rustMintFields = new Set([
    ...[...read('aof-core/src/state.rs').matchAll(/pub struct Config\s*\{([\s\S]*?)\n\}/g)].flatMap((m) => [...m[1].matchAll(/pub\s+([a-z0-9_]+)\s*:/g)].map((x) => `config.${x[1]}`)),
    ...[...read('aof-core/src/state.rs').matchAll(/pub struct MaterialMints\s*\{([\s\S]*?)\n\}/g)].flatMap((m) => [...m[1].matchAll(/pub\s+([a-z0-9_]+)\s*:/g)].map((x) => `material_mints.${x[1]}`)),
  ]);
  for (const arm of mintArms) if (!rustMintFields.has(arm.source)) failures.push(`mint_for_kind ${arm.kind} references missing field ${arm.source}`);

  const declaredCount = Number(/pub const RESOURCE_KIND_COUNT:\s*usize\s*=\s*(\d+)/.exec(constants)?.[1] ?? NaN);
  const supplyArray = /pub max_supply:\s*\[u64;\s*RESOURCE_KIND_COUNT\s*\]/.test(state);
  const supplyIndex = /material_mints\.max_supply\[kind as usize\]/.test(state);
  if (declaredCount !== rustKinds.length) failures.push(`RESOURCE_KIND_COUNT=${declaredCount}, enum has ${rustKinds.length}`);
  if (!supplyArray) failures.push('MaterialMints::max_supply is not sized by RESOURCE_KIND_COUNT');
  if (!supplyIndex) failures.push('check_supply_cap does not index max_supply by ResourceKind as usize');

  const backendOrderBlock = /RESOURCE_KIND_ORDER\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(backendPda)?.[1] ?? '';
  const backendOrder = [...backendOrderBlock.matchAll(/["']([A-Za-z0-9]+)["']/g)].map((m) => m[1]);
  const expectedApiNames = resources.map((r) => r.apiName);
  equalOrder('backend RESOURCE_KIND_ORDER → manifest', backendOrder, expectedApiNames);
  const backendKindMap = entriesInObject(backendResources, /const kindMap:\s*Record<string, any>\s*=\s*\{([\s\S]*?)\n\};/, /^\s*([A-Za-z0-9_]+):\s*\{\s*([A-Za-z0-9_]+):\s*\{\s*\}\s*\}/gm);
  addSetCheck('backend resource kindMap', backendKindMap.map((x) => x.key), expectedApiNames);
  for (const entry of backendKindMap) if (entry.key !== entry.value) failures.push(`backend kindMap ${entry.key} constructs IDL variant ${entry.value}`);
  const backendAdminMap = entriesInObject(backendAdmin, /const RESOURCE_KIND_BY_NAME:[^{]+\{([\s\S]*?)\n\};/, /^\s*([A-Z][A-Z0-9_]*):\s*\{\s*([A-Za-z0-9_]+):\s*\{\s*\}\s*\}/gm);
  const expectedUpperKeys = resources.map((r) => upperSnake(r.kind));
  addSetCheck('backend admin RESOURCE_KIND_BY_NAME', backendAdminMap.map((x) => x.key), expectedUpperKeys);
  for (const entry of backendAdminMap) {
    const expectedApi = resources.find((r) => upperSnake(r.kind) === entry.key)?.apiName;
    if (entry.value !== expectedApi) failures.push(`backend admin map ${entry.key} constructs ${entry.value}, expected ${expectedApi}`);
  }

  const playableBlock = /export const PLAYABLE_RESOURCES:[\s\S]*?=\s*\[([\s\S]*?)\n\];/.exec(frontendAssets)?.[1] ?? '';
  const specialBlock = /export const SPECIAL_RESOURCES:[\s\S]*?=\s*\[([\s\S]*?)\n\];/.exec(frontendAssets)?.[1] ?? '';
  const frontendKeys = [playableBlock, specialBlock].join('\n').matchAll(/\bid:\s*["']([A-Za-z0-9]+)["']/g);
  const frontendIds = [...frontendKeys].map((m) => m[1]);
  addSetCheck('frontend visual resource keys', frontendIds, expectedApiNames);

  const counts = {
    rust_resource_kinds: rustKinds.length,
    rust_mint_for_kind_arms: mintArms.length,
    supply_cap_indexes: declaredCount,
    idl_resource_variants: idlKinds.length,
    backend_resource_keys: backendOrder.length,
    backend_resource_route_keys: backendKindMap.length,
    backend_admin_resource_keys: backendAdminMap.length,
    frontend_resource_keys: frontendIds.length,
  };
  return { failures, counts, rustKinds, idlKinds, mintArms, backendOrder, backendKindMap, backendAdminMap, frontendIds };
}

function prefixMatch(rel, prefixes) {
  return prefixes.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`));
}

function eligibleForArea(rel) { return isEligibleText(rel) && !(rel in EXCLUSIONS) && !(rel in HISTORICAL_DOCS); }

function filesFor(files, prefixes, extra = () => false) {
  return files.filter((rel) => eligibleForArea(rel) && (prefixMatch(rel, prefixes) || extra(rel)));
}

function identifierPresent(files, token) {
  const re = new RegExp(`(?<![A-Za-z0-9_])${esc(token)}(?![A-Za-z0-9_])`);
  return files.some((rel) => re.test(read(rel)));
}

function oldForms(name) { return identifierForms(name); }

function instructionMatrices(resources, allFiles) {
  const backendFiles = filesFor(allFiles, ['aof_backend/src'], (rel) => false).filter((rel) => !rel.startsWith('aof_backend/src/idl/'));
  const frontendFiles = filesFor(allFiles, ['frontend/src']);
  const testFiles = filesFor(allFiles, ['tests', 'frontend/tests', 'aof_backend/tests', 'programs']);
  const rows = [];
  for (const [oldName, newName] of Object.entries(STEP_C_RENAMES.instructions)) {
    const oldD = instructionDiscriminator(oldName);
    const newD = instructionDiscriminator(newName);
    const oldForms = oldFormsForInstruction(oldName);
    const newForms = oldFormsForInstruction(newName);
    const inLayer = (layerFiles) => ({
      old: oldForms.some((token) => identifierPresent(layerFiles, token)),
      canonical: newForms.some((token) => identifierPresent(layerFiles, token)),
    });
    const backend = inLayer(backendFiles);
    const frontend = inLayer(frontendFiles);
    const tests = inLayer(testFiles);
    const status = (x) => x.old ? 'NO — legacy caller remains' : x.canonical ? 'Yes' : 'N/A — no caller in this layer';
    rows.push({ oldName, newName, oldD, newD, backend: status(backend), frontend: status(frontend), tests: status(tests) });
  }
  return rows;
}

function oldFormsForInstruction(name) {
  const p = name.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join('');
  return [...new Set([name, p[0].toLowerCase() + p.slice(1), p])];
}

function pdaSeedMatrix(allFiles) {
  const rows = [];
  const rust = filesFor(allFiles, ['aof-core/src', 'programs']);
  const backend = filesFor(allFiles, ['aof_backend/src', 'aof_backend/scripts']);
  const frontend = filesFor(allFiles, ['frontend/src']);
  const tests = filesFor(allFiles, ['tests', 'aof-core/src', 'programs']);
  for (const [oldSeed, newSeed] of Object.entries(STEP_C_RENAMES.pdaSeeds ?? {})) {
    const newConstant = `${upperSnake(newSeed)}_SEED`;
    const hasDerivation = (rel, allowConstant) => {
      const content = read(rel);
      const derives = /findProgramAddress|createProgramAddress|find\(\[|pda\(\[|derive[A-Z]|(?<![A-Za-z0-9_.])seeds\s*=\s*\[/.test(content);
      if (!derives) return false;
      const token = allowConstant ? `(?:${esc(newSeed)}|${esc(newConstant)})` : esc(newSeed);
      return new RegExp(`(?<![A-Za-z0-9_])${token}(?![A-Za-z0-9_])`).test(content);
    };
    const has = (area, allowConstant) => area.some((rel) => hasDerivation(rel, allowConstant));
    const rustYes = has(rust, true);
    const backendYes = has(backend.filter((rel) => !rel.startsWith('aof_backend/src/idl/')), false);
    const frontendYes = has(frontend, false);
    const testsYes = has(tests, true);
    rows.push({
      account: Object.entries(STEP_C_RENAMES.accounts).find(([oldName]) => snake(oldName) === oldSeed)?.[1]
        ?? (oldSeed.includes('potato') ? pascal(newSeed) : pascal(newSeed)),
      oldSeed,
      newSeed,
      rust: rustYes ? 'Yes' : 'N/A — no derivation site',
      backend: backendYes ? 'Yes' : 'N/A — no derivation site',
      frontend: frontendYes ? 'Yes' : 'N/A — no derivation site',
      tests: testsYes ? 'Yes' : 'N/A — no derivation test',
    });
  }
  return rows;
}

function countForFiles(hits, files) {
  const set = new Set(files);
  return hits.filter((hit) => set.has(hit.file));
}

function renderReport(data) {
  const metricTable = Object.entries(data.metrics).map(([name, metric]) => `| \`${name}\` | ${metric.count} |`).join('\n');
  const resourceRows = data.mapping.resources.map((row) => `| \`${row.old}\` | \`${row.canonical}\` | ${row.kind} |`).join('\n');
  const instructionRows = data.mapping.instructions.map((row) => `| \`${row.oldName}\` | \`${row.newName}\` | \`${row.oldD}\` | \`${row.newD}\` | ${row.backend} | ${row.frontend} | ${row.tests} |`).join('\n');
  const pdaRows = data.mapping.pdaSeeds.map((row) => `| \`${row.account}\` | \`b"${row.oldSeed}"\` | \`b"${row.newSeed}"\` | ${row.rust} | ${row.backend} | ${row.frontend} | ${row.tests} |`).join('\n');
  const integrityRows = Object.entries(data.integrity.counts).map(([key, value]) => `| \`${key}\` | ${value} |`).join('\n');
  const problems = [...data.integrity.failures, ...data.invalidExclusions, ...data.nonzeroMetrics.flatMap(([name, metric]) => metric.hits.map((hit) => `${name}: ${hit.file}:${hit.line} \`${hit.token}\` — ${hit.text}`))];
  const problemSection = problems.length ? problems.map((p) => `- ${p}`).join('\n') : '- None.';
  const helperRows = Object.entries(STEP_C_RENAMES.helpers ?? {}).map(([oldName, newName]) => `| \`${oldName}\` | \`${newName}\` | Rust test-only local helper; not an Anchor instruction, no discriminator |`).join('\n');
  return `<!-- GENERATED by scripts/resource-drift.mjs. Historical mappings below are not active product identifiers. -->
# Step C — cross-layer resource and legacy identifier drift

**Status:** ${data.passed ? 'active drift gates are zero; Step C remains open pending the separate acceptance items and Anchor-generated IDL validation' : 'BLOCKED — fix every active hit below before closing Step C'}.

This report is regenerated from tracked and untracked, non-ignored text files. It includes active source, comments, copy, tests, scripts, and active docs. No active-code keep-list is applied. Exclusions are exact-path mapping descriptors, frozen history, and immutable database migration snapshots, each with a reason in \`scripts/resource-drift.mjs\`. A generic occurrence of Anchor's \`seeds = [...]\` syntax is not rewritten; the resource mapping is explicitly \`seeds → neuron\`.

## Required drift metrics

| Metric | Drift count |
|---|---:|
${metricTable}

<code>rust_idl_resource_drift</code> is strictly the Rust \`ResourceKind\` ↔ committed core IDL enum comparison and its Rust mint/cap mapping integrity. It is not a claim that every layer is clean. Final resource acceptance requires \`global_active_resource_drift = 0\`.

## 27-resource bijection / integrity counts

| Mapping layer | Count |
|---|---:|
${integrityRows}

Expected: 27 Rust enum variants → 27 \`mint_for_kind\` arms → 27 supply-cap indexes → 27 committed IDL variants → 27 backend resource keys → 27 frontend resource keys. Duplicate/unreachable mappings or any ordering mismatch fail the gate.

## Explicit historical resource mapping

| Retired identifier | Canonical identifier | ResourceKind |
|---|---|---|
${resourceRows}

## Farming instruction rename and discriminator matrix

Old discriminator is \`sha256("global:<old>")[0..8]\`; new discriminator is recomputed only for the renamed instruction. Unchanged instruction discriminators remain protected by the layout baseline.

| Old instruction | Canonical instruction | Old discriminator | New discriminator | Backend updated | Frontend updated | Tests updated |
|---|---|---|---|---|---|---|
${instructionRows}

### Non-instruction helper check

| Old local helper | Canonical helper | Classification |
|---|---|---|
${helperRows || '| — | — | No helper mapping |'}

## Resource-specific PDA seed bytes

Anchor account-constraint syntax \`seeds = [...]\` is unchanged. These are the resource-specific byte strings only; every derivation site is updated or explicitly marked N/A where that client has no derivation call site. There are no legacy PDA aliases.

| PDA/account | Old seed bytes | New seed bytes | Rust | Backend | Frontend | Tests |
|---|---|---|---|---|---|---|
${pdaRows}

## Integrity failures and active hits

${problemSection}

## Scope and status

- Historical docs/audits are excluded only by exact path and only with an explicit HISTORICAL marker in their first five lines.
- Mapping descriptors and negative mapping tests are exact-path exclusions with reasons; no runtime/product source may be excluded.
- AmberQuartz and SoulCore are retained; this gate does not delete or reclassify products.
- The report does not authorize recipe/source/sink changes, deployment, or closing Step C.
- Anchor-generated IDL validation remains pending on the required toolchain/CI.
`;
}

function main() {
  if (!WRITE && !CHECK) throw new Error('choose --write or --check');
  const resources = resourceCatalog();
  const allFiles = trackedFiles();
  const { selected: globalFiles, invalidExclusions } = activeFiles(allFiles);
  const { tokens, canonicalResourceMap } = legacyCatalog(resources);
  const globalHits = scanFiles(globalFiles, { tokens });
  const rustIdlFiles = filesFor(allFiles, ['aof-core/src', 'aof_backend/src/idl']);
  const backendFiles = filesFor(allFiles, ['aof_backend']);
  const frontendFiles = filesFor(allFiles, ['frontend']);
  const gameFiles = filesFor(allFiles, ['game']);
  const testScriptFiles = filesFor(allFiles, ['tests', 'scripts', 'aof_backend/scripts', 'frontend/tests', 'watchtower/tests', 'audit']);
  const integrity = deriveIntegrity(resources);
  const localHits = {
    rust_idl: countForFiles(globalHits, rustIdlFiles),
    backend: countForFiles(globalHits, backendFiles),
    frontend: countForFiles(globalHits, frontendFiles),
    game: countForFiles(globalHits, gameFiles),
    test_script: countForFiles(globalHits, testScriptFiles),
  };
  const coreDiffs = integrity.failures.filter((failure) => /ResourceKind|mint_for_kind|RESOURCE_KIND_COUNT|max_supply|committed IDL/i.test(failure));
  const metrics = {
    rust_idl_resource_drift: { count: localHits.rust_idl.length + coreDiffs.length, hits: localHits.rust_idl, structural: coreDiffs },
    backend_resource_drift: { count: localHits.backend.length + integrity.failures.filter((x) => /backend (RESOURCE_KIND_ORDER|resource kindMap|admin RESOURCE_KIND_BY_NAME)/.test(x)).length, hits: localHits.backend },
    frontend_resource_drift: { count: localHits.frontend.length + integrity.failures.filter((x) => /frontend visual resource keys/.test(x)).length, hits: localHits.frontend },
    game_client_resource_drift: { count: localHits.game.length, hits: localHits.game },
    test_script_resource_drift: { count: localHits.test_script.length, hits: localHits.test_script },
    global_active_resource_drift: { count: globalHits.length, hits: globalHits },
  };
  const nonzeroMetrics = Object.entries(metrics).filter(([, metric]) => metric.count !== 0);
  const instructionRows = instructionMatrices(resources, allFiles);
  const pdaRows = pdaSeedMatrix(allFiles);
  const mapping = {
    resources: canonicalResourceMap,
    instructions: instructionRows,
    pdaSeeds: pdaRows,
  };
  const data = {
    metrics,
    integrity,
    mapping,
    invalidExclusions,
    nonzeroMetrics,
    passed: nonzeroMetrics.length === 0 && integrity.failures.length === 0 && invalidExclusions.length === 0,
  };
  const markdown = renderReport(data);
  if (WRITE) {
    fs.writeFileSync(path.join(ROOT, REPORT), markdown);
    console.log(`wrote ${REPORT}`);
  }
  if (CHECK) {
    const current = exists(REPORT) ? read(REPORT) : '';
    if (current !== markdown) {
      console.error(`${REPORT} is stale; run node scripts/resource-drift.mjs --write`);
      return 1;
    }
    if (!data.passed) {
      console.error('resource drift gate failed');
      for (const [name, metric] of nonzeroMetrics) console.error(`  ${name}: ${metric.count}`);
      for (const failure of integrity.failures) console.error(`  integrity: ${failure}`);
      for (const failure of invalidExclusions) console.error(`  exclusion: ${failure}`);
      return 1;
    }
    console.log('resource drift gate passed: all required metrics are zero; Rust↔IDL and 27-key integrity checks pass');
  } else {
    for (const [name, metric] of Object.entries(metrics)) console.log(`${name}=${metric.count}`);
    if (integrity.failures.length) console.log(`integrity_failures=${integrity.failures.length}`);
  }
  return data.passed || WRITE ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
}
