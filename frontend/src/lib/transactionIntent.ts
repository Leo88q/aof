import { PublicKey } from "@solana/web3.js";
import { positiveU64 } from "./amounts";

export const CORE_PROGRAM_ID = "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq";
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM = "11111111111111111111111111111111";
const COMPUTE = "ComputeBudget111111111111111111111111111111";
export const MARKETPLACE_BUY_DISCRIMINATOR = [219, 1, 7, 251, 90, 189, 167, 48] as const;

export interface MarketplaceBuyIntent {
  readonly kind: "marketplaceBuy";
  readonly buyer: string;
  readonly seller: string;
  readonly treasury: string;
  readonly mint: string;
  readonly maxPriceLamports: string;
  readonly expiresAt: string;
}
export type TransactionIntent = MarketplaceBuyIntent;
type Instruction = { programId: string; keys: PublicKey[]; data: Uint8Array };

export function isMarketplaceBuy(ix: Instruction): boolean {
  return ix.programId === CORE_PROGRAM_ID && MARKETPLACE_BUY_DISCRIMINATOR.every((v, i) => ix.data[i] === v);
}
const pda = (seed: string, key?: PublicKey) => PublicKey.findProgramAddressSync(
  [new TextEncoder().encode(seed), ...(key ? [key.toBytes()] : [])], new PublicKey(CORE_PROGRAM_ID),
)[0];
const ata = (mint: PublicKey, owner: PublicKey) => PublicKey.findProgramAddressSync([owner.toBytes(), TOKEN.toBytes(), mint.toBytes()], ATA)[0];
function keysEqual(actual: PublicKey[], expected: PublicKey[]): boolean {
  return actual.length === expected.length && expected.every((key, i) => key.equals(actual[i]));
}

/** Locally constructed intent, never a response-provided "approved" object.
 * Exact asset, parties, destinations and bytes are checked; any extra action
 * (even through an allowed AOF program) fails before the wallet sees it. */
export function validateTransactionIntent(
  instructions: Instruction[], intent: TransactionIntent | undefined, user: PublicKey,
  now = Math.floor(Date.now() / 1000),
): void {
  if (instructions.some((ix) => ix.programId === CORE_PROGRAM_ID &&
      [92, 247, 50, 140, 72, 120, 69, 249].every((byte, i) => ix.data[i] === byte))) {
    throw new Error("Unbounded legacy marketplace purchase is disabled");
  }
  if (!intent) {
    if (instructions.some(isMarketplaceBuy)) throw new Error("Marketplace purchase requires a local user intent");
    return; // Other operations still use the existing guard policy, not full intent validation.
  }
  if (intent.kind !== "marketplaceBuy") throw new Error("Unsupported transaction intent");
  positiveU64(intent.maxPriceLamports);
  if (!/^[1-9][0-9]{0,15}$/.test(intent.expiresAt) || !Number.isSafeInteger(Number(intent.expiresAt)) ||
      Number(intent.expiresAt) <= now || Number(intent.expiresAt) - now > 300) throw new Error("Quote expired");
  const buyer = new PublicKey(intent.buyer), mint = new PublicKey(intent.mint);
  if (!buyer.equals(user)) throw new Error("Wallet differs from purchase intent");
  const listing = pda("listing", mint), buyerToken = ata(mint, buyer);
  const expected = [pda("config"), buyer, new PublicKey(intent.seller), new PublicKey(intent.treasury),
    mint, pda("tool", mint), listing, ata(mint, listing), buyerToken, TOKEN, new PublicKey(SYSTEM)];
  let buys = 0, atas = 0;
  for (const ix of instructions) {
    if (isMarketplaceBuy(ix)) {
      if (++buys !== 1 || !keysEqual(ix.keys, expected) || ix.data.length !== 24) throw new Error("Unexpected purchase accounts or instructions");
      const view = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength);
      if (view.getBigUint64(8, true) !== BigInt(intent.maxPriceLamports) || view.getBigInt64(16, true) !== BigInt(intent.expiresAt)) {
        throw new Error("Transaction price or deadline differs from user intent");
      }
    } else if (ix.programId === ATA.toBase58()) {
      if (++atas !== 1 || ix.data.length !== 1 || ix.data[0] !== 1 ||
          !keysEqual(ix.keys, [buyer, buyerToken, buyer, mint, new PublicKey(SYSTEM), TOKEN])) throw new Error("Unexpected rent destination");
    } else if (ix.programId !== COMPUTE) {
      throw new Error("Extra instruction is outside the purchase intent");
    }
  }
  if (buys !== 1) throw new Error("Missing marketplace purchase");
}
