import { BN } from "bn.js";
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { program } from "../provider";
import { auctionPda, configPda, toolPda } from "../lib/pda";
import { coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";

const r = Router();

r.post("/create", requireCircuitOpen, requireWalletLimits("auction__create"), requireIdempotency, async (req, res) => {
  try {
    const seller = pk(req.body.seller);
    const mint = pk(req.body.mint);
    const minBid = new BN(req.body.minBid);
    const durationSeconds = new BN(req.body.durationSeconds);
    const [config] = configPda();
    const [auction] = auctionPda(mint);
    const sellerToken = getAssociatedTokenAddressSync(mint, seller);
    const auctionVault = getAssociatedTokenAddressSync(mint, auction, true);

    const ix = await (program.methods as any)
      .auctionCreate(minBid as any, durationSeconds as any)
      .accounts({
        config,
        seller,
        mint,
        sellerToken,
        auction,
        auctionVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = await coSign([ix], seller);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/bid", requireCircuitOpen, requireWalletLimits("auction__bid"), requireIdempotency, async (req, res) => {
  try {
    const bidder = pk(req.body.bidder);
    const mint = pk(req.body.mint);
    const amount = new BN(req.body.amount);
    const previousBidder = pk(req.body.previousBidder);
    const [auction] = auctionPda(mint);

    const ix = await (program.methods as any)
      .auctionBid(amount as any)
      .accounts({
        bidder,
        mint,
        auction,
        previousBidder,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = await coSign([ix], bidder);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/settle", requireCircuitOpen, requireWalletLimits("auction__settle"), requireIdempotency, async (req, res) => {
  try {
    const caller = pk(req.body.caller);
    const mint = pk(req.body.mint);
    const seller = pk(req.body.seller);
    const treasury = pk(req.body.treasury);
    const winnerToken = pk(req.body.winnerToken);
    const [config] = configPda();
    const [auction] = auctionPda(mint);
    const [tool] = toolPda(mint);
    const auctionVault = getAssociatedTokenAddressSync(mint, auction, true);

    const ix = await (program.methods as any)
      .auctionSettle()
      .accounts({
        config,
        mint,
        auction,
        seller,
        treasury,
        auctionVault,
        winnerToken,
        tool,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = await coSign([ix], caller);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
