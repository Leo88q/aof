/**
 * Скрипт автоматической инициализации MaterialMints
 * 
 * Что делает:
 * 1. Создаёт 25 SPL mint-токенов (SEEDS, WHEAT, FLOUR, и т.д.)
 * 2. Собирает их адреса
 * 3. Вызывает /admin/init-material-mints для инициализации контракта
 * 4. Сохраняет адреса в mints.json для reference
 * 
 * Использование:
 *   cd ~/Desktop/aof_gui/aof_backend
 *   npx ts-node scripts/initMints.ts
 */

import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import { AUTHORITY } from "../src/config";

const RPC_URL = process.env.RPC_URL || clusterApiUrl("devnet");
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

// Все 25 ресурсов игры
const RESOURCES = [
  "seeds", "wheat", "flour", "bread", "wood", "stone", "coal", 
  "meat", "water", "food",
  "sandWhite", "sandPink", "sandYellow",
  "stoneBlue", "stonePurple", "stoneRed",
  "gemBlue", "gemOrange", "gemWhite", "gemGreen",
  "flaskBlue", "flaskYellow", "flaskGreen", "flaskPink", "flaskPurple",
];

async function main() {
  console.log("🎮 Инициализация MaterialMints...");
  console.log(`📡 RPC: ${RPC_URL}`);
  console.log(`🔑 Authority: ${AUTHORITY.publicKey.toBase58()}`);
  console.log("");
  
  const connection = new Connection(RPC_URL, "confirmed");
  
  // Проверяем баланс authority
  const balance = await connection.getBalance(AUTHORITY.publicKey);
  console.log(`💰 Balance: ${(balance / 1e9).toFixed(4)} SOL`);
  
  if (balance < 0.1e9) {
    console.error("❌ Недостаточно SOL. Нужно минимум 0.1 SOL для создания 25 mint'ов.");
    console.log(`   Airdrop: solana airdrop 2 ${AUTHORITY.publicKey.toBase58()} --url devnet`);
    process.exit(1);
  }
  
  // 1. Создаём все 25 mint-токенов
  console.log("\n📦 Создаём SPL mint-токены...\n");
  const mints: Record<string, string> = {};
  
  for (let i = 0; i < RESOURCES.length; i++) {
    const name = RESOURCES[i];
    try {
      process.stdout.write(`  [${i+1}/${RESOURCES.length}] ${name.padEnd(15)} ... `);
      
      const mint = await createMint(
        connection,
        AUTHORITY,                    // payer
        AUTHORITY.publicKey,          // mintAuthority
        AUTHORITY.publicKey,          // freezeAuthority
        9                             // decimals (как у большинства токенов)
      );
      
      const addr = mint.toBase58();
      mints[name] = addr;
      console.log(`✅ ${addr.slice(0, 8)}...${addr.slice(-6)}`);
    } catch (e: any) {
      console.log(`❌ ${e.message}`);
      process.exit(1);
    }
  }
  
  console.log(`\n✅ Создано ${Object.keys(mints).length} mint-токенов`);
  
  // 2. Сохраняем в JSON
  const fs = await import("fs");
  const path = await import("path");
  const outPath = path.join(process.cwd(), "scripts", "mints.json");
  fs.writeFileSync(outPath, JSON.stringify(mints, null, 2));
  console.log(`💾 Сохранено в ${outPath}`);
  
  // 3. Вызываем admin endpoint
  console.log("\n🔧 Инициализация контракта...");
  const resp = await fetch(`${BACKEND_URL}/admin/init-material-mints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mints }),
  });
  
  const result: any = await resp.json();
  
  if (!resp.ok) {
    console.error("❌ Ошибка инициализации:", result.error);
    process.exit(1);
  }
  
  console.log(`✅ ${result.message}`);
  console.log(`📝 Transaction ready for signing`);
  
  // 4. Подписываем и отправляем транзакцию (если есть coSign)
  if (result.tx) {
    console.log("\n📤 Отправка транзакции в блокчейн...");
    try {
      // Отправляем через backend endpoint send
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
        console.log("   Сохрани mints.json и используй для повторной попытки");
      }
    } catch (e: any) {
      console.error("❌ Ошибка отправки:", e.message);
    }
  }
  
  // 5. Проверяем что контракт инициализирован
  console.log("\n🔍 Проверка...");
  await new Promise(r => setTimeout(r, 2000));
  const checkResp = await fetch(`${BACKEND_URL}/query/material-mints`);
  const check: any = await checkResp.json();
  
  if (check.initialized) {
    console.log(`\n🎉 УСПЕХ! Контракт инициализирован.`);
    console.log(`   Загружено ${Object.keys(check.mints).length} mint-адресов`);
    console.log(`\n🎮 Теперь игра работает в реальном режиме!`);
  } else {
    console.log("\n⚠️  Контракт ещё не инициализирован (транзакция не отправлена)");
    console.log(`   Mint-адреса сохранены в ${outPath}`);
  }
}

main().catch((e) => {
  console.error("💥 Fatal:", e);
  process.exit(1);
});
