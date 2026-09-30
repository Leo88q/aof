import { PublicKey } from "@solana/web3.js";

/**
 * [§3.4] Перерождение: чтение состояния и проверка склада.
 *
 * Механика обещает «либо сбрасывается всё, либо ничего». Чтобы это было
 * правдой не только на словах, интерфейс:
 *   • не досчитывает ни одного поля — цена, кулдаун, бюджет ребёртов, XP и
 *     список излишков приходят из сети (backend читает их из аккаунтов);
 *   • независимо перечитывает каждый ATA из списка излишков и сверяет остаток
 *     с тем, что показал сервер: расхождение блокирует кнопку, а не «исправляется»
 *     на клиенте;
 *   • отказывается включать действие, если ответ неполон или содержит
 *     неканонический адрес.
 *
 * Файл не содержит ни одной константы контракта: цена и лимит приходят из
 * конфига ребёрта, а предел пар `(mint, token_account)` — из ответа сервера
 * (он обязан совпадать с `REBIRTH_RESET_MAX_RESOURCE_ACCOUNTS` в aof-core).
 */

export type RebirthSurplusEntry = {
  mint: string;
  tokenAccount: string;
  amountAtoms: string;
};

export type RebirthStatus = {
  seasonId: number;
  paused: boolean;
  treasury: string;
  costLamports: string;
  cooldownSeconds: number;
  maxRebirths: number;
  generation: number | null;
  rebirthCount: number;
  permanentBonusBps: number;
  nextAllowedAt: number | null;
  progress: {
    player: boolean;
    villagers: number | null;
    hasTent: boolean | null;
    seasonPass: boolean;
    xp: number | null;
  };
  surplus: {
    limit: number;
    accounts: RebirthSurplusEntry[];
    fitsInOneTransaction: boolean;
  };
  canRebirth: boolean;
  reasons: string[];
  now: number;
};

export type SurplusCheck =
  | { kind: "confirmed"; totalAtoms: string }
  | { kind: "mismatch"; mint: string; expected: string; actual: string }
  | { kind: "unavailable" };

/**
 * Проверка адреса без импорта `api`/`collectors`: этот модуль обязан
 * загружаться в обычном node-тесте, а `api` тянет за собой React-контекст
 * локали и CSS. Синтаксис base58 — тот же (32..44 знака, без 0/O/I/l).
 */
export function isAddress(value: unknown): value is string {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  try { new PublicKey(value); return true; } catch { return false; }
}

/**
 * Программы и системные адреса, которые не могут быть SPL-минтом: если бэкенд
 * прислал такой адрес в поле `mint`, ответ считается неверным, а не «странным».
 */
const NON_MINT_ADDRESSES = new Set([
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "SysvarRent111111111111111111111111111111111",
  "ComputeBudget111111111111111111111111111111",
]);

/** Минт ресурса: валидный адрес и заведомо не программа/системный аккаунт. */
export function isMintAddress(value: unknown): value is string {
  return isAddress(value) && !NON_MINT_ADDRESSES.has(value);
}

const isU64Text = (value: unknown): value is string =>
  typeof value === "string" && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) <= (1n << 64n) - 1n;

const readCount = (value: unknown, max = 0xffffffff): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max ? value : null;

/**
 * Разбор ответа `/rebirth/status/:user`. Любое несоответствие типов — `null`:
 * показать половину панели и «включить» перерождение по догадке нельзя.
 */
export function readRebirthStatus(raw: unknown): RebirthStatus | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, any>;
  const seasonId = readCount(row.seasonId);
  const rebirth = row.rebirth;
  const progress = row.progress;
  const surplus = row.surplus;
  if (seasonId === null || !rebirth || !progress || !surplus) return null;
  if (typeof rebirth.paused !== "boolean" || !isAddress(rebirth.treasury)) return null;
  if (!isU64Text(rebirth.costLamports)) return null;
  const cooldownSeconds = readCount(rebirth.cooldownSeconds);
  const maxRebirths = readCount(rebirth.maxRebirths, 255);
  const rebirthCount = readCount(rebirth.rebirthCount, 255);
  const permanentBonusBps = readCount(rebirth.permanentBonusBps, 0xffff);
  if (cooldownSeconds === null || maxRebirths === null || rebirthCount === null || permanentBonusBps === null) return null;
  const generation = rebirth.generation === null ? null : readCount(rebirth.generation, 0xffff);
  const nextAllowedAt = rebirth.nextAllowedAt === null ? null : readCount(rebirth.nextAllowedAt);
  if (rebirth.generation !== null && generation === null) return null;
  if (rebirth.nextAllowedAt !== null && nextAllowedAt === null) return null;

  if (typeof progress.player !== "boolean" || typeof progress.seasonPass !== "boolean") return null;
  const villagers = progress.villagers === null ? null : readCount(progress.villagers);
  const xp = progress.xp === null ? null : readCount(progress.xp);
  const isTent = progress.hasTent === null ? null : progress.hasTent === true ? true : progress.hasTent === false ? false : undefined;
  if (isTent === undefined) return null;

  const limit = readCount(surplus.limit);
  if (limit === null || !Array.isArray(surplus.accounts)) return null;
  if (typeof surplus.fitsInOneTransaction !== "boolean") return null;
  const accounts: RebirthSurplusEntry[] = [];
  for (const entry of surplus.accounts as unknown[]) {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as Record<string, unknown>;
    if (!isMintAddress(item.mint) || !isAddress(item.tokenAccount)) return null;
    if (!isU64Text(item.amountAtoms) || item.amountAtoms === "0") return null;
    accounts.push({ mint: item.mint, tokenAccount: item.tokenAccount, amountAtoms: item.amountAtoms });
  }
  if (accounts.length > limit) return null;

  if (typeof row.canRebirth !== "boolean" || !Array.isArray(row.reasons)) return null;
  if (row.reasons.some((reason: unknown) => typeof reason !== "string")) return null;
  const now = readCount(row.now);
  if (now === null) return null;

  return {
    seasonId,
    paused: rebirth.paused,
    treasury: rebirth.treasury,
    costLamports: rebirth.costLamports,
    cooldownSeconds,
    maxRebirths,
    generation,
    rebirthCount,
    permanentBonusBps,
    nextAllowedAt,
    progress: { player: progress.player, villagers, hasTent: isTent, seasonPass: progress.seasonPass, xp },
    surplus: { limit, accounts, fitsInOneTransaction: surplus.fitsInOneTransaction },
    canRebirth: row.canRebirth,
    reasons: row.reasons as string[],
    now,
  };
}

/** Суммарный объём излишков в атомах — то, что подтверждает игрок на экране. */
export function surplusTotalAtoms(surplus: readonly RebirthSurplusEntry[]): bigint {
  return surplus.reduce((total, entry) => total + BigInt(entry.amountAtoms), 0n);
}

/**
 * Сколько миллисекунд осталось до следующего перерождения; 0 — уже можно.
 *
 * Часы берутся из `nowMs` (по умолчанию — часы клиента), а не из повторного
 * `Date.now()`: раньше функция складывала время из ответа сети с разницей двух
 * собственных замеров часов, и на границе секунды ответ менялся на 1000 мс —
 * тест падал примерно раз в десяток прогонов, а панель показывала то «можно»,
 * то «нельзя» на одном и том же состоянии. Тот же приём, что у остальных
 * обратных отсчётов приложения (`timeLeftStr`).
 */
export function cooldownRemainingMs(status: RebirthStatus, nowMs = Date.now()): number {
  if (status.nextAllowedAt === null) return 0;
  const now = Math.floor(nowMs / 1000);
  return Math.max(0, (status.nextAllowedAt - now) * 1000);
}

/** SPL token account: amount лежит в 8 байтах по смещению 64. */
function tokenAmount(data: Uint8Array): bigint {
  if (data.length < 72) throw new Error("short token account");
  return new DataView(data.buffer, data.byteOffset + 64, 8).getBigUint64(0, true);
}

/**
 * Независимая сверка списка излишков с сетью: каждый ATA перечитывается из RPC,
 * остаток обязан совпасть с показанным. Это ловит и подменённый ответ, и
 * устаревшее чтение (за это время игрок потратил ресурс).
 */
export async function verifySurplusOnChain(
  connection: { getMultipleAccountsInfo: (keys: PublicKey[], commitment?: "confirmed") => Promise<({ data: Uint8Array } | null)[]> },
  surplus: readonly RebirthSurplusEntry[],
): Promise<SurplusCheck> {
  if (surplus.length === 0) return { kind: "confirmed", totalAtoms: "0" };
  let infos: ({ data: Uint8Array } | null)[];
  try {
    infos = await connection.getMultipleAccountsInfo(
      surplus.map((entry) => new PublicKey(entry.tokenAccount)),
      "confirmed",
    );
  } catch {
    return { kind: "unavailable" };
  }
  let total = 0n;
  for (let index = 0; index < surplus.length; index += 1) {
    const info = infos[index];
    const entry = surplus[index];
    if (!info) return { kind: "mismatch", mint: entry.mint, expected: entry.amountAtoms, actual: "0" };
    let actual: bigint;
    try {
      actual = tokenAmount(info.data);
    } catch {
      return { kind: "unavailable" };
    }
    if (actual !== BigInt(entry.amountAtoms)) {
      return { kind: "mismatch", mint: entry.mint, expected: entry.amountAtoms, actual: actual.toString() };
    }
    total += actual;
  }
  return { kind: "confirmed", totalAtoms: total.toString() };
}
