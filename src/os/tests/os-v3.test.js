"use strict";
/** Watchtower OS v3 — test suite (node:test, zero deps). Run: npm test */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

const { GAME, PROGRAMS, PROGRAM_IDS, SESSION_KEYS, checkGameId } = require("../config");
const { VERSION, TOTAL, COMPONENTS, PRODUCT_INDEX, DEDUP_DECISIONS } = require("../stack-v3");
const { SDKS, SDK_IDS, GODOT_V3_SDKS } = require("../sdk-configs");
const { INFRA_IDS } = require("../infra-configs");
const { strategyFor, strategyMatrix, ITEM_TYPES, RARITIES } = require("../assets-strategy");
const { CONTROL_PANELS_V3, PANELS_TOTAL } = require("../control-panels-v3");
const { buildHandoff, buildFinalReport, FINAL_REPORT_POINTS } = require("../handoff-v3");
const { createOsServer } = require("../server");

const ROOT = join(__dirname, "..", "..", "..");

// ── OS config / stack ───────────────────────────────────────────────────────

test("stack v3 has exactly 33 deduplicated components", () => {
  assert.equal(VERSION, "v3");
  assert.equal(TOTAL, 33);
  assert.equal(COMPONENTS.length, 33);
  assert.equal(new Set(COMPONENTS.map((c) => c.id)).size, 33);
  assert.equal(COMPONENTS[0].n, 1);
  assert.equal(COMPONENTS[32].n, 33);
});

test("every named product of the AOF v3 spec maps to a component", () => {
  for (const product of [
    "Privy", "Phantom FirstStep", "Altude", "Session Keys", "cNFT Bubblegum v2",
    "Core Attributes", "Xandeum", "LaserStream", "Shyft", "PostgreSQL TimescaleDB Redis",
    "Sonic HyperGrid", "MagicBlock ER REPLA", "Arcium", "PST", "Helika", "GameSight",
    "Game Signals ML", "Magic Eden", "GameShift", "Tensor", "Gamba", "Husks",
    "RitArena", "RACE", "Access Protocol", "idosgames", "Unity", "Godot",
    "relayzero", "StealthSDK", "Security Auditing Skill", "Sentio", "SolGuard",
    "SLAM", "Preset", "ARC", "Bolt", "DePIN", "Rust Actix",
  ]) {
    assert.ok(PRODUCT_INDEX[product], `product missing from productIndex: ${product}`);
  }
});

test("spec dedup decisions: Preset, RitArena, SolGuard", () => {
  assert.equal(DEDUP_DECISIONS.length, 3);
  const kept = DEDUP_DECISIONS.map((d) => d.kept);
  assert.deepEqual(kept, ["Preset", "RitArena", "SolGuard"]);
  const dropped = DEDUP_DECISIONS.map((d) => d.dropped);
  assert.deepEqual(dropped, ["create-solana-game", "Aureus", "SolShield"]);
});

test("program_ids: 6 real program crates (Anchor.toml) + 2 null placeholders [AOF-H2]", () => {
  assert.deepEqual(PROGRAM_IDS, [
    "AOF_CORE_PROGRAM_ID",
    "4BhD6spJHdvHQ9mgyaU6AUSLU37oJbTMCDcAXyWhMRVo",
    "4fNKhVw2nErWZBBw9hgWD3Metu1UKbDLdhFGWbCewdLU",
    "4rMWC1h9mt6JTfBsUPYLMCydPED4e31cffmix5nZyuRb",
    "Gvbo9wDEW6kCzzhjk3stEcZoVtcScbN8mGv9SNwTUJLv",
    "6ZnnyKkv1kUE4AJqi5uwdh5ZX6VFGfbQiwhGSkfqZ9K5",
    "CgInv111...",
    "STrEaSuRy111...",
  ]);
  // placeholders must carry NO address: clients skip RPC probes for them
  for (const ph of ["CgInv111...", "STrEaSuRy111..."]) {
    const entry = PROGRAMS.find((p) => p.key === ph);
    assert.ok(entry, `placeholder ${ph} present`);
    assert.equal(entry.programId, null, `${ph} must have programId null`);
    assert.equal(entry.status, "placeholder");
  }
  // real entries carry registry addresses and honest verification status
  const core = PROGRAMS.find((p) => p.alias === "aof_core");
  assert.equal(core.programId, "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq");
  assert.equal(core.status, "reference-unverified");
  assert.equal(core.rpcVerifiedAt, null);
  assert.equal(GAME.gameId, "aof");
  assert.equal(GAME.tenantId, "aof");
  assert.equal(GAME.network, "stage");
  assert.equal(GAME.stage, "prototype");
});

test("session keys: createSession AOF_CORE_PROGRAM_ID, topUp 0.01 SOL, expiry 60 min", () => {
  // [AOF-H2] session-keys program = real anchor id, not the legacy placeholder
  assert.equal(SESSION_KEYS.program, "6ZnnyKkv1kUE4AJqi5uwdh5ZX6VFGfbQiwhGSkfqZ9K5");
  assert.equal(SESSION_KEYS.createSession.on, "AOF_CORE_PROGRAM_ID");
  assert.equal(SESSION_KEYS.topUpSol, 0.01);
  assert.equal(SESSION_KEYS.expiryMinutes, 60);
  assert.ok(SESSION_KEYS.forbiddenIxs.includes("withdraw"));
});

test("gameId gate: aof ok, foreign gameId rejected", () => {
  assert.equal(checkGameId("aof").ok, true);
  assert.equal(checkGameId(undefined).ok, true);
  assert.equal(checkGameId("ares").ok, false);
});

// ── control panels / handoff ────────────────────────────────────────────────

test("19 control panels in src/os/control-panels-v3.js", () => {
  assert.equal(PANELS_TOTAL, 19);
  assert.equal(CONTROL_PANELS_V3.length, 19);
  assert.equal(new Set(CONTROL_PANELS_V3.map((p) => p.id)).size, 19);
  for (const p of CONTROL_PANELS_V3) assert.ok(p.controls.length > 0 && p.components.length > 0);
});

test("handoff-v3: cross-game PDA studio_profile + RACE + idosgames + RLS materials", () => {
  const h = buildHandoff();
  assert.equal(h.protocol.id, "handoff-v3");
  assert.deepEqual(h.crossGame.studioPda.seeds, ["studio_profile"]);
  assert.deepEqual(h.crossGame.linkedWallets.providers, ["RACE", "idosgames"]);
  assert.ok(h.crossGame.materials.rls.includes("tenant_id"));
  assert.equal(h.crossGame.materials.materializedView, "mv_cross_game_materials_aof");
  assert.equal(h.agents.length, 4); // Husks + RitArena + relayzero + StealthSDK
});

test("final report: exactly 20 пунктов", () => {
  assert.equal(FINAL_REPORT_POINTS.length, 20);
  const r = buildFinalReport();
  assert.equal(r.total, 20);
  assert.equal(r.points.length, 20);
  assert.equal(r.points[0].n, 1);
  assert.equal(r.points[19].n, 20);
  assert.equal(r.document, "FINAL_REPORT_V3.md");
});

// ── assets strategy ─────────────────────────────────────────────────────────

test("assets strategy: common/common -> cNFT $110/M, Tensor primary", () => {
  const s = strategyFor("common", "common");
  assert.equal(s.standard, "cNft");
  assert.equal(s.compression.mintCostUsdPerMillion, 110);
  assert.equal(s.compression.protocol, "Bubblegum v2");
  assert.equal(s.marketplacePrimary, "Tensor");
});

test("assets strategy: golden tools + land -> Standard NFT (GrowthStage, Position)", () => {
  for (const itemType of ["golden_tool", "land"]) {
    const s = strategyFor(itemType, "legendary");
    assert.equal(s.standard, "standard-nft");
    assert.ok(s.attributes.includes("GrowthStage"));
    assert.ok(s.attributes.includes("Position"));
  }
});

test("assets strategy: seeds/crops/materials compressed; matrix covers itemType x rarity", () => {
  for (const t of ["seed", "crop", "material"]) {
    assert.equal(strategyFor(t, "common").standard, "cNft");
    assert.equal(strategyFor(t, "epic").standard, "cNft");
  }
  const m = strategyMatrix();
  assert.equal(m.total, ITEM_TYPES.length * RARITIES.length);
  assert.equal(m.rows.length, m.total);
});

test("assets strategy: invalid params -> 400", () => {
  assert.throws(() => strategyFor("banana", "common"), /unsupported strategy query/);
  assert.throws(() => strategyFor("common", "mythic"), /unsupported strategy query/);
});

// ── SDK / infra registries ──────────────────────────────────────────────────

test("14 SDK endpoints: godot-solana + 13 v3 best-free SDKs", () => {
  assert.equal(SDK_IDS.length, 14);
  assert.ok(SDK_IDS.includes("godot-solana"));
  for (const id of GODOT_V3_SDKS) assert.ok(SDK_IDS.includes(id), `missing v3 sdk: ${id}`);
  assert.equal(GODOT_V3_SDKS.length, 13);
});

test("sdk facts: gamba 5%, ritarena over Aureus, solguard 130+ over SolShield, preset over create-solana-game", () => {
  assert.equal(SDKS.gamba.houseEdgePercent, 5);
  assert.equal(SDKS.ritarena.chosenOver, "Aureus");
  assert.equal(SDKS.ritarena.lifecycle.retryEvents, true);
  assert.equal(SDKS.solguard.checks, 130);
  assert.equal(SDKS.solguard.chosenOver, "SolShield");
  assert.equal(SDKS.preset.chosenOver, "create-solana-game");
  assert.equal(SDKS.preset.official, true);
});

test("infra registry covers arc / bolt / depin / actix / storage / privacy", () => {
  for (const id of ["arc", "bolt", "depin", "actix", "preset", "xandeum", "pst", "core-attributes", "arcium", "access", "idosgames", "crossgame", "overview"]) {
    assert.ok(INFRA_IDS.includes(id), `missing infra: ${id}`);
  }
});

// ── HTTP API («API проверки» exactly as specified) ──────────────────────────

let server;
let base;

before(async () => {
  server = createOsServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server && server.close());

async function getJson(path) {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
}

test("GET /api/os/config — v3 33 components", async () => {
  const { status, body } = await getJson("/api/os/config");
  assert.equal(status, 200);
  assert.equal(body.version, "v3");
  assert.equal(body.componentsTotal, 33);
  assert.equal(body.components.length, 33);
  assert.equal(body.controlPanels.total, 19);
  assert.deepEqual(body.programIds, PROGRAM_IDS);
  assert.ok(body.programIds.includes("AOF_CORE_PROGRAM_ID"));
  assert.equal(body.programs.length, PROGRAMS.length);
});

test("GET /api/sdk/godot-solana?gameId=aof", async () => {
  const { body } = await getJson("/api/sdk/godot-solana?gameId=aof");
  assert.equal(body.gameId, "aof");
  for (const m of ["SolanaClient", "WalletAdapter", "AnchorProgram", "CandyMachine", "SplBuilders", "SessionKeys"]) {
    assert.ok(body.modules.includes(m), `module ${m}`);
  }
  assert.equal(body.v3Sdks.length, 13);
  assert.equal(body.claudeSkill.path, ".claude/skills/godot-solana/SKILL.md");
  assert.equal(body.securityAuditingSkill.path, ".claude/skills/security-auditing/SKILL.md");
});

test("GET /api/sdk/gamba?gameId=aof", async () => {
  const { body } = await getJson("/api/sdk/gamba?gameId=aof");
  assert.equal(body.gameId, "aof");
  assert.equal(body.wager, "NFT");
  assert.equal(body.provablyFair, "commit-reveal");
  assert.equal(body.houseEdgePercent, 5);
  assert.equal(body.jackpot, true);
});

test("GET /api/sdk/preset?gameId=aof&template=farming", async () => {
  const ok = await getJson("/api/sdk/preset?gameId=aof&template=farming");
  assert.equal(ok.status, 200);
  assert.equal(ok.body.template, "farming");
  assert.equal(ok.body.official, true);
  const bad = await getJson("/api/sdk/preset?gameId=aof&template=nope");
  assert.equal(bad.status, 400);
});

test("GET /api/sdk/ritarena?gameId=aof — best free arena over Aureus", async () => {
  const { body } = await getJson("/api/sdk/ritarena?gameId=aof");
  assert.equal(body.chosenOver, "Aureus");
  assert.equal(body.lifecycle.retryEvents, true);
  assert.equal(body.lifecycle.maxRetries, 5);
});

for (const id of ["xandeum", "pst", "core-attributes", "access-protocol", "idosgames-wallet", "security-auditing-skill", "sentio-cli", "solguard", "solana-slam", "arcium"]) {
  test(`GET /api/sdk/${id}?gameId=aof`, async () => {
    const { status, body } = await getJson(`/api/sdk/${id}?gameId=aof`);
    assert.equal(status, 200);
    assert.equal(body.gameId, "aof");
    assert.equal(body.sdk, id);
  });
}

for (const id of ["arc", "bolt", "depin", "actix", "overview"]) {
  test(`GET /api/infra/${id}?gameId=aof`, async () => {
    const { status, body } = await getJson(`/api/infra/${id}?gameId=aof`);
    assert.equal(status, 200);
    assert.equal(body.gameId, "aof");
  });
}

test("GET /api/game-signals/config?gameId=aof — ML 60M+, churn 14d >85%", async () => {
  const { body } = await getJson("/api/game-signals/config?gameId=aof");
  assert.equal(body.gameId, "aof");
  assert.equal(body.ml.trainingCorpus.transactions, "60M+");
  assert.equal(body.ml.trainingCorpus.games, 12);
  const churn = body.ml.models.find((m) => m.name === "churn-14d");
  assert.equal(churn.threshold, 0.85);
});

test("GET /api/l2/router?gameId=aof&tps=low&ux=gasless — MagicBlock ER sub-10ms gasless", async () => {
  const { status, body } = await getJson("/api/l2/router?gameId=aof&tps=low&ux=gasless");
  assert.equal(status, 200);
  assert.equal(body.gameId, "aof");
  assert.deepEqual(body.input, { tps: "low", ux: "gasless" });
  assert.equal(body.route.primary, "magicblock-er");
  assert.ok(body.route.latencyMs <= 10);
  assert.deepEqual(body.route.flow, ["delegate", "executeGasless", "commit state"]);
  assert.ok(body.route.magicActions.includes("auto-harvest"));
  const high = await getJson("/api/l2/router?gameId=aof&tps=high&ux=private");
  assert.equal(high.body.route.primary, "sonic-hypergrid");
  assert.equal(high.body.privacy.confidential, "arcium");
  const bad = await getJson("/api/l2/router?gameId=aof&tps=moon");
  assert.equal(bad.status, 400);
});

test("GET /api/assets/strategy?gameId=aof&itemType=common&rarity=common", async () => {
  const { status, body } = await getJson("/api/assets/strategy?gameId=aof&itemType=common&rarity=common");
  assert.equal(status, 200);
  assert.equal(body.gameId, "aof");
  assert.equal(body.itemType, "common");
  assert.equal(body.rarity, "common");
  assert.equal(body.standard, "cNft");
});

test("control panels / handoff / final report endpoints", async () => {
  const panels = await getJson("/api/os/control-panels?gameId=aof");
  assert.equal(panels.body.total, 19);
  const handoff = await getJson("/api/os/handoff?gameId=aof");
  assert.equal(handoff.body.gameId, "aof");
  const report = await getJson("/api/os/final-report?gameId=aof");
  assert.equal(report.body.total, 20);
});

test("foreign gameId -> 404; non-GET -> 405", async () => {
  const { status } = await getJson("/api/os/config?gameId=ares-1");
  assert.equal(status, 404);
  const res = await fetch(base + "/api/os/config", { method: "POST" });
  assert.equal(res.status, 405);
});

// ── Unity/Godot project layout (v1 7 layers + v2 12 products + v3 13 SDKs) ──

test("godot project: 7 layers + 12 products + 13 v3 SDKs on disk", () => {
  const godot = join(ROOT, "game", "godot");
  assert.ok(existsSync(join(godot, "project.godot")), "project.godot");
  assert.equal(readdirSync(join(godot, "layers")).filter((f) => f.endsWith(".gd")).length, 7);
  assert.equal(readdirSync(join(godot, "products")).filter((f) => f.endsWith(".gd")).length, 12);
  assert.equal(readdirSync(join(godot, "sdk")).filter((f) => f.endsWith(".gd")).length, 13);
  for (const m of ["solana_client", "wallet_adapter", "anchor_program", "candy_machine", "spl_builders", "session_keys"]) {
    assert.ok(existsSync(join(godot, "chain", `${m}.gd`)), `chain/${m}.gd`);
  }
});

test("unity mirror + skills + docs exist", () => {
  for (const p of [
    "game/unity/README.md",
    "game/README.md",
    ".claude/skills/godot-solana/SKILL.md",
    ".claude/skills/security-auditing/SKILL.md",
    "WATCHTOWER_INTEGRATION.md",
    "docs/WATCHTOWER_OS_V3.md",
    "FINAL_REPORT_V3.md",
    "src/os/sql/cross_game_materials.sql",
  ]) assert.ok(existsSync(join(ROOT, p)), p);
});
