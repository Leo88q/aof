import { createHash } from "crypto";
import { PublicKey, Transaction } from "@solana/web3.js";
import { connection } from "../provider";

export type RentStrategy = "init" | "init_if_needed" | "idempotent" | "create";

export interface PayerRentAccountSpec {
  name: string;
  address: PublicKey;
  size: number;
  strategy: RentStrategy;
}

export interface PayerRentQuoteLine {
  name: string;
  address: string;
  size: number;
  strategy: RentStrategy;
  exists: boolean;
  rentDueLamports: string;
  maxRentLamports: string;
}

export interface PayerCostQuote {
  version: 1;
  payer: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  messageSha256: string;
  networkFeeLamports: string;
  rentLamports: string;
  maxRentLamports: string;
  maxCostLamports: string;
  rentAccounts: PayerRentQuoteLine[];
}

// Hard limits apply before a quote is returned and are checked again by the
// browser before wallet signing. They bound both network fees and account rent.
export const MAX_NETWORK_FEE_LAMPORTS = 250_000n;
export const MAX_TOTAL_PAYER_COST_LAMPORTS = 20_000_000n;

function decimal(value: bigint): string {
  return value.toString(10);
}

export async function quotePayerCosts(
  tx: Transaction,
  payer: PublicKey,
  lifetime: { blockhash: string; lastValidBlockHeight: number },
  specs: PayerRentAccountSpec[],
): Promise<PayerCostQuote> {
  if (tx.feePayer?.equals(payer) !== true) throw new Error("PAYER_QUOTE_FEE_PAYER_MISMATCH");
  if (!Number.isSafeInteger(lifetime.lastValidBlockHeight) || lifetime.lastValidBlockHeight <= 0) {
    throw new Error("PAYER_QUOTE_INVALID_EXPIRY");
  }
  const seen = new Set<string>();
  for (const spec of specs) {
    if (!spec.name || !Number.isSafeInteger(spec.size) || spec.size <= 0) throw new Error("PAYER_QUOTE_INVALID_ACCOUNT_SPEC");
    const key = spec.address.toBase58();
    if (seen.has(key)) throw new Error("PAYER_QUOTE_DUPLICATE_ACCOUNT");
    seen.add(key);
  }

  const feeResult = await connection.getFeeForMessage(tx.compileMessage(), "confirmed");
  if (feeResult.value === null || !Number.isSafeInteger(feeResult.value) || feeResult.value < 0) {
    throw new Error("PAYER_QUOTE_FEE_UNAVAILABLE");
  }
  const networkFee = BigInt(feeResult.value);
  if (networkFee > MAX_NETWORK_FEE_LAMPORTS) throw new Error("PAYER_QUOTE_NETWORK_FEE_LIMIT");

  const rentAccounts: PayerRentQuoteLine[] = [];
  let rentDue = 0n;
  let maxRent = 0n;
  for (const spec of specs) {
    const [info, minimum] = await Promise.all([
      connection.getAccountInfo(spec.address, "confirmed"),
      connection.getMinimumBalanceForRentExemption(spec.size, "confirmed"),
    ]);
    if (!Number.isSafeInteger(minimum) || minimum < 0) throw new Error(`PAYER_QUOTE_RENT_UNAVAILABLE:${spec.name}`);
    if (info && info.data.length !== spec.size) throw new Error(`PAYER_QUOTE_ACCOUNT_SIZE_MISMATCH:${spec.name}`);
    if (info && (spec.strategy === "init" || spec.strategy === "create")) {
      throw new Error(`PAYER_QUOTE_ACCOUNT_ALREADY_EXISTS:${spec.name}`);
    }
    const rent = BigInt(minimum);
    const due = info ? 0n : rent;
    rentDue += due;
    maxRent += rent;
    rentAccounts.push({
      name: spec.name,
      address: spec.address.toBase58(),
      size: spec.size,
      strategy: spec.strategy,
      exists: !!info,
      rentDueLamports: decimal(due),
      maxRentLamports: decimal(rent),
    });
  }

  const maxCost = networkFee + maxRent;
  if (maxCost > MAX_TOTAL_PAYER_COST_LAMPORTS) throw new Error("PAYER_QUOTE_TOTAL_LIMIT");
  return {
    version: 1,
    payer: payer.toBase58(),
    recentBlockhash: lifetime.blockhash,
    lastValidBlockHeight: lifetime.lastValidBlockHeight,
    messageSha256: createHash("sha256").update(tx.serializeMessage()).digest("hex"),
    networkFeeLamports: decimal(networkFee),
    rentLamports: decimal(rentDue),
    maxRentLamports: decimal(maxRent),
    maxCostLamports: decimal(maxCost),
    rentAccounts,
  };
}
