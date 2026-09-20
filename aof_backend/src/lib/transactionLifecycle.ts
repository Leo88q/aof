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
export function simulationTransaction(tx: Transaction): VersionedTransaction {
  return VersionedTransaction.deserialize(tx.serialize({ requireAllSignatures: false }));
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
  const bytes = tx.serialize();
  const signature = bs58.encode(tx.signature);
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
