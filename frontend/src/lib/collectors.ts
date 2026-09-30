import { PublicKey } from "@solana/web3.js";
import { api } from "./api";

/**
 * Коллекционеры (Historian / Medallion).
 *
 * Механика живёт целиком: allowlist минтов (`register_collector_mint`, админ
 * `POST /admin/config/collector-mint`), сама постановка NFT в vault PDA,
 * счётчики в Player и перки — скидка на минт-комиссию и повышенный кап
 * реферальных бонусов [AUDIT F-16]. В интерфейсе не было ни постановки, ни
 * снятия: счётчики показывались как число, а включить перк было нечем.
 *
 * Правила контракта, которые обязан повторять интерфейс:
 *   • ставится ровно 1 NFT за вызов, mint обязан быть в allowlist;
 *   • lock 3 дня (COLLECTORS_LOCK_SECONDS = 3 * 86400);
 *   • снятие стоит FEE_PER_NFT_MICROS = 0.01 SOL из газ-бака;
 *   • перк даёт сам факт счётчика > 0 (has_historian/has_medallion).
 */

export const COLLECTOR_KINDS = ["historian", "medallion"] as const;
export type CollectorKind = (typeof COLLECTOR_KINDS)[number];

/** aof-core/src/constants.rs: COLLECTORS_LOCK_SECONDS. */
export const COLLECTOR_LOCK_SECONDS = 3 * 86400;

/** Только синтаксически корректный адрес доходит до чтения и до транзакции. */
export function isMintAddress(value: string): boolean {
  const text = value.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text)) return false;
  try { new PublicKey(text); return true; } catch { return false; }
}

export type CollectorPosition =
  | { kind: "none" }
  | { kind: "staked"; owner: string; collectorKind: CollectorKind; unlockAt: number }
  | { kind: "unknown" };

/**
 * Читает позицию по минту. Backend отдаёт `null` только когда аккаунта нет;
 * любую ошибку он отдаёт как 503, поэтому «позиции нет» — это подтверждённый
 * ответ, а не догадка.
 */
export async function readCollectorPosition(mint: string, owner: string): Promise<CollectorPosition> {
  if (!isMintAddress(mint)) return { kind: "unknown" };
  let raw: any;
  try {
    raw = await api.query.collector(mint.trim());
  } catch {
    return { kind: "unknown" };
  }
  if (raw === null || raw === undefined) return { kind: "none" };
  if (typeof raw !== "object") return { kind: "unknown" };
  const kind = raw.kind === "historian" || raw.kind === "medallion" ? raw.kind : null;
  const unlockAt = Number(raw.unlockAt);
  if (!kind || !Number.isSafeInteger(unlockAt) || unlockAt < 0) return { kind: "unknown" };
  if (typeof raw.owner !== "string" || !isMintAddress(raw.owner)) return { kind: "unknown" };
  return { kind: "staked", owner: raw.owner, collectorKind: kind, unlockAt };
}

/** Сколько миллисекунд осталось до снятия; 0 — уже можно. */
export function lockRemainingMs(position: CollectorPosition, now = Date.now()): number {
  if (position.kind !== "staked") return 0;
  return Math.max(0, position.unlockAt * 1000 - now);
}
