import { BN } from "bn.js";
import { Router } from "express";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
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
        tool: toolPda(mint)[0],
        sellerToken,
        auction,
        auctionVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const createVaultAta = createAssociatedTokenAccountIdempotentInstruction(
      seller,
      auctionVault,
      auction,
      mint,
    );
    const tx = await coSign([createVaultAta, ix], seller);
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
    const [config] = configPda();
    const [auction] = auctionPda(mint);

    const ix = await (program.methods as any)
      .auctionBid(amount as any)
      .accounts({
        config,
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
    const [config] = configPda();
    const [auction] = auctionPda(mint);
    const [tool] = toolPda(mint);
    const auctionVault = getAssociatedTokenAddressSync(mint, auction, true);
    // [SECURITY_CHECKLIST #33] Parties and the winner's destination come from
    // chain state, not from the request: the program requires the winner's
    // canonical ATA (created idempotently here, paid by the caller).
    const state: any = await (program.account as any)["auction"].fetch(auction);
    const cfg: any = await (program.account as any)["config"].fetch(config);
    const seller = new PublicKey(state.seller);
    const treasury = new PublicKey(cfg.treasury);
    const winner = new BN(state.currentBid.toString()).gtn(0) ? new PublicKey(state.currentBidder) : seller;
    const winnerToken = getAssociatedTokenAddressSync(mint, winner);
    const winnerAta = createAssociatedTokenAccountIdempotentInstruction(caller, winnerToken, winner, mint);

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

    const tx = await coSign([winnerAta, ix], caller);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// [SECURITY_CHECKLIST_REVIEW F-G] The seller withdraws an auction nobody bid on.
r.post("/cancel", requireCircuitOpen, requireWalletLimits("auction__cancel"), requireIdempotency, async (req, res) => {
  try {
    const seller = pk(req.body.seller);
    const mint = pk(req.body.mint);
    const [config] = configPda();
    const [auction] = auctionPda(mint);
    const auctionVault = getAssociatedTokenAddressSync(mint, auction, true);
    const sellerToken = getAssociatedTokenAddressSync(mint, seller);
    const sellerAta = createAssociatedTokenAccountIdempotentInstruction(seller, sellerToken, seller, mint);

    const ix = await (program.methods as any)
      .auctionCancel()
      .accounts({ config, seller, mint, auction, auctionVault, sellerToken, tokenProgram: TOKEN_PROGRAM_ID })
      .instruction();

    const tx = await coSign([sellerAta, ix], seller);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
