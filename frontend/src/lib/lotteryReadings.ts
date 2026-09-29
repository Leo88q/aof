import { PublicKey } from '@solana/web3.js';
import { CORE_PROGRAM_ID } from './transactionIntent';

const MAX_U64 = (1n << 64n) - 1n;
export function lotteryU64(raw: unknown, zero = false): raw is string {
  return typeof raw === 'string' && (zero ? /^(0|[1-9][0-9]{0,19})$/ : /^[1-9][0-9]{0,19}$/).test(raw) &&
    BigInt(raw) <= MAX_U64;
}
export function lotteryPda(seed: 'lottery_round' | 'lottery_ticket', roundId: string, ticket?: string): string {
  if (!lotteryU64(roundId, true) || (ticket !== undefined && !lotteryU64(ticket, true))) throw new Error('Invalid lottery identifier');
  const u64 = (text: string) => {
    const out = new Uint8Array(8);
    new DataView(out.buffer).setBigUint64(0, BigInt(text), true);
    return out;
  };
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(seed), u64(roundId), ...(ticket === undefined ? [] : [u64(ticket)])],
    new PublicKey(CORE_PROGRAM_ID),
  )[0].toBase58();
}

export type LotteryRound = {
  roundId: string; ticketsSold: string; poolLamports: string; drawn: boolean; drawCommitted: boolean;
  winningTicket: string | null; claimed: boolean; createdAt: number;
};
export type LotteryTicket = { pubkey: string; roundId: string; ticketNumber: string; buyer: string };

/** Reject malformed or incomplete on-chain snapshots; never infer an empty round from a network error. */
export function readLotteryRound(raw: unknown, selectedId: string): LotteryRound | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !lotteryU64(selectedId, true)) return null;
  const row = raw as Record<string, unknown>;
  const createdAt = typeof row.createdAt === 'string' && /^[1-9][0-9]{0,15}$/.test(row.createdAt)
    ? Number(row.createdAt) : row.createdAt;
  if (row.roundId !== selectedId || !lotteryU64(row.ticketsSold, true) || !lotteryU64(row.poolLamports, true) ||
      typeof row.drawn !== 'boolean' || typeof row.drawCommitted !== 'boolean' ||
      typeof row.claimed !== 'boolean' || !Number.isSafeInteger(createdAt) || (createdAt as number) <= 0 ||
      (createdAt as number) > 253402300799) return null;
  const winning = row.winningTicket;
  if (row.drawn) {
    if (!lotteryU64(winning, true) || BigInt(winning) >= BigInt(row.ticketsSold) || row.ticketsSold === '0') return null;
  } else if (winning !== '0' && winning !== null && winning !== undefined) return null;
  if (row.claimed && !row.drawn) return null;
  return { roundId: selectedId, ticketsSold: row.ticketsSold, poolLamports: row.poolLamports,
    drawn: row.drawn, drawCommitted: row.drawCommitted, claimed: row.claimed,
    winningTicket: row.drawn ? winning as string : null, createdAt: createdAt as number };
}

/** A list must be complete and every row must belong to the requested wallet and on-chain round. */
export function readLotteryTickets(raw: unknown, round: LotteryRound, wallet: string): LotteryTicket[] | null {
  if (!Array.isArray(raw)) return null;
  try { new PublicKey(wallet); } catch { return null; }
  if (BigInt(raw.length) > BigInt(round.ticketsSold)) return null;
  const seen = new Set<string>();
  const tickets: LotteryTicket[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const item = entry as Record<string, unknown>;
    if (item.roundId !== round.roundId || item.buyer !== wallet ||
        !lotteryU64(item.ticketNumber, true) || BigInt(item.ticketNumber) >= BigInt(round.ticketsSold) ||
        item.pubkey !== lotteryPda('lottery_ticket', round.roundId, item.ticketNumber) ||
        seen.has(item.ticketNumber)) return null;
    seen.add(item.ticketNumber);
    tickets.push({ pubkey: item.pubkey as string, roundId: round.roundId,
      ticketNumber: item.ticketNumber, buyer: wallet });
  }
  return tickets;
}

export function canRefundLotteryTicket(round: LotteryRound, now = Date.now()): boolean {
  return !round.drawn && !round.drawCommitted && Number.isFinite(now) &&
    now >= (round.createdAt + 14 * 86400) * 1000;
}
