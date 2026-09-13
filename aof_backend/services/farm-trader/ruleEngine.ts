/**
 * Движок правил: проверяет условия пользователя против текущей цены.
 * Правила:
 *   smart_sell: {rarity, currency, trigger: price <= threshold}
 *   smart_buy: {rarity, toolType, trigger: price <= threshold, max_spend_per_day}
 *   push: {rarity, direction, threshold (%)} — только уведомление
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export interface PriceInfo {
  rarity: number;
  priceMascot: number;
  priceSol: number;
  prevPriceMascot?: number; // Для расчёта изменения в процентах
}

// Получить последнюю цену для редкости
export async function getCurrentPrice(rarity: number): Promise<PriceInfo | null> {
  const latest = await db.priceTick.findFirst({
    where: { rarity },
    orderBy: { ts: "desc" },
  });
  if (!latest) return null;

  // Ищем предыдущий тик для расчёта изменения
  const previous = await db.priceTick.findFirst({
    where: { rarity, ts: { lt: latest.ts } },
    orderBy: { ts: "desc" },
  });

  return {
    rarity,
    priceMascot: latest.priceMascot,
    priceSol: latest.priceSol,
    prevPriceMascot: previous?.priceMascot,
  };
}

// Проверка правила: сработало ли условие
export function checkRule(rule: any, price: PriceInfo): boolean {
  if (rule.paused) return false;

  // Фильтр по редкости
  if (rule.rarity && rule.rarity !== price.rarity) return false;

  // Выбираем цену по валюте правила
  const priceVal = rule.currency === "sol" ? price.priceSol : price.priceMascot;

  switch (rule.type) {
    case "smart_sell": {
      // Триггер: цена упала ниже порога → продаём
      if (!rule.threshold) return false;
      return priceVal <= rule.threshold;
    }
    case "smart_buy": {
      // Триггер: цена упала ниже порога → покупаем
      if (!rule.threshold) return false;
      return priceVal <= rule.threshold;
    }
    case "push": {
      // Уведомление при изменении на порог % в указанном направлении
      if (!rule.prevPriceMascot || !price.prevPriceMascot) return false;
      const changePct = Math.abs(
        ((priceVal - (rule.currency === "sol" ? price.priceSol : price.prevPriceMascot!)) /
          (rule.currency === "sol" ? price.priceSol : price.prevPriceMascot!)) * 100
      );
      if (changePct < (rule.threshold || 0)) return false;

      if (rule.direction === "up") {
        return priceVal > (price.prevPriceMascot || 0);
      }
      if (rule.direction === "down") {
        return priceVal < (price.prevPriceMascot || 0);
      }
      return true; // direction === "any"
    }
    default:
      return false;
  }
}
