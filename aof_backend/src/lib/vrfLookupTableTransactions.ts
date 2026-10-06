import {
  AddressLookupTableAccount,
  Keypair,
  PublicKey,
  Signer,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { parse as parseDotenv } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AUTHORITY, AUTHORITY_PUBKEY } from "../config";
import { connection, assertExpectedCluster } from "../provider";
import { simulateTransaction } from "../security/txSimulator";
import { toolMetadataRegistryPda, TOKEN_METADATA_PROGRAM_ID } from "./pda";
import { requireAuthoritySigning } from "./tx";
import { PayerCostQuote, PayerRentAccountSpec, quotePayerCosts } from "./payerQuote";
import { sendConfirmedVersionedTransaction } from "./transactionLifecycle";

// Keep 64 bytes of headroom below Solana's 1,232-byte packet limit. Readiness
// tests use the same bound for VRF settlements and large tool-mint instructions.
export const VRF_V0_PACKET_LIMIT_BYTES = 1_232;
export const VRF_V0_PACKET_HEADROOM_BYTES = 64;
export const VRF_V0_MAX_SERIALIZED_BYTES = VRF_V0_PACKET_LIMIT_BYTES - VRF_V0_PACKET_HEADROOM_BYTES;
const U64_MAX = (1n << 64n) - 1n;

function configuredLookupTableAddress(): PublicKey {
  let value = (process.env.VRF_ADDRESS_LOOKUP_TABLE || "").trim();
  if (!value) {
    // Read only this public setting so a running backend sees the address the
    // bringup script just appended, even if dotenv loaded an empty value at
    // process start. Do not reload/override any other deployment secrets.
    try {
      const parsed = parseDotenv(readFileSync(resolve(__dirname, "../../.env"), "utf8"));
      value = (parsed.VRF_ADDRESS_LOOKUP_TABLE || "").trim();
      if (value) process.env.VRF_ADDRESS_LOOKUP_TABLE = value;
    } catch {
      // Fall through to the same fail-closed configuration error below.
    }
  }
  if (!value) {
    const error = new Error("VRF_ADDRESS_LOOKUP_TABLE is unset; run `npm run vrf:lut:init` and retry");
    (error as { status?: number }).status = 503;
    (error as { expose?: boolean }).expose = true;
    throw error;
  }
  try {
    return new PublicKey(value);
  } catch {
    throw new Error("VRF_ADDRESS_LOOKUP_TABLE is not a valid public key");
  }
}

/** Read the configured table from chain and refuse stale, inactive or closed tables. */
export async function loadVrfAddressLookupTable(): Promise<AddressLookupTableAccount> {
  const key = configuredLookupTableAddress();
  const { value } = await connection.getAddressLookupTable(key, "confirmed");
  if (!value || !value.key.equals(key)) throw new Error("Configured VRF address lookup table was not found on chain");
  if (value.state.deactivationSlot !== U64_MAX) {
    throw new Error("Configured VRF address lookup table is deactivated; provision a live table before retrying");
  }
  if (value.state.addresses.length === 0) throw new Error("Configured VRF address lookup table is empty");
  const currentSlot = BigInt(await connection.getSlot("confirmed"));
  if (currentSlot <= BigInt(value.state.lastExtendedSlot)) {
    throw new Error("VRF address lookup table was just extended; retry after the next slot");
  }
  const addresses = new Set(value.state.addresses.map((address) => address.toBase58()));
  const missingMetadataKeys = [toolMetadataRegistryPda()[0], TOKEN_METADATA_PROGRAM_ID]
    .filter((address) => !addresses.has(address.toBase58()));
  if (missingMetadataKeys.length) {
    throw new Error("VRF address lookup table is missing tool metadata keys; run `npm run vrf:lut:init` and retry");
  }
  return value;
}

function zeroSignature(signature: Uint8Array | undefined): boolean {
  return !signature || signature.length !== 64 || signature.every((byte) => byte === 0);
}

async function buildVrfV0Transaction(
  instructions: TransactionInstruction[],
  feePayer: PublicKey,
  signers: Signer[],
): Promise<{ tx: VersionedTransaction; lifetime: { blockhash: string; lastValidBlockHeight: number } }> {
  await assertExpectedCluster();
  if (instructions.length === 0) throw new Error("Cannot build an empty VRF transaction");
  const lookupTable = await loadVrfAddressLookupTable();
  const lifetime = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: lifetime.blockhash,
    instructions,
  }).compileToV0Message([lookupTable]);
  const tx = new VersionedTransaction(message);

  const requiredKeys = message.staticAccountKeys.slice(0, message.header.numRequiredSignatures);
  const required = new Set(requiredKeys.map((key) => key.toBase58()));
  const signerByKey = new Map<string, Signer>();
  for (const signer of signers) {
    if (!required.has(signer.publicKey.toBase58())) {
      throw new Error(`Unexpected VRF transaction signer ${signer.publicKey.toBase58()}`);
    }
    signerByKey.set(signer.publicKey.toBase58(), signer);
  }
  if (required.has(AUTHORITY_PUBKEY.toBase58())) {
    requireAuthoritySigning();
    signerByKey.set(AUTHORITY_PUBKEY.toBase58(), AUTHORITY as Keypair);
  }
  if (signerByKey.size) tx.sign([...signerByKey.values()]);

  const serializedBytes = tx.serialize().length;
  if (serializedBytes > VRF_V0_MAX_SERIALIZED_BYTES) {
    throw new Error(
      `v0 transaction is ${serializedBytes} bytes; maximum with headroom is ${VRF_V0_MAX_SERIALIZED_BYTES}. ` +
      "The configured address lookup table may be incomplete; run `npm run vrf:lut:init` and retry.",
    );
  }
  return { tx, lifetime };
}

/** Operator co-sign for the paid exploration commit; user signature remains required. */
export async function coSignWithVrfLookupTable(
  instructions: TransactionInstruction[],
  feePayer: PublicKey,
  signers: Signer[] = [],
): Promise<string> {
  const { tx } = await buildVrfV0Transaction(instructions, feePayer, signers);
  const simulation = await simulateTransaction(tx);
  if (!simulation.success) throw new Error(`Transaction simulation failed: ${simulation.error || "unknown error"}`);
  return Buffer.from(tx.serialize()).toString("base64");
}

/** Build an ALT-backed transaction and bind the player's rent quote to its v0 message. */
export async function coSignWithVrfLookupTableQuoted(
  instructions: TransactionInstruction[],
  feePayer: PublicKey,
  rentAccounts: PayerRentAccountSpec[],
): Promise<{ tx: string; quote: PayerCostQuote }> {
  const { tx, lifetime } = await buildVrfV0Transaction(instructions, feePayer, []);
  const quote = await quotePayerCosts(tx, feePayer, lifetime, rentAccounts);
  const simulation = await simulateTransaction(tx);
  if (!simulation.success) throw new Error(`Transaction simulation failed: ${simulation.error || "unknown error"}`);
  return { tx: Buffer.from(tx.serialize()).toString("base64"), quote };
}

/** Permissionless exploration reveal/refund signed by the player or settler. */
export async function sendSignedByWithVrfLookupTable(
  signer: Keypair,
  instructions: TransactionInstruction[],
  beforeBroadcast?: (signature: string) => Promise<void>,
): Promise<string> {
  const { tx, lifetime } = await buildVrfV0Transaction(instructions, signer.publicKey, [signer]);
  if (tx.signatures.some(zeroSignature)) throw new Error("VRF settlement is missing a required signer");
  const simulation = await simulateTransaction(tx);
  if (!simulation.success) throw new Error(`Transaction simulation failed: ${simulation.error || "unknown error"}`);
  return sendConfirmedVersionedTransaction(connection, tx, lifetime, beforeBroadcast);
}
