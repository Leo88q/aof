import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { db } from "../lib/db";
import { AUTHORITY } from "../config";
import { program } from "../provider";
import { authPda, configPda, playerPda } from "../lib/pda";
import { authorityOnly, pk } from "../lib/tx";
import { logger } from "../lib/logger";
import { requireIdempotency, completeIdempotencyMiddleware } from "../middleware/security";

const r = Router();

// Маппинг типов наград → kind для mintResource (как в resources.ts)
const kindMap: Record<string, any> = {
  FOOD: { food: {} },
  WOOD: { wood: {} },
  STONE: { stone: {} },
  // [БЛОК L] Хлебная цепочка
  SEEDS: { seeds: {} },
  WHEAT: { wheat: {} },
  FLOUR: { flour: {} },
  BREAD: { bread: {} },
  WATER: { water: {} },
  COAL: { coal: {} },
  MEAT: { meat: {} },
  // Камни
  STONE_BLUE: { stoneBlue: {} },
  STONE_PURPLE: { stonePurple: {} },
  STONE_RED: { stoneRed: {} },
  // Песок
  SAND_WHITE: { sandWhite: {} },
  SAND_PINK: { sandPink: {} },
  SAND_YELLOW: { sandYellow: {} },
  // Гемы
  GEM_BLUE: { gemBlue: {} },
  GEM_ORANGE: { gemOrange: {} },
  GEM_WHITE: { gemWhite: {} },
  GEM_GREEN: { gemGreen: {} },
  // Баночки
  FLASK_BLUE: { flaskBlue: {} },
  FLASK_YELLOW: { flaskYellow: {} },
  FLASK_GREEN: { flaskGreen: {} },
  FLASK_PINK: { flaskPink: {} },
  FLASK_PURPLE: { flaskPurple: {} },
  LOVE_HEART: { loveHeart: {} },
};

// Список писем пользователя
r.get("/:user", async (req, res) => {
  try {
    const user = req.params.user;
    const items = await db.inboxItem.findMany({
      where: { user },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unread = items.filter((i) => !i.read).length;
    res.json({ items, unread });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Создать письмо (вызывается бэкендом для компенсаций/ивентов)
r.post("/create", async (req, res) => {
  try {
    const { user, sender, subject, body, rewardType, rewardAmount, ttlHours } = req.body;
    const expiresAt = ttlHours ? new Date(Date.now() + ttlHours * 3600000) : null;
    const item = await db.inboxItem.create({
      data: { user, sender, subject, body, rewardType, rewardAmount, expiresAt },
    });
    res.json({ item });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Отметить как прочитанное
r.post("/read", async (req, res) => {
  try {
    const { id } = req.body;
    const item = await db.inboxItem.update({ where: { id }, data: { read: true } });
    res.json({ item });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Забрать награду из письма (явный клейм + реальное ончейн-начисление)
r.post("/claim", requireIdempotency, async (req, res) => {
  try {
    const { id, mints } = req.body;
    const item = await db.inboxItem.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.claimed) return res.status(400).json({ error: "Already claimed" });
    if (item.expiresAt && new Date(item.expiresAt) < new Date()) {
      return res.status(400).json({ error: "Letter expired" });
    }

    // Реальное ончейн-начисление через mintResource (прямой вызов, без HTTP в себя)
    let onchainSig: string | null = null;
    let rewardResult: any = { type: item.rewardType, amount: item.rewardAmount };

    try {
      const kind = kindMap[item.rewardType || ""];
      if (kind && mints?.rewardMint && item.rewardAmount) {
        const ownerPk = pk(item.user);
        const mintPk = pk(mints.rewardMint);
        const treasuryToken = mints.treasuryToken
          ? pk(mints.treasuryToken)
          : getAssociatedTokenAddressSync(mintPk, AUTHORITY.publicKey, true);

        const [config] = configPda();
        const [auth] = authPda();
        const [player] = playerPda(ownerPk);
        const tokenAccount = getAssociatedTokenAddressSync(mintPk, ownerPk);

        const ix = await (program.methods as any)
          .mintResource(kind, BigInt(item.rewardAmount))
          .accounts({
            config,
            authority: AUTHORITY.publicKey,
            auth,
            mint: mintPk,
            tokenAccount,
            treasuryToken,
            player,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        onchainSig = await authorityOnly([ix]);
      } else {
        // [ФИКС] Без данных о минте награда откладывается, письмо НЕ клеймится.
        // Раньше при этом всё равно ставился claimed=true → награда терялась навсегда.
        return res.status(202).json({
          pending: true,
          reason: "rewardMint not provided — клейм доступен позже",
          reward: rewardResult,
        });
      }
    } catch (e: any) {
      // Ончейн не сработал (контракты не задеплоены) — оставляем письмо неклеенным
      logger.warn({ err: e.message, inboxId: id }, "On-chain reward mint failed");
      rewardResult.pending = true;
      rewardResult.reason = e.message;
      return res.status(503).json({
        error: "Reward mint unavailable (contracts not deployed)",
        reward: rewardResult,
      });
    }

    const updated = await db.inboxItem.update({
      where: { id },
      data: { claimed: true, read: true },
    });

    // Завершаем идемпотентность после успешной операции
    await completeIdempotencyMiddleware(req);

    res.json({ item: updated, reward: rewardResult, onchainSig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Архивировать письмо
r.post("/archive", async (req, res) => {
  try {
    const { id } = req.body;
    await db.inboxItem.delete({ where: { id } });
    res.json({ archived: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
