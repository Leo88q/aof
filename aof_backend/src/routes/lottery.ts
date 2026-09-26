import BN from "bn.js";
import { Router } from "express";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { AUTHORITY_PUBKEY } from "../config";
import { program, connection } from "../provider";
import { configPda, lotteryRoundPda, lotteryTicketPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireAdmin } from "../middleware/adminAuth";
import { reservePoolSlot, vrfCommitAccounts } from "../lib/vrf";
import { commitStatus, fetchPendingCommit, buildRevealInstructions } from "../lib/vrfSettlement";

/**
 * [F-06] Lottery with a player-funded pool and a Switchboard draw:
 *   - tickets escrow the full price on the round (nothing reaches the treasury
 *     before the draw; an undrawn round refunds every ticket in full);
 *   - the operator closes sales by committing the draw (anyone may after the
 *     on-chain sales window), the vrf-settler reveals it permissionlessly;
 *   - the winner claims the prize (pool minus the house share).
 */
const r = Router();

const u64 = (value: unknown, field: string): BN => {
  const text = String(value ?? "");
  if (!/^[0-9]{1,20}$/.test(text)) throw new Error(`${field} must be a u64`);
  return new BN(text);
};
const counterPda = (roundId: BN, buyer: PublicKey) => PublicKey.findProgramAddressSync(
  [Buffer.from("lottery_ticket"), Buffer.from("count"), roundId.toArrayLike(Buffer, "le", 8), buyer.toBuffer()],
  program.programId,
)[0];

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

r.post("/ticket/buy", async (req, res) => {
  try {
    const buyer = pk(req.body.buyer);
    const roundId = u64(req.body.roundId, "roundId");
    const [lotteryRound] = lotteryRoundPda(roundId);
    const round: any = await (program.account as any).lotteryRound.fetch(lotteryRound);
    if (round.drawCommitted || round.drawn) throw new Error("LOTTERY_SALES_CLOSED");
    // The ticket PDA is numbered by tickets_sold at execution time; a
    // concurrent purchase makes this transaction fail (retry), never mis-number.
    const [lotteryTicket] = lotteryTicketPda(roundId, round.ticketsSold);
    const ix = await (program.methods as any)
      .buyLotteryTicket()
      .accounts({
        config: configPda()[0],
        buyer,
        lotteryRound,
        lotteryTicket,
        ticketCounter: counterPda(roundId, buyer),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], buyer);
    res.json({ tx, ticketNumber: round.ticketsSold.toString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** Operator closes sales and commits the draw to a Switchboard pool slot. */
r.post("/draw/commit", requireAdmin, async (req, res) => {
  try {
    const roundId = u64(req.body.roundId, "roundId");
    const slot = await reservePoolSlot(program, connection);
    const vrf = await vrfCommitAccounts(program, connection, slot);
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
