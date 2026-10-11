/**
 * Push worker. Delivers Web Push when VAPID keys are configured and the
 * device token is a PushSubscription JSON. A row is marked sent only after
 * the push service accepts it, or when every device is gone (404/410).
 * Without keys the row stays unsent so a later key does not drop the queue.
 */
import { PrismaClient } from "@prisma/client";
import webpush from "web-push";

const db = new PrismaClient();
const PROCESS_INTERVAL_MS = 10_000;

type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };

function vapidReady(): boolean {
  const subject = process.env.VAPID_SUBJECT || "";
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

function asSubscription(token: string): Subscription | null {
  try {
    const parsed = JSON.parse(token);
    if (typeof parsed?.endpoint === "string" && parsed?.keys?.p256dh && parsed?.keys?.auth) return parsed;
  } catch {
    return null;
  }
  return null;
}

async function processQueue() {
  if (!vapidReady()) return;
  const pending = await db.notificationQueue.findMany({
    where: { sent: false },
    take: 50,
    orderBy: { createdAt: "asc" },
  });
  for (const notification of pending) {
    const devices = await db.deviceToken.findMany({
      where: { user: notification.user, enabled: true },
    });
    if (devices.length === 0) {
      await db.notificationQueue.update({ where: { id: notification.id }, data: { sent: true } });
      continue;
    }
    let delivered = 0;
    let remaining = 0;
    for (const device of devices) {
      const sub = asSubscription(device.token);
      if (!sub) {
        remaining += 1;
        continue;
      }
      try {
        await webpush.sendNotification(sub, JSON.stringify({
          title: notification.title,
          body: notification.body,
          data: notification.payload ? JSON.parse(notification.payload) : undefined,
        }));
        delivered += 1;
      } catch (error: any) {
        const status = error?.statusCode;
        if (status === 404 || status === 410) {
          await db.deviceToken.update({ where: { token: device.token }, data: { enabled: false } });
        } else {
          remaining += 1;
        }
      }
    }
    if (delivered > 0 && remaining === 0) {
      await db.notificationQueue.update({ where: { id: notification.id }, data: { sent: true } });
    }
  }
}

async function main() {
  console.log(`[push-worker] start (${vapidReady() ? "web-push" : "waiting for VAPID keys"})`);
  setInterval(() => {
    processQueue().catch((e) => console.error("[push-worker]", e.message));
  }, PROCESS_INTERVAL_MS);
}

main().catch(console.error);
