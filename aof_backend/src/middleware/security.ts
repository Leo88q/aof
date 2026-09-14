/**
 * Мидлвары безопасности для применения к критичным роутерам.
 * Используют модули из src/security/.
 */
import { Request, Response, NextFunction } from "express";
import { checkWalletLimits } from "../security/walletLimits";
import { checkIdempotency, completeIdempotency, failIdempotency } from "../security/idempotency";
import { assertCircuitOpen } from "../security/circuitBreaker";
import { auditLog } from "../security/auditLog";
import { logger } from "../lib/logger";

/**
 * Проверка что система не в аварийном режиме.
 * Применять ко всем роутерам с деньгами.
 */
export const requireCircuitOpen = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await assertCircuitOpen();
    next();
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
};

/**
 * Лимиты по кошельку (извлекает адрес из тела запроса).
 * Поля для поиска адреса: user, owner, buyer, seller, maker, caller,
 * bidder, player, winner, creator, fulfiller, renter, waterer, visitor,
 * referred and cranker.
 */
export const requireWalletLimits = (operationType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Mapped mutations are authenticated before this middleware. Prefer the
      // wallet selected by the proof route (for example `fulfiller`, not the
      // earlier `creator` field in a craft-order request); the body fallback
      // remains for explicitly admin-authenticated or legacy internal calls.
      const walletAddress =
        (req as any).authenticatedWallet ||
        req.body.user ||
        req.body.owner ||
        req.body.buyer ||
        req.body.seller ||
        req.body.maker ||
        req.body.caller ||
        req.body.bidder ||
        req.body.player ||
        req.body.winner ||
        req.body.creator ||
        req.body.fulfiller ||
        req.body.renter ||
        req.body.waterer ||
        req.body.visitor ||
        req.body.referred ||
        req.body.cranker;

      if (!walletAddress) {
        return res.status(400).json({ error: "Wallet address not found in request" });
      }

      // Объём в lamports если есть. Never turn a negative/invalid amount
      // into a free operation: negative values could otherwise reduce the
      // rolling aggregate and bypass the volume limit.
      const rawVolume = req.body.amount;
      const volumeLamports = rawVolume === undefined || rawVolume === null || rawVolume === ""
        ? 0
        : Number(rawVolume);
      if (!Number.isSafeInteger(volumeLamports) || volumeLamports < 0) {
        return res.status(400).json({ error: "Invalid non-negative operation amount" });
      }

      await checkWalletLimits(walletAddress, operationType, volumeLamports);
      next();
    } catch (e: any) {
      res.status(429).json({ error: e.message });
    }
  };
};

/**
 * Идемпотентность операций (защита от двойных клеймов).
 * Клиент должен прислать уникальный ключ операции в заголовке.
 */
export const requireIdempotency = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // A mapped wallet-proof route already installed this guard centrally. Do
  // not create a second record when the route also lists requireIdempotency.
  if ((req as any).idempotencyKey) {
    next();
    return;
  }

  try {
    // Every mutation must provide a client-generated key. Falling back to a
    // truncated body hash made two distinct requests collide and allowed a
    // missing key to be silently accepted; fail closed instead.
    const supplied = req.get("x-idempotency-key") || "";
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(supplied)) {
      res.status(400).json({ error: "A valid X-Idempotency-Key header is required" });
      return;
    }
    // Scope the key to the HTTP operation so a UUID accidentally reused by a
    // client cannot alias a different endpoint.
    const operationKey = `http:${req.method}:${req.path}:${supplied}`;

    const check = await checkIdempotency(operationKey);
    if (!check.allowed) {
      return res.status(409).json({
        error: check.alreadyProcessed
          ? "Operation already completed"
          : "Operation already in progress",
      });
    }

    // Сохраняем ключ для завершения после успешного выполнения.
    // Finalize automatically on the actual HTTP response so every route gets
    // failure recovery, including early returns from inside try/catch blocks.
    (req as any).idempotencyKey = operationKey;
    let responseBody: any;
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      responseBody = body;
      return originalJson(body);
    };
    res.once("finish", () => {
      const failed = res.statusCode >= 400 || res.statusCode === 202 || Boolean(responseBody?.error);
      const finalize = failed
        ? failIdempotency(operationKey, responseBody?.error || `HTTP ${res.statusCode}`)
        : completeIdempotency(operationKey);
      finalize.catch((error) => logger.error({ error, operationKey }, "Failed to finalize idempotency"));
    });
    next();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Завершение идемпотентности (вызывать после успешной операции).
 */
export const completeIdempotencyMiddleware = async (req: Request) => {
  const key = (req as any).idempotencyKey;
  if (key) {
    await completeIdempotency(key);
  }
};

/**
 * Логирование критичных операций.
 */
export const auditCriticalOperation = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const wallet =
      req.body.user || req.body.owner || req.body.buyer || req.body.seller;

    await auditLog({
      action,
      wallet,
      amount: Number(req.body.amount) || 0,
      mint: req.body.mint || "",
      status: "initiated",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });

    next();
  };
};

/**
 * Комбинированный мидлвар для критичных операций с деньгами.
 * Применяет все защиты сразу.
 */
export const criticalOperationGuard = (operationType: string) => {
  return [
    requireCircuitOpen,
    requireWalletLimits(operationType),
    requireIdempotency,
    auditCriticalOperation(operationType),
  ];
};
