import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  ComputeBudgetProgram,
  Keypair,
  NonceAccount,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import { AUTHORITY, AUTHORITY_PUBKEY } from "../config";
import { connection, assertExpectedCluster } from "../provider";
import { sendConfirmedTransaction } from "./transactionLifecycle";

/** Public upgrade authority. The frontend guard allows a rent refund only to
 * this address, so a player nonce cannot become a general SOL transfer. */
export const GAME_OPERATOR = new PublicKey("C8MS1G3g7aR39pAGYnFjcz4uj693dYw3icWTMCV7cYRN");
export const NONCE_ACCOUNT_LENGTH = 80;
const STORE_PATH = join(__dirname, "../../data/player-nonces.json");
const COMPUTE_UNIT_LIMIT = 400_000;
const COMPUTE_UNIT_PRICE = 1;

type NonceRecord = {
  nonceAccount: string;
  initialNonce: string;
  rentLamports: number;
};

type Store = Record<string, NonceRecord>;

export type DurableNonce = {
  instructions: TransactionInstruction[];
  blockhash: string;
  lastValidBlockHeight: number;
};

const pendingLoad = new Map<string, Promise<{ record: NonceRecord; currentNonce: string }>>();

function authorityKey(): Keypair {
  if (!AUTHORITY) {
    throw new Error("Player nonce creation requires the local authority key");
  }
  if (!AUTHORITY.publicKey.equals(GAME_OPERATOR) || !AUTHORITY_PUBKEY.equals(GAME_OPERATOR)) {
    throw new Error("Configured authority is not the game operator; refusing to front nonce rent");
  }
  return AUTHORITY;
}

/** Stable per-player nonce address. The secret is only needed to sign creation
 * and is never written to the store. */
export function playerNonceKeypair(player: PublicKey, secretKey: Uint8Array): Keypair {
  const seed = createHash("sha256")
    .update("aof-player-nonce-v1")
    .update(secretKey)
    .update(player.toBuffer())
    .digest();
  return Keypair.fromSeed(seed);
}

function readStore(): Store {
  if (!existsSync(STORE_PATH)) return {};
  const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8")) as Store;
  return parsed && typeof parsed === "object" ? parsed : {};
}

function writeStore(store: Store): void {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`);
}

function defaultBudget(): TransactionInstruction[] {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE }),
  ];
}

/** Phantom prepends compute-budget instructions when they are absent, which
 * pushes nonceAdvance out of first place and the cluster then reports
 * Blockhash not found. Keep advance first and put any budget immediately after. */
export function assembleDurableInstructions(
  advance: TransactionInstruction,
  instructions: TransactionInstruction[],
  reimbursement: TransactionInstruction | null,
): TransactionInstruction[] {
  const budget = instructions.filter((ix) => ix.programId.equals(ComputeBudgetProgram.programId));
  const rest = instructions.filter((ix) => !ix.programId.equals(ComputeBudgetProgram.programId));
  return [
    advance,
    ...(budget.length ? budget : defaultBudget()),
    ...(reimbursement ? [reimbursement] : []),
    ...rest,
  ];
}

async function createNonceAccount(player: PublicKey, nonceKey: Keypair): Promise<NonceRecord> {
  const authority = authorityKey();
  const rentLamports = await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
  const tx = new Transaction().add(
    ...SystemProgram.createNonceAccount({
      fromPubkey: authority.publicKey,
      noncePubkey: nonceKey.publicKey,
      authorizedPubkey: player,
      lamports: rentLamports,
    }),
  );
  tx.feePayer = authority.publicKey;
  const lifetime = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = lifetime.blockhash;
  tx.sign(authority, nonceKey);
  const simulationTx = VersionedTransaction.deserialize(tx.serialize());
  const simulation = await connection.simulateTransaction(simulationTx, { sigVerify: false, commitment: "confirmed" });
  if (simulation.value.err) {
    throw new Error(`Player nonce creation failed simulation: ${JSON.stringify(simulation.value.err)}`);
  }
  await sendConfirmedTransaction(connection, tx, lifetime);
  const info = await connection.getAccountInfo(nonceKey.publicKey, "confirmed");
  if (!info) throw new Error("Player nonce account was not visible after creation");
  const nonce = NonceAccount.fromAccountData(info.data);
  return {
    nonceAccount: nonceKey.publicKey.toBase58(),
    initialNonce: nonce.nonce,
    rentLamports,
  };
}

async function loadNonce(player: PublicKey): Promise<{ record: NonceRecord; currentNonce: string }> {
  await assertExpectedCluster();
  const nonceKey = playerNonceKeypair(player, authorityKey().secretKey);
  let store = readStore();
  let record = store[player.toBase58()];
  const info = await connection.getAccountInfo(nonceKey.publicKey, "confirmed");
  if (!info) {
    record = await createNonceAccount(player, nonceKey);
    store = readStore();
    store[player.toBase58()] = record;
    writeStore(store);
    console.info(`player nonce created ${record.nonceAccount}`);
  } else if (!record) {
    // The account already exists but we no longer know whether the player has
    // repaid it. Do not charge again.
    record = {
      nonceAccount: nonceKey.publicKey.toBase58(),
      initialNonce: "",
      rentLamports: info.lamports,
    };
    store[player.toBase58()] = record;
    writeStore(store);
  }
  const current = NonceAccount.fromAccountData(
    (info ?? await connection.getAccountInfo(nonceKey.publicKey, "confirmed"))!.data,
  ).nonce;
  return { record, currentNonce: current };
}

async function loadNonceOnce(player: PublicKey): Promise<{ record: NonceRecord; currentNonce: string }> {
  const key = player.toBase58();
  const existing = pendingLoad.get(key);
  if (existing) return existing;
  const work = loadNonce(player).finally(() => pendingLoad.delete(key));
  pendingLoad.set(key, work);
  return work;
}

/** A player signature has to survive Phantom's multi-minute devnet simulation.
 * The nonce account is created by the operator only because that creation
 * cannot itself wait on Phantom; the player's transaction pays the rent back. */
export async function preparePlayerDurableNonce(
  player: PublicKey,
  instructions: TransactionInstruction[],
): Promise<DurableNonce> {
  const { record, currentNonce } = await loadNonceOnce(player);
  const advance = SystemProgram.nonceAdvance({
    noncePubkey: new PublicKey(record.nonceAccount),
    authorizedPubkey: player,
  });
  const reimbursement = record.initialNonce !== "" && currentNonce === record.initialNonce
    ? SystemProgram.transfer({
      fromPubkey: player,
      toPubkey: GAME_OPERATOR,
      lamports: record.rentLamports,
    })
    : null;
  const height = await connection.getBlockHeight("confirmed");
  return {
    instructions: assembleDurableInstructions(advance, instructions, reimbursement),
    blockhash: currentNonce,
    lastValidBlockHeight: height + 1_000_000,
  };
}
