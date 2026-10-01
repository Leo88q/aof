import BN from "bn.js";
import { inboxRewardId, rewardReceiptPda, fetchRewardReceipt, assertRewardReceipt, RewardReceiptConflict } from "../lib/rewardReceipt";
import { TransactionOutcomeUnknown } from "../lib/transactionLifecycle";
import { Router } from "express";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { db } from "../lib/db";
import {AUTHORITY_PUBKEY} from "../config";
import { program, connection } from "../provider";
import { authPda, configPda, materialMintsPda, playerPda, issuanceCapPda, resourceKindIndex } from "../lib/pda";
import { fetchOne, fetchOneForSigner } from "../lib/decode";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { logger } from "../lib/logger";
import { RESOURCE_UNIT } from "../lib/miningPayout";
import { requireIdempotency } from "../middleware/security";
import { requireAdmin } from "../middleware/adminAuth";
import { requireWalletProof } from "../security/walletProof";
import { requireNoFraudHold } from "../security/fraudHold";

const r = Router();

// Anchor error codes for the issuance cap: 6098 IssuanceCapNotConfigured,
// 6099 IssuanceCapExceeded. These are POSITIONAL (6000 + index in the
// `AofError` enum in aof-core/src/errors.rs), so they were wrong here for a
// long time (mapped as 6097/6098) and the committed IDL was stale too; both
// are now reconciled against the Rust enum. Re-check whenever a variant is
// added anywhere but the end of that enum.
const ISSUANCE_CAP_ERROR_CODES = new Set([6098, 6099]);
function isIssuanceCapError(e: any): boolean {
  const code = Number(e?.error?.errorCode?.number ?? e?.code);
  if (ISSUANCE_CAP_ERROR_CODES.has(code)) return true;
  const msg = String(e?.message ?? e?.logs?.join("\n") ?? "");
  return /IssuanceCapExceeded|IssuanceCapNotConfigured|custom program error: 0x17d[23]/i.test(msg);
}

// Маппинг типов наград → kind для mintResource (как в resources.ts)
const kindMap: Record<string, any> = {
  DATA: { data: {} },
  CIRCUIT: { circuit: {} },
  SILICON: { silicon: {} },
  MIND: { mind: {} },
  // [БЛОК L] Хлебная цепочка
  NEURON: { neuron: {} },
  SYNAPSE: { synapse: {} },
  SIGNAL: { signal: {} },
  MODEL: { model: {} },
  POWER: { power: {} },
  COMPUTE: { compute: {} },
  DATASET: { dataset: {} },
  // Камни
  BLUE_CORE: { blueCore: {} },
  PURPLE_CORE: { purpleCore: {} },
  RED_CORE: { redCore: {} },
  // Песок
  CLEAR_QUARTZ: { clearQuartz: {} },
  ROSE_QUARTZ: { roseQuartz: {} },
  AMBER_QUARTZ: { amberQuartz: {} },
  // Гемы
  QUANTUM_BIT: { quantumBit: {} },
  NEURAL_CHIP: { neuralChip: {} },
  PHOTON_BIT: { photonBit: {} },
  BIO_CHIP: { bioChip: {} },
  // Баночки
  CRYO_FLUID: { cryoFluid: {} },
  VOLT_FLUID: { voltFluid: {} },
  BIO_FLUID: { bioFluid: {} },
  NANO_FLUID: { nanoFluid: {} },
  QUANTUM_FLUID: { quantumFluid: {} },
  SOUL_CORE: { soulCore: {} },
};

const CONFIG_REWARD_MINT: Record<string, string> = {
  DATA: "foodMint",
  CIRCUIT: "woodMint",
  SILICON: "stoneMint",
  MIND: "potatoMint",
};

const MATERIAL_REWARD_MINT: Record<string, string> = {
  NEURON: "seeds",
  SYNAPSE: "wheat",
  SIGNAL: "flour",
  MODEL: "bread",
  POWER: "water",
  COMPUTE: "coal",
  DATASET: "meat",
  STONE_BLUE: "stone_blue",
  STONE_PURPLE: "stone_purple",
  STONE_RED: "stone_red",
  SAND_WHITE: "sand_white",
  SAND_PINK: "sand_pink",
  SAND_YELLOW: "sand_yellow",
  GEM_BLUE: "gem_blue",
  GEM_ORANGE: "gem_orange",
  GEM_WHITE: "gem_white",
  GEM_GREEN: "gem_green",
  FLASK_BLUE: "flask_blue",
  FLASK_YELLOW: "flask_yellow",
  FLASK_GREEN: "flask_green",
  FLASK_PINK: "flask_pink",
  FLASK_PURPLE: "flask_purple",
  LOVE_HEART: "love_heart",
};

// Inbox messages are private; a public wallet address is not authorization.
// Read via a single-use wallet proof bound to this request body and path.
r.post("/list", requireWalletProof("inbox_list", "user"), async (req, res) => {
  try {
    const user = req.body.user;
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
r.post("/claim", requireWalletProof("inbox_claim", "user"), requireNoFraudHold("user", "inbox_claim"), requireIdempotency, async (req, res) => {
  try {
    const { id, user } = req.body;
    const item = await db.inboxItem.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.user !== user) {
      return res.status(403).json({ error: "Not your inbox item" });
    }
    if (item.rewardVersion !== 1) return res.status(409).json({ error: "LEGACY_REWARD_REQUIRES_RECONCILIATION" });
    if (item.claimState === "quarantined") return res.status(409).json({ error: "REWARD_RECEIPT_CONFLICT" });
    if (item.claimed && item.claimState === "confirmed") return res.status(400).json({ error: "Already claimed" });
    if (item.expiresAt && new Date(item.expiresAt) < new Date()) {
      return res.status(400).json({ error: "Letter expired" });
    }

    // [PAYER] С отправкой транзакции игроком backend больше не завершает claim
    // сам: он резервирует строку и возвращает кошельку частично подписанную
    // транзакцию. Повторный запрос по ещё НЕ подписанной строке (`reserved` без
    // claimSignature) выдаёт свежую транзакцию — иначе истёкший блокхаш навсегда
    // блокировал бы награду. Настоящая защита от двойной выплаты — on-chain
    // `RewardReceipt` (`init`), а не эта строка.
    const locked = await db.inboxItem.updateMany({
      where: { id, rewardVersion: 1, claimState: { in: ["unclaimed", "reserved"] } },
      data: { claimed: true, claimState: "reserved" },
    });
    if (locked.count !== 1) return res.status(409).json({ error: "Already claimed or in progress" });

    let rewardResult: any = { type: item.rewardType, amount: item.rewardAmount };

    try {
      const rewardType = (item.rewardType || "").toUpperCase();
      const kind = kindMap[rewardType];
      if (kind && item.rewardAmount && item.rewardAmount > 0) {
        const [config] = configPda();
        const [materialMints] = materialMintsPda();
        const cfg: any = await fetchOneForSigner("config", config);
        const mm: any = await fetchOneForSigner("materialMints", materialMints);
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

        const receipt = await fetchRewardReceipt(connection, id, ownerPk);
        if (receipt) {
          assertRewardReceipt(receipt, { recipient: item.user, mint: mintPk.toBase58(), grossAmount: amount.toString() });
          const recovered = await db.inboxItem.update({ where: { id }, data: { claimed: true, claimState: "confirmed", read: true } });
          return res.json({ item: recovered, reward: rewardResult, recoveredFromReceipt: rewardReceiptPda(id, ownerPk).toBase58() });
        }
        // [PAYER] Награда — claim игрока. Fee payer и подписант — кошелёк
        // получателя (`payer` в контексте, констрейнт `payer == token_account.owner`),
        // его ATA создаётся лениво в этой же транзакции; `Player` и
        // `RewardReceipt` тоже оплачивает он. Authority добавляет только
        // авторизационную подпись, а не оплачивает чужие аккаунты.
        const ix = await (program.methods as any)
          .mintResourceOnce(kind, new BN(amount.toString()), Array.from(inboxRewardId(id)))
          .accounts({
            config,
            materialMints,
            authority: AUTHORITY_PUBKEY,
            auth,
            mint: mintPk,
            tokenAccount,
            treasuryToken,
            payer: ownerPk,
            player,
            issuanceCap: issuanceCapPda(kind)[0],
            tokenProgram: TOKEN_PROGRAM_ID,
            rewardReceipt: rewardReceiptPda(id, ownerPk),
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        // ATA казны — инфраструктура проекта: её rent проект платит сам, вне
        // транзакции игрока (иначе игрок оплатил бы чужой аккаунт). Существующая
        // ATA не оплачивается повторно; в quote эта стоимость не входит.
        const treasuryInfo = await connection.getAccountInfo(treasuryToken, "confirmed");
        if (!treasuryInfo) {
          await authorityOnly([
            createAssociatedTokenAccountIdempotentInstruction(AUTHORITY_PUBKEY, treasuryToken, treasury, mintPk),
          ]);
        }
        const createUserAta = createAssociatedTokenAccountIdempotentInstruction(ownerPk, tokenAccount, ownerPk, mintPk);
        const tx = await coSign([createUserAta, ix], ownerPk);
        await db.inboxItem.update({
          where: { id }, data: { claimState: "reserved", claimMint: mintPk.toBase58(), claimSignature: null },
        });
        return res.json({
          tx,
          reward: rewardResult,
          quote: {
            rewardId: inboxRewardId(id).toString("hex"),
            recipient: ownerPk.toBase58(),
            mint: mintPk.toBase58(),
            amount: amount.toString(),
            // Вид ресурса и казна нужны кошельку, чтобы собрать локальный интент
            // claim'а и проверить аккаунты транзакции до подписи.
            resourceKind: resourceKindIndex(kind),
            treasury: String(cfg.treasury),
          },
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

    // Сюда управление не доходит: каждая ветка выше вернула ответ. Подтверждение
    // claim'а теперь приходит от клиента вместе с подписью (см. /claim/confirm).
    return res.status(500).json({ error: "UNREACHABLE_CLAIM_STATE" });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * [PAYER] Подтверждение claim'а, который игрок подписал и отправил сам.
 * Единственное доказательство — финализированный `RewardReceipt` на чейне:
 * клиентская подпись без него ничего не подтверждает, а найденный чек с чужим
 * mint/суммой уводит письмо в карантин (как и в остальных путях).
 */
r.post("/claim/confirm", requireWalletProof("inbox_claim_confirm", "user"), requireIdempotency, async (req, res) => {
  try {
    const { id, user, signature } = req.body;
    const item = await db.inboxItem.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.user !== user) return res.status(403).json({ error: "Not your inbox item" });
    if (item.claimState === "quarantined") return res.status(409).json({ error: "REWARD_RECEIPT_CONFLICT" });
    if (item.claimState === "confirmed") return res.json({ item, reward: { type: item.rewardType, amount: item.rewardAmount }, onchainSig: item.claimSignature });
    if (typeof signature !== "string" || signature.length < 32) {
      return res.status(400).json({ error: "Invalid transaction signature" });
    }

    const ownerPk = pk(user);
    const receipt = await fetchRewardReceipt(connection, id, ownerPk);
    if (!receipt) {
      return res.status(202).json({ pending: true, reason: "REWARD_RECEIPT_NOT_FOUND" });
    }
    try {
      assertRewardReceipt(receipt, {
        recipient: user,
        mint: String(item.claimMint ?? receipt.mint),
        grossAmount: String(BigInt(item.rewardAmount ?? 0) * BigInt(RESOURCE_UNIT)),
      });
    } catch (e) {
      if (e instanceof RewardReceiptConflict) {
        await db.inboxItem.update({ where: { id }, data: { claimed: true, claimState: "quarantined" } });
        logger.error({ inboxId: id }, "Reward receipt conflict; manual review required");
        return res.status(409).json({ error: "REWARD_RECEIPT_CONFLICT" });
      }
      throw e;
    }

    const updated = await db.inboxItem.update({
      where: { id },
      data: { claimed: true, read: true, claimState: "confirmed", claimSignature: signature },
    });
    return res.json({ item: updated, reward: { type: item.rewardType, amount: item.rewardAmount }, onchainSig: signature });
  } catch (e: any) {
    logger.warn({ err: e?.message, inboxId: req.body?.id }, "Reward claim confirmation failed");
    return res.status(400).json({ error: e.message });
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
