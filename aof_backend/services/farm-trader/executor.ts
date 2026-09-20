import { sendConfirmedTransaction } from "../../src/lib/transactionLifecycle";
/**
 * Исполнитель сделок: вызывает ончейн инструкции от имени пользователя
 * через сессионный ключ.
 *
 * [ФИКС Группы 3] Реальный режим (FARM_TRADER_SIMULATION=false):
 *   - грузит сессионный ключ из кейстора (lib/sessionKeys)
 *   - проверяет сессию ончейн: существует, не отозвана, не протухла
 *   - проверяет SPL-делегирование на ATA инструмента (юзер выдаёт через
 *     token::approve — без него бот не может двигать инструмент)
 *   - собирает sell_into_queue, подписывает сессионным ключом
 *     (комиссию транзакции платит authority), отправляет
 *
 * Поток подключения авто-торговли для пользователя:
 *   1) POST /session/create-trader  -> подписать tx (делегирование инструкций)
 *   2) token::approve на ATA инструмента в пользу сессионного ключа
 *   3) правила в traderRules исполняются автоматически
 *
 * buy/bid/cancel пока в симуляции: эти инструкции ещё не принимают
 * сессионного подписанта на уровне контракта — подключение отдельно.
 */
import { PrismaClient } from "@prisma/client";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import { connection, marketProgram, assertExpectedCluster } from "../../src/provider";
import { AUTHORITY } from "../../src/config";
import {
  hotMarketPoolPda,
  hotMarketQueuePda,
  sessionTokenPda,
} from "../../src/lib/pda";
import { loadSessionKeypair } from "../../src/lib/sessionKeys";

const db = new PrismaClient();

// Режим: симуляция пока контракты не задеплоены
const SIMULATION_MODE = process.env.FARM_TRADER_SIMULATION !== "false";

export interface ExecutionParams {
  user: string;
  ruleId: string;
  action: string; // cancel | sell_into_queue | bid | buy
  mint?: string;
  price?: number;
  rarity?: number; // [ФИКС] нужно для сборки ончейн инструкции
}

// Исполнение сделки
export async function executeTrade(params: ExecutionParams): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
}> {
  // Проверка риск-лимитов по трасту
  const trust = await db.trustScore.findUnique({ where: { user: params.user } });
  const tier = trust?.tier ?? 1;
  const maxSpendPerDay = 0.5 * (tier === 1 ? 1 : tier === 2 ? 2 : tier === 3 ? 4 : tier === 4 ? 8 : 20);

  // Проверка дневного лимита трат для покупок
  if (params.action === "buy" || params.action === "bid") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const spentToday = await db.traderExecution.aggregate({
      where: {
        user: params.user,
        action: { in: ["buy", "bid"] },
        success: true,
        ts: { gte: todayStart },
      },
      _sum: { price: true },
    });
    const totalSpent = (spentToday._sum.price || 0) + (params.price || 0);
    if (totalSpent > maxSpendPerDay) {
      return {
        success: false,
        error: `Daily spend limit exceeded: ${maxSpendPerDay} SOL`,
      };
    }
  }

  // Режим симуляции: записываем что было бы исполнено
  if (SIMULATION_MODE) {
    console.log(`[farm-trader] SIMULATION: ${params.action} for ${params.user} at ${params.price}`);
    return {
      success: true,
      signature: `SIM_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    };
  }

  // ===== [ФИКС] РЕАЛЬНЫЙ РЕЖИМ =====
  try {
    if (params.action === "sell_into_queue") {
      return await executeSellIntoQueueReal(params);
    }
    // buy/bid/cancel: инструкции пока не принимают сессионного подписанта —
    // честно сообщаем вместо фейковой подписи (как было с PLACEHOLDER_)
    return {
      success: false,
      error: `action ${params.action}: session signing not wired in contract yet`,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// [ФИКС] Реальная авто-продажа через сессионный ключ
async function executeSellIntoQueueReal(params: ExecutionParams): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
}> {
  if (!params.mint) {
    return { success: false, error: "auto-sell: mint инструмента не выбран (нет резолва инвентаря)" };
  }
  if (params.rarity === undefined) {
    return { success: false, error: "auto-sell: rarity не задан в параметрах" };
  }

  const userPk = new PublicKey(params.user);
  const mintPk = new PublicKey(params.mint);
  const rarity = params.rarity;

  // 1. Сессионный ключ из кейстора
  const sessionKp = loadSessionKeypair(params.user);
  if (!sessionKp) {
    return { success: false, error: "нет сессионного ключа (нужен POST /session/create-trader)" };
  }

  // 2. Сессия ончейн: создана, не отозвана, не протухла
  const [sessionToken] = sessionTokenPda(userPk, sessionKp.publicKey);
  let session: any;
  try {
    session = await (marketProgram.account as any)["sessionToken"].fetch(sessionToken);
  } catch {
    return { success: false, error: "сессия не создана ончейн (юзер не подписал tx одобрения)" };
  }
  if (session.revoked) {
    return { success: false, error: "сессия отозвана" };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec > Number(session.validUntil.toString())) {
    return { success: false, error: "сессия протухла (нужно пересоздать)" };
  }

  // 3. Пул: текущая цена для защитного min_price (проскальзывание вниз 5%)
  const [pool] = hotMarketPoolPda(rarity);
  const poolAcc: any = await (marketProgram.account as any)["hotMarketPool"].fetch(pool);
  const currentPrice = Number(poolAcc.currentPriceMascot.toString());
  const minPrice = new BN(Math.floor((currentPrice * 9500) / 10000));

  // 4. SPL-делегирование: без него бот не может перевести инструмент
  const sellerToolToken = getAssociatedTokenAddressSync(mintPk, userPk);
  const poolToolToken = getAssociatedTokenAddressSync(mintPk, pool, true);
  try {
    const tokenAcc = await getAccount(connection, sellerToolToken);
    const delegateOk =
      tokenAcc.delegate !== null &&
      tokenAcc.delegate.toBase58() === sessionKp.publicKey.toBase58();
    const amountOk = tokenAcc.delegatedAmount >= BigInt(1);
    if (!delegateOk || !amountOk) {
      return {
        success: false,
        error: "нет SPL-делегирования сессионному ключу на ATA инструмента (нужен token::approve)",
      };
    }
  } catch (e: any) {
    return { success: false, error: `ATA инструмента не найден: ${e.message}` };
  }

  // 5. Транзакция: комиссию платит authority, подписывает сессионный ключ
  const [queue] = hotMarketQueuePda(rarity);
  const ix = await (marketProgram.methods as any)
    .hotMarketSellIntoQueue(rarity, minPrice)
    .accounts({
      pool,
      queue,
      seller: userPk,
      signer: sessionKp.publicKey,
      sessionToken,
      toolMint: mintPk,
      sellerToolToken,
      poolToolToken,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const tx = new Transaction().add(ix);
  tx.feePayer = AUTHORITY.publicKey;
  await assertExpectedCluster();
  const lifetime = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = lifetime.blockhash;
  tx.partialSign(AUTHORITY, sessionKp);
  const sig = await sendConfirmedTransaction(connection, tx, lifetime);
  return { success: true, signature: sig };
}

// Запись исполнения в БД
export async function recordExecution(
  params: ExecutionParams,
  result: { success: boolean; signature?: string; error?: string }
) {
  await db.traderExecution.create({
    data: {
      user: params.user,
      ruleId: params.ruleId,
      action: params.action,
      mint: params.mint,
      price: params.price,
      signature: result.signature,
      success: result.success,
      error: result.error,
    },
  });
}
