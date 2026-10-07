/**
 * Resume-скрипт инициализации MaterialMints
 * Улучшения:
 * - Retry логика с exponential backoff
 * - Fresh blockhash перед каждой транзакцией
 * - Commitment "confirmed"
 * - Задержки между транзакциями (избегаем 429)
 */

import { BorshAccountsCoder } from "@coral-xyz/anchor";
import { Connection, clusterApiUrl, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import idl from "../src/idl/aof_core.json";
import { AUTHORITY, PROGRAM_ID } from "../src/config";
import { validateCanonicalResourceRegistry } from "../src/lib/resourceRegistry";
// [AUDIT AOF-H1] bootstrap scripts need a hot authority key by design;
// refuse to run (loudly) under AUTHORITY_MODE=read-only.
if (!AUTHORITY) {
  throw new Error(
    "Deploy script requires AUTHORITY_MODE=hot + AUTHORITY_SECRET_KEY [AOF-H1]; "
    + "read-only mode cannot bootstrap programs.",
  );
}
// ts-node компилирует с проверкой типов, но TS не сужает импортированную
// привязку внутри функций (TS18047) — фиксируем не-null значение локально.
const authority = AUTHORITY;


// Используем Helius RPC если есть, иначе devnet (публичный)
const RPC_URL = process.env.HELIUS_RPC_URL || process.env.RPC_URL || clusterApiUrl("devnet");
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

const RESOURCES = ["neuron", "synapse", "signal", "model", "circuit", "silicon", "mind", "compute", "dataset", "power", "data", "clearQuartz", "roseQuartz", "amberQuartz", "blueCore", "purpleCore", "redCore", "quantumBit", "neuralChip", "photonBit", "bioChip", "cryoFluid", "voltFluid", "bioFluid", "nanoFluid", "quantumFluid", "soulCore"];

const [MINT_AUTHORITY] = PublicKey.findProgramAddressSync(
  [Buffer.from("auth")],
  PROGRAM_ID,
);

const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const [CONFIG_ADDRESS] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
const [MATERIAL_MINTS_ADDRESS] = PublicKey.findProgramAddressSync([Buffer.from("material_mints")], PROGRAM_ID);
const coder = new BorshAccountsCoder(idl as any);

function camelAccount(raw: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [
    key.replace(/_([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase()), value,
  ]));
}

/** Return true only for a fully valid existing registry; never mint replacements. */
async function existingResourceMints(connection: Connection): Promise<boolean> {
  const info = await connection.getAccountInfo(MATERIAL_MINTS_ADDRESS, "confirmed");
  if (!info) return false;
  if (!info.owner.equals(PROGRAM_ID)) {
    throw new Error("MaterialMints PDA exists but is not owned by aof_core; refusing to create replacement mints");
  }
  const configInfo = await connection.getAccountInfo(CONFIG_ADDRESS, "confirmed");
  if (!configInfo || !configInfo.owner.equals(PROGRAM_ID)) {
    throw new Error("MaterialMints exists without a canonical aof_core Config; refusing to create replacement mints");
  }
  let config: Record<string, any>;
  let materialMints: Record<string, any>;
  try {
    config = camelAccount(coder.decode("Config", configInfo.data) as any);
    materialMints = camelAccount(coder.decode("MaterialMints", info.data) as any);
  } catch (error) {
    throw new Error(`existing resource registry cannot be decoded; refusing to create replacement mints: ${String(error)}`);
  }
  const registry = await validateCanonicalResourceRegistry(connection, config, materialMints, MINT_AUTHORITY);
  if (!registry.mints) {
    throw new Error(`existing resource registry is invalid; refusing to create replacement mints: ${registry.errors.join(",")}`);
  }
  const payoutMints = [
    registry.mints.CIRCUIT, registry.mints.SILICON, registry.mints.DATASET, registry.mints.NEURON,
  ];
  if (new Set(payoutMints.map((mint) => mint.toBase58())).size !== 4) {
    throw new Error("existing mining payout registry does not have four unique mints");
  }
  console.log("✅ MaterialMints уже инициализирован и прошёл проверку всех 27 SPL mint; новые минты не создаются.");
  console.log(`   CIRCUIT=${payoutMints[0].toBase58()} SILICON=${payoutMints[1].toBase58()}`);
  console.log(`   DATASET=${payoutMints[2].toBase58()} NEURON=${payoutMints[3].toBase58()}`);
  return true;
}

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
        authority,
        MINT_AUTHORITY,
        null,
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
  console.log(`🔑 Authority: ${authority.publicKey.toBase58()}`);
  console.log("");
  
  const connection = new Connection(RPC_URL, "confirmed");
  const genesis = await connection.getGenesisHash();
  if (genesis !== DEVNET_GENESIS) {
    throw new Error(`RPC is not devnet (${genesis}); resource mints are only bootstrapped on devnet`);
  }
  if (await existingResourceMints(connection)) return;
  
  // Проверяем баланс
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`💰 Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
  
  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.error("❌ Недостаточно SOL!");
    process.exit(1);
  }
  
  console.log("📦 Создаём 27 канонических SPL-токенов...\n");
  const mints: Record<string, string> = {};
  
  for (let i = 0; i < RESOURCES.length; i++) {
    const name = RESOURCES[i];
    process.stdout.write(`  [${(i+1).toString().padStart(2)}/${RESOURCES.length}] ${name.padEnd(15)} ... `);
    
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ADMIN_TOKEN || ""}`,
    },
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
      }
    } catch (e: any) {
      console.error("❌ Ошибка отправки:", e.message);
    }
  }

  console.log("\n🔧 Установка базовых resource mint'ов...");
  const setMintsResp = await fetch(`${BACKEND_URL}/admin/set-resource-mints`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ADMIN_TOKEN || ""}`,
    },
    body: JSON.stringify({
      dataMint: mints.data,
      circuitMint: mints.circuit,
      siliconMint: mints.silicon,
      neuronMint: mints.neuron,
      powerMint: mints.power,
      mindMint: mints.mind,
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
