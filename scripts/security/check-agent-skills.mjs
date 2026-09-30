#!/usr/bin/env node
/**
 * check-agent-skills — навыки, плагины и MCP-описания ИИ-агентов как код.
 *
 *   node scripts/security/check-agent-skills.mjs            # проверка (CI)
 *   node scripts/security/check-agent-skills.mjs --list     # инвентарь навыков
 *
 * Зачем (чек-лист #130, #107, #78):
 *   В феврале 2026 в реестре навыков OpenClaw нашли 341–386 вредоносных навыков:
 *   стилеры ключей бирж, приватных ключей и SSH, AMOS для macOS через «предварительные
 *   требования» в README. Snyk оценил 36 % из ~4 тыс. навыков как имеющие изъяны,
 *   пять вредоносных навыков прошли VirusTotal и ClawScan. Навык может быть просто
 *   набором инструкций без кода — значит, проверять надо текст, а не только бинарь.
 *
 * Правила:
 *   1. Каждый файл навыка/конфига агента запинован по SHA-256 (agent-config-lock);
 *      новый файл в каталоге навыков обязан прийти отдельным ревьюируемым дифом.
 *   2. Навык не может тянуть и исполнять код из сети, читать ключи/seed, повышать
 *      себе права или прятать инструкции от пользователя. Исключение — строка в
 *      security/agent-skills.allow.json с объяснением (и она тоже ревьюится).
 *   3. Навыки запускаются в песочнице без сети, без домашнего каталога, без кошельков
 *      (docs/AI_AGENT_SECURITY_POLICY.md §8): если навык просит «скачай и запусти» —
 *      это находка, а не «предварительное требование».
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const rel = (p) => relative(ROOT, p).split("\\").join("/");
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");

// Каталоги, которые реально исполняются агентом как инструкции/инструменты.
const SKILL_DIRS = [".claude/skills", ".claude/commands", ".claude/agents", "skills", ".github/instructions", "prompts"];
const SKILL_FILES = ["AGENTS.md", "CLAUDE.md", ".mcp.json", ".cursor/mcp.json", ".vscode/mcp.json", ".claude/settings.json"];

const RULES = [
  { id: "remote-exec", severity: "high", re: /\b(curl|wget)\b[^\n|]{0,160}\|\s*(sudo\s+)?(ba|z|k)?sh\b|\biwr\b[^\n]{0,120}\|\s*iex\b|Invoke-Expression|powershell\s+(-|\/)(enc|e)\b|base64\s+(-d|--decode)[^\n]{0,80}\|\s*(ba|z)?sh\b|\beval\s+\$\((curl|wget)/i, why: "выполнение кода из сети (curl|sh, iwr|iex, base64|sh)" },
  { id: "install-untrusted", severity: "high", re: /\b(npm\s+(i|install|add)\s+(?!test\b)|pnpm\s+add\b|yarn\s+add\b|pip3?\s+install\b|pipx\s+install\b|gem\s+install\b|cargo\s+install\b|brew\s+install\b|npx\s+(-y|--yes)\b)/i, why: "установка пакета исполняет install-скрипты (снабженческая атака)" },
  { id: "credential-paths", severity: "high", re: /(~\/\.ssh|~\/\.aws|\/\.config\/solana|id_rsa|id_ed25519|\.npmrc|\.netrc|credentials\.json|AUTHORITY_SECRET_KEY|SESSION_KEYSTORE_KEY|VRF_SETTLER_SECRET_KEY|seed[- ]?phrase|mnemonic|keypair\.json|wallet\.json)/i, why: "обращение к ключам/секретам вне контура подписи" },
  { id: "exfiltration", severity: "high", re: /(webhook\.site|pastebin\.com|transfer\.sh|0x0\.st|ngrok\.(io|app)|discord\.com\/api\/webhooks|t\.me\/|api\.telegram\.org)/i, why: "канал утечки/эксфильтрации данных" },
  { id: "permission-escalation", severity: "high", re: /(--dangerously-skip-permissions|bypassPermissions|dangerouslySkipPermissions|"autoApprove"\s*:\s*true|"alwaysAllow"\s*:\s*\[|allowed-tools\s*:\s*\*)/i, why: "снятие подтверждений/расширение прав агента" },
  { id: "hidden-instructions", severity: "high", re: /(ignore (all )?(previous|prior) instructions|do not (tell|inform|mention to) the user|не сообщай(те)? пользовател|не говори(те)? пользовател|silently (run|execute|send))/i, why: "скрытая инструкция (prompt injection)" },
  { id: "unsandboxed-run", severity: "medium", re: /(\bchmod\s+\+x\b[\s\S]{0,120}\b(run|exec|\.\/)|\bosascript\b|\bxvfb\b|\blaunchctl\b|\bsystemctl\b|\bschtasks\b)/i, why: "запуск/закрепление кода вне песочницы" },
  { id: "wallet-signing", severity: "medium", re: /(\bsolana\s+(transfer|pay)\b|\bspl-token\s+(transfer|approve)\b|signTransaction\(|sendTransaction\(|Keypair\.fromSecretKey)/i, why: "навык сам подписывает/переводит активы, а не только советует" },
];

const findings = [];
const skills = [];
const allow = existsSync(resolve(ROOT, "security/agent-skills.allow.json"))
  ? JSON.parse(read("security/agent-skills.allow.json"))
  : { allow: [] };
const allowedLines = new Set((allow.allow || []).map((a) => `${a.file}:${a.rule}:${a.match}`));

for (const dir of SKILL_DIRS) {
  const abs = resolve(ROOT, dir);
  if (!existsSync(abs)) continue;
  for (const file of walk(abs)) skills.push(file);
}
for (const file of SKILL_FILES) if (existsSync(resolve(ROOT, file))) skills.push(resolve(ROOT, file));

for (const abs of skills) {
  const file = rel(abs);
  const text = readFileSync(abs, "utf8");
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  const name = frontmatter?.[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter?.[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (file.includes("/skills/")) {
    skills.length; // no-op, keeps the inventory path obvious
    if (!name) findings.push({ file, rule: "skill-frontmatter", why: "у навыка нет name в frontmatter — непонятно, что он делает" });
    if (!description) findings.push({ file, rule: "skill-frontmatter", why: "у навыка нет description — ревьюер не видит назначение" });
  }
  const lines = text.split("\n");
  for (const rule of RULES) {
    lines.forEach((line, index) => {
      const m = line.match(rule.re);
      if (!m) return;
      const match = m[0].trim().slice(0, 80);
      if (allowedLines.has(`${file}:${rule.id}:${match}`)) return;
      findings.push({ file, line: index + 1, rule: rule.id, severity: rule.severity, match, why: rule.why });
    });
  }
}

// Пиннинг: каждый файл навыка обязан быть в agent-config.lock.json.
const lockPath = resolve(ROOT, "security/agent-config.lock.json");
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : { files: {} };
for (const abs of skills) {
  const file = rel(abs);
  if (!lock.files?.[file]) {
    findings.push({ file, rule: "unpinned-skill", severity: "high", why: "файл навыка/конфига агента не запинован в security/agent-config.lock.json (--update после ревью)" });
  }
}

if (process.argv.includes("--list")) {
  console.log(JSON.stringify({
    skills: skills.map((abs) => ({ file: rel(abs), bytes: statSync(abs).size, pinned: Boolean(lock.files?.[rel(abs)]) })),
    rules: RULES.map((r) => r.id),
  }, null, 2));
  process.exit(0);
}

if (findings.length) {
  console.error("check-agent-skills: навыки/конфиги агентов содержат опасные инструкции или не запинованы:");
  for (const f of findings) {
    console.error(`  ✗ ${f.file}${f.line ? `:${f.line}` : ""} [${f.rule}] ${f.match ? `«${f.match}» ` : ""}${f.why}`);
  }
  console.error(
    "\nЕсли строка безопасна и объяснена — добавьте её в security/agent-skills.allow.json " +
    "({file, rule, match, justification}) и обновите лок навыков отдельным ревьюируемым дифом. " +
    "Внешние навыки/MCP ставим только в песочницу без сети и без кошельков (§8 политики агентов).",
  );
  process.exit(1);
}
console.log(`check-agent-skills: ${skills.length} файл(ов) навыков/конфигов агентов — опасных инструкций нет, все запинованы`);
if (process.argv.includes("--verbose")) {
  for (const abs of skills) console.log("  · " + rel(abs));
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
