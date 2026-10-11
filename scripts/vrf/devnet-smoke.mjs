#!/usr/bin/env node
/**
 * [F-06] End-to-end smoke test of slot-hash settlement on devnet.
 *
 *   npm ci                                   # workspace root (@solana/web3.js)
 *   API=https://api.devnet.example RPC_URL=https://api.devnet.solana.com \
 *   PLAYER_KEYPAIR=~/.config/solana/devnet-player.json \
 *   WALLET_PROOF_DOMAIN=<same as the backend> node scripts/vrf/devnet-smoke.mjs
 *
 * Steps (each one fails loudly):
 *   1. GET /vrf/health            the core pool is healthy and has free slots
 *   2. POST /packs/commit         player signs the operator co-signed commit
 *   3. read the PackCommit        odds snapshot, randomness, seed slot
 *   4. wait for settlement        vrf-settler, or after 40 s self-settle
 *   5. find the reveal tx         decode VrfSettled from its logs
 *   6. recompute the outcome      sha256("aof-vrf-v1"|"pack"|commit|value) and
 *                                 compare with the minted ToolData rarity
 * Programs may be built with the empty `--features devnet` marker. The
 * backend must be on devnet and must not set AOF_RANDOMNESS.
 */
import { createHash, createPrivateKey, randomBytes, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import os from "node:os";
import { pathToFileURL } from "node:url";

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  return encoded === undefined ? "null" : encoded;
}

/**
 * Same wire format as frontend/src/lib/wallet.ts and aof_backend
 * walletProof.ts: `${domain}:${wallet}:${subject}:${digest}:${ms}:${nonce}`,
 * digest = sha256(canonicalJson({ method, target, body })).
 * `seed` is the 32-byte ed25519 seed (first half of a Solana secret key).
 */
export function walletProof({ domain, wallet, seed, now = Date.now() }, subject, target, body) {
  const digest = createHash("sha256").update(canonicalJson({ method: "POST", target, body }), "utf8").digest("hex");
  const message = `${domain}:${wallet}:${subject}:${digest}:${now}:${randomBytes(16).toString("hex")}`;
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(seed)]);
  const signature = sign(null, Buffer.from(message, "utf8"), createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" }));
  return { message, signature: signature.toString("base64") };
}

export function weightedPick(bps, weights) {
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (bps < acc) return i;
  }
  return weights.length - 1;
}

/** VrfSettled { mechanic u8, commit, randomness, seed_slot u64, value [u8;32], cranker } */
export function decodeVrfSettled(logs) {
  const disc = createHash("sha256").update("event:VrfSettled").digest().subarray(0, 8);
  for (const line of logs) {
    const m = /^Program data: (.+)$/.exec(line);
    if (!m) continue;
    const data = Buffer.from(m[1], "base64");
    if (data.length < 145 || !data.subarray(0, 8).equals(disc)) continue;
    return {
      mechanic: data[8],
      commit: Buffer.from(data.subarray(9, 41)),
      randomness: Buffer.from(data.subarray(41, 73)),
      seedSlot: data.readBigUInt64LE(73),
      value: Buffer.from(data.subarray(81, 113)),
      cranker: Buffer.from(data.subarray(113, 145)),
    };
  }
  return null;
}

/** Mirrors vrf::derive_roll + vrf::below + randomness::weighted_pick for packs. */
export function packRarity(commit, value, odds) {
  const roll = createHash("sha256").update(Buffer.concat([Buffer.from("aof-vrf-v1"), Buffer.from("pack"), Buffer.from(commit), Buffer.from(value)])).digest();
  const bps = Number((roll.readBigUInt64LE(0) * 10_000n) >> 64n);
  return { bps, rarity: RARITIES[weightedPick(bps, odds)] };
}

function step(n, text) {
  console.log(`\n[${n}] ${text}`);
}

async function main() {
  const { Connection, Keypair, PublicKey, Transaction } = await import("@solana/web3.js");
  const API = (process.env.API || "").replace(/\/+$/, "");
  const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
  const DOMAIN = process.env.WALLET_PROOF_DOMAIN || "AOF_API";
  const PACK = process.env.PACK_TYPE || "small";
  if (!API || !process.env.PLAYER_KEYPAIR) {
    console.error("API and PLAYER_KEYPAIR are required");
    process.exit(2);
  }
  const keyPath = process.env.PLAYER_KEYPAIR.replace(/^~/, os.homedir());
  const player = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keyPath, "utf8"))));
  const connection = new Connection(RPC_URL, "confirmed");
  const signer = { domain: DOMAIN, wallet: player.publicKey.toBase58(), seed: player.secretKey.slice(0, 32) };

  async function call(method, path, body, subject) {
    const init = { method, headers: { "Content-Type": "application/json" } };
    if (body) {
      const payload = subject ? { ...body, walletProof: walletProof(signer, subject, path, body) } : body;
      init.body = JSON.stringify(payload);
      init.headers["X-Idempotency-Key"] = `smoke-${randomBytes(12).toString("hex")}`;
    }
    const res = await fetch(`${API}${path}`, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
    return json;
  }

  async function signAndSend(base64) {
    const tx = Transaction.from(Buffer.from(base64, "base64"));
    tx.partialSign(player);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }

  step(1, "pool health");
  const health = await call("GET", "/vrf/health");
  console.log(JSON.stringify(health));
  if (health.cluster !== "devnet") throw new Error("backend is not configured for devnet");
  if (!health.core?.healthy) throw new Error(`core pool unhealthy: ${health.core?.reason}`);

  step(2, `open a ${PACK} pack as ${player.publicKey.toBase58()}`);
  const configs = await call("GET", "/packs/configs");
  const cfg = (configs.packs || []).find((p) => p.packType === PACK);
  if (!cfg) throw new Error(`pack ${PACK} is not configured on-chain`);
  const commit = await call("POST", "/packs/commit", { user: player.publicKey.toBase58(), packType: PACK, maxPriceLamports: cfg.priceLamports }, "packs_commit");
  const commitSig = await signAndSend(commit.tx);
  console.log(`commit ${commitSig} packCommit=${commit.packCommit} mint=${commit.mint}`);

  step(3, "commit snapshot");
  const info = await connection.getAccountInfo(new PublicKey(commit.packCommit), "confirmed");
  if (!info) throw new Error("PackCommit not found right after the commit");
  const odds = [0, 1, 2, 3, 4].map((i) => info.data.readUInt16LE(49 + 2 * i));
  console.log(`odds snapshot ${odds.join("/")}`);

  step(4, "wait for settlement");
  let status;
  const started = Date.now();
  let selfSettled = false;
  for (;;) {
    status = await call("GET", `/packs/status/${commit.packCommit}`);
    if (status.state !== "pending") break;
    if (!selfSettled && Date.now() - started > 40_000) {
      console.log("settler is slow: settling it ourselves");
      const reveal = await call("POST", "/packs/reveal", { user: player.publicKey.toBase58(), packCommit: commit.packCommit }, "packs_reveal");
      console.log(`self-settle (${reveal.phase}) ${await signAndSend(reveal.tx)}`);
      selfSettled = true;
    }
    if (Date.now() - started > 180_000) throw new Error("not settled within 3 minutes");
    await new Promise((r) => setTimeout(r, 2_000));
  }
  console.log(JSON.stringify(status));
  if (status.state !== "settled") throw new Error(`expected a settled pack, got ${status.state}`);

  step(5, "reveal transaction and VrfSettled");
  const sigs = await connection.getSignaturesForAddress(new PublicKey(commit.packCommit), { limit: 10 }, "confirmed");
  let settled = null;
  for (const s of sigs) {
    const tx = await connection.getTransaction(s.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    const ev = tx?.meta?.logMessages ? decodeVrfSettled(tx.meta.logMessages) : null;
    if (ev && new PublicKey(ev.commit).toBase58() === commit.packCommit) {
      settled = { ...ev, signature: s.signature };
      break;
    }
  }
  if (!settled) throw new Error("VrfSettled not found in the pack commit's transactions");
  console.log(`reveal ${settled.signature} by ${new PublicKey(settled.cranker).toBase58()} value=${settled.value.toString("hex")}`);

  step(6, "recompute the outcome");
  const { bps, rarity } = packRarity(new PublicKey(commit.packCommit).toBuffer(), settled.value, odds);
  console.log(`bps=${bps} expected=${rarity} minted=${status.tool.rarity}`);
  if (rarity !== status.tool.rarity) throw new Error("minted rarity does not match the slot-hash roll");
  console.log("\nVRF devnet smoke test passed");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`\nVRF devnet smoke test FAILED: ${e.message}`);
    process.exit(1);
  });
}
