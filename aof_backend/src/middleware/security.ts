/**
 * Мидлвары безопасности для применения к критичным роутерам.
 * Используют модули из src/security/.
 */
import { Request, Response, NextFunction } from "express";
import { checkWalletLimits } from "../security/walletLimits";
import { checkIdempotency, completeIdempotency } from "../security/idempotency";
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
 * Поля для поиска адреса: user, owner, buyer, seller, maker, caller.
 */
export const requireWalletLimits = (operationType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const walletAddress =
        req.body.user ||
        req.body.owner ||
        req.body.buyer ||
        req.body.seller ||
        req.body.maker ||
        req.body.caller;

      if (!walletAddress) {
        return res.status(400).json({ error: "Wallet address not found in request" });
      }

      // Объём в lamports если есть
      const volumeLamports = Number(req.body.amount) || 0;

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
  try {
    // Ключ из заголовка или генерируем из тела запроса
    const operationKey =
      req.headers["x-idempotency-key"] as string ||
      `${req.path}:${JSON.stringify(req.body).slice(0, 200)}`;

    const check = await checkIdempotency(operationKey);
    if (!check.allowed) {
      return res.status(409).json({
        error: check.alreadyProcessed
          ? "Operation already completed"
          : "Operation already in progress",
      });
    }

    // Сохраняем ключ для завершения после успешного выполнения
    (req as any).idempotencyKey = operationKey;
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
