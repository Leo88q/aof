/**
 * Инициализация Config аккаунта (если его нет)
 */
import { connection } from "../src/provider";
import { configPda } from "../src/lib/pda";
import { program } from "../src/provider";
import { AUTHORITY } from "../src/config";
import { SystemProgram } from "@solana/web3.js";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

async function main() {
  console.log("🔧 Проверка Config аккаунта...\n");
  
  const [config] = configPda();
  console.log("Config PDA:", config.toBase58());
  
  const account = await connection.getAccountInfo(config);
  
  if (account) {
    console.log("✅ Config уже существует!");
    return;
  }
  
  console.log("❌ Config не существует — создаю...\n");
  
  // Добавляем endpoint для инициализации Config в admin.ts
  // Или вызываем напрямую через program
  
  try {
    const ix = await (program.methods as any)
      .initialize()
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    
    console.log("📤 Отправка транзакции инициализации Config...");
    
    const { Transaction } = await import("@solana/web3.js");
    const tx = new Transaction().add(ix);
    tx.feePayer = AUTHORITY.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(AUTHORITY);
    
    const signature = await connection.sendRawTransaction(tx.serialize());
    console.log("⏳ Ожидание подтверждения...");
    await connection.confirmTransaction(signature, "confirmed");
    
    console.log("✅ Config создан!");
    console.log(`🔗 https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
  } catch (e: any) {
    console.error("❌ Ошибка:", e.message);
    process.exit(1);
  }
}

main().catch(e => { console.error("💥", e); process.exit(1); });
