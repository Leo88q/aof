/**
 * Скрипт автоматической инициализации MaterialMints
 * 
 * Что делает:
 * 1. Создаёт 27 канонических SPL-токенов (SEEDS, WHEAT, FLOUR, и т.д.)
 * 2. Собирает их адреса
 * 3. Вызывает /admin/init-material-mints для инициализации контракта
 * 4. Сохраняет адреса в mints.json для reference
 * 
 * Использование:
 *   cd ~/Desktop/aof_gui/aof_backend
 *   npx ts-node scripts/initMints.ts
 */

import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import { AUTHORITY, PROGRAM_ID } from "../src/config";
// [AUDIT AOF-H1] bootstrap scripts need a hot authority key by design;
// refuse to run (loudly) under AUTHORITY_MODE=read-only.
if (!AUTHORITY) {
  throw new Error(
    "Deploy script requires AUTHORITY_MODE=hot + AUTHORITY_SECRET_KEY [AOF-H1]; "
    + "read-only mode cannot bootstrap programs.",
  );
}


const RPC_URL = process.env.RPC_URL || clusterApiUrl("devnet");
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

// Все 27 ресурсных mint'ов: 4 в Config + 23 в MaterialMints.
const RESOURCES = [
  "seeds", "wheat", "flour", "bread", "wood", "stone", "potato", "coal",
  "meat", "water", "food",
  "sandWhite", "sandPink", "sandYellow",
  "stoneBlue", "stonePurple", "stoneRed",
  "gemBlue", "gemOrange", "gemWhite", "gemGreen",
  "flaskBlue", "flaskYellow", "flaskGreen", "flaskPink", "flaskPurple",
  "loveHeart",
];

// mint_resource проверяет, что mint authority — именно auth PDA программы.
const [MINT_AUTHORITY] = PublicKey.findProgramAddressSync(
  [Buffer.from("auth")],
  PROGRAM_ID,
);

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
    console.error("❌ Недостаточно SOL. Нужно минимум 0.1 SOL для создания ресурсных mint'ов.");
    console.log(`   Airdrop: solana airdrop 2 ${AUTHORITY.publicKey.toBase58()} --url devnet`);
    process.exit(1);
  }
  
  // 1. Создаём все 27 канонических mint-токенов
  console.log("\n📦 Создаём SPL mint-токены...\n");
  const mints: Record<string, string> = {};
  
  for (let i = 0; i < RESOURCES.length; i++) {
    const name = RESOURCES[i];
    try {
      process.stdout.write(`  [${i+1}/${RESOURCES.length}] ${name.padEnd(15)} ... `);
      
      const mint = await createMint(
        connection,
        AUTHORITY,                    // payer
        MINT_AUTHORITY,               // mintAuthority: auth PDA signs on-chain minting
        null,                         // immutable freeze authority
        9                             // decimals
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ADMIN_TOKEN || ""}`,
    },
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
        headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ADMIN_TOKEN || ""}`,
    },
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

  // 5. Config хранит базовые mint'ы отдельно от MaterialMints.
  console.log("\n🔧 Установка базовых resource mint'ов...");
  const setMintsResp = await fetch(`${BACKEND_URL}/admin/set-resource-mints`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ADMIN_TOKEN || ""}`,
    },
    body: JSON.stringify({
      foodMint: mints.food,
      woodMint: mints.wood,
      stoneMint: mints.stone,
      seedsMint: mints.seeds,
      waterMint: mints.water,
      potatoMint: mints.potato,
    }),
  });
  const setMintsResult: any = await setMintsResp.json();
  if (!setMintsResp.ok) {
    console.error("❌ Ошибка установки базовых mint'ов:", setMintsResult.error);
    process.exit(1);
  }
  if (setMintsResult.tx) {
    const sendResp = await fetch(`${BACKEND_URL}/admin/send-tx`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ADMIN_TOKEN || ""}`,
      },
      body: JSON.stringify({ tx: setMintsResult.tx }),
    });
    const sendResult: any = await sendResp.json();
    if (!sendResp.ok || !sendResult.signature) {
      console.error("❌ Ошибка отправки Config mint-транзакции:", sendResult.error || "unknown error");
      process.exit(1);
    }
  }
  
  // 6. Проверяем что контракт инициализирован
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
