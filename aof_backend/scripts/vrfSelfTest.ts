/**
 * [F-06] Offline self-test of the backend VRF helpers: pool circuit breaker,
 * settlement phase split, cluster selection, randomness account parsing and
 * the address derivations the on-chain contexts bind.
 */
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";

process.env.PROGRAM_ID ||= "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq";
process.env.TREASURY_PUBKEY ||= "11111111111111111111111111111111";
process.env.AUTHORITY_MODE ||= "read-only";
process.env.AUTHORITY_PUBKEY ||= "11111111111111111111111111111111";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const vrf = require("../src/lib/vrf") as typeof import("../src/lib/vrf");

const k = (seed: number) => new PublicKey(Buffer.alloc(32, seed));

// ---- circuit breaker over the pool
{
  const slot = (i: number, lock: PublicKey, lockedAtSlot = 0, retired = false) => ({
    vrfSlot: k(100 + i), randomness: k(200 + i), index: i, lock, lockedAtSlot, retired,
  });
  const env = { VRF_MAX_PENDING_SLOTS: "450" } as NodeJS.ProcessEnv;
  assert.deepEqual(vrf.evaluatePool([], 1_000, env).reason, "VRF_POOL_EMPTY");
  const healthy = vrf.evaluatePool([slot(0, PublicKey.default), slot(1, k(9), 900)], 1_000, env);
  assert.equal(healthy.healthy, true);
  assert.equal(healthy.free, 1);
  assert.equal(healthy.oldestLockAgeSlots, 100);
  const stuck = vrf.evaluatePool([slot(0, PublicKey.default), slot(1, k(9), 100)], 1_000, env);
  assert.equal(stuck.healthy, false, "a commit older than VRF_MAX_PENDING_SLOTS stops new commits");
  assert.equal(stuck.reason, "VRF_SETTLEMENT_DEGRADED");
  const busy = vrf.evaluatePool([slot(0, k(8), 990), slot(1, k(9), 995)], 1_000, env);
  assert.equal(busy.reason, "VRF_POOL_EXHAUSTED");
  const retired = vrf.evaluatePool([slot(0, PublicKey.default, 0, true)], 1_000, env);
  assert.equal(retired.reason, "VRF_POOL_EMPTY", "retired slots do not count");
  assert.equal(vrf.maxPendingSlots({} as NodeJS.ProcessEnv), 450);
}

// ---- settlement phases never overlap (mirrors vrf.rs reveal/refund windows)
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { commitPhase } = require("../src/lib/vrfSettlement") as typeof import("../src/lib/vrfSettlement");
  assert.equal(vrf.VRF_REFUND_AFTER_SLOTS, 18_000);
  assert.equal(commitPhase(1_000, 1_000), "revealable");
  assert.equal(commitPhase(1_000, 1_000 + 17_999), "revealable");
  assert.equal(commitPhase(1_000, 1_000 + 18_000), "refundable");
}

// ---- cluster selection must match the program build
{
  assert.equal(vrf.switchboardCluster({ SWITCHBOARD_CLUSTER: "devnet" } as NodeJS.ProcessEnv, "https://x"), "devnet");
  assert.equal(vrf.switchboardCluster({} as NodeJS.ProcessEnv, "https://api.devnet.solana.com"), "devnet");
  assert.equal(vrf.switchboardCluster({} as NodeJS.ProcessEnv, "https://mainnet.helius-rpc.com"), "mainnet");
  assert.throws(() => vrf.switchboardCluster({ SWITCHBOARD_CLUSTER: "testnet" } as NodeJS.ProcessEnv, "https://x"));
  assert.equal(vrf.SWITCHBOARD.mainnet.programId.toBase58(), "SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv");
  assert.equal(vrf.SWITCHBOARD.devnet.queue.toBase58(), "EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7");
  // The program-state PDA pinned in vrf.rs is derivable from the program id.
  for (const c of Object.values(vrf.SWITCHBOARD)) {
    assert.ok(PublicKey.findProgramAddressSync([Buffer.from("STATE")], c.programId)[0].equals(c.state));
  }
}

// ---- randomness account parsing (offsets of RandomnessAccountData)
{
  const data = Buffer.alloc(480);
  Buffer.from([10, 66, 229, 135, 220, 239, 217, 114]).copy(data, 0);
  k(1).toBuffer().copy(data, 8);
  k(2).toBuffer().copy(data, 40);
  data.writeBigUInt64LE(777n, 104);
  k(3).toBuffer().copy(data, 112);
  data.writeBigUInt64LE(779n, 144);
  Buffer.alloc(32, 7).copy(data, 152);
  const r = vrf.parseRandomness(data);
  assert.ok(r.authority.equals(k(1)) && r.queue.equals(k(2)) && r.oracle.equals(k(3)));
  assert.equal(r.seedSlot, 777n);
  assert.equal(r.revealSlot, 779n);
  assert.deepEqual([...r.value], Array(32).fill(7));
  data[0] ^= 1;
  assert.throws(() => vrf.parseRandomness(data), /Not a Switchboard randomness account/);
}

// ---- PDAs the on-chain contexts bind
{
  const core = new PublicKey(process.env.PROGRAM_ID!);
  const rnd = vrf.vrfRandomnessPda(core, 3);
  const le = Buffer.alloc(4);
  le.writeUInt32LE(3, 0);
  assert.ok(rnd.equals(PublicKey.findProgramAddressSync([Buffer.from("vrf_randomness"), le], core)[0]));
  assert.ok(vrf.vrfSlotPda(core, rnd).equals(PublicKey.findProgramAddressSync([Buffer.from("vrf_slot"), rnd.toBuffer()], core)[0]));
  assert.ok(vrf.vrfAuthorityPda(core).equals(PublicKey.findProgramAddressSync([Buffer.from("vrf_authority")], core)[0]));
  const env = { SWITCHBOARD_CLUSTER: "mainnet" } as NodeJS.ProcessEnv;
  const oracle = k(5);
  assert.ok(vrf.statsPda(oracle, env).equals(PublicKey.findProgramAddressSync(
    [Buffer.from("OracleRandomnessStats"), oracle.toBuffer()], vrf.SWITCHBOARD.mainnet.programId)[0]));
  const signer = vrf.lutSignerPda(rnd, env);
  const slotLe = Buffer.alloc(8);
  slotLe.writeBigUInt64LE(1234n, 0);
  assert.ok(vrf.lutAddress(signer, 1234).equals(PublicKey.findProgramAddressSync(
    [signer.toBuffer(), slotLe], vrf.ADDRESS_LOOKUP_TABLE_PROGRAM_ID)[0]));
  assert.match(vrf.randomNonce(), /^[0-9]+$/);
}

// ---- compute budget: CU limit plus a priority fee the wallet guard accepts
{
  const COMPUTE = "ComputeBudget111111111111111111111111111111";
  const parse = (env: Record<string, string>) => vrf.vrfComputeBudget(env as NodeJS.ProcessEnv).map((ix) => {
    assert.equal(ix.programId.toBase58(), COMPUTE);
    assert.equal(ix.keys.length, 0);
    return ix.data[0] === 2
      ? { op: 2, value: ix.data.readUInt32LE(1), len: ix.data.length }
      : { op: ix.data[0], value: Number(ix.data.readBigUInt64LE(1)), len: ix.data.length };
  });
  assert.deepEqual(parse({}), [{ op: 2, value: 400_000, len: 5 }, { op: 3, value: 5_000, len: 9 }]);
  assert.deepEqual(parse({ VRF_COMPUTE_UNITS: "600000", VRF_PRIORITY_MICROLAMPORTS: "0" }), [{ op: 2, value: 600_000, len: 5 }]);
  // txGuard.ts refuses a price above 100_000 microlamports and a limit above 1.4M CU
  assert.deepEqual(parse({ VRF_COMPUTE_UNITS: "9000000", VRF_PRIORITY_MICROLAMPORTS: "5000000" }),
    [{ op: 2, value: 1_400_000, len: 5 }, { op: 3, value: vrf.VRF_MAX_PRIORITY_MICROLAMPORTS, len: 9 }]);
  assert.equal(vrf.VRF_MAX_PRIORITY_MICROLAMPORTS, 100_000);
  assert.deepEqual(parse({ VRF_PRIORITY_MICROLAMPORTS: "junk" }), [{ op: 2, value: 400_000, len: 5 }]);
}

// ---- drum outcome from the program events (the drum mints no NFT to look up)
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { drumOutcomeFromLogs } = require("../src/lib/vrfSettlement") as typeof import("../src/lib/vrfSettlement");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { questsProgram } = require("../src/provider");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { EventParser } = require("@coral-xyz/anchor");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const idl = require("../src/idl/aof_quests.json");
  const parser = new EventParser(questsProgram.programId, questsProgram.coder);
  const pid = questsProgram.programId.toBase58();
  const u64 = (n: number) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
  const disc = (name: string) => Buffer.from(idl.events.find((e: any) => e.name === name).discriminator);
  const logs = (data: Buffer) => [
    `Program ${pid} invoke [1]`, "Program log: Instruction: X", `Program data: ${data.toString("base64")}`,
    `Program ${pid} consumed 1000 of 400000 compute units`, `Program ${pid} success`,
  ];
  const revealed = Buffer.concat([disc("DrumRevealed"), k(1).toBuffer(), u64(20), k(2).toBuffer(), u64(99), Buffer.alloc(32, 7), k(3).toBuffer()]);
  assert.deepEqual(drumOutcomeFromLogs(logs(revealed), "sig1", parser), { state: "settled", prize: 20, signature: "sig1", value: "07".repeat(32) });
  const refunded = Buffer.concat([disc("DrumRefunded"), k(1).toBuffer(), u64(5)]);
  assert.deepEqual(drumOutcomeFromLogs(logs(refunded), "sig2", parser), { state: "refunded", amount: 5, signature: "sig2" });
  const committed = Buffer.concat([disc("DrumCommitted"), k(1).toBuffer(), k(2).toBuffer(), u64(99)]);
  assert.equal(drumOutcomeFromLogs(logs(committed), "sig3", parser), "committed");
  assert.equal(drumOutcomeFromLogs([`Program ${pid} invoke [1]`, `Program ${pid} success`], "sig4", parser), null);
}

// ---- oracle selection: only eligible oracles, live-healthy first, load spread
{
  const cand = (seed: number, over: Partial<import("../src/lib/vrf").OracleCandidate> = {}) => ({
    oracle: k(seed), gatewayUrl: "https://gw.example", isOnQueue: true, isVerified: true,
    heartbeatFresh: true, quoteFresh: true, liveHealthy: true, ...over,
  });
  assert.equal(vrf.oracleEligible(cand(1)), true);
  for (const bad of [
    { heartbeatFresh: false }, { quoteFresh: false }, { isVerified: false }, { isOnQueue: false },
    { gatewayUrl: "" }, { restricted: true }, { gatewayEnabled: false }, { pullOracleEnabled: false },
  ]) assert.equal(vrf.oracleEligible(cand(1, bad)), false, JSON.stringify(bad));
  const set = [cand(1, { heartbeatFresh: false }), cand(2, { liveHealthy: false }), cand(3), cand(4)];
  const picked = new Set([0, 0.49, 0.5, 0.99].map((r) => vrf.pickOracle(set, () => r).toBase58()));
  assert.deepEqual([...picked].sort(), [k(3).toBase58(), k(4).toBase58()].sort(), "spread over live-healthy eligible oracles");
  assert.ok(vrf.pickOracle([cand(1, { heartbeatFresh: false }), cand(2, { liveHealthy: false })], () => 0).equals(k(2)),
    "falls back to eligible oracles without live health");
  assert.throws(() => vrf.pickOracle([cand(1, { quoteFresh: false })]), /VRF_ORACLE_UNAVAILABLE/);
  assert.throws(() => vrf.pickOracle([]), /VRF_ORACLE_UNAVAILABLE/);

  // The mirror agrees with the installed SDK's own eligibility rule on SDK-shaped
  // inspection entries (a Switchboard upgrade that changes the rule fails here).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { isRandomnessOracleCandidateEligible } = require("@switchboard-xyz/common");
  const sdkShaped = (over: Record<string, unknown> = {}) => ({
    oracleId: k(7).toBase58(), oracle: { pubkey: k(7) }, gatewayUrl: "https://gw.example", isOnQueue: true,
    isVerified: true, heartbeatFresh: true, quoteFresh: true, liveHealthy: false, ...over,
  });
  for (const over of [
    {}, { liveHealthy: true }, { heartbeatFresh: false }, { quoteFresh: false }, { isVerified: false },
    { isOnQueue: false }, { gatewayUrl: "" }, { gatewayUrl: null }, { restricted: true }, { restricted: false },
    { gatewayEnabled: false }, { gatewayEnabled: true }, { pullOracleEnabled: false }, { pullOracleEnabled: true },
  ]) {
    const entry = sdkShaped(over);
    const mapped = vrf.oracleCandidateFromInspection(entry);
    assert.ok(mapped.oracle.equals(k(7)));
    assert.equal(vrf.oracleEligible(mapped), isRandomnessOracleCandidateEligible(entry), JSON.stringify(over));
  }
}

// ---- gateway protocol: no RPC URL leak, strict response shape
{
  const uri = Buffer.alloc(64);
  uri.write("https://oracle.example.com:8443/");
  assert.equal(vrf.gatewayUrlFromBytes(uri), "https://oracle.example.com:8443");
  assert.throws(() => vrf.gatewayUrlFromBytes(Buffer.from("ftp://x")), /gateway/);
  assert.throws(() => vrf.gatewayUrlFromBytes(Buffer.alloc(64)), /gateway/);

  const slothash = Buffer.alloc(32, 7);
  const body = vrf.revealRequestBody(k(5), slothash, 123_456_789n);
  assert.deepEqual(Object.keys(body).sort(), ["randomness_key", "slot", "slothash"], "the RPC URL is not forwarded by default");
  assert.equal(body.randomness_key, k(5).toBuffer().toString("hex"));
  assert.equal(body.slot, 123_456_789);
  assert.deepEqual(body.slothash, Array(32).fill(7));
  assert.equal(vrf.revealRequestBody(k(5), slothash, 1n, "https://public.example").rpc, "https://public.example");

  const good = { signature: Buffer.alloc(64, 1).toString("base64"), recovery_id: 1, value: Array(32).fill(255) };
  const params = vrf.parseRevealResponse(good);
  assert.equal(params.signature.length, 64);
  assert.equal(params.recoveryId, 1);
  assert.equal(params.value.length, 32);
  assert.throws(() => vrf.parseRevealResponse({ ...good, signature: Buffer.alloc(63).toString("base64") }), /signature/);
  assert.throws(() => vrf.parseRevealResponse({ ...good, recovery_id: 4 }), /recovery/);
  assert.throws(() => vrf.parseRevealResponse({ ...good, value: Array(31).fill(0) }), /value/);
  assert.throws(() => vrf.parseRevealResponse({ ...good, value: [...Array(31).fill(0), 256] }), /value/);
  assert.throws(() => vrf.parseRevealResponse(null), /signature/);
}

// ---- pool slot choice: free and unreserved only, this replica's shard first
{
  const slot = (i: number, lock = PublicKey.default, retired = false) => ({
    vrfSlot: k(100 + i), randomness: k(200 + i), index: i, lock, lockedAtSlot: 0, retired,
  });
  const slots = [slot(0), slot(1), slot(2, k(9)), slot(3), slot(4, PublicKey.default, true), slot(5)];
  const none = new Set<string>();
  assert.equal(vrf.poolShard({} as NodeJS.ProcessEnv), null);
  assert.deepEqual(vrf.poolShard({ VRF_POOL_SHARD: "1/2" } as NodeJS.ProcessEnv), { index: 1, count: 2 });
  assert.throws(() => vrf.poolShard({ VRF_POOL_SHARD: "2/2" } as NodeJS.ProcessEnv), /0 <= i < n/);
  assert.throws(() => vrf.poolShard({ VRF_POOL_SHARD: "one" } as NodeJS.ProcessEnv), /i\/n/);
  const shard = { index: 1, count: 2 };
  for (const r of [0, 0.5, 0.999]) {
    const pick = vrf.pickPoolSlot(slots, none, shard, () => r)!;
    assert.equal(pick.index % 2, 1, "replica 1/2 takes odd slots while it has free ones");
    assert.notEqual(pick.index, 4, "retired slots are never handed out");
  }
  const oddReserved = new Set([k(101).toBase58(), k(103).toBase58(), k(105).toBase58()]);
  assert.equal(vrf.pickPoolSlot(slots, oddReserved, shard, () => 0)!.index, 0, "falls back to other shards when its own is busy");
  for (const r of [0, 0.3, 0.6, 0.99]) {
    const pick = vrf.pickPoolSlot(slots, none, null, () => r)!;
    assert.ok([0, 1, 3, 5].includes(pick.index), "never a locked (2) or retired (4) slot");
  }
  const all = new Set(slots.map((s) => s.vrfSlot.toBase58()));
  assert.equal(vrf.pickPoolSlot(slots, all, shard), null, "nothing free: the route answers VRF_POOL_EXHAUSTED");
}

// ---- settler signer: fee-only wallet, never the operator key in production
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const settler = require("../src/lib/settlerSigner") as typeof import("../src/lib/settlerSigner");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Keypair } = require("@solana/web3.js") as typeof import("@solana/web3.js");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bs58 = require("bs58").default ?? require("bs58");
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const path = require("node:path") as typeof import("node:path");
  const operator = Keypair.generate();
  const fee = Keypair.generate();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "settler-"));
  const file = path.join(dir, "key");
  fs.writeFileSync(file, bs58.encode(fee.secretKey));
  const fromFile = settler.resolveSettlerSigner(operator, { VRF_SETTLER_SECRET_KEY_FILE: file } as NodeJS.ProcessEnv, true);
  assert.equal(fromFile.source, "dedicated");
  assert.ok(fromFile.keypair.publicKey.equals(fee.publicKey), "base58 key file");
  fs.writeFileSync(file, JSON.stringify(Array.from(fee.secretKey)));
  assert.ok(settler.resolveSettlerSigner(null, { VRF_SETTLER_SECRET_KEY_FILE: file } as NodeJS.ProcessEnv, true)
    .keypair.publicKey.equals(fee.publicKey), "solana-keygen JSON key file, read-only operator");
  assert.throws(() => settler.resolveSettlerSigner(operator, {} as NodeJS.ProcessEnv, true), /VRF_SETTLER_SECRET_KEY_FILE/,
    "production refuses the operator-key fallback");
  assert.throws(() => settler.resolveSettlerSigner(operator, { VRF_SETTLER_SECRET_KEY: bs58.encode(fee.secretKey) } as NodeJS.ProcessEnv, true),
    /Docker secret/, "production refuses the key in an environment variable");
  fs.writeFileSync(file, bs58.encode(operator.secretKey));
  assert.throws(() => settler.resolveSettlerSigner(operator, { VRF_SETTLER_SECRET_KEY_FILE: file } as NodeJS.ProcessEnv, false),
    /not the operator key/, "the settler wallet must be a separate key");
  const dev = settler.resolveSettlerSigner(operator, {} as NodeJS.ProcessEnv, false);
  assert.equal(dev.source, "operator", "development may fall back to the operator key");
  assert.throws(() => settler.resolveSettlerSigner(null, {} as NodeJS.ProcessEnv, false), /AUTHORITY_MODE=hot/);
  assert.throws(() => settler.parseSecretKey(bs58.encode(fee.publicKey.toBytes())), /64-byte/, "a public key is not a keypair");
  fs.rmSync(dir, { recursive: true, force: true });

  assert.equal(settler.settlerStandbySlots({} as NodeJS.ProcessEnv), 0, "primary by default");
  assert.equal(settler.settlerStandbySlots({ VRF_SETTLER_STANDBY_SLOTS: "120" } as NodeJS.ProcessEnv), 120);
  assert.throws(() => settler.settlerStandbySlots({ VRF_SETTLER_STANDBY_SLOTS: "450" } as NodeJS.ProcessEnv), /below VRF_MAX_PENDING_SLOTS/,
    "a standby slower than the circuit breaker would never help");
  assert.throws(() => settler.settlerStandbySlots({ VRF_SETTLER_STANDBY_SLOTS: "-1" } as NodeJS.ProcessEnv), /non-negative/);
}

console.log("vrf self-test: pool circuit breaker, phase split, cluster pins, account parsing, PDAs, compute budget, drum outcome, oracle selection, gateway protocol, pool slot choice, settler signer passed");
