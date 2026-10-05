import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

/** The signed bytes may have landed. Never retry a payout with a fresh tx. */
export class TransactionOutcomeUnknown extends Error {
  constructor(public readonly signature: string) {
    super(`Transaction outcome unknown; reconcile signature ${signature} before retrying`);
    this.name = "TransactionOutcomeUnknown";
  }
}

export class TransactionExecutionFailed extends Error {
  constructor(public readonly signature: string) {
    super(`Transaction execution failed: ${signature}`);
    this.name = "TransactionExecutionFailed";
  }
}

/** Use the versioned overload even for legacy messages: it doesn't replace
 * the blockhash or strip signatures like the legacy web3.js overload can. */
export function simulationTransaction(tx: Transaction | VersionedTransaction): VersionedTransaction {
  return tx instanceof VersionedTransaction
    ? tx
    : VersionedTransaction.deserialize(tx.serialize({ requireAllSignatures: false }));
}

export async function sendConfirmedTransaction(
  rpc: Pick<Connection, "sendRawTransaction" | "confirmTransaction">,
  tx: Transaction,
  lifetime: { blockhash: string; lastValidBlockHeight: number },
  beforeBroadcast?: (signature: string) => Promise<void>,
): Promise<string> {
  if (!tx.signature || tx.recentBlockhash !== lifetime.blockhash) {
    throw new Error("Signed transaction and blockhash lifetime must match");
  }
  return sendConfirmedBytes(rpc, tx.serialize(), bs58.encode(tx.signature), lifetime, beforeBroadcast);
}

/** Same crash-safe confirmation lifecycle for a native v0 message. */
export async function sendConfirmedVersionedTransaction(
  rpc: Pick<Connection, "sendRawTransaction" | "confirmTransaction">,
  tx: VersionedTransaction,
  lifetime: { blockhash: string; lastValidBlockHeight: number },
  beforeBroadcast?: (signature: string) => Promise<void>,
): Promise<string> {
  if (!("staticAccountKeys" in tx.message)) throw new Error("Only a v0 message is supported by the versioned sender");
  const payer = tx.message.staticAccountKeys[0];
  const payerSignature = tx.signatures[0];
  if (!payer || tx.message.recentBlockhash !== lifetime.blockhash || !payerSignature ||
      payerSignature.length !== 64 || payerSignature.every((byte) => byte === 0)) {
    throw new Error("Signed v0 transaction and blockhash lifetime must match");
  }
  return sendConfirmedBytes(rpc, tx.serialize(), bs58.encode(payerSignature), lifetime, beforeBroadcast);
}

async function sendConfirmedBytes(
  rpc: Pick<Connection, "sendRawTransaction" | "confirmTransaction">,
  bytes: Buffer | Uint8Array,
  signature: string,
  lifetime: { blockhash: string; lastValidBlockHeight: number },
  beforeBroadcast?: (signature: string) => Promise<void>,
): Promise<string> {
  // Persist the signature BEFORE the first network call (crash-safe reservation).
  await beforeBroadcast?.(signature);
  let confirmation;
  try {
    const returned = await rpc.sendRawTransaction(bytes, { maxRetries: 3, preflightCommitment: "confirmed" });
    if (returned !== signature) throw new Error("RPC returned a different signature");
    confirmation = await rpc.confirmTransaction({ signature, ...lifetime }, "finalized");
  } catch {
    // Even a send timeout can occur after the RPC forwarded the bytes.
    throw new TransactionOutcomeUnknown(signature);
  }
  if (confirmation.value.err) throw new TransactionExecutionFailed(signature);
  return signature;
}
