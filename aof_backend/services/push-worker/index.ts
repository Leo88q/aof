/**
 * Push Worker: заготовка для отправки мобильных пушей.
 * В полной версии подключается к:
 *   - FCM (Android) через firebase-admin
 *   - APNs (iOS) через node-apn
 *   - Web Push через web-push
 *
 * Сейчас: помечает уведомления как отправленные (лог-режим),
 * чтобы не блокировать очередь до интеграции с Capacitor.
 *
 * Запуск: npx ts-node services/push-worker/index.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const PROCESS_INTERVAL_MS = 10_000; // Каждые 10 секунд

async function processQueue() {
  // Берём 50 неотправленных уведомлений
  const pending = await db.notificationQueue.findMany({
    where: { sent: false },
    take: 50,
    orderBy: { createdAt: "asc" },
  });

  if (pending.length === 0) return;

  console.log(`[push-worker] Обработка ${pending.length} уведомлений`);

  for (const notification of pending) {
    // Получаем активные токены устройств пользователя
    const devices = await db.deviceToken.findMany({
      where: { user: notification.user, enabled: true },
    });

    if (devices.length === 0) {
      // Нет устройств — просто помечаем как отправленное
      await db.notificationQueue.update({
        where: { id: notification.id },
        data: { sent: true },
      });
      continue;
    }

    // TODO: реальная отправка через FCM/APNs/Web Push
    // Пока лог-режим: печатаем и помечаем как отправленное
    console.log(
      `[push-worker] → ${notification.user} (${devices.length} устройств): ` +
      `${notification.title} — ${notification.body}`
    );

    await db.notificationQueue.update({
      where: { id: notification.id },
      data: { sent: true },
    });
  }
}

async function main() {
  console.log("[push-worker] Запуск (лог-режим, реальная отправка после интеграции с Capacitor)");
  setInterval(() => {
    processQueue().catch((e) => console.error("[push-worker] Ошибка:", e.message));
  }, PROCESS_INTERVAL_MS);
}

main().catch(console.error);
