import { Transaction, PublicKey } from "@solana/web3.js";
import { connection, wallet } from "../provider";
import { AUTHORITY } from "../config";
import { simulateTransaction } from "../security/txSimulator";

async function requireSimulation(tx: Transaction): Promise<void> {
  const result = await simulateTransaction(tx);
  if (!result.success) {
    throw new Error(`Transaction simulation failed: ${result.error || "unknown error"}`);
  }
}

export async function coSign(ix: any[], feePayer: PublicKey): Promise<string> {
  const tx = new Transaction().add(...ix);
  tx.feePayer = feePayer;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  // [ФИКС] Подписываем авторити только если инструкция реально требует его подписи.
  // Иначе partialSign бросает "unknown signer" и все пользовательские роуты
  // (листинг/офферы/аренда/аукцион/ордербук) падают на этапе сборки транзакции.
  const msg = tx.compileMessage();
  const required = msg.accountKeys.slice(0, msg.header.numRequiredSignatures);
  if (required.some((k: any) => k.equals(AUTHORITY.publicKey))) {
    tx.partialSign(AUTHORITY);
  }
  await requireSimulation(tx);
  return tx.serialize({ requireAllSignatures: false }).toString("base64");
}

export async function authorityOnly(ix: any[]): Promise<string> {
  const tx = new Transaction().add(...ix);
  tx.feePayer = AUTHORITY.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(AUTHORITY);
  await requireSimulation(tx);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

export function pk(s: string): PublicKey {
  return new PublicKey(s);
}
