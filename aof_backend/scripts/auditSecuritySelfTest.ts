import assert from "node:assert/strict";
import express from "express";
import { generateKeyPairSync, sign } from "node:crypto";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { redactSensitive } from "../src/security/redaction";
import { reconcileInboxClaims } from "../src/lib/rewardReconciliation";
import { requireMappedWalletProof, verifyWalletProof, WALLET_PROOF_DOMAIN } from "../src/security/walletProof";
import { walletProofDigest } from "../src/security/walletProofCore";
import { sendConfirmedTransaction, simulationTransaction, TransactionExecutionFailed, TransactionOutcomeUnknown } from "../src/lib/transactionLifecycle";

async function main() {
  const app = express();
  app.use(express.json());
  app.use(requireMappedWalletProof());
  const router = express.Router();
  router.post("/create", (_req, res) => res.json({ vulnerable: true }));
  app.use("/guild", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const address: any = server.address();
    for (const path of ["/guild/create", "/guild/create/", "/GUILD/CREATE", "/Guild/Create/"]) {
      const res = await fetch(`http://127.0.0.1:${address.port}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leaderId: Keypair.generate().publicKey.toBase58() }) });
      assert.equal(res.status, 401, `unsigned route alias bypass: ${path}`);
    }
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }

  const keys = generateKeyPairSync("ed25519");
  const wallet = bs58.encode(keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32));
  const body = { user: wallet, amount: "1" };
  const context = { method: "DELETE", target: "/alerts/123" };
  const digest = walletProofDigest(body, context);
  const message = `${WALLET_PROOF_DOMAIN}:${wallet}:alerts_delete:${digest}:${Date.now()}:${"a".repeat(32)}`;
  const signature = sign(null, Buffer.from(message), keys.privateKey).toString("base64");
  assert.ok(verifyWalletProof(wallet, message, signature, WALLET_PROOF_DOMAIN, "alerts_delete", 300_000, digest));
  for (const changed of [{ ...context, method: "POST" }, { ...context, target: "/alerts/456" }, { ...context, target: "/alerts/123?force=true" }]) {
    assert.equal(verifyWalletProof(wallet, message, signature, WALLET_PROOF_DOMAIN, "alerts_delete", 300_000, walletProofDigest(body, changed)), false);
  }

  const payer = Keypair.generate();
  const lifetime = { blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 42 };
  const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: lifetime.blockhash }).add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 1 }));
  tx.sign(payer);
  assert.deepEqual(Buffer.from(simulationTransaction(tx).serialize()), tx.serialize());
  const sig = bs58.encode(tx.signature!);
  let persisted = false;
  const rpc: any = {
    sendRawTransaction: async (bytes: Buffer) => { assert.ok(persisted); assert.deepEqual(bytes, tx.serialize()); return sig; },
    confirmTransaction: async (strategy: any, commitment: string) => { assert.deepEqual(strategy, { signature: sig, ...lifetime }); assert.equal(commitment, "finalized"); return { value: { err: null } }; },
  };
  assert.equal(await sendConfirmedTransaction(rpc, tx, lifetime, async () => { persisted = true; }), sig);
  await assert.rejects(sendConfirmedTransaction({ ...rpc, confirmTransaction: async () => ({ value: { err: { InstructionError: [0, "error"] } } }) }, tx, lifetime), TransactionExecutionFailed);
  for (const failing of [
    { ...rpc, sendRawTransaction: async () => { throw Error("send timeout after submission"); } },
    { ...rpc, confirmTransaction: async () => { throw Error("confirmation timeout"); } },
  ]) await assert.rejects(sendConfirmedTransaction(failing, tx, lifetime), TransactionOutcomeUnknown);
  let sent = false;
  await assert.rejects(sendConfirmedTransaction({ ...rpc, sendRawTransaction: async () => { sent = true; return sig; } }, tx, lifetime, async () => { throw Error("DB unavailable"); }), /DB unavailable/);
  assert.equal(sent, false);
  assert.deepEqual(redactSensitive({ nested: [{ privateKey: "secret", amount: 1 }], walletProof: { signature: "secret" } }), { nested: [{ privateKey: "[REDACTED]", amount: 1 }], walletProof: "[REDACTED]" });
  let deep: any = {};
  for (let i = 0; i < 40; i++) deep = { nested: deep };
  assert.throws(() => walletProofDigest(deep), /nesting/);
  const statuses = [null, { confirmationStatus: "confirmed", err: null }, { confirmationStatus: "finalized", err: null }, { confirmationStatus: "finalized", err: "failed" }];
  const updates: any[] = [];
  assert.equal(await reconcileInboxClaims({ inboxItem: {
    findMany: async () => statuses.map((_, i) => ({ id: String(i), claimSignature: `sig${i}` })),
    updateMany: async (update: any) => { updates.push(update); return { count: 1 }; },
  } } as any, { getSignatureStatuses: async () => ({ value: statuses }) } as any), 2);
  assert.equal(updates[0].where.claimSignature, "sig2");
  assert.equal(updates[0].data.claimState, "confirmed");
  assert.equal(updates[1].data.claimed, false);
  console.log("audit security tests: real Express route aliases, signed method/target, exact simulation bytes, finalized errors, ambiguous sends and pre-broadcast persistence passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
