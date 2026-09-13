import { Router } from "express";
import { db } from "../lib/db";

const r = Router();

// Создать гильдию
r.post("/create", async (req, res) => {
  try {
    const { name, leaderId } = req.body;
    const guild = await db.guild.create({
      data: {
        name,
        leaderId,
        members: { create: { user: leaderId, role: "leader" } },
      },
    });
    await db.guildActivity.create({
      data: { guildId: guild.id, actor: leaderId, action: "guild_created" },
    });
    res.json({ guild });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Вступить в гильдию
r.post("/join", async (req, res) => {
  try {
    const { guildId, user } = req.body;
    const member = await db.guildMember.create({
      data: { guildId, user, role: "member" },
    });
    await db.guildActivity.create({
      data: { guildId, actor: user, action: "joined" },
    });
    res.json({ member });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Внести ресурсы в общий склад
r.post("/deposit", async (req, res) => {
  try {
    const { guildId, user, amount } = req.body;
    const activity = await db.guildActivity.create({
      data: { guildId, actor: user, action: "deposit", amount },
    });
    res.json({ activity });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Лента активности гильдии
r.get("/activity/:guildId", async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const activities = await db.guildActivity.findMany({
      where: { guildId },
      orderBy: { ts: "desc" },
      take: 50,
    });
    res.json({ activities });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Участники гильдии с ролями
r.get("/members/:guildId", async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const members = await db.guildMember.findMany({
      where: { guildId },
      orderBy: { joinedAt: "asc" },
    });
    res.json({ members });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Повысить/понизить роль (только лидер)
r.post("/set-role", async (req, res) => {
  try {
    const { guildId, user, targetUser, newRole } = req.body;
    if (!["officer", "member"].includes(newRole)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    // Проверяем что запрашивающий — лидер
    const requester = await db.guildMember.findFirst({
      where: { guildId, user },
    });
    if (!requester || requester.role !== "leader") {
      return res.status(403).json({ error: "Only leader can change roles" });
    }
    const member = await db.guildMember.update({
      where: { guildId_user: { guildId, user: targetUser } },
      data: { role: newRole },
    });
    res.json({ member });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
