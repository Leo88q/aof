import { Router } from "express";
import { validate } from "../middleware/validate";
import { sessionCreateSchema } from "../lib/validation";
import { SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { MARKET_PROGRAM_ID, marketProgram } from "../provider";
import { sessionTokenPda, trustSnapshotPda } from "../lib/pda";
import { coSign, pk } from "../lib/tx";
import { getOrCreateSessionKeypair } from "../lib/sessionKeys";
import { db } from "../lib/db";

const r = Router();

// Создание сессионного ключа для автономного бота
r.post("/create", validate(sessionCreateSchema), async (req, res) => {
  try {
    const authority = pk(req.body.authority);
    const sessionSigner = pk(req.body.sessionSigner);
    const allowedIxs = new BN(req.body.allowedIxs);
    const maxAmountPerTx = new BN(req.body.maxAmountPerTx);
    const ttlSeconds = new BN(req.body.ttlSeconds);

    // [ФИКС] Валидация лимита по Trust Index до отправки транзакции
    // Защита архитектуры session-key: max_amount_per_tx не может превышать лимит тира
    const TIER_LIMITS_LAMPORTS: Record<number, number> = {
      1: 1_000_000_000,       // Тир 1: 1 SOL
      2: 5_000_000_000,       // Тир 2: 5 SOL
      3: 10_000_000_000,      // Тир 3: 10 SOL
      4: 50_000_000_000,      // Тир 4: 50 SOL
      5: 100_000_000_000,     // Тир 5+: 100 SOL
    };
    
    const trustScore = await db.trustScore.findUnique({
      where: { user: authority.toBase58() },
    });
    const trustTier = trustScore?.tier ?? 1; // По умолчанию тир 1 если нет данных
    const tierLimit = TIER_LIMITS_LAMPORTS[Math.min(trustTier, 5)] || TIER_LIMITS_LAMPORTS[5];
    
    const requestedAmount = Number(maxAmountPerTx.toString());
    if (requestedAmount > tierLimit) {
      return res.status(400).json({
        error: `maxAmountPerTx (${requestedAmount}) exceeds tier ${trustTier} limit (${tierLimit} lamports)`,
        trustTier,
        tierLimit,
      });
    }

    const [sessionToken] = sessionTokenPda(authority, sessionSigner);
    const [trustSnapshot] = trustSnapshotPda(authority);

    const ix = await (marketProgram.methods as any)
      .sessionCreate(sessionSigner, allowedIxs, maxAmountPerTx, ttlSeconds)
      .accounts({
        sessionToken,
        trustSnapshot,
        authority,
        targetProgram: MARKET_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], authority);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Отзыв сессионного ключа (в любой момент)
r.post("/revoke", async (req, res) => {
  try {
    const authority = pk(req.body.authority);
    const sessionSigner = pk(req.body.sessionSigner);

    const [sessionToken] = sessionTokenPda(authority, sessionSigner);

    const ix = await (marketProgram.methods as any)
      .sessionRevoke()
      .accounts({
        sessionToken,
        authority,
      })
      .instruction();
    const tx = await coSign([ix], authority);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// [ФИКС Группы 3] Сессионный ключ для Farm-Trader: бэкенд сам генерирует
// ключевую пару, сохраняет в кейсторе и возвращает транзакцию на подпись
// пользователю. allowedIxs — битовая маска: бит 0 = sell_into_queue.
r.post("/create-trader", async (req, res) => {
  try {
    const authority = pk(req.body.authority);
    const allowedIxs = new BN(req.body.allowedIxs || 1); // бит 0 = sell_into_queue
    const ttlSeconds = new BN(req.body.ttlSeconds || 7 * 24 * 3600); // 7 дней

    // Лимит по тир траста — та же валидация что и в /create
    const TIER_LIMITS_LAMPORTS: Record<number, number> = {
      1: 1_000_000_000,
      2: 5_000_000_000,
      3: 10_000_000_000,
      4: 50_000_000_000,
      5: 100_000_000_000,
    };
    const trustScore = await db.trustScore.findUnique({
      where: { user: authority.toBase58() },
    });
    const trustTier = trustScore?.tier ?? 1;
    const tierLimit = TIER_LIMITS_LAMPORTS[Math.min(trustTier, 5)] || TIER_LIMITS_LAMPORTS[5];
    const requestedAmount = Number(req.body.maxAmountPerTx || tierLimit);
    if (requestedAmount > tierLimit) {
      return res.status(400).json({
        error: `maxAmountPerTx (${requestedAmount}) exceeds tier ${trustTier} limit (${tierLimit} lamports)`,
      });
    }
    const maxAmountPerTx = new BN(requestedAmount);

    const sessionKp = getOrCreateSessionKeypair(authority.toBase58());
    const sessionSigner = sessionKp.publicKey;
    const [sessionToken] = sessionTokenPda(authority, sessionSigner);
    const [trustSnapshot] = trustSnapshotPda(authority);

    const ix = await (marketProgram.methods as any)
      .sessionCreate(sessionSigner, allowedIxs, maxAmountPerTx, ttlSeconds)
      .accounts({
        sessionToken,
        trustSnapshot,
        authority,
        targetProgram: MARKET_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = await coSign([ix], authority);
    res.json({ tx, sessionSigner: sessionSigner.toBase58() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
