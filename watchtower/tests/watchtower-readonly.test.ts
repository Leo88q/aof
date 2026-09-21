/**
 * Read-only guarantees, checked against the source so a future edit cannot
 * silently add a write path or a signer.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const srcDir = join(__dirname, "..", "src");
const files = readdirSync(srcDir).filter((f) => f.endsWith(".ts")).map((f) => [f, readFileSync(join(srcDir, f), "utf8")] as const);
const all = files.map(([, s]) => s).join("\n");

// No Prisma mutations anywhere in the exporter.
for (const [name, s] of files) {
  // Prisma delegate mutations look like `<db>.<model>.<op>(`; crypto's
  // `.update(` is not a DB write, so anchor the pattern on a delegate.
  const writes = /\b(db|trx|tx|prisma|deps\.db)\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/g;
  assert.deepEqual([...s.matchAll(writes)].map((m) => m[0]), [], `${name} contains a Prisma write call`);
  for (const m of ["$executeRaw", "$executeRawUnsafe", "$transaction("]) assert.ok(!s.includes(m), `${name} uses ${m}`);
}
// No signer / transaction submission capability.
for (const m of ["AUTHORITY_SECRET_KEY", "Keypair.fromSecretKey", "sendTransaction", "sendRawTransaction", "signTransaction", "authorityOnly", "../provider", "aof_backend/src/config", "aof_backend/src/lib/tx"]) {
  const hits = files.filter(([, s]) => s.includes(m)).map(([n]) => n);
  // The exporter mentions AUTHORITY_SECRET_KEY exactly once: to delete it.
  if (m === "AUTHORITY_SECRET_KEY") { assert.deepEqual(hits, ["watchtower-exporter.ts"]); assert.ok(all.includes("delete process.env.AUTHORITY_SECRET_KEY")); continue; }
  assert.deepEqual(hits, [], `signer/write capability referenced: ${m}`);
}
// RPC surface is limited to slot reads.
const rpcCalls = [...all.matchAll(/\b(?:conn|rpc|connection)\.(\w+)\(/g)].map((m) => m[1]);
assert.deepEqual([...new Set(rpcCalls)], ["getSlot"], `unexpected RPC methods: ${rpcCalls}`);
// Writes flag is a refusal switch, not a feature flag.
assert.ok(all.includes('WATCHTOWER_ENABLE_WRITES", "false") === "true"') && all.includes("refuses"));
// Only GET/HEAD are served.
assert.ok(all.includes('req.method !== "GET" && req.method !== "HEAD"'));
// Manifest declares no writes / no signer.
const manifest = JSON.parse(readFileSync(join(__dirname, "..", "integration-manifest.json"), "utf8"));
assert.equal(manifest.writes, false); assert.equal(manifest.signerCapability, false); assert.equal(manifest.gameId, "aof"); assert.equal(manifest.parserVersion, "aof-v1");
assert.equal(manifest.programIds.length, 3);
// Example env has no secret values filled in.
const env = readFileSync(join(__dirname, "..", "config.example.env"), "utf8");
for (const line of env.split("\n")) {
  const m = /^(WATCHTOWER_EXPORTER_TOKEN|WATCHTOWER_PLAYER_HASH_SALT|SENTRY_DSN|REDIS_URL|WATCHTOWER_RPC_URL)=(\S*)/.exec(line);
  if (m) assert.equal(m[2], "", `${m[1]} must be empty in config.example.env`);
}
console.log("watchtower-readonly: no Prisma writes, no signer, RPC=getSlot only, GET-only, manifest/env hygiene passed");
