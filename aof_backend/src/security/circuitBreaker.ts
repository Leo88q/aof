/**
 * Circuit Breaker — возможность мгновенной остановки всех операций.
 * Активируется админом при обнаружении атаки.
 *
 * Режимы:
 * - OPEN: все операции разрешены (нормальный режим)
 * - HALF: операции разрешены только с подтверждением
 * - CLOSED: все операции заблокированы (аварийный режим)
 */
import { db } from "../lib/db";

export type CircuitState = "OPEN" | "HALF" | "CLOSED";

export async function getCircuitState(): Promise<CircuitState> {
  const record = await db.circuitBreaker.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  return (record?.state as CircuitState) || "OPEN";
}

export async function setCircuitState(state: CircuitState, reason: string): Promise<void> {
  const existing = await db.circuitBreaker.findFirst();

  if (existing) {
    await db.circuitBreaker.update({
      where: { id: existing.id },
      data: { state, reason, updatedAt: new Date() },
    });
  } else {
    await db.circuitBreaker.create({
      data: { state, reason, updatedAt: new Date() },
    });
  }
}

/**
 * Проверить circuit breaker перед операцией.
 * Бросает исключение если операции заблокированы.
 */
export async function assertCircuitOpen(): Promise<void> {
  const state = await getCircuitState();

  if (state === "CLOSED") {
    throw new Error("CIRCUIT_CLOSED: все операции временно заблокированы");
  }

  if (state === "HALF") {
    // В режиме HALF требуется дополнительная проверка
    // Пока просто логируем
    console.warn("[CIRCUIT_HALF] Операция в режиме повышенной проверки");
  }
}

/**
 * Обёртка для операций с проверкой circuit breaker.
 */
export async function withCircuitCheck<T>(fn: () => Promise<T>): Promise<T> {
  await assertCircuitOpen();
  return fn();
}
