/**
 * Resume-скрипт инициализации MaterialMints
 * Улучшения:
 * - Retry логика с exponential backoff
 * - Fresh blockhash перед каждой транзакцией
 * - Commitment "confirmed"
 * - Задержки между транзакциями (избегаем 429)
 */

import { Connection, Keypair, clusterApiUrl, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { AUTHORITY } from "../src/config";

// Используем Helius RPC если есть, иначе devnet (публичный)
const RPC_URL = process.env.HELIUS_RPC_URL || process.env.RPC_URL || clusterApiUrl("devnet");
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

const RESOURCES = [
  "seeds", "wheat", "flour", "bread", "wood", "stone", "coal", 
  "meat", "water", "food",
  "sandWhite", "sandPink", "sandYellow",
  "stoneBlue", "stonePurple", "stoneRed",
  "gemBlue", "gemOrange", "gemWhite", "gemGreen",
  "flaskBlue", "flaskYellow", "flaskGreen", "flaskPink", "flaskPurple",
];

// Retry wrapper для createMint
async function createMintWithRetry(
  connection: Connection,
  name: string,
  retries = 5
): Promise<PublicKey> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const mint = await createMint(
        connection,
        AUTHORITY,
        AUTHORITY.publicKey,
        AUTHORITY.publicKey,
        9,
        undefined,
        { commitment: "confirmed" }
      );
      return mint;
    } catch (e: any) {
      lastError = e;
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s, 8s, 16s
      console.log(`     ⚠️  Retry ${i+1}/${retries} через ${delay}ms: ${e.message?.slice(0, 80)}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

async function main() {
  console.log("🎮 Инициализация MaterialMints (v2 с retry)...");
  console.log(`📡 RPC: ${RPC_URL}`);
  console.log(`🔑 Authority: ${AUTHORITY.publicKey.toBase58()}`);
  console.log("");
  
  const connection = new Connection(RPC_URL, "confirmed");
  
  // Проверяем баланс
  const balance = await connection.getBalance(AUTHORITY.publicKey);
  console.log(`💰 Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
  
  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.error("❌ Недостаточно SOL!");
    process.exit(1);
  }
  
  console.log("📦 Создаём 25 SPL mint-токенов...\n");
  const mints: Record<string, string> = {};
  
  for (let i = 0; i < RESOURCES.length; i++) {
    const name = RESOURCES[i];
    process.stdout.write(`  [${(i+1).toString().padStart(2)}/25] ${name.padEnd(15)} ... `);
    
    try {
      const mint = await createMintWithRetry(connection, name);
      const addr = mint.toBase58();
      mints[name] = addr;
      console.log(`✅ ${addr.slice(0, 8)}...${addr.slice(-6)}`);
      
      // Задержка между транзакциями (избегаем 429 rate limit)
      if (i < RESOURCES.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e: any) {
      console.log(`❌ ${e.message?.slice(0, 100)}`);
      console.error(`\n💥 Fatal error при создании ${name}`);
      
      // Сохраняем что успели
      if (Object.keys(mints).length > 0) {
        const fs = await import("fs");
        const path = await import("path");
        const outPath = path.join(process.cwd(), "scripts", "mints-partial.json");
        fs.writeFileSync(outPath, JSON.stringify(mints, null, 2));
        console.log(`💾 Частичный результат сохранён в ${outPath}`);
      }
      process.exit(1);
    }
  }
  
  console.log(`\n✅ Создано ${Object.keys(mints).length} mint-токенов`);
  
  // Сохраняем в JSON
  const fs = await import("fs");
  const path = await import("path");
  const outPath = path.join(process.cwd(), "scripts", "mints.json");
  fs.writeFileSync(outPath, JSON.stringify(mints, null, 2));
  console.log(`💾 Сохранено в ${outPath}`);
  
  // Инициализация контракта
  console.log("\n🔧 Инициализация контракта...");
  
  const resp = await fetch(`${BACKEND_URL}/admin/init-material-mints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mints }),
  });
  
  const result: any = await resp.json();
  
  if (!resp.ok) {
    console.error("❌ Ошибка инициализации:", result.error);
    console.log(`   Mint-адреса сохранены в ${outPath}`);
    process.exit(1);
  }
  
  console.log(`✅ ${result.message}`);
  
  // Отправка транзакции
  if (result.tx) {
    console.log("\n📤 Отправка транзакции...");
    try {
      const sendResp = await fetch(`${BACKEND_URL}/admin/send-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx: result.tx }),
      });
      const sendResult: any = await sendResp.json();
      
      if (sendResult.signature) {
        console.log(`✅ Транзакция подтверждена: ${sendResult.signature}`);
        console.log(`🔗 Explorer: https://explorer.solana.com/tx/${sendResult.signature}?cluster=devnet`);
      } else {
        console.log("⚠️  Транзакция не отправлена:", sendResult.error || "нет send endpoint");
      }
    } catch (e: any) {
      console.error("❌ Ошибка отправки:", e.message);
    }
  }
  
  // Проверка
  console.log("\n🔍 Проверка через 3 секунды...");
  await new Promise(r => setTimeout(r, 3000));
  const checkResp = await fetch(`${BACKEND_URL}/query/material-mints`);
  const check: any = await checkResp.json();
  
  if (check.initialized) {
    console.log(`\n🎉 УСПЕХ! Контракт инициализирован.`);
    console.log(`   Загружено ${Object.keys(check.mints).length} mint-адресов`);
    console.log(`\n🎮 Теперь игра работает в реальном режиме!`);
  } else {
    console.log("\n⚠️  Контракт ещё не инициализирован");
  }
}

main().catch((e) => {
  console.error("💥 Fatal:", e);
  process.exit(1);
});
