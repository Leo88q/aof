/**
 * Wallet-proof middleware test (closes AOF-M1 / mutation AM-2).
 *
 * The original self-test (walletProofSelfTest.ts) models replay with an
 * in-memory store and never enters the real middleware: if the 409 guard in
 * requireWalletProof() were deleted, that test would still pass.
 *
 * This test drives the ACTUAL middleware (`requireWalletProof`) and the ACTUAL
 * idempotency logic (`checkIdempotency` / `completeIdempotency`), replacing
 * only the Prisma client with an in-memory stub that implements the same
 * findUnique/create/update/updateMany/deleteMany contract. It asserts:
 *
 *   1. a valid one-time proof authenticates the request (next() called);
 *   2. replaying the SAME proof message returns 409 (the AM-2 guard);
 *   3. a fresh proof (new nonce) for the same wallet is accepted again;
 *   4. a tampered signature returns 401 (verification path intact);
 *   5. idempotency storage failure fails closed with 503.
 *
 * Run: npm run test:wallet-proof-middleware
 */
import { strict as assert } from "assert";
import { generateKeyPairSync, sign, randomBytes } from "crypto";

// ── Prisma stub installed BEFORE the middleware module loads ────────────────
type Row = {
  operationKey: string;
  status: "in_progress" | "completed" | "failed";
  result: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

const rows = new Map<string, Row>();
let failStorage = false;

const stubDb = {
  idempotencyRecord: {
    async findUnique({ where }: { where: { operationKey: string } }) {
      if (failStorage) throw new Error("storage down");
      return rows.get(where.operationKey) ?? null;
    },
    async create({ data }: { data: Partial<Row> }) {
      if (failStorage) throw new Error("storage down");
      const row: Row = {
        operationKey: data.operationKey as string,
        status: "in_progress",
        result: null,
        createdAt: new Date(),
        completedAt: null,
      };
      rows.set(row.operationKey, row);
      return row;
    },
    async update({ where, data }: { where: { operationKey: string }; data: Partial<Row> }) {
      if (failStorage) throw new Error("storage down");
      const row = rows.get(where.operationKey);
      if (!row) throw Object.assign(new Error("No idempotency record"), { code: "P2025" });
      Object.assign(row, data);
      return row;
    },
    async updateMany(_args: unknown) {
      if (failStorage) throw new Error("storage down");
      return { count: 0 };
    },
    async deleteMany(_args: unknown) {
      if (failStorage) throw new Error("storage down");
      return { count: 0 };
    },
  },
};

const dbPath = require.resolve("../src/lib/db");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: { db: stubDb, prisma: stubDb },
} as NodeModule;

const { requireWalletProof } = require("../src/security/walletProof");
const { walletProofDigest } = require("../src/security/walletProofCore");

// ── request/response mocks ──────────────────────────────────────────────────
function mockRes() {
  const res: any = {
    statusCode: null as number | null,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    // requireIdempotency installs a finalization hook on response finish.
    once(_event: string, _cb: () => void) {
      return this;
    },
  };
  return res;
}

function makeReq(body: Record<string, unknown>) {
  const headers: Record<string, string> = {
    "x-idempotency-key": "mw-test-" + randomBytes(12).toString("hex"),
  };
  return {
    method: "POST",
    originalUrl: "/api/quests/claim",
    path: "/api/quests/claim",
    headers,
    get: (name: string) => headers[name.toLowerCase()] || "",
    body,
  };
}

function makeProof(wallet: string, body: Record<string, unknown>, privateKey: crypto.KeyObject) {
  // The middleware signs over {method, target, body} — mirror it exactly.
  const digest = walletProofDigest(body, { method: "POST", target: "/api/quests/claim" });
  const nonce = randomBytes(8).toString("hex");
  const message = `AOF_API:${wallet}:claim-quest:${digest}:${Date.now()}:${nonce}`;
  const signature = sign(null, Buffer.from(message, "utf8"), privateKey).toString("base64");
  return { message, signature };
}

async function runMiddleware(req: any) {
  const res = mockRes();
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };
  await requireWalletProof("claim-quest")(req, res, next);
  return { res, nextCalled };
}

async function main(): Promise<void> {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  // @solana/web3.js PublicKey base58 of the raw 32 bytes (last 32 of SPKI)
  const { PublicKey } = require("@solana/web3.js");
  const spki = publicKey.export({ type: "spki", format: "der" }) as Buffer;
  const wallet = new PublicKey(spki.subarray(spki.length - 32)).toBase58();

  // 1. valid proof → authenticated, next() called
  const body1 = { user: wallet, questId: "q1" };
  const proof1 = makeProof(wallet, body1, privateKey);
  const r1 = await runMiddleware(makeReq({ ...body1, walletProof: proof1 }));
  assert.equal(r1.nextCalled, true, "valid proof must call next()");
  assert.equal(r1.res.statusCode, null, "valid proof must not set an error status");

  // 2. replay of the SAME proof → 409 (the AM-2 guard under test)
  const r2 = await runMiddleware(makeReq({ ...body1, walletProof: proof1 }));
  assert.equal(r2.nextCalled, false, "replayed proof must NOT call next()");
  assert.equal(r2.res.statusCode, 409, `replayed proof must return 409, got ${r2.res.statusCode}`);
  assert.equal((r2.res.body as any).error, "Wallet proof already used");

  // 3. fresh proof (new nonce) for the same wallet → accepted again
  const proof3 = makeProof(wallet, body1, privateKey);
  assert.notEqual(proof3.message, proof1.message, "fresh proof must differ");
  const r3 = await runMiddleware(makeReq({ ...body1, walletProof: proof3 }));
  assert.equal(r3.nextCalled, true, "fresh proof must call next()");
  assert.equal(r3.res.statusCode, null);

  // 4. tampered signature → 401
  const proof4 = makeProof(wallet, body1, privateKey);
  proof4.signature = Buffer.from(
    Buffer.from(proof4.signature, "base64").map((b, i) => (i === 0 ? b ^ 0xff : b)),
  ).toString("base64");
  const r4 = await runMiddleware(makeReq({ ...body1, walletProof: proof4 }));
  assert.equal(r4.nextCalled, false);
  assert.equal(r4.res.statusCode, 401, `tampered signature must return 401, got ${r4.res.statusCode}`);

  // 5. storage failure → 503 fail-closed
  const proof5 = makeProof(wallet, body1, privateKey);
  failStorage = true;
  const r5 = await runMiddleware(makeReq({ ...body1, walletProof: proof5 }));
  failStorage = false;
  assert.equal(r5.nextCalled, false);
  assert.equal(r5.res.statusCode, 503, `storage failure must return 503, got ${r5.res.statusCode}`);

  console.log(
    "wallet proof middleware test: 409 replay guard, fresh-proof acceptance, 401 tamper, 503 fail-closed — all passed on the real middleware path",
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
