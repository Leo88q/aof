import { Router } from "express";
import { db } from "../lib/db";
import { requireIdempotency } from "../middleware/security";

const r = Router();

// Шкала бонусов по отсутствию
const COMEBACK_TIERS = [
  { minDays: 3,  type: "small",  reward: { core: 100, drumSpin: false } },
  { minDays: 7,  type: "medium", reward: { core: 500, drumSpin: true } },
  { minDays: 30, type: "large",  reward: { core: 2000, drumSpin: true, forgeFree: true } },
];

// Чек-ин: определяет отсутствие и создаёт комбэк-бонус если нужно
r.post("/check", async (req, res) => {
  try {
    const { user } = req.body;
    let record = await db.comebackRecord.findUnique({ where: { user } });
    const now = new Date();

    if (!record) {
      record = await db.comebackRecord.create({
        data: { user, lastSeen: now },
      });
      return res.json({ absenceDays: 0, comebackBonus: null, isNew: true });
    }

    const absenceMs = now.getTime() - new Date(record.lastSeen).getTime();
    const absenceDays = Math.floor(absenceMs / 86400000);

    // Обновляем lastSeen
    await db.comebackRecord.update({
      where: { user },
      data: { lastSeen: now, totalAbsences: { increment: absenceDays > 0 ? 1 : 0 } },
    });

    // Если отсутствие >= 3 дней — создаём комбэк-бонус
    if (absenceDays >= 3) {
      const tier = COMEBACK_TIERS.filter((t) => absenceDays >= t.minDays).pop();
      if (tier) {
        await db.comebackBonus.upsert({
          where: { user_absenceDays: { user, absenceDays } },
          update: {},
          create: { user, absenceDays, bonusType: tier.type },
        });
        return res.json({
          absenceDays,
          comebackBonus: {
            type: tier.type,
            reward: tier.reward,
            message:
              tier.type === "small" ? "С возвращением! Небольшой подарок." :
              tier.type === "medium" ? "Мы скучали! Подарок + спин Барабана." :
              "Долго не виделись! Большой пакет наград.",
          },
        });
      }
    }

    res.json({ absenceDays, comebackBonus: null });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Список доступных комбэк-бонусов
r.get("/:user", async (req, res) => {
  try {
    const user = req.params.user;
    const bonuses = await db.comebackBonus.findMany({
      where: { user, claimed: false },
      orderBy: { createdAt: "desc" },
    });
    res.json({ bonuses });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Забрать комбэк-бонус (с реальным начислением наград)
r.post("/claim", requireIdempotency, async (req, res) => {
  try {
    const { id, mints } = req.body;
    const bonus = await db.comebackBonus.findUnique({ where: { id } });
    if (!bonus) return res.status(404).json({ error: "Not found" });
    if (bonus.claimed) return res.status(400).json({ error: "Already claimed" });

    const updated = await db.comebackBonus.update({
      where: { id },
      data: { claimed: true },
    });

    const tier = COMEBACK_TIERS.find((t) => t.type === bonus.bonusType);
    const reward = tier?.reward || { core: 0 };

    // Реальное начисление: создаём письмо в инбокс с наградой
    // (инбокс уже умеет начислять через mintResource)
    await db.inboxItem.create({
      data: {
        user: bonus.user,
        sender: "Age of Farming Team",
        subject: "С возвращением, фермер!",
        body: `Мы скучали! Пропущено дней: ${bonus.absenceDays}. Забирай подарок.`,
        rewardType: "WOOD",
        rewardAmount: reward.core,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });

    res.json({ bonus: updated, reward, inboxCreated: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
