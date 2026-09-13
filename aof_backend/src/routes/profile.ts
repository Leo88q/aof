import { Router } from "express";
import { db } from "../lib/db";
import { pk } from "../lib/tx";

const r = Router();

// [NEW] Регистрация username (адрес + ник)
r.post("/register", async (req, res) => {
  try {
    const { address, username } = req.body;
    if (!address || !username) {
      return res.status(400).json({ error: "address и username обязательны" });
    }
    // Валидация ника
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: "username должен быть 3-20 символов" });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: "username может содержать только буквы, цифры и _" });
    }

    // Проверка, что address валидный
    try { pk(address); } catch {
      return res.status(400).json({ error: "некорректный адрес кошелька" });
    }

    // upsert: если уже есть — обновляем username
    const profile = await db.playerProfile.upsert({
      where: { address },
      update: { username },
      create: { address, username },
    });

    res.json({ success: true, profile });
  } catch (e: any) {
    // Уникальность username
    if (e.code === "P2002" && e.meta?.target?.includes("username")) {
      return res.status(409).json({ error: "этот username уже занят" });
    }
    res.status(400).json({ error: e.message });
  }
});

// [NEW] Резолвинг username → address
r.get("/by-username/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const profile = await db.playerProfile.findUnique({ where: { username } });
    if (!profile) {
      return res.status(404).json({ error: "username не найден" });
    }
    res.json({ address: profile.address });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// [NEW] Получить username по адресу
r.get("/username/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const profile = await db.playerProfile.findUnique({ where: { address } });
    if (!profile) {
      return res.json({ username: null });
    }
    res.json({ username: profile.username });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
