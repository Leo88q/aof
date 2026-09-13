import { Router } from "express";
import { db } from "../lib/db";

const r = Router();

const RECOVERY_INTERVAL_MS = 10 * 60 * 1000; // 1 единица / 10 минут

// Получить текущую энергию (с расчётом восстановления + кап от VIP)
r.get("/balance/:user", async (req, res) => {
  try {
    const user = req.params.user;

    // Кап зависит от VIP-статуса: 30 у VIP, 20 у обычных
    // (по ТЗ: "30 у VIP, 20 у обычных", восстановление 8/10 мин)
    let isVip = false;
    try {
      const profile = await db.profile.findUnique({ where: { user } });
      isVip = Boolean(profile?.title?.includes("VIP"));
    } catch {}
    const energyCap = isVip ? 30 : 20;
    const regenMs = isVip ? 8 * 60 * 1000 : 10 * 60 * 1000;

    let energy = await db.energy.findUnique({ where: { user } });
    if (!energy) {
      energy = await db.energy.create({ data: { user, cap: energyCap } });
    } else if (energy.cap !== energyCap) {
      // Обновляем кап если изменился статус
      energy = await db.energy.update({ where: { user }, data: { cap: energyCap } });
    }

    // Расчёт восстановления с момента последнего обновления
    const now = Date.now();
    const elapsed = now - new Date(energy.lastUpdate).getTime();
    const recovered = Math.floor(elapsed / regenMs);
    const newAmount = Math.min(energy.cap, energy.amount + recovered);

    if (newAmount !== energy.amount) {
      energy = await db.energy.update({
        where: { user },
        data: {
          amount: newAmount,
          lastUpdate: new Date(
            new Date(energy.lastUpdate).getTime() + recovered * RECOVERY_INTERVAL_MS
          ),
        },
      });
    }

    const msToNext = regenMs - (now - new Date(energy.lastUpdate).getTime());
    res.json({
      amount: energy.amount,
      cap: energy.cap,
      msToNextUnit: Math.max(0, msToNext),
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Потратить энергию на действие
r.post("/spend", async (req, res) => {
  try {
    const { user, amount } = req.body;
    const spendAmount = amount || 1;

    const energy = await db.energy.findUnique({ where: { user } });
    if (!energy) {
      return res.status(404).json({ error: "Energy not found" });
    }
    if (energy.amount < spendAmount) {
      return res.status(400).json({ error: "Not enough energy" });
    }

    const updated = await db.energy.update({
      where: { user },
      data: { amount: energy.amount - spendAmount },
    });
    res.json({ amount: updated.amount });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
