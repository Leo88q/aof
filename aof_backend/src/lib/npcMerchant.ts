/**
 * NPC Торговец "Фермер"
 * Автономно торгует на маркете 24/7.
 * 
 * Стратегия:
 * - Покупает FOOD/SEEDS/WHEAT выше рынка на 5%
 * - Продаёт излишки ниже рынка на 3%
 * - Лимит: 3 сделки за цикл (каждые 10 минут)
 */

import { db } from "./db";
import { PublicKey } from "@solana/web3.js";

interface MerchantAction {
  type: "buy" | "sell";
  resource: string;
  amount: number;
  price: number;
  reason: string;
}

// Конфигурация NPC
const NPC_CONFIG = {
  name: "Фермер",
  wallet: "NPC_FARMER_" + "X".repeat(32), // TODO: реальный кошелёк
  maxTradesPerCycle: 3,
  buyPremium: 0.05,  // покупает на 5% выше рынка
  sellDiscount: 0.03, // продаёт на 3% ниже рынка
  resources: ["WHEAT", "FOOD", "SEEDS", "FLOUR", "BREAD"],
};

/**
 * Главный цикл торгового агента
 * Запускается cron'ом каждые 10 минут
 */
export async function runMerchantCycle(): Promise<MerchantAction[]> {
  console.log(`🤖 [${NPC_CONFIG.name}] Запуск торгового цикла...`);
  
  const actions: MerchantAction[] = [];
  
  // Анализируем каждый ресурс
  for (const resource of NPC_CONFIG.resources) {
    if (actions.length >= NPC_CONFIG.maxTradesPerCycle) break;
    
    const action = await analyzeAndTrade(resource);
    if (action) {
      actions.push(action);
      await logTrade(action);
    }
  }
  
  console.log(`🤖 [${NPC_CONFIG.name}] Цикл завершён: ${actions.length} сделок`);
  return actions;
}

/**
 * Анализ рынка и принятие решения
 */
async function analyzeAndTrade(resource: string): Promise<MerchantAction | null> {
  try {
    // Симуляция рыночного анализа (TODO: подключить к реальному orderbook когда будет on-chain)
    // Генерируем случайное решение для демонстрации
    const rand = Math.random();
    const avgPrice = 0.001 + Math.random() * 0.002; // 0.001-0.003 SOL
    
    // 40% шанс купить, 30% продать, 30% ничего
    if (rand < 0.4) {
      const buyPrice = avgPrice * (1 + NPC_CONFIG.buyPremium);
      const amount = Math.floor(10 + Math.random() * 40); // 10-50 единиц
      
      return {
        type: "buy",
        resource,
        amount,
        price: buyPrice,
        reason: `Симуляция: покупаем ${resource} по ${buyPrice.toFixed(4)} SOL`,
      };
    }
    
    if (rand < 0.7) {
      const sellPrice = avgPrice * (1 - NPC_CONFIG.sellDiscount);
      const amount = Math.floor(10 + Math.random() * 30);
      
      return {
        type: "sell",
        resource,
        amount,
        price: sellPrice,
        reason: `Симуляция: продаём ${resource} по ${sellPrice.toFixed(4)} SOL`,
      };
    }
    
    // Рынок сбалансирован — не торгуем
    return null;
    
  } catch (e) {
    console.error(`🤖 [${NPC_CONFIG.name}] Ошибка анализа ${resource}:`, e);
    return null;
  }
}

/**
 * Логирует сделку NPC в AuditLog
 */
async function logTrade(action: MerchantAction) {
  try {
    await db.auditLog.create({
      data: {
        user: NPC_CONFIG.wallet,
        action: `npc_${action.type}_${action.resource}`,
        metadata: JSON.stringify({
          amount: action.amount,
          price: action.price,
          reason: action.reason,
          timestamp: new Date().toISOString(),
        }),
        result: "success",
      },
    });
    
    console.log(`🤖 [${NPC_CONFIG.name}] ${action.type.toUpperCase()} ${action.amount} ${action.resource} @ ${action.price.toFixed(4)} SOL`);
  } catch (e) {
    console.error(`🤖 [${NPC_CONFIG.name}] Ошибка логирования:`, e);
  }
}

/**
 * Получает статистику NPC
 */
export async function getMerchantStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const trades = await db.auditLog.findMany({
    where: {
      user: NPC_CONFIG.wallet,
      action: { startsWith: "npc_" },
      timestamp: { gte: today },
    },
  });
  
  const buyTrades = trades.filter(t => t.action.includes("_buy_"));
  const sellTrades = trades.filter(t => t.action.includes("_sell_"));
  
  return {
    name: NPC_CONFIG.name,
    totalTradesToday: trades.length,
    buyTrades: buyTrades.length,
    sellTrades: sellTrades.length,
    resources: NPC_CONFIG.resources,
    strategy: {
      buyPremium: `${(NPC_CONFIG.buyPremium * 100).toFixed(0)}%`,
      sellDiscount: `${(NPC_CONFIG.sellDiscount * 100).toFixed(0)}%`,
    },
  };
}
