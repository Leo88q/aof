/**
 * Анти-фрод сервис: выявление сибил-аккаунтов и мошеннических паттернов.
 * Три сигнала (из ТЗ §4.1):
 *   1. Device fingerprint — несколько кошельков с одного устройства.
 *      Фингерпринт НЕ должен включать кошелёк: иначе один человек с N
 *      кошельками получает N «разных устройств» и сигнал теряет смысл.
 *   2. Скорость рефералов — аномально быстрые привязки
 *   3. Возраст кошелька — свеже-созданные кошельки подозрительнее
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const db = new PrismaClient();

// Генерация фингерпринта устройства из заголовков запроса
export function computeFingerprint(headers: any, _wallet?: string): string {
  const parts = [
    headers["user-agent"] || "",
    headers["accept-language"] || "",
    headers["x-device-model"] || "",
    headers["x-screen-resolution"] || "",
    headers["x-timezone"] || "",
  ];
  const secret = process.env.FINGERPRINT_SALT || "";
  return crypto.createHash("sha256").update(secret + "|" + parts.join("|")).digest("hex");
}

// Регистрация устройства + проверка на сибил
export async function registerDevice(user: string, fingerprint: string): Promise<{
  isNewDevice: boolean;
  sybilRisk: "low" | "medium" | "high";
  devicesCount: number;
}> {
  // Обновляем lastSeen если устройство известно
  const existing = await db.deviceFingerprint.findUnique({
    where: { user_fingerprint: { user, fingerprint } },
  });

  if (existing) {
    await db.deviceFingerprint.update({
      where: { id: existing.id },
      data: { lastSeen: new Date() },
    });
    return { isNewDevice: false, sybilRisk: "low", devicesCount: 1 };
  }

  // Новое устройство — регистрируем
  await db.deviceFingerprint.create({
    data: { user, fingerprint },
  });

  // Проверяем сколько всего устройств у пользователя
  const devicesCount = await db.deviceFingerprint.count({ where: { user } });

  // Проверяем сколько пользователей с таким же фингерпринтом (общее устройство)
  const sharedUsers = await db.deviceFingerprint.findMany({
    where: { fingerprint },
    distinct: ["user"],
  });

  let sybilRisk: "low" | "medium" | "high" = "low";
  if (devicesCount > 5) {
    sybilRisk = "high"; // Слишком много устройств — подозрительно
  } else if (sharedUsers.length > 3) {
    sybilRisk = "medium"; // Одно устройство на много кошельков
  } else if (devicesCount > 2) {
    sybilRisk = "medium";
  }

  // Автоматический флаг при высоком риске
  if (sybilRisk === "high") {
    await db.sybilFlag.create({
      data: {
        user,
        reason: "multi_device",
        severity: 2,
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
    });
    await db.trustFlag.create({
      data: {
        user,
        flagType: "sybil",
        mult: 0.4, // из ТЗ: ×0.4 к траст-индексу
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
    });
  }

  return { isNewDevice: true, sybilRisk, devicesCount };
}

// Holding period для реферальных наград (по тирам траста)
export async function scheduleReferralReward(params: {
  referrer: string;
  referred: string;
  rewardType: string;
  amount: number;
  holdingHours: number;
}): Promise<{ availableAt: Date }> {
  const availableAt = new Date(Date.now() + params.holdingHours * 3600000);

  await db.referralHolding.upsert({
    where: {
      referrer_referred_rewardType: {
        referrer: params.referrer,
        referred: params.referred,
        rewardType: params.rewardType,
      },
    },
    update: { amount: params.amount, availableAt },
    create: {
      referrer: params.referrer,
      referred: params.referred,
      rewardType: params.rewardType,
      amount: params.amount,
      availableAt,
    },
  });

  return { availableAt };
}

// Проверка доступности награды для клейма
export async function checkRewardAvailable(referrer: string, referred: string): Promise<{
  available: boolean;
  availableAt?: Date;
}> {
  const holding = await db.referralHolding.findFirst({
    where: { referrer, referred, claimed: false },
  });
  if (!holding) return { available: false };
  if (new Date() < holding.availableAt) {
    return { available: false, availableAt: holding.availableAt };
  }
  return { available: true };
}
