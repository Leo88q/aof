import { Router } from "express";
import { db } from "../lib/db";
import { requireWalletProof } from "../security/walletProof";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

// Зарегистрировать токен устройства (вызывается фронтом через Capacitor)
r.post("/device/register", requireWalletProof("notifications_device_register", "user"), async (req, res) => {
  try {
    const { user, platform, token } = req.body;
    if (!["ios", "android", "web"].includes(platform)) {
      return res.status(400).json({ error: "Invalid platform" });
    }

    const device = await db.deviceToken.upsert({
      where: { token },
      update: { user, platform, enabled: true },
      create: { user, platform, token },
    });
    res.json({ device });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Отписаться от пушей
r.post("/device/unregister", requireWalletProof("notifications_device_unregister", "user"), async (req, res) => {
  try {
    const { token, user } = req.body;
    const device = await db.deviceToken.findUnique({ where: { token } });
    if (!device || device.user !== user) return res.status(403).json({ error: "Not your device token" });
    await db.deviceToken.update({ where: { token }, data: { enabled: false } });
    res.json({ disabled: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Добавить уведомление в очередь (вызывается другими сервисами)
r.post("/queue", requireAdmin, async (req, res) => {
  try {
    const { user, type, title, body, payload } = req.body;
    const notification = await db.notificationQueue.create({
      data: { user, type, title, body, payload: payload ? JSON.stringify(payload) : null },
    });
    res.json({ queued: notification.id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// История уведомлений пользователя
r.get("/:user", async (req, res) => {
  try {
    const user = req.params.user;
    const notifications = await db.notificationQueue.findMany({
      where: { user },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ notifications });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
