import BN from "bn.js";
import { Router } from "express";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { AUTHORITY_PUBKEY } from "../config";
import { program, connection } from "../provider";
import { configPda, lotteryRoundPda, lotteryTicketPda, lotteryTicketCounterPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireAdmin } from "../middleware/adminAuth";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";
import { releasePoolSlot, reservePoolSlot, vrfCommitAccounts } from "../lib/vrf";
import { commitStatus, fetchPendingCommit, buildRevealInstructions } from "../lib/vrfSettlement";

/**
 * [F-06] Lottery with a player-funded pool and a slot-hash draw:
 *   - tickets escrow the full price on the round (nothing reaches the treasury
 *     before the draw; an undrawn round refunds every ticket in full);
 *   - the operator closes sales by committing the draw (anyone may after the
 *     on-chain sales window), the vrf-settler reveals it permissionlessly;
 *   - the winner claims the prize (pool minus the house share).
 */
const r = Router();

/** Must equal `LOTTERY_TICKET_PRICE_LAMPORTS` in `aof-core/src/constants.rs`.
 * The frontend reads the same number from `/query/lottery-round`-style quotes;
 * a mismatch is caught by the program's `max_price_lamports` check, not by
 * trusting this constant. */
const LOTTERY_TICKET_PRICE_LAMPORTS = new BN(800_000);


/** Public chamber list. SOL is the only asset the program can escrow.
 * SKR and Potato stay sealed here so a client cannot invent a charge. */
r.get("/pools", (_req, res) => {
  res.json({
    pools: [
      {
        id: "sol", asset: "SOL", status: "live", priceLamports: LOTTERY_TICKET_PRICE_LAMPORTS.toString(),
        winners: 1, prizeBps: 7000, houseBps: 3000, maxTicketsPerWallet: 10,
        salesSeconds: 7 * 86400, refundAfterSeconds: 14 * 86400,
      },
      { id: "skr", asset: "SKR", status: "sealed", reason: "SKR_MINT_NOT_CONFIGURED" },
      { id: "potato", asset: "POTATO", status: "sealed", reason: "POTATO_ESCROW_NOT_DEPLOYED" },
    ],
  });
});

const u64 = (value: unknown, field: string): BN => {
  const text = String(value ?? "");
  if (!/^[0-9]{1,20}$/.test(text)) throw new Error(`${field} must be a u64`);
  return new BN(text);
};

r.post("/round/init", requireAdmin, async (req, res) => {
  try {
    const roundId = u64(req.body.roundId, "roundId");
    const ix = await (program.methods as any)
      .initLotteryRound(roundId)
      .accounts({
        config: configPda()[0],
        authority: AUTHORITY_PUBKEY,
        lotteryRound: lotteryRoundPda(roundId)[0],
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.get("/round/:roundId", async (req, res) => {
  try {
    const roundId = u64(req.params.roundId, "roundId");
    const [lotteryRound] = lotteryRoundPda(roundId);
    const round: any = await (program.account as any).lotteryRound.fetchNullable(lotteryRound);
    if (!round) return res.status(404).json({ error: "Round not found" });
    res.json({
      roundId: roundId.toString(),
      address: lotteryRound.toBase58(),
      ticketsSold: round.ticketsSold.toString(),
      poolLamports: round.poolLamports.toString(),
      drawCommitted: round.drawCommitted,
      drawn: round.drawn,
      winningTicket: round.drawn ? round.winningTicket.toString() : null,
      claimed: round.claimed,
      createdAt: Number(round.createdAt),
      draw: round.drawCommitted && !round.drawn ? await commitStatus("lottery", lotteryRound) : null,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * [F-06] Ticket purchase with a wallet-signed ceiling.
 *
 * The deployed `buy_lottery_ticket` escrows a compiled constant, so the wallet
 * must be able to refuse a charge it did not see: the player signs
 * `max_price_lamports`, the program checks `price <= max_price`, and the local
 * intent in `frontend/src/lib/transactionIntent.ts` compares the same bytes
 * before the wallet opens. A ceiling below the on-chain price is refused here
 * (fail fast) and again in the program (`PriceAboveMaximum`).
 */
r.post("/ticket/buy", requireCircuitOpen, requireWalletLimits("lottery_buy"), requireIdempotency, async (req, res) => {
  try {
    // The wallet-proof middleware for this route selects `buyer`
    // (aof_backend/src/security/walletProof.ts), so the body field is `buyer`.
    const user = pk(req.body.buyer);
    const roundId = u64(req.body.roundId, "roundId");
    const ceiling = LOTTERY_TICKET_PRICE_LAMPORTS;
    const maxPrice = req.body.maxPriceLamports === undefined
      ? ceiling
      : u64(req.body.maxPriceLamports, "maxPriceLamports");
    if (maxPrice.lt(ceiling)) throw new Error("PRICE_ABOVE_MAXIMUM");
    const [lotteryRound] = lotteryRoundPda(roundId);
    const round: any = await (program.account as any).lotteryRound.fetch(lotteryRound);
    if (round.drawn) return res.status(409).json({ error: "LOTTERY_ROUND_CLOSED" });
    if (round.drawCommitted) return res.status(409).json({ error: "LOTTERY_SALES_CLOSED" });
    const ticketNumber = round.ticketsSold as BN;
    const [lotteryTicket] = lotteryTicketPda(roundId, ticketNumber);
    const [ticketCounter] = lotteryTicketCounterPda(roundId, user);
    const ix = await (program.methods as any)
      .buyLotteryTicket(maxPrice)
      .accounts({
        config: configPda()[0],
        buyer: user,
        lotteryRound,
        lotteryTicket,
        ticketCounter,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({
      tx,
      roundId: roundId.toString(),
      ticketNumber: ticketNumber.toString(),
      priceLamports: LOTTERY_TICKET_PRICE_LAMPORTS.toString(),
      maxPriceLamports: maxPrice.toString(),
    });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

/** Operator closes sales and commits the draw on the same path as pack opening. */
r.post("/draw/commit", requireAdmin, async (req, res) => {
  try {
    const roundId = u64(req.body.roundId, "roundId");
    const slot = await reservePoolSlot(program, connection);
    let vrf;
    try {
    vrf = await vrfCommitAccounts(program, connection, slot);
    const ix = await (program.methods as any)
      .commitLotteryDraw()
      .accounts({
        config: configPda()[0],
        cranker: AUTHORITY_PUBKEY,
        lotteryRound: lotteryRoundPda(roundId)[0],
        ...vrf,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
    } catch (error) {
      releasePoolSlot(slot);
      throw error;
    }
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

/** Settle the draw now (the vrf-settler does this automatically). */
r.post("/draw/reveal", requireAdmin, async (req, res) => {
  try {
    const roundId = u64(req.body.roundId, "roundId");
    const commit = await fetchPendingCommit("lottery", lotteryRoundPda(roundId)[0]);
    if (!commit) return res.status(409).json({ error: "No draw in flight" });
    const sig = await authorityOnly(await buildRevealInstructions(commit, AUTHORITY_PUBKEY));
    res.json({ sig });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

r.post("/claim", async (req, res) => {
  try {
    const winner = pk(req.body.winner);
    const roundId = u64(req.body.roundId, "roundId");
    const ticketNumber = u64(req.body.ticketNumber, "ticketNumber");
    const ix = await (program.methods as any)
      .claimLotteryPrize()
      .accounts({
        config: configPda()[0],
        lotteryRound: lotteryRoundPda(roundId)[0],
        lotteryTicket: lotteryTicketPda(roundId, ticketNumber)[0],
        winner,
      })
      .instruction();
    const tx = await coSign([ix], winner);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** Full refund of one ticket of an undrawn round after the timeout (anyone may send it). */
r.post("/ticket/refund", async (req, res) => {
  try {
    const payer = pk(req.body.payer);
    const roundId = u64(req.body.roundId, "roundId");
    const ticketNumber = u64(req.body.ticketNumber, "ticketNumber");
    const [lotteryTicket] = lotteryTicketPda(roundId, ticketNumber);
    const ticket: any = await (program.account as any).lotteryTicket.fetch(lotteryTicket);
    const ix = await (program.methods as any)
      .refundLotteryTicket()
      .accounts({
        config: configPda()[0],
        lotteryRound: lotteryRoundPda(roundId)[0],
        lotteryTicket,
        buyer: ticket.buyer,
      })
      .instruction();
    const tx = await coSign([ix], payer);
    res.json({ tx, buyer: ticket.buyer.toBase58() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
