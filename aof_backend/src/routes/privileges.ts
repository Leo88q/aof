import { Router } from "express";
import { PublicKey } from "@solana/web3.js";
import { checkSkrPrivilege } from "../lib/skrPrivilege";
import { connection } from "../provider";
import { db } from "../lib/db";
import { pk } from "../lib/tx";

const r = Router();

// GET /privileges/:user — полная карта привилегий игрока
r.get("/:user", async (req, res) => {
  try {
    const user = pk(req.params.user);
    
    // 1. Проверяем SKR / Saga NFT
    const skrPrivilege = await checkSkrPrivilege(connection, user);
    
    // 2. Проверяем Streak (ежедневный вход)
    const streak = await db.streak.findUnique({ where: { user: req.params.user } });
    const streakDays = streak?.current ?? 0;
    const streakDiscountBps = Math.min(Math.floor(streakDays / 7) * 500, 2500); // макс 25%
    
    // 3. Проверяем Trust Index
    const trustEntry = await db.trustScore.findUnique({ where: { user: req.params.user } });
    const trustScore = trustEntry?.score ?? 0;
    const trustTier = trustScore >= 90 ? 5 : trustScore >= 70 ? 4 : trustScore >= 50 ? 3 : trustScore >= 30 ? 2 : 1;
    const trustDiscountBps = (trustTier - 1) * 200; // 0-8%
    
    // 4. [УБРАНО] Season Pass — таблицы seasonPass нет в Prisma
    // В будущем можно будет добавить проверку через on-chain данные
    const hasVip = false;
    
    // 5. [УБРАНО] Коллекционеры — таблицы collectorStake нет в Prisma
    // В будущем можно будет добавить проверку через on-chain данные
    const hasHistorian = false;
    const hasMedallion = false;
    
    // Собираем финальную карту
    const privileges = [
      {
        id: "skr_holder",
        title: "📱 SKR Holder",
        description: "Держите ≥100 SKR для 15% скидки на крафт",
        active: skrPrivilege.hasPrivilege && skrPrivilege.source === "SKR_HOLDER",
        effect: "-15% крафт (POTATO)",
        required: "100 SKR",
        icon: "📱",
        color: "#9333ea",
      },
      {
        id: "seeker_farmer",
        title: "🌟 Seeker Farmer",
        description: "Владелец Saga/Seeker NFT",
        active: skrPrivilege.hasPrivilege && skrPrivilege.source === "SAGA_NFT",
        effect: "+20% к добыче, +1 FlaskGreen/день",
        required: "Saga NFT",
        icon: "🌟",
        color: "#f59e0b",
      },
      {
        id: "season_vip",
        title: "👑 Season VIP",
        description: "Премиум статус текущего сезона",
        active: hasVip,
        effect: "VIP-квесты, эксклюзивные награды",
        required: "0.15 SOL или 100 SKR",
        icon: "👑",
        color: "#eab308",
      },
      {
        id: "streak_bonus",
        title: `🔥 Streak ${streakDays}д`,
        description: "Бонус за последовательные входы",
        active: streakDays >= 7,
        effect: `-${(streakDiscountBps / 100).toFixed(1)}% крафт`,
        required: "7+ дней подряд",
        icon: "🔥",
        color: "#ef4444",
      },
      {
        id: "trust_index",
        title: `⭐ Trust Tier ${trustTier}`,
        description: "Рейтинг доверия на маркетплейсе",
        active: trustTier >= 2,
        effect: `-${(trustDiscountBps / 100).toFixed(1)}% комиссия`,
        required: "Score 30+",
        icon: "⭐",
        color: "#10b981",
      },
      {
        id: "historian",
        title: "📜 Historian Collector",
        description: "Застейканный коллекционный NFT",
        active: hasHistorian,
        effect: "+5% шанс Epic из паков",
        required: "Stake Historian",
        icon: "📜",
        color: "#8b5cf6",
      },
      {
        id: "medallion",
        title: "🏅 Medallion Collector",
        description: "Застейканный коллекционный NFT",
        active: hasMedallion,
        effect: "+3% шанс Legendary из паков",
        required: "Stake Medallion",
        icon: "🏅",
        color: "#ec4899",
      },
    ];
    
    const activeCount = privileges.filter((p: any) => p.active).length;
    const totalDiscountBps = skrPrivilege.craftDiscountBps + streakDiscountBps + trustDiscountBps;
    
    res.json({
      user: req.params.user,
      privileges,
      summary: {
        activeCount,
        total: privileges.length,
        totalCraftDiscountBps: totalDiscountBps,
        totalCraftDiscountPct: (totalDiscountBps / 100).toFixed(1),
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
