import { PublicKey } from "@solana/web3.js";

function asPublicKey(value: any): PublicKey | null {
  try {
    if (value instanceof PublicKey) return value;
    const candidate = value?.pubkey ?? value;
    if (typeof candidate === "string" || candidate instanceof Uint8Array || Array.isArray(candidate)) {
      return new PublicKey(candidate);
    }
  } catch {
    // Malformed RPC account keys fail closed.
  }
  return null;
}

/**
 * Confirm only a successful RPC response for the exact player-paid XP claim
 * transaction: player is fee payer, the only two required signers are player
 * and authority, there is one top-level instruction, and it targets this
 * program. Confirmed transaction metadata supplies the cryptographic
 * signature-verification result; this helper additionally checks RPC shape
 * and signer/message consistency before event reconciliation.
 */
export function transactionHasPlayerPayerAndAuthoritySignature(
  transaction: any,
  player: PublicKey,
  authority: PublicKey,
  expectedProgram: PublicKey,
): boolean {
  const rpcTransaction = transaction?.transaction;
  const message = rpcTransaction?.message;
  const header = message?.header;
  const instructions = message?.compiledInstructions ?? message?.instructions;
  const staticKeys: any[] = message?.staticAccountKeys ?? message?.accountKeys ?? [];
  const loaded = transaction?.meta?.loadedAddresses;
  const rawKeys = [
    ...staticKeys,
    ...(Array.isArray(loaded?.writable) ? loaded.writable : []),
    ...(Array.isArray(loaded?.readonly) ? loaded.readonly : []),
  ];
  const keys = rawKeys.map(asPublicKey);
  const requiredSignatures = header?.numRequiredSignatures;
  const signatures = rpcTransaction?.signatures;
  if (!Number.isInteger(requiredSignatures) || requiredSignatures !== 2 ||
      !Array.isArray(signatures) || signatures.length !== requiredSignatures ||
      signatures.some((signature: unknown) => typeof signature !== "string" || signature.length === 0) ||
      keys.some((key) => key === null) || !Array.isArray(instructions) || instructions.length !== 1) {
    return false;
  }

  const accountKeys = keys as PublicKey[];
  if (!accountKeys[0].equals(player)) return false;
  const signerKeys = accountKeys.slice(0, requiredSignatures);
  if (signerKeys[0].equals(signerKeys[1]) ||
      !signerKeys.some((key) => key.equals(player)) ||
      !signerKeys.some((key) => key.equals(authority))) return false;

  const programIndex = instructions[0]?.programIdIndex;
  return Number.isInteger(programIndex) && accountKeys[programIndex]?.equals(expectedProgram) === true;
}
