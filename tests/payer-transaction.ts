import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";

export type AnchorErrorEntry = { code?: number; name?: string };

/** Wait until the validator bank used by this RPC recognizes an account owner.
 * In local-validator tests, a confirmed createMint can briefly still simulate
 * against an older bank that sees its new account as SystemProgram-owned. */
export async function waitForAccountOwner(
  connection: Connection,
  address: PublicKey,
  expectedOwner: PublicKey,
  label = "account",
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let observedOwner: PublicKey | undefined;
  for (;;) {
    const info = await connection.getAccountInfo(address, "confirmed");
    observedOwner = info?.owner;
    if (observedOwner?.equals(expectedOwner)) return;
    if (Date.now() >= deadline) {
      throw new Error(`${label} ${address} was not observed under ${expectedOwner}; got ${observedOwner ?? "missing"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Wait for a confirmed close to become visible on the validator bank. */
export async function waitForAccountAbsent(
  connection: Connection,
  address: PublicKey,
  label = "account",
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const observed = await connection.getAccountInfo(address, "confirmed");
    if (!observed) return;
    if (Date.now() >= deadline) {
      throw new Error(`${label} ${address} still exists after ${timeoutMs}ms (owner ${observed.owner}, lamports ${observed.lamports})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Submit a legacy Anchor transaction with only the required explicit signers.
 * AnchorProvider.sendAndConfirm always tries its wallet, even when that wallet
 * is not a required signer; payer-funded instructions must not inherit it. */
export async function submitWithPayer(
  connection: Connection,
  transaction: Transaction,
  payer: Keypair,
  extraSigners: Keypair[] = [],
  minContextSlot?: number,
): Promise<string> {
  transaction.feePayer = payer.publicKey;
  const { context, value: lifetime } = await connection.getLatestBlockhashAndContext("confirmed");
  transaction.recentBlockhash = lifetime.blockhash;

  const message = transaction.compileMessage();
  const required = message.accountKeys.slice(0, message.header.numRequiredSignatures);
  const candidates = [payer, ...extraSigners];
  const uniqueCandidates = candidates.filter((candidate, index, all) =>
    all.findIndex((other) => other.publicKey.equals(candidate.publicKey)) === index,
  );
  const signers = required.map((key) => uniqueCandidates.find((candidate) => candidate.publicKey.equals(key)));
  const missing = required.filter((key) => !uniqueCandidates.some((candidate) => candidate.publicKey.equals(key)));
  if (missing.length) {
    throw new Error(`missing local test signer(s): ${missing.map((key) => key.toBase58()).join(", ")}`);
  }

  transaction.partialSign(...signers as Keypair[]);
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    preflightCommitment: "confirmed",
    minContextSlot: Math.max(context.slot, minContextSlot ?? 0),
  });
  let tx: any = null;
  let transactionError: any = null;
  try {
    const confirmation = await connection.confirmTransaction({ signature, ...lifetime }, "confirmed");
    transactionError = confirmation.value.err;
  } catch (confirmationError) {
    // web3.js rejects with the raw TransactionError for an executed failure.
    // Recover metadata so callers get a useful message, but preserve RPC,
    // timeout, and blockhash errors when no failed transaction was recorded.
    try {
      tx = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
    } catch {
      throw confirmationError;
    }
    if (!tx?.meta?.err) throw confirmationError;
    transactionError = tx.meta.err;
  }
  if (transactionError) {
    if (!tx) {
      tx = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
    }
    throw new Error(`payer-funded transaction failed: ${JSON.stringify(transactionError)}; ${
      (tx?.meta?.logMessages ?? []).join("\n")
    }`);
  }
  return signature;
}

/** Anchor's sendRawTransaction path returns a generic SendTransactionError;
 * recover the named Anchor code from its logs (or its numeric custom code). */
export async function anchorErrorCode(
  error: any,
  idlErrors: AnchorErrorEntry[] = [],
  connection?: Connection,
): Promise<string | undefined> {
  const direct = error?.error?.errorCode?.code;
  if (typeof direct === "string") return direct;

  let logs: string[] = error?.logs ?? error?.transactionLogs ?? [];
  if (!logs.length && typeof error?.getLogs === "function") {
    try {
      logs = await error.getLogs(connection);
    } catch {
      // The message may still include the custom program error number.
    }
  }
  const text = `${logs.join("\n")}\n${String(error?.message ?? error)}`;
  const named = text.match(/Error Code:\s*([A-Za-z0-9_]+)/);
  if (named) return named[1];

  const hex = text.match(/custom program error:\s*0x([0-9a-f]+)/i);
  const decimal = text.match(/(?:Custom|custom program error)["']?\s*[:= ]\s*(\d+)/i);
  const number = hex ? Number.parseInt(hex[1], 16) : decimal ? Number(decimal[1]) : undefined;
  return idlErrors.find((entry) => entry.code === number)?.name;
}
