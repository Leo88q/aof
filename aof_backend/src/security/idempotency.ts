/**
 * Идемпотентность операций с деньгами.
 * Защита от гонок состояний: два одновременных запроса на один и тот же
 * клейм/продажу не должны оба пройти.
 *
 * Механизм:
 * 1. Клиент присылает уникальный ключ операции (client-generated UUID)
 * 2. Проверяем в БД не обработана ли уже эта операция
 * 3. Если нет — помечаем "в процессе" с блокировкой
 * 4. После успеха — помечаем "завершена"
 * 5. Если параллельный запрос — отклоняем с ошибкой "уже обработано"
 */
import { db } from "../lib/db";

export async function checkIdempotency(operationKey: string): Promise<{
  allowed: boolean;
  alreadyProcessed?: boolean;
}> {
  try {
    const existing = await db.idempotencyRecord.findUnique({
      where: { operationKey },
    });

    if (existing) {
      if (existing.status === "completed") {
        return { allowed: false, alreadyProcessed: true };
      }
      // Операция в процессе — возможно параллельный запрос
      return { allowed: false, alreadyProcessed: false };
    }

    // Создаём запись "в процессе"
    await db.idempotencyRecord.create({
      data: {
        operationKey,
        status: "in_progress",
        createdAt: new Date(),
      },
    });

    return { allowed: true };
  } catch (e: any) {
    // Гонка при создании — другой запрос уже создал запись
    if (e.code === "P2002") {
      return { allowed: false, alreadyProcessed: false };
    }
    throw e;
  }
}

export async function completeIdempotency(
  operationKey: string,
  result?: string
): Promise<void> {
  await db.idempotencyRecord.update({
    where: { operationKey },
    data: {
      status: "completed",
      result,
      completedAt: new Date(),
    },
  });
}

export async function failIdempotency(
  operationKey: string,
  error?: string
): Promise<void> {
  await db.idempotencyRecord.update({
    where: { operationKey },
    data: {
      status: "failed",
      result: error,
      completedAt: new Date(),
    },
  });
}

/**
 * Обёртка для критичных операций с автоматической идемпотентностью.
 * Использование:
 *   const result = await withIdempotency(req.body.opKey, async () => {
 *     // критичная операция
 *   });
 */
export async function withIdempotency<T>(
  operationKey: string,
  fn: () => Promise<T>
): Promise<{ success: boolean; result?: T; error?: string; alreadyProcessed?: boolean }> {
  const check = await checkIdempotency(operationKey);

  if (!check.allowed) {
    return {
      success: false,
      alreadyProcessed: check.alreadyProcessed,
      error: check.alreadyProcessed
        ? "Operation already completed"
        : "Operation already in progress",
    };
  }

  try {
    const result = await fn();
    await completeIdempotency(operationKey, JSON.stringify(result).slice(0, 500));
    return { success: true, result };
  } catch (e: any) {
    await failIdempotency(operationKey, e.message);
    throw e;
  }
}
