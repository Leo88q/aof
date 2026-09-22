"use strict";
/**
 * Runtime smoke (devnet) for Watchtower OS v3.
 *
 * 1. boots the OS API (or reuses SMOKE_BASE_URL) on an ephemeral port;
 * 2. hits every endpoint of the «API проверки» list and asserts shape
 *    (v3 / 33 components / 19 panels / 20 points / gameId=aof echo);
 * 3. unless --offline, probes Solana devnet RPC (getHealth/getVersion) and the
 *    deployed program ids (AOF_CORE_PROGRAM_ID, SessKeys deployed id) — the
 *    probe is advisory for stage/prototype and never fails the smoke.
 *
 * Usage: node smoke-devnet.js [--offline]   (exit 0 = pass)
 */
const { spawn } = require("node:child_process");
const { createOsServer } = require("./server");
const { PROGRAMS } = require("./config");

const OFFLINE = process.argv.includes("--offline");
const EXTERNAL = process.env.SMOKE_BASE_URL || "";
const DEVNET_RPC = process.env.SMOKE_DEVNET_RPC || "https://api.devnet.solana.com";

let passed = 0;
let failed = 0;
const notes = [];

function report(name, ok, detail) {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function get(base, path) {
  const res = await fetch(base + path, { headers: { accept: "application/json" } });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function rpc(method, params) {
  const res = await fetch(DEVNET_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  return res.json();
}

async function run(base) {
  console.log(`\n== Watchtower OS v3 smoke — base ${base} (${OFFLINE ? "offline" : "devnet probe allowed"}) ==\n`);

  // ── API проверки ─────────────────────────────────────────────────────────
  const checks = [
    ["GET /api/os/config", "/api/os/config", (b) => b.version === "v3" && b.componentsTotal === 33 && b.components.length === 33 && Array.isArray(b.programIds) && b.programIds.includes("AOF_CORE_PROGRAM_ID")],
    ["GET /api/sdk/godot-solana", "/api/sdk/godot-solana?gameId=aof", (b) => b.gameId === "aof" && Array.isArray(b.modules) && b.modules.includes("SolanaClient") && Array.isArray(b.v3Sdks) && b.v3Sdks.length === 13],
    ["GET /api/sdk/gamba", "/api/sdk/gamba?gameId=aof", (b) => b.houseEdgePercent === 5 && b.wager === "NFT"],
    ["GET /api/sdk/preset", "/api/sdk/preset?gameId=aof&template=farming", (b) => b.template === "farming" && b.official === true && b.chosenOver === "create-solana-game"],
    ["GET /api/sdk/ritarena", "/api/sdk/ritarena?gameId=aof", (b) => b.chosenOver === "Aureus" && b.lifecycle.retryEvents === true],
    ["GET /api/sdk/xandeum", "/api/sdk/xandeum?gameId=aof", (b) => b.capacity === "exabyte"],
    ["GET /api/sdk/pst", "/api/sdk/pst?gameId=aof", (b) => Array.isArray(b.guarantees) && b.guarantees.includes("privacy")],
    ["GET /api/sdk/core-attributes", "/api/sdk/core-attributes?gameId=aof", (b) => b.dasReadMs === 5],
    ["GET /api/sdk/access-protocol", "/api/sdk/access-protocol?gameId=aof", (b) => b.mechanic === "stake-to-access"],
    ["GET /api/sdk/idosgames-wallet", "/api/sdk/idosgames-wallet?gameId=aof", (b) => b.bridge && b.rewardPool !== undefined || b.bridge?.rewards === "RewardPool"],
    ["GET /api/sdk/security-auditing-skill", "/api/sdk/security-auditing-skill?gameId=aof", (b) => typeof b.skillPath === "string"],
    ["GET /api/sdk/sentio-cli", "/api/sdk/sentio-cli?gameId=aof", (b) => b.sdk === "sentio-cli"],
    ["GET /api/sdk/solguard", "/api/sdk/solguard?gameId=aof", (b) => b.checks === 130 && b.chosenOver === "SolShield"],
    ["GET /api/sdk/solana-slam", "/api/sdk/solana-slam?gameId=aof", (b) => b.runtime === "LiteSVM"],
    ["GET /api/sdk/arcium", "/api/sdk/arcium?gameId=aof", (b) => Array.isArray(b.circuits)],
    ["GET /api/infra/arc", "/api/infra/arc?gameId=aof", (b) => Array.isArray(b.components) && b.components.includes("GrowthStage")],
    ["GET /api/infra/bolt", "/api/infra/bolt?gameId=aof", (b) => b.systems.includes("plant") && b.entities.includes("Plot")],
    ["GET /api/infra/depin", "/api/infra/depin?gameId=aof", (b) => b.workerStakeSol === 10 && b.escrowSolPer100Players === 0.1],
    ["GET /api/infra/actix", "/api/infra/actix?gameId=aof", (b) => typeof b.entry === "string"],
    ["GET /api/infra/overview", "/api/infra/overview?gameId=aof", (b) => Array.isArray(b.components)],
    ["GET /api/game-signals/config", "/api/game-signals/config?gameId=aof", (b) => b.gameId === "aof" && b.ml.trainingCorpus.transactions === "60M+" && b.ml.models.some((m) => m.name === "churn-14d" && m.threshold === 0.85)],
    ["GET /api/l2/router", "/api/l2/router?gameId=aof&tps=low&ux=gasless", (b) => b.gameId === "aof" && b.route.primary === "magicblock-er" && b.route.magicActions.includes("auto-harvest")],
    ["GET /api/assets/strategy", "/api/assets/strategy?gameId=aof&itemType=common&rarity=common", (b) => b.gameId === "aof" && b.standard === "cNft" && b.compression.mintCostUsdPerMillion === 110],
    ["GET /api/os/control-panels", "/api/os/control-panels?gameId=aof", (b) => b.total === 19 && b.panels.length === 19],
    ["GET /api/os/handoff", "/api/os/handoff?gameId=aof", (b) => b.crossGame.studioPda.seeds.includes("studio_profile") && b.crossGame.linkedWallets.providers.includes("RACE")],
    ["GET /api/os/final-report", "/api/os/final-report?gameId=aof", (b) => b.total === 20 && b.points.length === 20],
    ["GET /api/health", "/api/health", (b) => b.ok === true && b.signerCapability === false],
  ];

  for (const [name, path, assert] of checks) {
    try {
      const { status, body } = await get(base, path);
      if (status !== 200) report(name, false, `status ${status}`);
      else if (!assert(body)) report(name, false, "assertion failed");
      else report(name, true);
    } catch (e) {
      report(name, false, String(e.message || e));
    }
  }

  // unknown gameId must be rejected
  try {
    const { status } = await get(base, "/api/os/config?gameId=other");
    report("GET /api/os/config?gameId=other -> 404", status === 404, `status ${status}`);
  } catch (e) {
    report("GET /api/os/config?gameId=other -> 404", false, String(e.message || e));
  }

  // ── devnet probe (advisory for stage/prototype) ──────────────────────────
  if (OFFLINE) {
    notes.push("devnet probe skipped (--offline)");
    return;
  }
  try {
    const health = await rpc("getHealth", []);
    const ok = health?.result === "ok" || typeof health?.result === "string";
    report("devnet RPC getHealth", ok, JSON.stringify(health?.result ?? health?.error ?? {}).slice(0, 80));
    for (const p of PROGRAMS) {
      const id = p.deployedId || p.programId;
      try {
        const r = await rpc("getAccountInfo", [id, { encoding: "base64" }]);
        const found = Boolean(r?.result?.value);
        notes.push(`program ${p.key} (${id}): ${found ? "account found" : "not found (placeholder or undeployed — ok for stage/prototype)"}`);
        console.log(`INFO  program ${p.key} -> ${found ? "found" : "absent"}`);
      } catch {
        console.log(`INFO  program ${p.key} -> rpc unavailable (skipped)`);
      }
    }
  } catch (e) {
    notes.push(`devnet probe unavailable: ${e.message || e} — tolerated for stage/prototype`);
    console.log(`INFO  devnet RPC unreachable (${e.message || e}) — tolerated`);
  }
}

async function main() {
  let base = EXTERNAL;
  let server = null;
  if (!base) {
    server = createOsServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  try {
    await run(base);
  } finally {
    if (server) server.close();
  }
  console.log(`\n== smoke result: ${passed} passed, ${failed} failed ==`);
  for (const n of notes) console.log(`NOTE  ${n}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(1);
});
