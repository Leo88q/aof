import { db } from "../lib/db";
import { generateDailyQuests } from "../lib/questGenerator";
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { AUTHORITY } from "../config";
import { questsProgram } from "../provider";
import {
  questConfigPda,
  questTemplatePda,
  questProgressPda,
  achievementRecordPda,
} from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";

const r = Router();

// Инициализация конфигурации заданий
r.post("/config/init", async (req, res) => {
  try {
    const potatoMint = pk(req.body.potatoMint);
    const treasuryPotato = pk(req.body.treasuryPotato);

    const [questConfig] = questConfigPda();

    const ix = await (questsProgram.methods as any)
      .initQuestConfig(potatoMint, treasuryPotato)
      .accounts({
        questConfig,
        authority: AUTHORITY.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Создание шаблона квеста
r.post("/quest/init", async (req, res) => {
  try {
    const questId = Number(req.body.questId);
    const rewardPotato = new BN(req.body.rewardPotato);

    const [questConfig] = questConfigPda();
    const [questTemplate] = questTemplatePda(questId);

    const ix = await (questsProgram.methods as any)
      .questInit(questId, rewardPotato)
      .accounts({
        questConfig,
        questTemplate,
        authority: AUTHORITY.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Клейм награды за выполненный квест
r.post("/quest/claim", requireCircuitOpen, requireWalletLimits("quests_claim"), requireIdempotency, async (req, res) => {
  try {
    const user = pk(req.body.user);
    const questId = Number(req.body.questId);

    const [questConfig] = questConfigPda();
    const [questTemplate] = questTemplatePda(questId);
    const [questProgress] = questProgressPda(user, questId);

    // Читаем конфиг чтобы взять адреса казны и минта
    const config: any = await (questsProgram.account as any)["questConfig"].fetch(questConfig);
    const userPotato = getAssociatedTokenAddressSync(config.potatoMint, user);

    const ix = await (questsProgram.methods as any)
      .questClaimReward(questId)
      .accounts({
        questConfig,
        questTemplate,
        questProgress,
        user,
        treasuryPotato: config.treasuryPotato,
        userPotato,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Разблокировка достижения
r.post("/achievement/unlock", requireCircuitOpen, requireWalletLimits("quests_achievement"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const achievementId = Number(req.body.achievementId);

    const [questConfig] = questConfigPda();
    const [achievementRecord] = achievementRecordPda(user, achievementId);

    const ix = await (questsProgram.methods as any)
      .achievementUnlock(achievementId)
      .accounts({
        questConfig,
        achievementRecord,
        user,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});




// [Странник Джо] Получить ежедневные квесты (генерируются динамически)
r.get("/daily/:user", async (req, res) => {
  try {
    const { user } = req.params;
    const templates = generateDailyQuests(user);
    
    // Квесты генерируются на лету, прогресс пока не хранится в БД
    // TODO: сохранять прогресс когда добавим on-chain квесты
    const quests = templates.map((q) => ({
      ...q,
      progress: 0,
      completed: false,
    }));
    
    res.json({ quests });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;

// Список активных квестов пользователя с прогрессом
r.get("/list/:user", async (req, res) => {
  try {
    const user = req.params.user;
    
    // Определяем активные квесты на основе активности игрока
    // (в полной версии это должно читаться из questProgress PDA)
    const today = new Date().toISOString().split("T")[0];
    
    // Демо-квесты для MVP (в проде — из questTemplate PDA)
    const activeQuests = [
      {
        id: 1,
        title: "Добудь 500 WOOD",
        description: "Используй топор для майнинга дерева",
        type: "daily",
        target: 500,
        progress: 0, // TODO: вычислять из mining_activity
        reward: { type: "CORE", amount: 100 },
        claimable: false,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
      {
        id: 2,
        title: "Скрафти инструмент",
        description: "Создай новый инструмент через крафт",
        type: "daily",
        target: 1,
        progress: 0, // TODO: вычислять из craft_activity
        reward: { type: "CORE", amount: 50 },
        claimable: false,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
      {
        id: 3,
        title: "Посети ферму друга",
        description: "Полей ферму соседа",
        type: "daily",
        target: 1,
        progress: 0, // TODO: вычислять из neighbor_visits
        reward: { type: "CORE", amount: 30 },
        claimable: false,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    ];

    // Проверяем прогресс для каждого квеста
    // (в полной версии — читаем questProgress PDA)
    const quests = activeQuests.map((quest) => {
      const progress = Math.min(quest.progress, quest.target);
      const claimable = progress >= quest.target;
      return {
        ...quest,
        progress,
        claimable,
        pct: Math.round((progress / quest.target) * 100),
      };
    });

    res.json({ quests, today });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Список достижений пользователя
r.get("/achievements/:user", async (req, res) => {
  try {
    const user = req.params.user;
    
    // Демо-достижения (в полной версии — из achievementRecord PDA)
    const achievements = [
      { id: 1, title: "Первый шаг", description: "Добудь первый ресурс", icon: "🪓", unlocked: false },
      { id: 2, title: "Мастер крафта", description: "Скрафти 10 инструментов", icon: "⚒️", unlocked: false },
      { id: 3, title: "Социальная бабочка", description: "Посети 5 ферм друзей", icon: "👥", unlocked: false },
      { id: 4, title: "Коллекционер", description: "Собери 50% компендиума", icon: "📚", unlocked: false },
      { id: 5, title: "Легенда", description: "Достигни 1000 Trust Index", icon: "👑", unlocked: false },
    ];

    // Проверяем какие достижения разблокированы
    // (в полной версии — читаем achievementRecord PDA)
    const unlockedAchievements = achievements.map((ach) => ({
      ...ach,
      unlocked: false, // TODO: проверять условия
    }));

    res.json({ achievements: unlockedAchievements });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
