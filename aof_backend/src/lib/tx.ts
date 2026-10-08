import { Keypair, Transaction, PublicKey, Signer } from "@solana/web3.js";
import { connection, assertExpectedCluster } from "../provider";
import { AUTHORITY, AUTHORITY_PUBKEY } from "../config";
import { sendConfirmedTransaction } from "./transactionLifecycle";
import { simulateTransaction } from "../security/txSimulator";
import { PayerCostQuote, PayerRentAccountSpec, quotePayerCosts } from "./payerQuote";

async function requireSimulation(tx: Transaction): Promise<void> {
  const result = await simulateTransaction(tx);
  if (!result.success) {
    throw new Error(`Transaction simulation failed: ${result.error || "unknown error"}`);
  }
}

/**
 * [AUDIT AOF-H1] Fail-closed signing guard. In AUTHORITY_MODE=read-only the
 * backend holds no authority secret: instead of assembling a transaction
 * that can never be completed, every authority-signing path aborts with
 * HTTP 503 (exposed message — operators need to see the cause).
 */
export function requireAuthoritySigning(): void {
  if (!AUTHORITY) {
    const error = new Error(
      "Authority signing is disabled (AUTHORITY_MODE=read-only). " +
        "Wire Squads/KMS or run with AUTHORITY_MODE=hot [AOF-H1].",
    );
    (error as { status?: number }).status = 503;
    (error as { expose?: boolean }).expose = true;
    throw error;
  }
}

async function buildCoSignedTransaction(
  ix: any[],
  feePayer: PublicKey,
  signers: Signer[] = [],
): Promise<{ tx: Transaction; lifetime: { blockhash: string; lastValidBlockHeight: number } }> {
  await assertExpectedCluster();
  const tx = new Transaction().add(...ix);
  tx.feePayer = feePayer;
  const lifetime = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = lifetime.blockhash;
  // Sign with the operator only when an instruction actually requires it.
  const msg = tx.compileMessage();
  const required = msg.accountKeys.slice(0, msg.header.numRequiredSignatures);
  if (required.some((k: any) => k.equals(AUTHORITY_PUBKEY))) {
    requireAuthoritySigning();
    tx.partialSign(AUTHORITY as NonNullable<typeof AUTHORITY>);
  }
  if (signers.length) tx.partialSign(...signers);
  return { tx, lifetime };
}

/** Simulation and payer quotes consume time. Stamp a new blockhash after that
 * work, immediately before the player is asked to sign. A hash older than
 * about a minute is rejected by send as "Blockhash not found". */
async function stampFreshBlockhash(
  tx: Transaction,
  signers: Signer[],
): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const lifetime = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = lifetime.blockhash;
  tx.signatures = [];
  const msg = tx.compileMessage();
  const required = msg.accountKeys.slice(0, msg.header.numRequiredSignatures);
  if (required.some((k: PublicKey) => k.equals(AUTHORITY_PUBKEY))) {
    requireAuthoritySigning();
    tx.partialSign(AUTHORITY as NonNullable<typeof AUTHORITY>);
  }
  if (signers.length) tx.partialSign(...signers);
  return lifetime;
}

export async function coSign(ix: any[], feePayer: PublicKey, signers: Signer[] = []): Promise<string> {
  const { tx } = await buildCoSignedTransaction(ix, feePayer, signers);
  await requireSimulation(tx);
  await stampFreshBlockhash(tx, signers);
  return tx.serialize({ requireAllSignatures: false }).toString("base64");
}

/** Build and partially sign, then return a bounded quote tied to this exact
 * serialized message. The player's signature is still required to broadcast. */
export async function coSignQuoted(
  ix: any[],
  feePayer: PublicKey,
  rentAccounts: PayerRentAccountSpec[],
  signers: Signer[] = [],
): Promise<{ tx: string; quote: PayerCostQuote }> {
  const { tx } = await buildCoSignedTransaction(ix, feePayer, signers);
  await requireSimulation(tx);
  const lifetime = await stampFreshBlockhash(tx, signers);
  const quote = await quotePayerCosts(tx, feePayer, lifetime, rentAccounts);
  return {
    tx: tx.serialize({ requireAllSignatures: false }).toString("base64"),
    quote,
  };
}

export async function authorityOnly(
  ix: any[],
  beforeBroadcast?: (signature: string) => Promise<void>,
): Promise<string> {
  requireAuthoritySigning(); // before any RPC work: fail fast, no side effects
  return sendSignedBy(AUTHORITY as NonNullable<typeof AUTHORITY>, ix, beforeBroadcast);
}

/**
 * `signer` is the only signer and the fee payer; simulated before broadcast.
 * For permissionless instructions (the VRF settler's reveals and refunds),
 * which need a funded signer, not the operator key.
 */
export async function sendSignedBy(
  signer: Keypair,
  ix: any[],
  beforeBroadcast?: (signature: string) => Promise<void>,
): Promise<string> {
  await assertExpectedCluster();
  const tx = new Transaction().add(...ix);
  tx.feePayer = signer.publicKey;
  const lifetime = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = lifetime.blockhash;
  tx.sign(signer);
  await requireSimulation(tx);
  return sendConfirmedTransaction(connection, tx, lifetime, beforeBroadcast);
}

export function pk(s: string): PublicKey {
  return new PublicKey(s);
}
