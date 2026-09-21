import { BN } from "bn.js";
import { Router } from "express";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { program } from "../provider";
import { configPda, offerPda, toolPda } from "../lib/pda";
import { coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";

const r = Router();

r.post("/create", requireCircuitOpen, requireWalletLimits("offer__create"), requireIdempotency, async (req, res) => {
  try {
    const buyer = pk(req.body.buyer);
    const mint = pk(req.body.mint);
    const priceLamports = new BN(req.body.priceLamports);
    const [config] = configPda();
    const [offer] = offerPda(mint, buyer);

    const ix = await (program.methods as any)
      .offerCreate(priceLamports as any)
      .accounts({ config, buyer, mint, offer, systemProgram: SystemProgram.programId })
      .instruction();

    const tx = await coSign([ix], buyer);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/accept", requireCircuitOpen, requireWalletLimits("offer__accept"), requireIdempotency, async (req, res) => {
  try {
    const seller = pk(req.body.seller);
    const mint = pk(req.body.mint);
    const buyer = pk(req.body.buyer);
    const treasury = pk(req.body.treasury);
    const [config] = configPda();
    const [tool] = toolPda(mint);
    const [offer] = offerPda(mint, buyer);
    const sellerToken = getAssociatedTokenAddressSync(mint, seller);
    const buyerToken = getAssociatedTokenAddressSync(mint, buyer);

    const ix = await (program.methods as any)
      .offerAccept()
      .accounts({
        config,
        seller,
        mint,
        tool,
        offer,
        buyerRefund: buyer,
        treasury,
        sellerToken,
        buyerToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const createBuyerAta = createAssociatedTokenAccountIdempotentInstruction(
      seller,
      buyerToken,
      buyer,
      mint,
    );
    const tx = await coSign([createBuyerAta, ix], seller);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/cancel", requireCircuitOpen, requireWalletLimits("offer__cancel"), requireIdempotency, async (req, res) => {
  try {
    const buyer = pk(req.body.buyer);
    const mint = pk(req.body.mint);
    const [config] = configPda();
    const [offer] = offerPda(mint, buyer);

    const ix = await (program.methods as any)
      .offerCancel()
      .accounts({ config, mint, offer, buyer })
      .instruction();

    const tx = await coSign([ix], buyer);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
