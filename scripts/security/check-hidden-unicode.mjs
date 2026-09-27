#!/usr/bin/env node
/**
 * check-hidden-unicode — fail the build when a tracked text file contains
 * invisible or direction-changing Unicode.
 *
 *   node scripts/security/check-hidden-unicode.mjs            # all git-tracked text files
 *   node scripts/security/check-hidden-unicode.mjs --json out.json
 *   node scripts/security/check-hidden-unicode.mjs path/a.ts path/b.md
 *
 * Threat (SECURITY_CHECKLIST #76/#77): an attacker — or a dependency PR, or a
 * compromised contributor account — plants instructions that a human reviewer
 * cannot see but an AI auditor / coding agent reads: zero-width characters,
 * Unicode TAG characters (U+E0000..E007F encode ASCII invisibly), bidi
 * overrides that reorder what the diff shows ("Trojan Source", CVE-2021-42574),
 * or supplementary variation selectors used to smuggle bytes inside an emoji.
 * The same tricks hide "this file is out of audit scope" inside a comment.
 *
 * Policy
 *   FAIL  zero-width / format / bidi controls, TAG block, supplementary
 *         variation selectors, Hangul fillers, C0/C1 controls (except \t \n \r),
 *         BOM anywhere except byte 0.
 *   WARN  Private Use Area (icon fonts) — reported, never fails.
 *   Allowlist: scripts/security/hidden-unicode.allow.json ({ "path": ["U+XXXX"] }).
 *
 * Binary files (png/jpg/…, or any file with a NUL byte) are skipped.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const argv = process.argv.slice(2);
const jsonOut = argAfter("--json");
const quiet = argv.includes("--quiet");
const files = argv.filter((a) => !a.startsWith("--") && a !== jsonOut);

const BINARY_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "psd", "pdf", "zip", "gz", "br", "woff", "woff2", "ttf", "otf", "eot", "mp3", "ogg", "wav", "mp4", "webm", "so", "dylib", "dll", "wasm", "db", "sqlite", "keystore", "jar", "class", "pyc", "import", "uid", "fbx", "glb", "gltf", "blend", "unity", "asset", "prefab", "mat", "anim", "controller", "meta"]);

const FAIL_RANGES = [
  [0x0000, 0x0008, "C0 control"], [0x000b, 0x000c, "C0 control"], [0x000e, 0x001f, "C0 control"], [0x007f, 0x009f, "DEL / C1 control"],
  [0x00ad, 0x00ad, "SOFT HYPHEN"], [0x034f, 0x034f, "COMBINING GRAPHEME JOINER"], [0x061c, 0x061c, "ARABIC LETTER MARK (bidi)"],
  [0x115f, 0x1160, "HANGUL FILLER"], [0x17b4, 0x17b5, "KHMER INHERENT VOWEL (invisible)"], [0x180b, 0x180e, "MONGOLIAN FREE VARIATION SELECTOR / VOWEL SEPARATOR"],
  [0x200b, 0x200f, "ZERO WIDTH / LRM / RLM"], [0x202a, 0x202e, "BIDI EMBEDDING / OVERRIDE"], [0x2060, 0x2064, "WORD JOINER / INVISIBLE OPERATOR"],
  [0x2066, 0x206f, "BIDI ISOLATE / DEPRECATED FORMAT"], [0x3164, 0x3164, "HANGUL FILLER"], [0xfe00, 0xfe0e, "VARIATION SELECTOR 1-15"],
  [0xfeff, 0xfeff, "ZERO WIDTH NO-BREAK SPACE (BOM)"], [0xfff9, 0xfffb, "INTERLINEAR ANNOTATION"], [0xffa0, 0xffa0, "HALFWIDTH HANGUL FILLER"],
  [0x1bca0, 0x1bca3, "SHORTHAND FORMAT CONTROL"], [0x1d173, 0x1d17a, "MUSICAL SYMBOL FORMAT"], [0xe0000, 0xe007f, "TAG character (invisible ASCII)"],
  [0xe0100, 0xe01ef, "SUPPLEMENTARY VARIATION SELECTOR"],
];
// VS16 (U+FE0F) is how emoji are written in normal prose; it is allowed on purpose.
const WARN_RANGES = [[0xe000, 0xf8ff, "PRIVATE USE AREA"], [0xf0000, 0xffffd, "PRIVATE USE PLANE 15"], [0x100000, 0x10fffd, "PRIVATE USE PLANE 16"]];

const allowPath = resolve(HERE, "hidden-unicode.allow.json");
const allow = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, "utf8")) : {};

const list = files.length ? files : execSync("git ls-files -z --cached --others --exclude-standard", { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString("utf8").split("\0").filter(Boolean);
const findings = [];
const warnings = [];
let scanned = 0;
for (const rel of list) {
  const ext = rel.split(".").pop().toLowerCase();
  if (BINARY_EXT.has(ext)) continue;
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) continue;
  let buf;
  try {
    buf = readFileSync(abs);
  } catch {
    continue;
  }
  if (buf.includes(0)) continue; // binary
  scanned++;
  const text = buf.toString("utf8");
  const allowed = new Set((allow[rel] || []).map((cp) => parseInt(String(cp).replace(/^U\+/i, ""), 16)));
  let line = 1, col = 0;
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i);
    col++;
    if (cp === 0x0a) {
      line++;
      col = 0;
      continue;
    }
    if (cp > 0xffff) i++; // surrogate pair
    if (cp === 0x09 || cp === 0x0d) continue;
    if (cp < 0x80 && cp >= 0x20) continue;
    if (cp === 0xfeff && i === 0) continue; // leading BOM is legal
    if (allowed.has(cp)) continue;
    if (cp === 0x200d && isEmojiJoin(text, i)) continue; // 👨‍🌾 — ZWJ inside an emoji sequence
    const hit = FAIL_RANGES.find(([lo, hi]) => cp >= lo && cp <= hi);
    if (hit) {
      findings.push({ path: rel, line, col, codepoint: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`, name: hit[2], context: contextOf(text, i) });
      continue;
    }
    const warn = WARN_RANGES.find(([lo, hi]) => cp >= lo && cp <= hi);
    if (warn) warnings.push({ path: rel, line, col, codepoint: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`, name: warn[2], context: contextOf(text, i) });
  }
}

if (!quiet) {
  for (const f of findings) console.log(`FAIL ${f.path}:${f.line}:${f.col}  ${f.codepoint} ${f.name}   …${f.context}…`);
  for (const w of warnings) console.log(`warn ${w.path}:${w.line}:${w.col}  ${w.codepoint} ${w.name}   …${w.context}…`);
  console.log(`hidden-unicode: scanned ${scanned} text files — ${findings.length} finding(s), ${warnings.length} warning(s)`);
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ at: new Date().toISOString(), scanned, findings, warnings }, null, 2));
process.exit(findings.length ? 1 : 0);

function contextOf(text, i) {
  return text.slice(Math.max(0, i - 24), i + 24).replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff\ufff9-\ufffb\uffa0]/g, (c) => `<U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}>`).replace(/[\ud800-\udbff][\udc00-\udfff]/g, (p) => {
    const cp = p.codePointAt(0);
    return cp >= 0xe0000 ? `<U+${cp.toString(16).toUpperCase()}>` : p;
  }).replace(/\n/g, "⏎");
}
/** ZWJ is legitimate only when glued between two pictographic code points (or emoji modifiers). */
function isEmojiJoin(text, i) {
  const before = text.slice(Math.max(0, i - 4), i);
  const after = text.slice(i + 1, i + 5);
  const pict = /(\p{Extended_Pictographic}|\p{Emoji_Modifier}|\uFE0F)$/u;
  const pictNext = /^(\p{Extended_Pictographic}|\p{Emoji_Modifier})/u;
  return pict.test(before) && pictNext.test(after);
}
function argAfter(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : null;
}
