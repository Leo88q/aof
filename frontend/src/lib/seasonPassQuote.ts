/**
 * Live-котировка сетевых расходов для сезонного пропуска.
 *
 * Владелец (2026-10-01, п. 7): если игрок оплачивает transaction fee и rent
 * аккаунта-пропуска, нельзя обещать «бесплатный» пропуск без пояснения — рядом
 * с кнопкой обязана быть живая котировка сети. Цена самого пропуска — 0 игровых
 * токенов; rent и комиссию платит игрок как плательщик (payer) своей транзакции.
 *
 * Размер аккаунта: 8 байт Anchor-дискриминатора + SeasonPass
 * (`aof-core/src/state.rs`): Pubkey 32 + u32 4 + u32 4 + bool 1 + u64 8 = 49.
 * Гейт `tests/readiness/season-pass-copy.test.cjs` сверяет эту константу со
 * структурой в Rust, чтобы котировка не разъехалась с программой.
 */
import { connection } from './wallet';

export const SEASON_PASS_ACCOUNT_SIZE = 8 + 49;

export type SeasonPassQuote = {
  /** Точный rent-exempt депозит аккаунта-пропуска, лампорты (live RPC). */
  rentLamports: number;
  /** Базовая комиссия сети за одну подпись игрока, лампорты (протокольная константа). */
  baseFeeLamports: number;
  /** Медиана приоритетной комиссии последних слотов, микролампорты за CU (live RPC), null — RPC не дал данных. */
  priorityMicroLamports: number | null;
  /** Итого нижняя оценка: rent + базовая комиссия (без приоритетной). */
  totalLamports: number;
  fetchedAt: number;
};

const BASE_FEE_PER_SIGNATURE = 5000;

function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.floor(sorted.length / 2)];
}

/** Живая котировка: rent из RPC + приоритетная комиссия из последних слотов. */
export async function fetchSeasonPassQuote(): Promise<SeasonPassQuote> {
  const rentLamports = await connection.getMinimumBalanceForRentExemption(SEASON_PASS_ACCOUNT_SIZE);
  let priorityMicroLamports: number | null = null;
  try {
    const fees = await connection.getRecentPrioritizationFees();
    priorityMicroLamports = median(fees.map((f) => f.prioritizationFee));
  } catch {
    priorityMicroLamports = null;
  }
  return {
    rentLamports,
    baseFeeLamports: BASE_FEE_PER_SIGNATURE,
    priorityMicroLamports,
    totalLamports: rentLamports + BASE_FEE_PER_SIGNATURE,
    fetchedAt: Date.now(),
  };
}

/** Лампорты → SOL без потери точности для отображения (9 знаков). */
export function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
}
