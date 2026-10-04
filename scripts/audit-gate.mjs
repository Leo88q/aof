#!/usr/bin/env node
/**
 * [SECURITY_CHECKLIST #66] Blocking dependency audit for shipped code: any
 * high/critical vulnerability in the RUNTIME dependencies of frontend/,
 * aof_backend/ or the workspace root fails CI, unless every path to it ends in
 * an advisory reviewed in audit-allowlist.json (with a reason and an expiry).
 *
 * The coverage check walks the advisory graph to its *leaves* (advisory
 * objects) instead of recursing with a "back edge = failure" rule: npm's graph
 * is cyclic (metro <-> metro-config, react-native <-> virtualized-lists), and
 * a cycle that only leads to reviewed advisories used to be unfixable — no
 * allowlist entry could ever satisfy it. Reachability implements the rule in
 * the header literally: a package is covered when every high/critical advisory
 * reachable from it is reviewed, no matter how many dependency cycles it sits
 * in. `--self-test` pins both the chain and the cycle semantics.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const TARGETS = ["frontend", "aof_backend", "."];
const HIGH = new Set(["high", "critical"]);

/**
 * All advisory leaves reachable from a vulnerable package, cycle-safe.
 * String `via` entries are dependency edges; object entries are advisories.
 */
export function reachableAdvisories(vulns, name) {
  const out = [];
  const stack = [name];
  const seen = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    const vuln = vulns[current];
    if (!vuln) continue;
    for (const via of vuln.via) {
      if (typeof via === "string") stack.push(via);
      else out.push(via);
    }
  }
  return out;
}

/**
 * Unreviewed high/critical advisories per package. A package fails when any
 * high/critical advisory reachable from it is missing from `allowed`.
 */
export function uncoveredAdvisories(vulns, allowed, label = "test") {
  const failures = [];
  for (const [name, vuln] of Object.entries(vulns)) {
    if (!HIGH.has(vuln.severity)) continue;
    const unreviewed = reachableAdvisories(vulns, name)
      .filter((advisory) => HIGH.has(advisory.severity) && !allowed.has(advisory.url));
    if (unreviewed.length) failures.push(`${label}: ${vuln.severity} ${name} (${vuln.range})`);
  }
  return failures;
}

const advisory = (severity, url) => ({ severity, url });
const node = (severity, via, range = "*") => ({ severity, via, range });

function selfTest() {
  const cases = [
    ["clean tree", {}, [], []],
    ["direct high advisory, unreviewed",
      { braces: node("high", [advisory("high", "GHSA-x")]) }, [],
      ["test: high braces (*)"]],
    ["direct high advisory, reviewed",
      { braces: node("high", [advisory("high", "GHSA-x")]) }, ["GHSA-x"],
      []],
    ["chain to unreviewed high",
      { metro: node("high", ["micromatch"]), micromatch: node("high", ["braces"]),
        braces: node("high", [advisory("high", "GHSA-x")]) }, [],
      ["test: high metro (*)", "test: high micromatch (*)", "test: high braces (*)"]],
    ["chain to reviewed high",
      { metro: node("high", ["micromatch"]), micromatch: node("high", ["braces"]),
        braces: node("high", [advisory("high", "GHSA-x")]) }, ["GHSA-x"],
      []],
    ["cycle whose only leaf is reviewed",
      { metro: node("high", ["metro-config", "metro-file-map"]),
        "metro-config": node("high", ["metro"]),
        "metro-file-map": node("high", ["micromatch"]),
        micromatch: node("high", ["braces"]),
        braces: node("high", [advisory("high", "GHSA-x")]) }, ["GHSA-x"],
      []],
    ["cycle with one unreviewed leaf",
      { metro: node("high", ["metro-config"]), "metro-config": node("high", ["metro", "braces"]),
        braces: node("high", [advisory("high", "GHSA-x")]) }, [],
      ["test: high metro (*)", "test: high metro-config (*)", "test: high braces (*)"]],
    ["moderate leaves never fail",
      { metro: node("high", ["braces"]), braces: node("moderate", [advisory("moderate", "GHSA-x")]) }, [],
      []],
  ];
  let failed = 0;
  for (const [name, vulns, allowedList, expected] of cases) {
    const got = uncoveredAdvisories(vulns, new Set(allowedList));
    const ok = JSON.stringify(got) === JSON.stringify(expected);
    if (!ok) {
      failed += 1;
      console.error(`self-test FAILED: ${name}\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
    }
  }
  if (failed) process.exit(1);
  console.log(`audit gate self-test: ${cases.length} cases (chains, cycles, allowlist, moderate) passed`);
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const allowlist = JSON.parse(readFileSync(new URL("../audit-allowlist.json", import.meta.url), "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  const allowed = new Set(allowlist.advisories.filter((a) => a.expires >= today).map((a) => a.url));
  const failures = allowlist.advisories.filter((a) => a.expires < today).map((a) => `allowlist entry expired on ${a.expires}: ${a.url}`);

  function audit(dir) {
    try {
      return JSON.parse(execFileSync("npm", ["audit", "--omit=dev", "--json"], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
    } catch (e) {
      if (e.stdout) return JSON.parse(e.stdout); // npm exits non-zero when it finds anything
      throw e;
    }
  }

  for (const dir of TARGETS) {
    failures.push(...uncoveredAdvisories(audit(dir).vulnerabilities || {}, allowed, dir));
  }

  if (failures.length) {
    console.error("audit gate FAILED - unreviewed high/critical runtime vulnerabilities:\n  " + failures.join("\n  "));
    console.error("Fix/upgrade, or add a reviewed entry (reason + expiry) to audit-allowlist.json.");
    process.exit(1);
  }
  console.log(`audit gate: no unreviewed high/critical runtime vulnerabilities in ${TARGETS.join(", ")}`);
}
