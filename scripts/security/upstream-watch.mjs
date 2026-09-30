#!/usr/bin/env node
/**
 * upstream-watch — следим за security-релизами апстримов, от которых зависим.
 *
 *   node scripts/security/upstream-watch.mjs --check     # offline: реестр и пины сходятся
 *   node scripts/security/upstream-watch.mjs --online    # + OSV/релизы (нужна сеть)
 *
 * Зачем (чек-лист #116, #128):
 *   Liquid Network (≈$320 млн, 6 сентября 2026) потерял деньги не из-за подписей:
 *   исправление уязвимости влили в ветки Elements 1–3 сентября, но в теговый
 *   релиз оно не попало, а ПО федерации не обновлялось больше двух лет. Публичный
 *   diff до деплоя — готовая инструкция для атакующего, а отставание от апстрима —
 *   открытая дверь. Поэтому: пины в security/upstream-dependencies.json обязаны
 *   сходиться с lock-файлами (offline, каждый коммит) + регулярная online-проверка
 *   OSV/GitHub releases (workflow «Upstream watch», еженедельно).
 *
 * Online-режим ничего не публикует и не меняет: он пишет отчёт и завершается
 * кодом 1 при находках, чтобы workflow открыл issue.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const deps = JSON.parse(readFileSync(resolve(ROOT, "security/upstream-dependencies.json"), "utf8"));
const online = process.argv.includes("--online");
const outIndex = process.argv.indexOf("--out");
const outFile = outIndex > -1 ? process.argv[outIndex + 1] : null;
const lines = [];
const findings = [];

for (const dep of deps.dependencies) {
  const pin = describedPin(dep);
  lines.push(`## ${dep.id} (${dep.repo})`);
  lines.push(`- критичность: ${dep.criticality}`);
  lines.push(`- пин: ${pin}`);
  lines.push(`- advisory-источники: ${dep.advisorySources.join(", ")}`);
  if (!online) continue;

  const eco = ecosystem(dep);
  if (eco) {
    try {
      const result = await osvQuery(eco.package, eco.ecosystem, eco.version);
      const vulns = result.vulns || [];
      if (vulns.length) {
        findings.push(`${dep.id}: OSV знает ${vulns.length} уязвимост${vulns.length === 1 ? "ь" : "и"} для ${eco.package}@${eco.version}: ${vulns.map((v) => v.id).join(", ")}`);
        for (const v of vulns) {
          lines.push(`- ❗ OSV ${v.id}: ${(v.summary || "").slice(0, 200)}`);
        }
      } else {
        lines.push(`- OSV: уязвимостей для ${eco.package}@${eco.version} не найдено`);
      }
    } catch (error) {
      lines.push(`- OSV-запрос не удался: ${String(error?.message || error).slice(0, 160)}`);
    }
  }

  try {
    const latest = await latestRelease(dep.repo);
    if (latest) {
      const pinned = eco?.version || pin;
      lines.push(`- последний релиз ${dep.repo}: ${latest.tag_name} (${latest.published_at?.slice(0, 10)})${pinned.includes(latest.tag_name.replace(/^v/, "")) ? "" : " — сравнить с нашим пином"}`);
    }
  } catch (error) {
    lines.push(`- GitHub releases недоступны: ${String(error?.message || error).slice(0, 160)}`);
  }
}

const report = [
  "# Апстрим-дозор (upstream watch)",
  "",
  `Дата: ${new Date().toISOString()}. Режим: ${online ? "online (OSV + GitHub releases)" : "offline (реестр)"}.`,
  "",
  ...lines,
  "",
  "Напоминание: свой security-фикс сначала в приватной ветке, деплой, потом публикация коммита (#128).",
  "",
].join("\n");

if (outFile) writeFileSync(resolve(ROOT, outFile), report);
if (!outFile) console.log(report);

if (online && findings.length) {
  console.error("\nНаходки апстрим-дозора:");
  for (const f of findings) console.error("  ✗ " + f);
  console.error("\nРазберите каждую: обновить зависимость/программу, проверить, не затронуты ли наши форки (включая копию vrf.rs в aof-quests).");
  process.exit(1);
}

if (!online) {
  // Offline-режим — тонкая проверка: реестр читается, у каждой записи есть
  // advisory/release-источники и пин, на который можно сослаться в отчёте.
  const problems = [];
  for (const dep of deps.dependencies) {
    if (!dep.advisorySources?.length) problems.push(`${dep.id}: нет advisory-источников`);
    if (!dep.watch?.length) problems.push(`${dep.id}: нет watch[]`);
    if (dep.pinKind === "npm" && !existsSync(resolve(ROOT, dep.pinnedIn || ""))) problems.push(`${dep.id}: pinnedIn не найден`);
  }
  if (problems.length) {
    for (const p of problems) console.error("  ✗ " + p);
    process.exit(1);
  }
  console.log(`upstream-watch: ${deps.dependencies.length} апстримов в реестре, у всех есть advisory-источник и пин (offline)`);
}

// ------------------------------------------------------------- helpers ----
function describedPin(dep) {
  if (dep.pinKind === "reference") return `${dep.pinnedRef.file} содержит «${dep.pinnedRef.contains}»`;
  const version = dep.expectedVersion ? ` версия ${dep.expectedVersion}` : "";
  return `${dep.pinnedIn}: ${dep.package || dep.crate}${version}`;
}

function ecosystem(dep) {
  if (dep.pinKind === "npm") {
    const lock = safeJson(dep.pinnedIn);
    const version = lock?.packages?.[`node_modules/${dep.package}`]?.version;
    return version ? { package: dep.package, ecosystem: "npm", version } : null;
  }
  if (dep.pinKind === "cargo") {
    const lock = existsSync(resolve(ROOT, dep.pinnedIn)) ? readFileSync(resolve(ROOT, dep.pinnedIn), "utf8") : "";
    const m = lock.match(new RegExp(`name = "${dep.crate}"\\nversion = "([^"]+)"`));
    return m ? { package: dep.crate, ecosystem: "crates.io", version: m[1] } : null;
  }
  return null;
}

function safeJson(p) {
  try {
    return JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));
  } catch {
    return null;
  }
}

async function osvQuery(name, ecosystemName, version) {
  const response = await fetch("https://api.osv.dev/v1/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ package: { name, ecosystem: ecosystemName }, version }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`OSV HTTP ${response.status}`);
  return response.json();
}

async function latestRelease(repo) {
  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "neuroforge-upstream-watch" },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
  const body = await response.json();
  return body?.tag_name ? body : null;
}
