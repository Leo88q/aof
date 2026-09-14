/**
 * Только инициализация контракта (mint'ы уже созданы)
 */
import { readFileSync } from "fs";
import { join } from "path";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

async function main() {
  console.log("🔧 Инициализация контракта (mint'ы уже созданы)...\n");
  
  // Читаем сохранённые mint-адреса
  const mintsPath = join(process.cwd(), "scripts", "mints.json");
  const mints = JSON.parse(readFileSync(mintsPath, "utf-8"));
  
  console.log(`📦 Загружено ${Object.keys(mints).length} mint-адресов из mints.json`);
  console.log(`🔗 Backend: ${BACKEND_URL}\n`);
  
  // Вызываем init endpoint
  console.log("📤 POST /admin/init-material-mints...");
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
    console.error("❌ Ошибка:", result.error);
    if (result.missing) {
      console.error("   Отсутствуют:", result.missing);
    }
    process.exit(1);
  }
  
  console.log(`✅ ${result.message}`);
  
  // Отправка транзакции
  if (result.tx) {
    console.log("\n📤 Отправка транзакции в блокчейн...");
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
      console.log(`✅ Транзакция подтверждена!`);
      console.log(`🔗 https://explorer.solana.com/tx/${sendResult.signature}?cluster=devnet`);
    } else {
      console.log("⚠️  Не отправлено:", sendResult.error);
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
  } else {
    console.log("\n⚠️  Контракт не инициализирован");
  }
}

main().catch(e => { console.error("💥", e); process.exit(1); });
