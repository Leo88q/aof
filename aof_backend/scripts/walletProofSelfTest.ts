import { strict as assert } from "assert";
import { generateKeyPairSync, sign, verify } from "crypto";
import { canonicalJson, walletProofDigest } from "../src/security/walletProofCore";

function testCanonicalDigest(): void {
  const payload = {
    z: 3,
    nested: { b: true, a: "x" },
    omitted: undefined,
    list: [{ d: 4, c: 2 }],
  };
  assert.equal(
    canonicalJson(payload),
    '{"list":[{"c":2,"d":4}],"nested":{"a":"x","b":true},"z":3}',
  );
  // Cross-runtime fixture: this digest is also what the browser Web Crypto
  // implementation must produce for the same canonical JSON.
  assert.equal(
    walletProofDigest(payload),
    "35509f65b59409b313d140f70c5c8283e311a3271d04d8d9ab2d511cea1cec86",
  );

  const proof = { message: "ignored", signature: "ignored" };
  const withProof = { ...payload, walletProof: proof };
  assert.equal(walletProofDigest(payload), walletProofDigest(withProof));
  assert.notEqual(walletProofDigest(payload), walletProofDigest({ ...payload, z: 4 }));

  // [nf-mutate 2026-09-28] the nesting guard (`depth > 32`) had no test: a
  // 33-level payload must be refused, a 32-level one must still canonicalise.
  const nest = (levels: number): unknown => (levels === 0 ? 1 : { k: nest(levels - 1) });
  assert.equal(canonicalJson(nest(32)).length, 32 * 6 + 1);
  assert.throws(() => canonicalJson(nest(33)), /nesting exceeds limit/);
  assert.throws(() => canonicalJson(Array.from({ length: 34 }).reduce<unknown>((inner) => [inner], 1)), /nesting exceeds limit/);
  // Non-object bodies digest as an empty object; arrays are bodies too.
  assert.equal(walletProofDigest(null), walletProofDigest({}));
  assert.equal(walletProofDigest("string"), walletProofDigest({}));
}

function testEd25519Signature(): void {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const message = "AOF_API:wallet:subject:0123456789abcdef:1700000000000:0123456789abcdef";
  const bytes = Buffer.from(message, "utf8");
  const signature = sign(null, bytes, privateKey);
  assert.equal(verify(null, bytes, publicKey, signature), true);
  assert.equal(verify(null, Buffer.from(`${message}:tampered}`, "utf8"), publicKey, signature), false);
}

/**
 * This models the atomic check-and-consume contract used by the Prisma
 * idempotency record. It deliberately has no await between the existence
 * check and insert: a real database unique constraint provides that atomicity
 * across processes. The Prisma-backed integration variant lives in
 * scripts/idempotencyIntegrationTest.ts (`npm run test:idempotency-db`) and
 * runs against a throwaway SQLite database.
 */
class AtomicReplayStore {
  private readonly consumed = new Set<string>();

  consume(key: string): boolean {
    if (this.consumed.has(key)) return false;
    this.consumed.add(key);
    return true;
  }
}

async function testReplayRaceModel(): Promise<void> {
  const store = new AtomicReplayStore();
  const outcomes = await Promise.all(
    Array.from({ length: 64 }, () => Promise.resolve(store.consume("wallet-proof:test"))),
  );
  assert.equal(outcomes.filter(Boolean).length, 1);
  assert.equal(store.consume("wallet-proof:test"), false);
}

async function main(): Promise<void> {
  testCanonicalDigest();
  testEd25519Signature();
  await testReplayRaceModel();
  console.log("wallet proof self-test: canonical digest, Ed25519 signature, replay and race model passed");
  console.log("NOTE: this is an in-memory model only; the Prisma-backed idempotency CAS is covered by `npm run test:idempotency-db`");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
