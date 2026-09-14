import { Router } from "express";
import { db } from "../lib/db";
import { requireWalletProof } from "../security/walletProof";

const r = Router();

// Контент лора (Старый Ферма Джо + сезонные арки)
const LORE_ARCS: Record<string, any> = {
  onboarding: {
    title: "Добро пожаловать на ферму",
    npc: "Старый Ферма Джо",
    nodes: [
      { id: "welcome", text: "Здравствуй, сосед! Давно тут никого не было. Ферма заросла, но земля-то помнит руки." },
      { id: "first_mine", text: "Для начала — добудь немного ресурсов. Без FOOD далеко не уедешь." },
      { id: "first_tool", text: "Инструменты тут — всё. Без кирки камня не взять, без топора леса." },
    ],
  },
  rival_intro: {
    title: "Соперник",
    npc: "Ферма по соседству",
    nodes: [
      { id: "rival_seen", text: "Видел того фермера за холмом? Говорят, его поле растёт быстрее твоего. Пока что." },
    ],
  },
};

// Получить список арок и прогресс
r.get("/:user", async (req, res) => {
  try {
    const user = req.params.user;
    const progress = await db.loreProgress.findMany({ where: { user } });
    const arcs = Object.entries(LORE_ARCS).map(([arcId, arc]: any) => ({
      arcId,
      title: arc.title,
      npc: arc.npc,
      nodes: arc.nodes.map((n: any) => ({
        id: n.id,
        completed: progress.some((p) => p.arcId === arcId && p.nodeId === n.id && p.completed),
      })),
    }));
    res.json({ arcs });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Получить текст ноды + отметить прочитанной
r.post("/node/complete", requireWalletProof("lore_node_complete", "user"), async (req, res) => {
  try {
    const { user, arcId, nodeId } = req.body;
    const arc = LORE_ARCS[arcId];
    if (!arc) return res.status(404).json({ error: "Arc not found" });
    const node = arc.nodes.find((n: any) => n.id === nodeId);
    if (!node) return res.status(404).json({ error: "Node not found" });

    await db.loreProgress.upsert({
      where: { user_arcId_nodeId: { user, arcId, nodeId } },
      update: { completed: true },
      create: { user, arcId, nodeId, completed: true },
    });
    res.json({ npc: arc.npc, text: node.text });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
