import { BN } from "bn.js";
import { Router } from "express";
import { SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { program } from "../provider";
import { configPda, lotteryRoundPda, lotteryTicketPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { newCommit, peekSecret, markUsed } from "../lib/secretStore";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

r.post("/round/init", requireAdmin, async (req, res) => {
  try {
    const roundId = new BN(req.body.roundId);
    const [config] = configPda();
    const [lotteryRound] = lotteryRoundPda(roundId);

    const ix = await (program.methods as any)
      .initLotteryRound(roundId as any)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        lotteryRound,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/ticket/buy", async (req, res) => {
  // The contract currently fails closed because the documented per-wallet
  // daily cap is not yet enforced on-chain. Do not present an API path that
  // can only fail after the user has prepared a transaction.
  return res.status(503).json({
    error: "LOTTERY_TICKETS_DISABLED_UNTIL_ONCHAIN_DAILY_CAP_EXISTS",
  });
  try {
    const buyer = pk(req.body.buyer);
    const roundId = new BN(req.body.roundId);
    const ticketNumber = new BN(req.body.ticketNumber);
    const treasury = pk(req.body.treasury);
    const [config] = configPda();
    const [lotteryRound] = lotteryRoundPda(roundId);
    const [lotteryTicket] = lotteryTicketPda(roundId, ticketNumber);

    const ix = await (program.methods as any)
      .buyLotteryTicket()
      .accounts({
        config,
        buyer,
        treasury,
        lotteryRound,
        lotteryTicket,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = await coSign([ix], buyer);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// [ФИКС] Фаза 1 (commit): генерируем секрет офчейн, шлём ончейн только sha256(secret)
r.post("/draw/commit", requireAdmin, async (req, res) => {
  try {
    const roundId = new BN(req.body.roundId);
    const [config] = configPda();
    const [lotteryRound] = lotteryRoundPda(roundId);

    const { hash } = await newCommit(`lottery:${roundId.toString()}`);

    const ix = await (program.methods as any)
      .commitLotteryDraw(hash)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        lotteryRound,
      })
      .instruction();

    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// [ФИКС] Фаза 2 (reveal): достаём сохранённый секрет, шлём в контракт для розыгрыша
r.post("/draw/reveal", requireAdmin, async (req, res) => {
  try {
    const roundId = new BN(req.body.roundId);
    const [config] = configPda();
    const [lotteryRound] = lotteryRoundPda(roundId);

    const key = `lottery:${roundId.toString()}`;
    const secret = await peekSecret(key);

    const ix = await (program.methods as any)
      .drawLottery(secret)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        lotteryRound,
        slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
      })
      .instruction();

    const sig = await authorityOnly([ix]);
    await markUsed(key);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/claim", async (req, res) => {
  try {
    const winner = pk(req.body.winner);
    const roundId = new BN(req.body.roundId);
    const ticketNumber = new BN(req.body.ticketNumber);
    const [lotteryRound] = lotteryRoundPda(roundId);
    const [lotteryTicket] = lotteryTicketPda(roundId, ticketNumber);

    const ix = await (program.methods as any)
      .claimLotteryPrize()
      .accounts({ lotteryRound, lotteryTicket, winner })
      .instruction();

    const tx = await coSign([ix], winner);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
