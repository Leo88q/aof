import { Router } from "express";
import { db } from "../lib/db";
import { issueApiKey } from "../middleware/apiKey";

const r = Router();

// Выпустить новый API-ключ (только админ в проде)
r.post("/issue", async (req, res) => {
  try {
    const { label, tier } = req.body;
    if (!label) return res.status(400).json({ error: "label required" });
    const key = await issueApiKey(label, tier || "free");
    res.json({ key, label, tier: tier || "free" });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Список ключей
r.get("/list", async (req, res) => {
  try {
    const keys = await db.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        tier: true,
        rateLimit: true,
        active: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
    res.json({ keys });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Отозвать ключ
r.post("/revoke", async (req, res) => {
  try {
    const { id } = req.body;
    await db.apiKey.update({ where: { id }, data: { active: false } });
    res.json({ revoked: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
