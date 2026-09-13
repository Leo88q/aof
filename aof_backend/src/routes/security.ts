/**
 * Админская панель безопасности.
 * Управление списком разрешённых минтов, circuit breaker, просмотр аудита.
 */
import { Router } from "express";
import { db } from "../lib/db";
import {
  addAllowedMint,
  removeAllowedMint,
  listAllowedMints,
} from "../security/mintValidator";
import { getCircuitState, setCircuitState } from "../security/circuitBreaker";

const r = Router();

// === Управление разрешёнными минтами ===

// Список разрешённых минтов
r.get("/mints", async (_req, res) => {
  try {
    const mints = await listAllowedMints();
    res.json({ mints });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Добавить минт в список разрешённых
r.post("/mints/add", async (req, res) => {
  try {
    const { mint, label } = req.body;
    await addAllowedMint(mint, label);
    res.json({ added: true, mint });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Удалить минт из списка разрешённых
r.post("/mints/remove", async (req, res) => {
  try {
    const { mint } = req.body;
    await removeAllowedMint(mint);
    res.json({ removed: true, mint });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// === Circuit Breaker ===

// Текущее состояние circuit breaker
r.get("/circuit", async (_req, res) => {
  try {
    const state = await getCircuitState();
    res.json({ state });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Установить состояние circuit breaker (только админ)
r.post("/circuit/set", async (req, res) => {
  try {
    const { state, reason } = req.body;
    if (!["OPEN", "HALF", "CLOSED"].includes(state)) {
      return res.status(400).json({ error: "Invalid state" });
    }
    await setCircuitState(state, reason || "Manual override");
    res.json({ state, reason });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// === Просмотр аудита ===

// Последние записи аудита
r.get("/audit", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const records = await db.auditRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({ records });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Аудит по конкретному кошельку
r.get("/audit/:wallet", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const records = await db.auditRecord.findMany({
      where: { wallet: req.params.wallet },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({ records });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// === Статистика операций по кошелькам ===

// Топ кошельков по количеству операций
r.get("/stats/top-wallets", async (req, res) => {
  try {
    const windowStart = new Date(Date.now() - 15 * 60 * 1000);
    const stats = await db.walletOperation.groupBy({
      by: ["wallet"],
      where: { createdAt: { gte: windowStart } },
      _count: true,
      _sum: { volumeLamports: true },
      orderBy: { _count: { wallet: "desc" } },
      take: 20,
    });
    res.json({ stats });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
