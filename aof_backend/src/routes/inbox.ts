import BN from "bn.js";
import { inboxRewardId, rewardReceiptPda, fetchRewardReceipt, assertRewardReceipt, RewardReceiptConflict } from "../lib/rewardReceipt";
import { TransactionOutcomeUnknown } from "../lib/transactionLifecycle";
import { Router } from "express";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { db } from "../lib/db";
import { AUTHORITY } from "../config";
import { program, connection } from "../provider";
import { authPda, configPda, materialMintsPda, playerPda, issuanceCapPda } from "../lib/pda";
import { fetchOne } from "../lib/decode";
import { authorityOnly, pk } from "../lib/tx";
import { logger } from "../lib/logger";
import { RESOURCE_UNIT } from "../lib/miningPayout";
import { requireIdempotency } from "../middleware/security";
import { requireAdmin } from "../middleware/adminAuth";
import { requireWalletProof } from "../security/walletProof";

const r = Router();

// Anchor error codes for the issuance cap (aof_core.json errors 6097/6098).
const ISSUANCE_CAP_ERROR_CODES = new Set([6097, 6098]);
function isIssuanceCapError(e: any): boolean {
  const code = Number(e?.error?.errorCode?.number ?? e?.code);
  if (ISSUANCE_CAP_ERROR_CODES.has(code)) return true;
  const msg = String(e?.message ?? e?.logs?.join("\n") ?? "");
  return /IssuanceCapExceeded|IssuanceCapNotConfigured|custom program error: 0x17d[12]/i.test(msg);
}

// Маппинг типов наград → kind для mintResource (как в resources.ts)
const kindMap: Record<string, any> = {
  FOOD: { food: {} },
  WOOD: { wood: {} },
  STONE: { stone: {} },
  POTATO: { potato: {} },
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

const CONFIG_REWARD_MINT: Record<string, string> = {
  FOOD: "foodMint",
  WOOD: "woodMint",
  STONE: "stoneMint",
  POTATO: "potatoMint",
};

const MATERIAL_REWARD_MINT: Record<string, string> = {
  SEEDS: "seeds",
  WHEAT: "wheat",
  FLOUR: "flour",
  BREAD: "bread",
  WATER: "water",
  COAL: "coal",
  MEAT: "meat",
  STONE_BLUE: "stoneBlue",
  STONE_PURPLE: "stonePurple",
  STONE_RED: "stoneRed",
  SAND_WHITE: "sandWhite",
  SAND_PINK: "sandPink",
  SAND_YELLOW: "sandYellow",
  GEM_BLUE: "gemBlue",
  GEM_ORANGE: "gemOrange",
  GEM_WHITE: "gemWhite",
  GEM_GREEN: "gemGreen",
  FLASK_BLUE: "flaskBlue",
  FLASK_YELLOW: "flaskYellow",
  FLASK_GREEN: "flaskGreen",
  FLASK_PINK: "flaskPink",
  FLASK_PURPLE: "flaskPurple",
  LOVE_HEART: "loveHeart",
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
r.post("/create", requireAdmin, async (req, res) => {
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
r.post("/read", requireWalletProof("inbox_read", "user"), async (req, res) => {
  try {
    const { id, user } = req.body;
    const current = await db.inboxItem.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "Not found" });
    if (!user || user !== current.user) return res.status(403).json({ error: "Not your inbox item" });
    const item = await db.inboxItem.update({ where: { id }, data: { read: true } });
    res.json({ item });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Забрать награду из письма (явный клейм + реальное ончейн-начисление)
r.post("/claim", requireWalletProof("inbox_claim", "user"), requireIdempotency, async (req, res) => {
  try {
    const { id, user } = req.body;
    const item = await db.inboxItem.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.user !== user) {
      return res.status(403).json({ error: "Not your inbox item" });
    }
    if (item.rewardVersion !== 1) return res.status(409).json({ error: "LEGACY_REWARD_REQUIRES_RECONCILIATION" });
    if (item.claimState === "quarantined") return res.status(409).json({ error: "REWARD_RECEIPT_CONFLICT" });
    if (item.claimed) return res.status(400).json({ error: "Already claimed" });
    if (item.expiresAt && new Date(item.expiresAt) < new Date()) {
      return res.status(400).json({ error: "Letter expired" });
    }

    // Claim the row before signing the mint instruction. This closes the
    // concurrent double-claim race; failures release the claim below.
    const locked = await db.inboxItem.updateMany({
      where: { id, claimed: false, rewardVersion: 1 },
      data: { claimed: true, claimState: "reserved", claimSignature: null },
    });
    if (locked.count !== 1) return res.status(409).json({ error: "Already claimed or in progress" });

    // Реальное ончейн-начисление через mintResource (прямой вызов, без HTTP в себя)
    let onchainSig: string | null = null;
    let rewardResult: any = { type: item.rewardType, amount: item.rewardAmount };

    try {
      const rewardType = (item.rewardType || "").toUpperCase();
      const kind = kindMap[rewardType];
      if (kind && item.rewardAmount && item.rewardAmount > 0) {
        const [config] = configPda();
        const [materialMints] = materialMintsPda();
        const cfg: any = await fetchOne("config", config);
        const mm: any = await fetchOne("materialMints", materialMints);
        const mintValue = CONFIG_REWARD_MINT[rewardType]
          ? cfg?.[CONFIG_REWARD_MINT[rewardType]]
          : mm?.[MATERIAL_REWARD_MINT[rewardType]];

        if (!cfg || !mintValue || !cfg.treasury) {
          await db.inboxItem.update({ where: { id }, data: { claimed: false, claimState: "unclaimed", claimSignature: null } });
          return res.status(202).json({
            pending: true,
            reason: "canonical reward mint is not initialized — claim later",
            reward: rewardResult,
          });
        }

        const ownerPk = pk(item.user);
        const mintPk = new PublicKey(String(mintValue));
        const treasury = new PublicKey(String(cfg.treasury));
        const auth = authPda()[0];
        const [player] = playerPda(ownerPk);
        const tokenAccount = getAssociatedTokenAddressSync(mintPk, ownerPk);
        const treasuryToken = getAssociatedTokenAddressSync(mintPk, treasury, true);
        const amount = BigInt(item.rewardAmount) * BigInt(RESOURCE_UNIT);

        const receipt = await fetchRewardReceipt(connection, id);
        if (receipt) {
          assertRewardReceipt(receipt, { recipient: item.user, mint: mintPk.toBase58(), grossAmount: amount.toString() });
          const recovered = await db.inboxItem.update({ where: { id }, data: { claimed: true, claimState: "confirmed", read: true } });
          return res.json({ item: recovered, reward: rewardResult, recoveredFromReceipt: rewardReceiptPda(id).toBase58() });
        }
        const ix = await (program.methods as any)
          .mintResourceOnce(kind, new BN(amount.toString()), Array.from(inboxRewardId(id)))
          .accounts({
            config,
            materialMints,
            authority: AUTHORITY.publicKey,
            auth,
            mint: mintPk,
            tokenAccount,
            treasuryToken,
            player,
            issuanceCap: issuanceCapPda(kind)[0],
            tokenProgram: TOKEN_PROGRAM_ID,
            rewardReceipt: rewardReceiptPda(id),
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        const createUserAta = createAssociatedTokenAccountIdempotentInstruction(
          AUTHORITY.publicKey, tokenAccount, ownerPk, mintPk,
        );
        const createTreasuryAta = createAssociatedTokenAccountIdempotentInstruction(
          AUTHORITY.publicKey, treasuryToken, treasury, mintPk,
        );
        onchainSig = await authorityOnly([createUserAta, createTreasuryAta, ix], async (signature) => {
          await db.inboxItem.update({
            where: { id }, data: { claimSignature: signature, claimState: "submitted", claimMint: mintPk.toBase58() },
          });
        });
      } else {
        // Без канонического типа/положительной суммы письмо нельзя безопасно клеймить.
        await db.inboxItem.update({ where: { id }, data: { claimed: false, claimState: "unclaimed", claimSignature: null } });
        return res.status(202).json({
          pending: true,
          reason: "reward type or amount is not claimable",
          reward: rewardResult,
        });
      }
    } catch (e: any) {
      // On-chain issuance budget for this resource is exhausted for the current
      // epoch. Nothing was minted (the cap is charged before any CPI), so the
      // reward goes back to unclaimed and the client is told to retry later.
      // This is an operator signal (P0): either the cap is mis-calibrated or
      // the authority key is being abused.
      if (isIssuanceCapError(e)) {
        await db.inboxItem.update({ where: { id }, data: { claimed: false, claimState: "unclaimed", claimSignature: null } });
        logger.error({ inboxId: id, rewardType: item.rewardType, err: String(e?.message || e) }, "ISSUANCE_CAP: reward mint blocked by on-chain cap");
        return res.status(503).json({ error: "ISSUANCE_CAP_EXCEEDED", retryable: true });
      }
      if (e instanceof RewardReceiptConflict) {
        await db.inboxItem.update({ where: { id }, data: { claimed: true, claimState: "quarantined" } });
        logger.error({ inboxId: id }, "Reward receipt conflict; manual review required");
        return res.status(409).json({ error: "REWARD_RECEIPT_CONFLICT" });
      }
      // A timeout is NOT proof that a mint failed. Keep the durable reservation
      // until an operator reconciles its finalized signature. Never mint twice.
      if (e instanceof TransactionOutcomeUnknown) {
        logger.error({ inboxId: id, signature: e.signature }, "Reward requires reconciliation");
        return res.status(202).json({ pending: true, signature: e.signature, reason: "REWARD_RECONCILIATION_REQUIRED" });
      }
      // Definite pre-broadcast or finalized execution failure: safe to release.
      logger.warn({ err: e.message, inboxId: id }, "On-chain reward mint failed");
      await db.inboxItem.update({ where: { id }, data: { claimed: false, claimState: "unclaimed", claimSignature: null } });
      rewardResult.pending = true;
      rewardResult.reason = e.message;
      return res.status(503).json({
        error: "Reward mint unavailable (contracts not deployed)",
        reward: rewardResult,
      });
    }

    const updated = await db.inboxItem.update({
      where: { id },
      data: { read: true, claimState: "confirmed" },
    });

    res.json({ item: updated, reward: rewardResult, onchainSig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Архивировать письмо
r.post("/archive", requireWalletProof("inbox_archive", "user"), async (req, res) => {
  try {
    const { id, user } = req.body;
    const current = await db.inboxItem.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "Not found" });
    if (!user || user !== current.user) return res.status(403).json({ error: "Not your inbox item" });
    if (["reserved", "submitted"].includes(current.claimState)) {
      return res.status(409).json({ error: "Reward reconciliation pending" });
    }
    await db.inboxItem.delete({ where: { id } });
    res.json({ archived: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
