import { Router } from "express";
import { db } from "../lib/db";
import { computeFingerprint, registerDevice } from "../lib/antifraud";

const r = Router();

// Регистрация устройства при заходе в приложение
r.post("/device/register", async (req, res) => {
  try {
    const { user } = req.body;
    const fingerprint = computeFingerprint(req.headers, user);
    const result = await registerDevice(user, fingerprint);
    res.json({ fingerprint: fingerprint.slice(0, 12), ...result });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Статус сибил-флагов пользователя
r.get("/status/:user", async (req, res) => {
  try {
    const user = req.params.user;
    const flags = await db.sybilFlag.findMany({
      where: { user, active: true },
    });
    const devices = await db.deviceFingerprint.count({ where: { user } });

    // Определяем уровень риска
    let riskLevel: "clean" | "watch" | "flagged" = "clean";
    if (flags.some((f) => f.severity >= 2)) riskLevel = "flagged";
    else if (flags.length > 0 || devices > 3) riskLevel = "watch";

    res.json({
      user,
      riskLevel,
      activeFlags: flags.map((f) => ({
        reason: f.reason,
        severity: f.severity,
        expiresAt: f.expiresAt,
      })),
      devicesCount: devices,
      consequences: riskLevel === "flagged"
        ? {
            trustMultiplier: 0.4,
            holdingPeriodHours: 72,
            referralRewardsDelayed: true,
          }
        : null,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Доступность реферальной награды (с учётом holding period)
r.get("/reward/availability", async (req, res) => {
  try {
    const { referrer, referred } = req.query as any;
    const holding = await db.referralHolding.findFirst({
      where: { referrer, referred, claimed: false },
    });
    if (!holding) {
      return res.json({ available: false, reason: "no_pending_reward" });
    }
    const now = new Date();
    if (now < holding.availableAt) {
      const hoursLeft = Math.ceil((holding.availableAt.getTime() - now.getTime()) / 3600000);
      return res.json({
        available: false,
        availableAt: holding.availableAt,
        hoursLeft,
        reason: "holding_period",
      });
    }
    res.json({ available: true, amount: holding.amount, rewardType: holding.rewardType });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
