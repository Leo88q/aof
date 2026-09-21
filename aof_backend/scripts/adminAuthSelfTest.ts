/**
 * Self-test for the split admin credential, production gating of dangerous
 * admin routes, audit actor attribution and device fingerprint stability.
 *
 * Run: npm run test:admin-auth
 */
import assert from "node:assert/strict";
import express from "express";

const OPS = "o".repeat(40);
const READ = "r".repeat(40);

async function request(port: number, method: string, path: string, token?: string, body?: any) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function withServer(app: express.Express, fn: (port: number) => Promise<void>) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    await fn((server.address() as any).port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function testRoleSplit() {
  process.env.ADMIN_TOKEN = OPS;
  process.env.ADMIN_READ_TOKEN = READ;
  const { requireAdmin, requireAdminRead, adminByMethod } = await import("../src/middleware/adminAuth");

  const app = express();
  app.use(express.json());
  app.post("/ops", requireAdmin, (_req, res) => res.json({ ok: true }));
  app.get("/read", requireAdminRead, (req, res) => res.json({ role: req.adminRole }));
  const mixed = express.Router();
  mixed.use(adminByMethod);
  mixed.get("/logs", (req, res) => res.json({ role: req.adminRole }));
  mixed.post("/resolve", (req, res) => res.json({ role: req.adminRole }));
  app.use("/mixed", mixed);

  await withServer(app, async (port) => {
    // No token
    assert.equal((await request(port, "POST", "/ops")).status, 401);
    assert.equal((await request(port, "GET", "/read")).status, 401);
    // Read token: allowed on read routes, forbidden on ops routes
    assert.equal((await request(port, "GET", "/read", READ)).status, 200);
    assert.equal((await request(port, "GET", "/read", READ)).json.role, "read");
    assert.equal((await request(port, "POST", "/ops", READ)).status, 403);
    // Ops token: allowed everywhere
    assert.equal((await request(port, "POST", "/ops", OPS)).status, 200);
    assert.equal((await request(port, "GET", "/read", OPS)).json.role, "ops");
    // Method-based router
    assert.equal((await request(port, "GET", "/mixed/logs", READ)).status, 200);
    assert.equal((await request(port, "POST", "/mixed/resolve", READ)).status, 403);
    assert.equal((await request(port, "POST", "/mixed/resolve", OPS)).status, 200);
    // Wrong token / prefix of a token
    assert.equal((await request(port, "GET", "/read", OPS.slice(0, 39))).status, 401);
    assert.equal((await request(port, "GET", "/read", "x".repeat(40))).status, 401);
  });

  // Without a read token configured, the ops token still works on read routes
  delete process.env.ADMIN_READ_TOKEN;
  await withServer(app, async (port) => {
    assert.equal((await request(port, "GET", "/read", OPS)).status, 200);
    assert.equal((await request(port, "GET", "/read", READ)).status, 401);
  });

  // Unconfigured admin API is closed, not open
  delete process.env.ADMIN_TOKEN;
  await withServer(app, async (port) => {
    assert.equal((await request(port, "POST", "/ops", OPS)).status, 503);
  });
  process.env.ADMIN_TOKEN = OPS;
}

async function testProductionGate() {
  // nonProductionOnly captures NODE_ENV at module load, so evaluate it in a
  // fresh module instance for each environment.
  for (const [env, expected] of [["production", 404], ["development", 200], ["test", 200]] as const) {
    process.env.NODE_ENV = env;
    const modPath = require.resolve("../src/middleware/adminAuth");
    delete require.cache[modPath];
    const { requireAdmin, nonProductionOnly } = await import("../src/middleware/adminAuth");
    const app = express();
    app.use(express.json());
    app.use(requireAdmin);
    app.post("/admin/send-tx", nonProductionOnly, (_req, res) => res.json({ relayed: true }));
    app.post("/admin/test-grant", nonProductionOnly, (_req, res) => res.json({ granted: true }));
    await withServer(app, async (port) => {
      // Even a valid operator token does not reach the handler in production.
      assert.equal((await request(port, "POST", "/admin/send-tx", OPS, { tx: "AAAA" })).status, expected, `send-tx in ${env}`);
      assert.equal((await request(port, "POST", "/admin/test-grant", OPS, { user: "x" })).status, expected, `test-grant in ${env}`);
    });
  }
  delete process.env.NODE_ENV;
  delete require.cache[require.resolve("../src/middleware/adminAuth")];
}

async function testAuditActor() {
  process.env.ADMIN_TOKEN = OPS;
  process.env.ADMIN_READ_TOKEN = READ;
  const { resolveAuditActor } = await import("../src/middleware/audit");
  const mk = (over: any) => ({ header: (name: string) => over.headers?.[name.toLowerCase()] || "", body: over.body || {}, params: {}, ...over }) as any;

  // Body-supplied user is never the actor
  assert.deepEqual(resolveAuditActor(mk({ body: { user: "FORGED_WALLET" } })), { user: "anonymous", actorType: "anonymous" });
  // Signed wallet wins over body and over an admin token
  assert.deepEqual(
    resolveAuditActor(mk({ authenticatedWallet: "SIGNED", body: { user: "FORGED" }, headers: { authorization: `Bearer ${OPS}` } })),
    { user: "SIGNED", actorType: "wallet" },
  );
  // Admin token is attributed by role, without leaking the token
  assert.deepEqual(resolveAuditActor(mk({ headers: { authorization: `Bearer ${OPS}` }, body: { user: "X" } })), { user: "admin:ops", actorType: "admin" });
  assert.deepEqual(resolveAuditActor(mk({ headers: { "x-admin-token": READ } })), { user: "admin:read", actorType: "admin" });
}

async function testFingerprint() {
  const { computeFingerprint } = await import("../src/lib/antifraud");
  const headers = { "user-agent": "UA/1.0", "accept-language": "ru", "x-device-model": "Pixel", "x-screen-resolution": "1080x2400" };
  // Same device, different wallets -> same fingerprint (that is the whole point)
  assert.equal(computeFingerprint(headers, "WalletAAAAAAAAAAAAAAAA"), computeFingerprint(headers, "WalletBBBBBBBBBBBBBBBB"));
  // Different device -> different fingerprint
  assert.notEqual(computeFingerprint(headers, "W"), computeFingerprint({ ...headers, "user-agent": "UA/2.0" }, "W"));
  // Salt changes the value (so raw header combos cannot be precomputed)
  const plain = computeFingerprint(headers);
  process.env.FINGERPRINT_SALT = "salt";
  assert.notEqual(plain, computeFingerprint(headers));
  delete process.env.FINGERPRINT_SALT;
}

async function testEconomyQuality() {
  const { worstQuality, ECONOMY_FIELD_QUALITY } = await import("../src/lib/dataQuality");
  assert.equal(worstQuality({ a: "complete", b: "complete" }), "complete");
  assert.equal(worstQuality({ a: "complete", b: "partial" }), "partial");
  assert.equal(worstQuality({ a: "complete", b: "unavailable" }), "partial");
  assert.equal(worstQuality({ a: "unavailable", b: "unavailable" }), "unavailable");
  // Until the on-chain indexer exists these must stay flagged; flipping them
  // to "complete" without an indexer would reintroduce fictitious zeros.
  assert.equal(ECONOMY_FIELD_QUALITY.potatoMinted24h, "unavailable");
  assert.equal(ECONOMY_FIELD_QUALITY.potatoBurned24h, "unavailable");
  assert.equal(ECONOMY_FIELD_QUALITY.topHolders, "unavailable");
}

async function testIssuanceCapMapping() {
  // pda.ts pulls config.ts, which validates the runtime env. Provide a
  // throwaway keypair/ids so the module loads without a real deployment.
  const { Keypair } = await import("@solana/web3.js");
  const bs58 = (await import("bs58")).default;
  const idlAddress = JSON.parse((await import("node:fs")).readFileSync(require.resolve("../src/idl/aof_core.json"), "utf8")).address;
  process.env.PROGRAM_ID ||= idlAddress;
  process.env.AUTHORITY_SECRET_KEY ||= bs58.encode(Keypair.generate().secretKey);
  process.env.TREASURY_PUBKEY ||= Keypair.generate().publicKey.toBase58();
  const { RESOURCE_KIND_ORDER, resourceKindIndex, issuanceCapPda } = await import("../src/lib/pda");
  const fs = await import("node:fs");
  const path = await import("node:path");
  // The PDA seed is `kind as u8`; a drift between this list and the Rust enum
  // would silently point every mint at the wrong (or a missing) cap account.
  const rs = fs.readFileSync(path.join(__dirname, "..", "..", "aof-core", "src", "lib.rs"), "utf8");
  const body = /pub enum ResourceKind \{([\s\S]*?)\n\}/.exec(rs)![1];
  const rust = body.split("\n").map((l) => l.trim().replace(/,$/, "")).filter((l) => l && !l.startsWith("//")).map((n) => n[0].toLowerCase() + n.slice(1));
  assert.deepEqual([...RESOURCE_KIND_ORDER], rust);
  assert.equal(resourceKindIndex({ gemBlue: {} }), 16);
  assert.equal(resourceKindIndex("potato"), 26);
  assert.equal(resourceKindIndex(0), 0);
  assert.throws(() => resourceKindIndex({ nope: {} }));
  assert.throws(() => resourceKindIndex(99));
  assert.equal(issuanceCapPda({ potato: {} })[0].toBase58(), issuanceCapPda("potato")[0].toBase58());
  assert.notEqual(issuanceCapPda("potato")[0].toBase58(), issuanceCapPda("food")[0].toBase58());
  // IDL errors for the cap must exist with the codes the backend matches on.
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "idl", "aof_core.json"), "utf8"));
  const byName = Object.fromEntries(idl.errors.map((e: any) => [e.name, e.code]));
  // Do not hardcode: Anchor error codes are positional (6000 + index in the
  // `AofError` enum), so any variant inserted above the cap errors silently
  // renumbers them - which is exactly how the backend ended up matching
  // 6097/6098 while the program was already emitting 6098/6099.
  const errs = fs.readFileSync(path.join(__dirname, "..", "..", "aof-core", "src", "errors.rs"), "utf8");
  const enumBody = /pub enum AofError \{([\s\S]*?)\n\}/.exec(errs)![1];
  const rustErrors = enumBody.split("\n").map((l) => l.trim().replace(/,$/, ""))
    .filter((l) => /^[A-Z]\w*$/.test(l));
  const rustCode = (name: string) => 6000 + rustErrors.indexOf(name);
  for (const name of ["IssuanceCapNotConfigured", "IssuanceCapExceeded", "SupplyCapExceeded", "VaultGuardLimitExceeded"]) {
    assert.equal(byName[name], rustCode(name), `IDL error ${name} drifted from errors.rs`);
  }
  assert.ok(idl.instructions.find((i: any) => i.name === "mint_resource").accounts.some((a: any) => a.name === "issuance_cap"));
  assert.ok(idl.instructions.find((i: any) => i.name === "mint_resource_once").accounts.some((a: any) => a.name === "issuance_cap"));
}

async function testTrustAge() {
  const { ageScoreFromDays } = await import("../src/lib/trustFormula");
  assert.equal(ageScoreFromDays(0), 0);
  assert.equal(ageScoreFromDays(-5), 0);
  assert.equal(ageScoreFromDays(NaN), 0);
  assert.equal(ageScoreFromDays(1), 0);
  assert.equal(ageScoreFromDays(9), 5);
  assert.equal(ageScoreFromDays(90), 50);
  assert.equal(ageScoreFromDays(180), 100);
  assert.equal(ageScoreFromDays(10_000), 100);
  // Source of truth must be the indexer ledger, not the last login.
  const fs = await import("node:fs");
  const src = fs.readFileSync(require.resolve("../src/lib/trustFormula.ts"), "utf8");
  const body = src.slice(src.indexOf("async function calcAgeScore"), src.indexOf("// Компонент 2:"));
  assert.ok(!/lastLogin/.test(body), "age score must not be derived from Streak.lastLogin");
  assert.ok(/walletFirstSeen/.test(body));
}

async function main() {
  await testTrustAge();
  await testIssuanceCapMapping();
  await testRoleSplit();
  await testProductionGate();
  await testAuditActor();
  await testFingerprint();
  await testEconomyQuality();
  console.log("admin auth tests: trust age from indexer, issuance-cap kind mapping/IDL, read/ops split, production gating of send-tx/test-grant, audit actor attribution, wallet-independent fingerprint and economy data-quality flags passed");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
