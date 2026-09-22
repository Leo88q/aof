"use strict";
/**
 * Watchtower OS v3 — verification API (zero-dependency Node HTTP server).
 *
 * GET /api/os/config                  v3, 33 ideal-free components
 * GET /api/os/control-panels[/:id]    19 control panels
 * GET /api/os/handoff                 handoff-v3 manifest (cross-game + agents)
 * GET /api/os/final-report            20 пунктов
 * GET /api/sdk/:sdkId?gameId=aof      godot-solana | gamba | preset | ritarena |
 *                                     xandeum | pst | core-attributes |
 *                                     access-protocol | idosgames-wallet |
 *                                     security-auditing-skill | sentio-cli |
 *                                     solguard | solana-slam | arcium
 * GET /api/infra/:id?gameId=aof       arc | bolt | depin | actix | preset |
 *                                     xandeum | pst | core-attributes | arcium |
 *                                     access | idosgames | crossgame | overview
 * GET /api/game-signals/config?gameId=aof
 * GET /api/l2/router?gameId=aof&tps=low&ux=gasless   (tps=low|high, ux=gasless|cheap|private|settled)
 * GET /api/assets/strategy?gameId=aof&itemType=common&rarity=common
 * GET /api/health
 *
 * GET only (405 otherwise). gameId defaults to `aof`, any other gameId -> 404.
 */
const http = require("node:http");
const { URL } = require("node:url");
const { GAME, PROGRAMS, PROGRAM_IDS, SESSION_KEYS, DEPIN, GAMBA, CROSS_GAME, checkGameId } = require("./config");
const { VERSION, TOTAL, COMPONENTS, PRODUCT_INDEX, DEDUP_DECISIONS, componentsByCategory } = require("./stack-v3");
const { SDKS, SDK_IDS, getSdk } = require("./sdk-configs");
const { INFRA, INFRA_IDS } = require("./infra-configs");
const { gameSignalsConfig } = require("./game-signals");
const { strategyFor, strategyMatrix, ITEM_TYPES, RARITIES } = require("./assets-strategy");
const { l2Route, TPS_VALUES, UX_VALUES } = require("./l2-router");
const { CONTROL_PANELS_V3, PANELS_TOTAL, getPanel } = require("./control-panels-v3");
const { buildHandoff, buildFinalReport, FINAL_REPORT_POINTS } = require("./handoff-v3");

function osConfig() {
  return {
    gameId: GAME.gameId,
    tenantId: GAME.tenantId,
    name: GAME.name,
    genre: GAME.genre,
    version: VERSION,
    stack: "Watchtower OS v3 — Ideal Free Stack",
    network: GAME.network,
    stage: GAME.stage,
    commitment: GAME.commitment,
    componentsTotal: TOTAL,
    componentsCount: TOTAL,
    components: COMPONENTS,
    componentsByCategory: componentsByCategory(),
    productIndex: PRODUCT_INDEX,
    dedupDecisions: DEDUP_DECISIONS,
    idealFree: {
      identity: ["Privy", "Phantom FirstStep", "Altude", "Session Keys 0.01 SOL"],
      assets: ["cNFT $110/M", "Core Attributes", "Xandeum"],
      indexer: ["LaserStream", "Shyft gPA 15ms", "PG"],
      l2: ["Sonic HyperGrid", "MagicBlock ER sub-10ms gasless Magic Actions", "Arcium confidential", "PST private", "Xandeum exabyte"],
      analytics: ["Helika", "GameSight", "Game Signals ML 60M+ churn >85%"],
      marketplace: ["ME 120 QPM", "Shyft escrow-less", "GameShift USD 170+", "Tensor", "Gamba", "Husks", "RitArena", "RACE", "Access", "idosgames"],
      engines: ["Unity Godot detailed", "Gamba", "Preset official", "RitArena best free", "relayzero", "StealthSDK", "Xandeum", "PST", "Core Attributes", "Access", "idosgames", "SecuritySkill", "Sentio", "SolGuard", "SLAM", "Arcium — 13 SDKs"],
      infra: ["ARC", "Bolt", "DePIN", "Arcium", "Xandeum", "PST", "Core Attributes", "Preset", "Rust Actix", "Access", "idosgames"],
      security: ["Skill", "Sentio", "SolGuard"],
      testing: ["SLAM", "Preset"],
      storage: ["Xandeum", "PST", "Core Attributes"],
      privacy: ["PST", "Arcium"],
      monetization: ["Access", "idosgames", "GameShift USD", "Gamba"],
      aiAgents: ["Husks", "RitArena best free", "relayzero", "StealthSDK"],
      crossChain: ["RACE", "idosgames"],
    },
    programIds: PROGRAM_IDS,
    programs: PROGRAMS,
    sessionKeys: SESSION_KEYS,
    depin: DEPIN,
    gamba: GAMBA,
    crossGame: CROSS_GAME,
    controlPanels: { total: PANELS_TOTAL, file: "src/os/control-panels-v3.js", url: "/api/os/control-panels" },
    handoff: { file: "src/os/handoff-v3.js", url: "/api/os/handoff" },
    finalReport: { total: FINAL_REPORT_POINTS.length, document: "FINAL_REPORT_V3.md", url: "/api/os/final-report" },
    endpoints: {
      os: ["/api/os/config", "/api/os/control-panels", "/api/os/handoff", "/api/os/final-report"],
      sdk: SDK_IDS.map((id) => `/api/sdk/${id}?gameId=aof`),
      infra: INFRA_IDS.map((id) => `/api/infra/${id}?gameId=aof`),
      gameSignals: "/api/game-signals/config?gameId=aof",
      l2Router: "/api/l2/router?gameId=aof&tps=low&ux=gasless",
      assets: "/api/assets/strategy?gameId=aof&itemType=common&rarity=common",
      health: "/api/health",
    },
  };
}

function json(res, status, body) {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "cache-control": "no-store",
  });
  res.end(data);
}

function route(url) {
  const q = url.searchParams;
  const gate = checkGameId(q.get("gameId") ?? undefined);
  if (!gate.ok) return { status: 404, body: { error: gate.error, knownGameIds: [GAME.gameId] } };
  const gameId = gate.gameId;
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/") {
    return { status: 200, body: { ...osConfig(), note: "index — see endpoints" } };
  }
  if (path === "/api/health") {
    return { status: 200, body: { ok: true, service: "watchtower-os-v3", gameId: GAME.gameId, network: GAME.network, stage: GAME.stage, writes: false, signerCapability: false } };
  }
  if (path === "/api/os/config") return { status: 200, body: osConfig() };
  if (path === "/api/os/control-panels") {
    return { status: 200, body: { gameId, total: PANELS_TOTAL, file: "src/os/control-panels-v3.js", panels: CONTROL_PANELS_V3 } };
  }
  if (path.startsWith("/api/os/control-panels/")) {
    const panel = getPanel(path.slice("/api/os/control-panels/".length));
    return panel
      ? { status: 200, body: { gameId, panel } }
      : { status: 404, body: { error: "unknown control panel", known: CONTROL_PANELS_V3.map((p) => p.id) } };
  }
  if (path === "/api/os/handoff") return { status: 200, body: buildHandoff() };
  if (path === "/api/os/final-report") return { status: 200, body: buildFinalReport() };

  if (path === "/api/sdk") {
    return { status: 200, body: { gameId, total: SDK_IDS.length, sdks: SDK_IDS, v3BestFreeCount: 13, note: "godot-solana is the base engine SDK; the other 13 are the v3 best-free stack" } };
  }
  if (path.startsWith("/api/sdk/")) {
    const sdk = getSdk(path.slice("/api/sdk/".length));
    if (!sdk) return { status: 404, body: { error: "unknown sdk", known: SDK_IDS } };
    const body = { ...sdk, gameId };
    if (sdk.sdk === "preset") {
      const template = q.get("template") || sdk.template;
      if (!sdk.templates.includes(template)) {
        return { status: 400, body: { error: `unknown template "${template}"`, known: sdk.templates } };
      }
      body.template = template;
    }
    return { status: 200, body };
  }

  if (path === "/api/infra") {
    return { status: 200, body: { gameId, total: INFRA_IDS.length, infra: INFRA_IDS } };
  }
  if (path.startsWith("/api/infra/")) {
    const infra = INFRA[path.slice("/api/infra/".length)];
    return infra
      ? { status: 200, body: { ...infra, gameId } }
      : { status: 404, body: { error: "unknown infra component", known: INFRA_IDS } };
  }

  if (path === "/api/game-signals/config" || path === "/api/game-signals") {
    return { status: 200, body: gameSignalsConfig() };
  }

  if (path === "/api/l2/router" || path === "/api/l2") {
    try {
      return { status: 200, body: l2Route(q.get("tps") ?? undefined, q.get("ux") ?? undefined) };
    } catch (e) {
      return { status: e.status || 500, body: { error: e.message, tps: { known: TPS_VALUES }, ux: { known: UX_VALUES } } };
    }
  }

  if (path === "/api/assets/strategy") {
    const itemType = q.get("itemType");
    const rarity = q.get("rarity");
    if (itemType === null && rarity === null) return { status: 200, body: strategyMatrix() };
    try {
      return { status: 200, body: strategyFor(itemType ?? "common", rarity ?? "common") };
    } catch (e) {
      return { status: e.status || 500, body: { error: e.message, itemType: { known: ITEM_TYPES }, rarity: { known: RARITIES } } };
    }
  }
  if (path === "/api/assets/strategy/matrix") return { status: 200, body: strategyMatrix() };

  return { status: 404, body: { error: `no route ${path}`, see: "/api/os/config" } };
}

function createOsServer() {
  return http.createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "content-type, authorization",
      });
      return res.end();
    }
    if (req.method !== "GET") {
      return json(res, 405, { error: "GET only" });
    }
    let out;
    try {
      out = route(new URL(req.url, "http://localhost"));
    } catch (e) {
      out = { status: 500, body: { error: String(e && e.message ? e.message : e) } };
    }
    json(res, out.status, out.body);
  });
}

function main() {
  const port = Number(process.env.WATCHTOWER_OS_PORT || 8787);
  const host = process.env.WATCHTOWER_OS_HOST || "0.0.0.0";
  const server = createOsServer();
  server.listen(port, host, () => {
    console.log(`watchtower-os-v3 listening on http://${host}:${port} (gameId=aof, ${TOTAL} components, ${PANELS_TOTAL} panels)`);
  });
  return server;
}

if (require.main === module) main();

module.exports = { createOsServer, osConfig, route };
