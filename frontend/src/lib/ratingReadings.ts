import { PublicKey } from '@solana/web3.js';

export type RatingEntry = { rank: number; user: string; average: number; count: number };
export type PlayerRating = {
  user: string; average: number; count: number; distribution: number[];
  recentRatings: Array<{ fromUser: string; rating: number; comment: string | null; timestamp: string }>;
};

const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const address = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try { return new PublicKey(value).toBase58() === value && !new PublicKey(value).equals(PublicKey.default); }
  catch { return false; }
};

/** The off-chain community rating API is not a chain-backed reputation score.
 * Only a complete, owner-matching response can show "no reviews". */
export function readPlayerRating(raw: unknown, user: string): PlayerRating | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const data = raw as Record<string, any>;
  if (!address(user) || data.user !== user || !integer(data.count) ||
      typeof data.average !== 'number' || !Number.isFinite(data.average) || data.average < 0 || data.average > 5) return null;
  if (data.count === 0) {
    // The backend omits distribution/recentRatings only for a real zero count.
    if (data.average !== 0 || data.verified !== false || !Array.isArray(data.ratings) || data.ratings.length !== 0) return null;
    return { user, count: 0, average: 0, distribution: [0, 0, 0, 0, 0], recentRatings: [] };
  }
  if (data.average < 1 || !Array.isArray(data.distribution) || data.distribution.length !== 5 ||
      !data.distribution.every(integer) || data.distribution.reduce((a: number, b: number) => a + b, 0) !== data.count ||
      !Array.isArray(data.recentRatings) || data.recentRatings.length > 10 ||
      data.recentRatings.length === 0) return null;
  const recentRatings: PlayerRating['recentRatings'] = [];
  for (const row of data.recentRatings) {
    if (!row || typeof row !== 'object' || !address(row.fromUser) ||
        !integer(row.rating) || row.rating < 1 || row.rating > 5 ||
        typeof row.timestamp !== 'string' || !Number.isFinite(Date.parse(row.timestamp)) ||
        (row.comment != null && typeof row.comment !== 'string')) return null;
    recentRatings.push({ fromUser: row.fromUser, rating: row.rating,
      comment: row.comment ?? null, timestamp: row.timestamp });
  }
  return { user, count: data.count, average: data.average,
    distribution: data.distribution, recentRatings };
}

/** Reject malformed/partial list reads rather than calling them an empty ranking. */
export function readLeaderboard(raw: unknown): RatingEntry[] | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rows = (raw as Record<string, unknown>).leaderboard;
  if (!Array.isArray(rows) || rows.length > 100) return null;
  const seen = new Set<string>();
  const result: RatingEntry[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const entry = row as Record<string, unknown>;
    if (!integer(entry.rank) || entry.rank !== result.length + 1 ||
        !address(entry.user) || seen.has(entry.user) ||
        !integer(entry.count) || entry.count < 5 ||
        typeof entry.average !== 'number' || !Number.isFinite(entry.average) ||
        entry.average < 1 || entry.average > 5) return null;
    seen.add(entry.user);
    result.push(entry as RatingEntry);
  }
  return result;
}
