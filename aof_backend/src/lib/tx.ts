import { Transaction, PublicKey, Signer } from "@solana/web3.js";
import { connection, assertExpectedCluster } from "../provider";
import { AUTHORITY, AUTHORITY_PUBKEY } from "../config";
import { sendConfirmedTransaction } from "./transactionLifecycle";
import { simulateTransaction } from "../security/txSimulator";

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
function requireAuthoritySigning(): void {
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

export async function coSign(ix: any[], feePayer: PublicKey, signers: Signer[] = []): Promise<string> {
  await assertExpectedCluster();
  const tx = new Transaction().add(...ix);
  tx.feePayer = feePayer;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  // [ФИКС] Подписываем авторити только если инструкция реально требует его подписи.
  // Иначе partialSign бросает "unknown signer" и все пользовательские роуты
  // (листинг/офферы/аренда/аукцион/ордербук) падают на этапе сборки транзакции.
  const msg = tx.compileMessage();
  const required = msg.accountKeys.slice(0, msg.header.numRequiredSignatures);
  if (required.some((k: any) => k.equals(AUTHORITY_PUBKEY))) {
    requireAuthoritySigning();
    tx.partialSign(AUTHORITY as NonNullable<typeof AUTHORITY>);
  }
  if (signers.length) tx.partialSign(...signers);
  await requireSimulation(tx);
  return tx.serialize({ requireAllSignatures: false }).toString("base64");
}

export async function authorityOnly(
  ix: any[],
  beforeBroadcast?: (signature: string) => Promise<void>,
): Promise<string> {
  requireAuthoritySigning(); // before any RPC work: fail fast, no side effects
  await assertExpectedCluster();
  const tx = new Transaction().add(...ix);
  tx.feePayer = AUTHORITY_PUBKEY;
  const lifetime = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = lifetime.blockhash;
  tx.sign(AUTHORITY as NonNullable<typeof AUTHORITY>);
  await requireSimulation(tx);
  return sendConfirmedTransaction(connection, tx, lifetime, beforeBroadcast);
}

export function pk(s: string): PublicKey {
  return new PublicKey(s);
}
