import { program, connection } from "../provider";
import { PROGRAM_ID } from "../config";
import { ReadCache, envNonNegativeInt } from "./readCache";

/**
 * Read cache for the public `/query/*` surface (routes/query.ts) ONLY. Write
 * paths (admin, inbox, resources) keep the uncached fetchOne/fetchAll below so
 * a signer never acts on a value older than the RPC.
 *   QUERY_CACHE_TTL_MS      0 (default) = no staleness, but concurrent identical
 *                           reads still share one RPC call; 2000 recommended
 *                           under load (farm panels poll every 5 s).
 *   QUERY_CACHE_MAX_ENTRIES bound on distinct keys (default 5000).
 */
export const QUERY_CACHE_TTL_MS = envNonNegativeInt("QUERY_CACHE_TTL_MS", 0);
const queryCache = new ReadCache<any>(QUERY_CACHE_TTL_MS, Math.max(1, envNonNegativeInt("QUERY_CACHE_MAX_ENTRIES", 5_000)));
export const queryCacheStats = () => queryCache.stats();
export const queryCacheInvalidate = (key?: string) => queryCache.invalidate(key);

// Получить все аккаунты определённого типа с фильтрами
export async function fetchAll(accountName: string, filters: any[] = []) {
  return (program.account as any)[accountName].all(filters);
}

// Получить один аккаунт по адресу (возвращает null если не найден)
export async function fetchOne(accountName: string, address: any) {
  try {
    return await (program.account as any)[accountName].fetch(address);
  } catch {
    return null;
  }
}

/** `/query/*` variant of fetchOne: shared in-flight call + optional TTL. */
export function cachedFetchOne(accountName: string, address: any) {
  return queryCache.get(`one:${accountName}:${String(address)}`, () => fetchOne(accountName, address));
}

/** `/query/*` variant of fetchAll (getProgramAccounts — the expensive one). */
export function cachedFetchAll(accountName: string, filters: any[] = []) {
  return queryCache.get(`all:${accountName}:${JSON.stringify(filters)}`, () => fetchAll(accountName, filters));
}

// Фильтр по смещению в данных аккаунта (для поиска по владельцу/минту)
export function memcmpFilter(offset: number, bytesBase58: string) {
  return { memcmp: { offset, bytes: bytesBase58 } };
}

export { connection, PROGRAM_ID };
