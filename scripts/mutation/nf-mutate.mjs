#!/usr/bin/env node
/**
 * nf-mutate — zero-dependency mutation testing for the TypeScript / Rust
 * modules that carry the security and economic invariants.
 *
 *   node scripts/mutation/nf-mutate.mjs                       # every target in targets.json that can run here
 *   node scripts/mutation/nf-mutate.mjs --only wallet-proof   # one target (comma-separated ids)
 *   node scripts/mutation/nf-mutate.mjs --file aof_backend/src/security/fraudHold.ts \
 *         --cwd aof_backend --cmd "npm run -s test:fraud-hold"
 *
 * What it does: for one source file it generates single-point mutants
 * (flipped comparison, swapped && / ||, +/- swapped, true/false flipped,
 * `if (cond)` forced, integer literal +1, Rust `require!` disarmed, ...), writes
 * each mutant over the original, runs the target's test command, and restores
 * the file. A mutant the tests still pass with is a SURVIVOR: a line whose
 * behaviour no test pins down. The mutation score = killed / (killed + survived).
 *
 * The earlier audits did this by hand ("мутационная проверка: снять тормоз,
 * вернуть уязвимость, убедиться что тест падает"). This makes it repeatable and
 * reportable. It is deliberately simple: mutants are line-local regex
 * rewrites, comments and string literals are skipped heuristically, and an
 * equivalent mutant (same behaviour) is counted as a survivor — read the
 * report before filing a bug against the tests.
 *
 * Safety: the original file is restored after every mutant and on SIGINT/exit;
 * the run refuses to start on a dirty target file (git) unless --force.
 */
import { spawnSync, execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 24).map((l) => l.replace(/^ \*\s?/, "")).join("\n"));
  process.exit(0);
}
const MAX = int(args.max, 80);
const TIMEOUT_S = int(args.timeout, 240);
const SEED = int(args.seed, 7);
const ONLY = args.only ? String(args.only).split(",").map((s) => s.trim()) : null;

// ------------------------------------------------------------- targets ----
let targets;
if (args.file) {
  if (!args.cmd) die("--file needs --cmd");
  targets = [{ id: "adhoc", file: String(args.file), cwd: String(args.cwd || "."), cmd: String(args.cmd) }];
} else {
  const manifest = JSON.parse(readFileSync(resolve(HERE, "targets.json"), "utf8"));
  targets = manifest.targets.filter((t) => !ONLY || ONLY.includes(t.id));
  if (ONLY && targets.length === 0) die(`no target matches --only ${ONLY.join(",")}`);
}

// ------------------------------------------------------------ operators ---
// Each operator: { name, lang: [..], re, replace } applied to ONE match per mutant.
const OPS = [
  { name: "lte→lt", lang: ["ts", "rs"], re: /<=/g, rep: () => "<" },
  { name: "gte→gt", lang: ["ts", "rs"], re: />=/g, rep: () => ">" },
  { name: "lt→lte", lang: ["ts", "rs"], re: /(?<![<=!>-])<(?![<=])/g, rep: () => "<=" },
  { name: "gt→gte", lang: ["ts", "rs"], re: /(?<![>=!-])>(?![>=])/g, rep: () => ">=" },
  { name: "eq→neq", lang: ["ts"], re: /===/g, rep: () => "!==" },
  { name: "neq→eq", lang: ["ts"], re: /!==/g, rep: () => "===" },
  { name: "eq→neq", lang: ["rs"], re: /(?<![=!<>])==(?!=)/g, rep: () => "!=" },
  { name: "neq→eq", lang: ["rs"], re: /!=(?!=)/g, rep: () => "==" },
  { name: "and→or", lang: ["ts", "rs"], re: /&&/g, rep: () => "||" },
  { name: "or→and", lang: ["ts", "rs"], re: /\|\|/g, rep: () => "&&" },
  { name: "plus→minus", lang: ["ts", "rs"], re: /(?<=[\w)\]])\s\+\s(?=[\w(])/g, rep: () => " - " },
  { name: "minus→plus", lang: ["ts", "rs"], re: /(?<=[\w)\]])\s-\s(?=[\w(])/g, rep: () => " + " },
  { name: "true→false", lang: ["ts", "rs"], re: /\btrue\b/g, rep: () => "false" },
  { name: "false→true", lang: ["ts", "rs"], re: /\bfalse\b/g, rep: () => "true" },
  { name: "if→if(true)", lang: ["ts"], re: /\bif \((?!true\)|false\))([^()]*(?:\([^()]*\)[^()]*)*)\)/g, rep: () => "if (true)" },
  { name: "if→if(false)", lang: ["ts"], re: /\bif \((?!true\)|false\))([^()]*(?:\([^()]*\)[^()]*)*)\)/g, rep: () => "if (false)" },
  { name: "int+1", lang: ["ts", "rs"], re: /(?<![\w.])(?:[1-9]\d{0,8}|0)(?![\w.:])/g, rep: (m) => String(Number(m) + 1) },
  { name: "not→id", lang: ["ts"], re: /(?<![!=])!(?=[\w(])/g, rep: () => "" },
  { name: "not→id", lang: ["rs"], re: /(?<![!=])!(?=[\w(])(?!\s*\[)/g, rep: () => "" },
  { name: "require!→true", lang: ["rs"], re: /\brequire!\(\s*(?!true)/g, rep: () => "require!(true || " },
  { name: "checked_add→sub", lang: ["rs"], re: /\bchecked_add\b/g, rep: () => "checked_sub" },
  { name: "checked_sub→add", lang: ["rs"], re: /\bchecked_sub\b/g, rep: () => "checked_add" },
  { name: "saturating_sub→add", lang: ["rs"], re: /\bsaturating_sub\b/g, rep: () => "saturating_add" },
  { name: "return→negate", lang: ["ts"], re: /\breturn (?!true|false|null|undefined|[\d"'`{[])(\w[\w.]*)\s*;/g, rep: (m, id) => `return !${id};` },
];

function langOf(file) {
  return file.endsWith(".rs") ? "rs" : "ts";
}
function isCodeLine(line, lang) {
  const t = line.trim();
  if (!t) return false;
  if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("///") || t.startsWith("#[")) return false;
  if (lang === "ts" && (t.startsWith("import ") || t.startsWith("export type") || t.startsWith("export interface") || t.startsWith("interface ") || t.startsWith("type "))) return false;
  if (lang === "rs" && (t.startsWith("use ") || t.startsWith("#![") || t.startsWith("mod "))) return false;
  // Prisma projection shapes (`select: { a: true }`) and logger fields are data, not logic.
  if (lang === "ts" && /\b(select|include|orderBy)\s*:\s*\{/.test(t)) return false;
  return true;
}
/** Mask string/char/template literals and trailing comments so operators do not mutate text. */
function maskLiterals(line, lang) {
  let out = "";
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === "/" && line[i + 1] === "/") {
      out += " ".repeat(line.length - i);
      break;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      let j = i + 1;
      while (j < line.length && line[j] !== q) {
        if (line[j] === "\\") j++;
        j++;
      }
      // Rust lifetimes / TS generics: a lone ' followed by an identifier is not a string.
      if (q === "'" && lang === "rs" && j >= line.length) {
        out += c;
        i++;
        continue;
      }
      out += q + " ".repeat(Math.max(0, j - i - 1)) + (j < line.length ? q : "");
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function generateMutants(source, lang) {
  const lines = source.split("\n");
  const mutants = [];
  let inBlockComment = false;
  lines.forEach((line, idx) => {
    if (inBlockComment) {
      if (line.includes("*/")) inBlockComment = false;
      return;
    }
    if (line.trim().startsWith("/*") && !line.includes("*/")) {
      inBlockComment = true;
      return;
    }
    if (!isCodeLine(line, lang)) return;
    const masked = maskLiterals(line, lang);
    for (const op of OPS) {
      if (!op.lang.includes(lang)) continue;
      op.re.lastIndex = 0;
      let m;
      while ((m = op.re.exec(masked)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        const replacement = op.rep(...m);
        const mutatedLine = line.slice(0, start) + replacement + line.slice(end);
        if (mutatedLine === line) continue;
        mutants.push({ line: idx + 1, op: op.name, original: line, mutated: mutatedLine });
        if (op.re.lastIndex === m.index) op.re.lastIndex++;
      }
    }
  });
  return mutants;
}

// ------------------------------------------------------------ runner ------
function runCmd(cmd, cwd) {
  const t = Date.now();
  const r = spawnSync(cmd, { cwd, shell: true, encoding: "utf8", timeout: TIMEOUT_S * 1000, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CI: "1", NF_MUTATE: "1" } });
  const timedOut = r.error && r.error.code === "ETIMEDOUT";
  return { ok: !timedOut && r.status === 0, timedOut, ms: Date.now() - t, tail: ((r.stdout || "") + (r.stderr || "")).trim().split("\n").slice(-3).join(" | ").slice(0, 300) };
}

const summary = [];
let restore = null;
const restoreNow = () => {
  if (restore) {
    writeFileSync(restore.path, restore.content);
    restore = null;
  }
};
process.on("SIGINT", () => {
  restoreNow();
  process.exit(130);
});
process.on("exit", restoreNow);

for (const t of targets) {
  const cwd = resolve(ROOT, t.cwd || ".");
  const file = resolve(cwd, t.file);
  const rel = relative(ROOT, file);
  if (!existsSync(file)) {
    console.log(`\n## ${t.id}: ${rel} — SKIP (file not found)`);
    summary.push({ id: t.id, file: rel, status: "skip", reason: "file not found" });
    continue;
  }
  if (t.requires && !checkRequires(t.requires)) {
    console.log(`\n## ${t.id}: ${rel} — SKIP (${t.requires} not available here)`);
    summary.push({ id: t.id, file: rel, status: "skip", reason: `${t.requires} not available` });
    continue;
  }
  if (!args.force) {
    const dirty = execSync(`git status --porcelain -- "${rel}"`, { cwd: ROOT, encoding: "utf8" }).trim();
    if (dirty) die(`${rel} has uncommitted changes; commit/stash them or pass --force (the runner rewrites this file)`);
  }
  const lang = langOf(file);
  const original = readFileSync(file, "utf8");
  const all = generateMutants(original, lang);
  const picked = sample(all, MAX, SEED);
  console.log(`\n## ${t.id}: ${rel}  (${lang}, ${all.length} mutants generated, ${picked.length} run)`);
  console.log(`   test: ${t.cmd}   (cwd ${relative(ROOT, cwd) || "."})`);

  const baseline = runCmd(t.cmd, cwd);
  if (!baseline.ok) {
    console.log(`   BASELINE FAILS (${baseline.timedOut ? "timeout" : "exit≠0"}) — cannot mutate. ${baseline.tail}`);
    summary.push({ id: t.id, file: rel, status: "baseline-failed", reason: baseline.tail });
    continue;
  }
  console.log(`   baseline: ok in ${(baseline.ms / 1000).toFixed(1)}s`);

  let killed = 0, survived = 0, timeouts = 0;
  const survivors = [];
  const lines = original.split("\n");
  for (let k = 0; k < picked.length; k++) {
    const m = picked[k];
    const mutatedLines = lines.slice();
    mutatedLines[m.line - 1] = m.mutated;
    restore = { path: file, content: original };
    writeFileSync(file, mutatedLines.join("\n"));
    const r = runCmd(t.cmd, cwd);
    restoreNow();
    const tag = r.timedOut ? "TIMEOUT" : r.ok ? "SURVIVED" : "killed";
    if (r.timedOut) timeouts++;
    else if (r.ok) {
      survived++;
      survivors.push(m);
    } else killed++;
    process.stdout.write(`   [${String(k + 1).padStart(3)}/${picked.length}] L${String(m.line).padEnd(4)} ${m.op.padEnd(18)} ${tag.padEnd(8)} ${(r.ms / 1000).toFixed(1)}s\n`);
  }
  const scored = killed + survived;
  const score = scored ? (100 * killed) / scored : 0;
  console.log(`   score: ${score.toFixed(1)}%  killed=${killed} survived=${survived} timeout=${timeouts} (timeouts count as killed by convention but are listed)`);
  for (const s of survivors) {
    console.log(`   SURVIVOR L${s.line} ${s.op}`);
    console.log(`     - ${s.original.trim()}`);
    console.log(`     + ${s.mutated.trim()}`);
  }
  summary.push({ id: t.id, file: rel, status: "ok", generated: all.length, run: picked.length, killed, survived, timeouts, score, survivors: survivors.map((s) => ({ line: s.line, op: s.op, original: s.original.trim(), mutated: s.mutated.trim() })) });
}

// ------------------------------------------------------------- report -----
console.log("\n## Summary");
console.log(pad("target", 22) + pad("file", 46) + pad("run", 5) + pad("killed", 8) + pad("surv", 6) + "score");
for (const s of summary) {
  if (s.status !== "ok") {
    console.log(pad(s.id, 22) + pad(s.file, 46) + `— ${s.status}${s.reason ? `: ${s.reason}` : ""}`);
    continue;
  }
  console.log(pad(s.id, 22) + pad(s.file, 46) + pad(s.run, 5) + pad(s.killed, 8) + pad(s.survived, 6) + `${s.score.toFixed(1)}%`);
}
if (args.json) writeFileSync(String(args.json), JSON.stringify({ at: new Date().toISOString(), max: MAX, seed: SEED, targets: summary }, null, 2));
if (args.md) {
  const md = [
    `### nf-mutate ${new Date().toISOString()} (max ${MAX} mutants/file, seed ${SEED})`,
    "",
    "| target | file | run | killed | survived | score |",
    "|---|---|---:|---:|---:|---:|",
    ...summary.map((s) => s.status === "ok" ? `| ${s.id} | \`${s.file}\` | ${s.run} | ${s.killed} | ${s.survived} | ${s.score.toFixed(1)}% |` : `| ${s.id} | \`${s.file}\` | — | — | — | ${s.status} |`),
    "",
    ...summary.filter((s) => s.status === "ok" && s.survivors.length).flatMap((s) => [`**${s.id} survivors**`, "", ...s.survivors.map((v) => `- L${v.line} \`${v.op}\`: \`${v.original}\` → \`${v.mutated}\``), ""]),
  ].join("\n");
  appendFileSync(String(args.md), md + "\n");
}
const threshold = args["min-score"] !== undefined ? Number(args["min-score"]) : null;
if (threshold !== null && summary.some((s) => s.status === "ok" && s.score < threshold)) process.exit(1);

// ------------------------------------------------------------ helpers -----
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}
function int(v, d) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
}
function pad(v, n) {
  return String(v).padEnd(n);
}
function die(msg) {
  console.error(`nf-mutate: ${msg}`);
  process.exit(2);
}
function checkRequires(what) {
  if (what === "cargo") return spawnSync("cargo", ["--version"], { stdio: "ignore" }).status === 0;
  if (what === "prisma-client") return existsSync(resolve(ROOT, "aof_backend/node_modules/.prisma/client/index.js"));
  return true;
}
/** Deterministic sample without replacement (mulberry32). */
function sample(list, n, seed) {
  if (list.length <= n) return list;
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n).sort((a, b) => a.line - b.line);
}
