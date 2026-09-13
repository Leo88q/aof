import { Router } from "express";
import { db } from "../lib/db";
import { pk } from "../lib/tx";

const r = Router();

// [NEW] Полить ферму друга (социальная механика)
r.post("/water", async (req, res) => {
  try {
    const { owner, waterer } = req.body;
    if (!owner || !waterer) {
      return res.status(400).json({ error: "owner и waterer обязательны" });
    }
    if (owner === waterer) {
      return res.status(400).json({ error: "нельзя поливать свою ферму" });
    }

    // Валидация адресов
    try { pk(owner); pk(waterer); } catch {
      return res.status(400).json({ error: "некорректный адрес" });
    }

    // Проверка: последний полив не ранее часа назад
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const lastWatering = await db.friendWatering.findFirst({
      where: {
        owner,
        waterer,
        wateredAt: { gte: oneHourAgo },
      },
    });

    if (lastWatering) {
      const waitMinutes = Math.ceil((60 * 60 * 1000 - (Date.now() - lastWatering.wateredAt.getTime())) / 60000);
      return res.status(429).json({ error: `Можно поливать раз в час. Подождите ${waitMinutes} мин` });
    }

    // Записываем полив
    await db.friendWatering.create({
      data: { owner, waterer, bonusPct: 1 },
    });

    // TODO: добавить +5 trust points для waterer (через trust system)
    // TODO: добавить +1% бонус к следующему майнингу owner (через PlayerBonus аккаунт)

    res.json({ success: true, message: "Ферма полита" });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
