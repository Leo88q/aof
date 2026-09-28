#!/usr/bin/env node
/**
 * program-registry — инвентаризация всего, что мы задеплоили и от чего зависим.
 *
 *   node scripts/security/program-registry.mjs --check     # CI + readiness-тест
 *   node scripts/security/program-registry.mjs --json      # машинный инвентарь (для опс-отчёта)
 *
 * Зачем (чек-лист #98, #116, #128):
 *   Атаки июня–сентября 2026 показали, что целью становятся не только активные
 *   программы, но и спящие/депрекейтнутые (Raydium V3, Aztec Connect/Private
 *   Rollup, Thetanuts), а также устаревшие версии общей программы у нескольких
 *   интеграторов (Rain card contract). Поэтому:
 *
 *     * у каждой нашей программы есть запись с адресом, планом по upgrade
 *       authority и хотя бы одним монитором;
 *     * депрекейтнутая/выведенная запись обязана иметь evidence, successor и
 *       признак «осущена» — «забыли» не проходит;
 *     * внешние CPI-цели (SPL Token, ATA, System, ComputeBudget, Switchboard)
 *       перечислены явно: неизвестная программа — это ошибка, а не сюрприз;
 *     * каждая апстрим-зависимость имеет пин, который реально находится в
 *       lock-файле, и хотя бы один advisory- и один release-источник.
 *
 * Скрипт offline, без зависимостей, и не ходит в сеть: online-режим —
 * scripts/security/upstream-watch.mjs (workflow «Upstream watch»).
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const rel = (p) => relative(ROOT, p).split("\\").join("/");
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");
const problems = [];
const notes = [];

// ---------------------------------------------------------------- load -----
const registry = json("security/program-registry.json");
const upstream = json("security/upstream-dependencies.json");
const keys = json("security/key-inventory.json");

// ------------------------------------------------------- 1. наши программы -
const declared = new Map(); // aof_core -> id
for (const [dir, name] of [
  ["aof-core/src", "aof_core"],
  ["programs/aof-market/src", "aof_market"],
  ["programs/aof-quests/src", "aof_quests"],
  ["programs/aof-rebirth/src", "aof_rebirth"],
  ["programs/aof-liquidity/src", "aof_liquidity"],
  ["programs/aof-session-keys/src", "aof_session_keys"],
]) {
  for (const file of walk(join(ROOT, dir))) {
    if (!file.endsWith(".rs")) continue;
    const m = readFileSync(file, "utf8").match(/declare_id!\("([1-9A-HJ-NP-Za-km-z]{32,44})"\)/);
    if (m) declared.set(name, m[1]);
  }
}
const registered = new Map(registry.programs.filter((p) => p.onChain).map((p) => [p.name, p]));
for (const [name, id] of declared) {
  const entry = registered.get(name);
  if (!entry) problems.push(`declare_id! ${name} (${id}) отсутствует в security/program-registry.json programs[]`);
  else if (entry.address !== id) problems.push(`${name}: реестр ${entry.address} != declare_id! ${id}`);
}
for (const name of registered.keys()) {
  if (!declared.has(name)) problems.push(`реестр содержит ${name}, но declare_id! не найден — мёртвая запись`);
}

// Anchor.toml: все кластеры должны сходиться с реестром.
const anchor = read("Anchor.toml");
const anchorPrograms = new Map();
for (const m of anchor.matchAll(/\[programs\.([a-z]+)\]\n([\s\S]*?)(?=\n\[|\n*$)/g)) {
  const cluster = m[1];
  for (const line of m[2].split("\n")) {
    const pair = line.match(/^\s*([a-z0-9_]+)\s*=\s*"([1-9A-HJ-NP-Za-km-z]{32,44})"/);
    if (pair) anchorPrograms.set(`${cluster}:${pair[1]}`, pair[2]);
  }
}
for (const cluster of registry.clusters) {
  for (const [name, entry] of registered) {
    const value = anchorPrograms.get(`${cluster}:${name}`);
    if (!value) problems.push(`Anchor.toml [programs.${cluster}] не содержит ${name}`);
    else if (value !== entry.address) problems.push(`Anchor.toml [programs.${cluster}].${name} = ${value} != реестр ${entry.address}`);
  }
}

// IDL, watchtower/addresses.json и фронтенд обязаны знать те же адреса.
for (const [name, entry] of registered) {
  if (entry.idl && existsSync(resolve(ROOT, entry.idl))) {
    const idl = json(entry.idl);
    if (idl.address !== entry.address) problems.push(`${entry.idl}.address = ${idl.address} != реестр ${entry.address}`);
  } else if (entry.idl) {
    problems.push(`IDL ${entry.idl} из реестра не найден`);
  }
}
const addresses = json("watchtower/addresses.json");
const watchtowerPrograms = new Map((addresses.programs || []).map((p) => [p.name, p.address]));
for (const [name, entry] of registered) {
  const value = watchtowerPrograms.get(name);
  if (!value) problems.push(`watchtower/addresses.json не содержит ${name}`);
  else if (value !== entry.address) problems.push(`watchtower/addresses.json ${name} = ${value} != реестр ${entry.address}`);
}
// txGuard — единственный источник allowlist программ для клиента: там должны
// быть ВСЕ наши программы. Страница правил может ссылаться на реестр, но у неё
// обязан быть хотя бы один канонический адрес (иначе игроку не с чем сверяться).
{
  const guard = read("frontend/src/lib/txGuard.ts");
  for (const [name, entry] of registered) {
    if (!guard.includes(entry.address)) problems.push(`frontend/src/lib/txGuard.ts: нет адреса ${name} (${entry.address}) — клиент не пустит легитимную программу или пропустит чужую`);
  }
  const rules = read("frontend/src/site/content/rules.ts");
  const knownRulesAddresses = registered.size ? [...registered.values()].filter((e) => rules.includes(e.address)).length : 0;
  if (knownRulesAddresses === 0) problems.push("frontend/src/site/content/rules.ts: ни одного канонического адреса программы — игроку не с чем сверяться (#104)");
  if (!/addresses\.json|Anchor\.toml/.test(rules)) notes.push("frontend/src/site/content/rules.ts: нет ссылки на реестр адресов (Anchor.toml/watchtower/addresses.json)");
}

// --------------------------------------------------- 2. политика записей ---
for (const p of registry.programs) {
  if (p.status === "active") {
    if (!p.upgradeAuthorityPlan) problems.push(`${p.name}: active без upgradeAuthorityPlan (#44/#98)`);
    if (!Array.isArray(p.monitoring) || p.monitoring.length === 0) problems.push(`${p.name}: active без monitoring[]`);
  }
  if (p.status === "deprecated" || p.status === "test-only") {
    if (!p.deprecation) problems.push(`${p.name}: ${p.status} без блока deprecation (evidence/successor/authority)`);
    else {
      for (const field of ["retiredAt", "successor", "authority", "evidence"]) {
        if (!p.deprecation[field]) problems.push(`${p.name}: deprecation.${field} пуст — депрекейт без плана (#98)`);
      }
      if (p.deprecation.drained !== true && p.status === "deprecated") {
        problems.push(`${p.name}: deprecated, но не помечен drained=true — спящая программа остаётся целью (#98)`);
      }
    }
    if (p.valueBearing) problems.push(`${p.name}: deprecated/test-only не может быть valueBearing — балансы должны быть выведены`);
  }
}
for (const r of registry.retired) {
  for (const field of ["retiredAt", "successor", "authority", "evidence"]) {
    if (!r[field]) problems.push(`retired ${r.name}: нет ${field}`);
  }
  if (r.drained !== true) problems.push(`retired ${r.name}: drained != true — компонент всё ещё может получать ценность`);
}

// --------------------------------------------- 3. внешние CPI-цели ----------
const externalIds = new Set(registry.external.map((e) => e.address));
for (const e of registry.external) {
  if (!["active", "deprecated", "devnet-only"].includes(e.status)) problems.push(`external ${e.name}: неизвестный status ${e.status}`);
  if (!e.upstreamId && !e.pin) problems.push(`external ${e.name}: нет ни upstreamId, ни pin — непонятно, что мониторить (#116)`);
}
// Адреса, зашитые в Rust (vrf.rs): program id обязаны быть в external[],
// queue/state PDA — в relatedAddresses[] соответствующей записи.
const relatedAddresses = new Set(registry.external.flatMap((e) => e.relatedAddresses || []));
const vrfSources = ["aof-core/src/vrf.rs", "programs/aof-quests/src/vrf.rs"].filter((f) => existsSync(resolve(ROOT, f)));
let pinnedAddresses = 0;
for (const file of vrfSources) {
  const re = /pub const (\w+): Pubkey = Pubkey::new_from_array\(\[([\s\S]*?)\]\)/g;
  for (const m of read(file).matchAll(re)) {
    const bytes = m[2].split(",").map((n) => n.trim()).filter(Boolean).map(Number).filter((n) => Number.isInteger(n));
    if (bytes.length !== 32) continue;
    pinnedAddresses += 1;
    const id = bs58(Uint8Array.from(bytes));
    // Program ids: SPL-подобные адреса и сами программы Switchboard. Queue/state —
    // адреса внутри программы-оракула, они живут в relatedAddresses.
    const isProgramId = /PROGRAM_ID|ADDRESS_LOOKUP|SWITCHBOARD_ON_DEMAND/.test(m[1]);
    if (isProgramId && !externalIds.has(id)) problems.push(`${file}: program id ${m[1]} (${id}) отсутствует в external[] реестра (#116)`);
    if (!isProgramId && !relatedAddresses.has(id)) {
      problems.push(`${file}: адрес ${m[1]} (${id}) не привязан ни к одной записи external[].relatedAddresses (#116)`);
    }
  }
}
if (pinnedAddresses === 0) problems.push("не удалось извлечь адреса из vrf.rs — проверка реестра деградировала");

// ------------------------------------------------- 4. апстрим-зависимости --
for (const dep of upstream.dependencies) {
  for (const field of ["id", "repo", "criticality", "pinKind", "advisorySources", "watch"]) {
    if (!dep[field]) problems.push(`upstream ${dep.id || "?"}: нет ${field}`);
  }
  if (!Array.isArray(dep.advisorySources) || dep.advisorySources.length === 0) problems.push(`upstream ${dep.id}: пустые advisorySources`);
  if (!dep.advisorySources?.some((s) => /advisories|rustsec|osv|security/i.test(s))) {
    problems.push(`upstream ${dep.id}: нет advisory-источника (только релизы) — security-фикс можно пропустить (#128)`);
  }
  if (dep.pinKind === "npm" || dep.pinKind === "cargo") {
    const lockPath = dep.pinnedIn;
    if (!lockPath || !existsSync(resolve(ROOT, lockPath))) problems.push(`upstream ${dep.id}: pinnedIn ${lockPath} не найден`);
    else {
      const lock = read(lockPath);
      if (dep.pinKind === "npm") {
        const needle = `"node_modules/${dep.package}": {`;
        if (!lock.includes(needle)) problems.push(`upstream ${dep.id}: ${dep.package} не найден в ${lockPath} (переименование/удаление без обновления реестра?)`);
      } else {
        const needle = `name = "${dep.crate}"`;
        if (!lock.includes(needle)) problems.push(`upstream ${dep.id}: crate ${dep.crate} не найден в ${lockPath}`);
        if (dep.expectedVersion && !new RegExp(`name = "${dep.crate}"\\nversion = "${escapeRe(dep.expectedVersion)}"`).test(lock)) {
          problems.push(`upstream ${dep.id}: ожидалась версия ${dep.expectedVersion}, её нет в ${lockPath} — обновить реестр вместе с lock-файлом`);
        }
      }
    }
  } else if (dep.pinKind === "reference") {
    const ref = dep.pinnedRef;
    if (!ref?.file || !existsSync(resolve(ROOT, ref.file))) problems.push(`upstream ${dep.id}: pinnedRef.file ${ref?.file} не найден`);
    else if (ref.contains && !read(ref.file).includes(ref.contains)) {
      problems.push(`upstream ${dep.id}: ${ref.file} больше не содержит "${ref.contains}" — пин устарел`);
    }
  } else {
    problems.push(`upstream ${dep.id}: неизвестный pinKind ${dep.pinKind}`);
  }
}
if (!existsSync(resolve(ROOT, ".github/workflows/upstream-watch.yml"))) {
  problems.push("нет .github/workflows/upstream-watch.yml — апстрим не мониторится регулярно (#116/#128)");
}

// -------------------------------------------------- 5. инвентарь ключей ----
const envNames = new Set();
for (const dir of ["aof_backend/src", "aof_backend/services", "watchtower/src", "src/os"]) {
  if (!existsSync(join(ROOT, dir))) continue;
  for (const file of walk(join(ROOT, dir))) {
    if (!/\.(ts|js|mjs|cjs)$/.test(file)) continue;
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/(?:process\.)?env\.([A-Z][A-Z0-9_]+)/g)) envNames.add(m[1]);
  }
}
const declaredEnv = new Set(keys.roles.flatMap((r) => r.envVars));
for (const allow of keys.nonSecretEnvAllowlist) declaredEnv.add(allow);
const secretish = /(SECRET|TOKEN|PASSWORD|PASS$|_KEY|KEY$|_KEY_|KEY_|SALT|DSN|MNEMONIC|SEED)/;
const base = (name) => name.replace(/_FILE$/, "");
for (const name of envNames) {
  if (!secretish.test(name)) continue;
  if (declaredEnv.has(name) || declaredEnv.has(base(name))) continue;
  problems.push(`env ${name} похож на секрет, но его нет в security/key-inventory.json roles[].envVars (#101)`);
}
for (const role of keys.roles) {
  for (const field of ["id", "what", "storage", "productionRequirement", "rotation", "compromiseAction"]) {
    if (!role[field]) problems.push(`key-inventory роль ${role.id || "?"}: нет ${field}`);
  }
}
const rawInventory = read("security/key-inventory.json");
for (const m of rawInventory.matchAll(/"[1-9A-HJ-NP-Za-km-z]{64,88}"/g)) problems.push(`key-inventory.json содержит base58-подобное значение (не секрет?)`);
for (const m of rawInventory.matchAll(/"[0-9a-fA-F]{64,}"/g)) problems.push(`key-inventory.json содержит hex-подобное значение (не секрет?)`);

// ------------------------------------------------------------- вывод ------
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    programs: registry.programs.map((p) => ({ name: p.name, address: p.address, status: p.status, valueBearing: p.valueBearing })),
    external: registry.external.map((e) => ({ name: e.name, address: e.address, kind: e.kind })),
    retired: registry.retired.map((r) => ({ name: r.name, retiredAt: r.retiredAt, drained: r.drained })),
    upstream: upstream.dependencies.map((d) => ({ id: d.id, repo: d.repo, watch: d.watch })),
    keyRoles: keys.roles.map((r) => ({ id: r.id, storage: r.storage, provenanceRequired: !!r.provenanceRequired })),
  }, null, 2));
  process.exit(0);
}

if (problems.length) {
  console.error("program-registry: реестр программ/апстримов/ключей разошёлся с кодом:");
  for (const p of problems) console.error("  ✗ " + p);
  console.error("\nИсправьте реестр или код (это отдельный ревьюируемый диф), затем повторите проверку.");
  process.exit(1);
}
for (const n of notes) console.warn("  · " + n);
console.log(
  `program-registry: ${registry.programs.length} программ, ${registry.external.length} внешних CPI-целей, ` +
  `${registry.retired.length} выведенных компонент(ов), ${upstream.dependencies.length} апстримов, ` +
  `${keys.roles.length} ролей ключей — всё сходится`,
);

// ----------------------------------------------------------- helpers ------
function json(p) {
  return JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));
}
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function bs58(bytes) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    out = alphabet[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}
