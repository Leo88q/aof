import { BN } from "bn.js";
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { program } from "../provider";
import { configPda, listingPda, toolPda } from "../lib/pda";
import { coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";

const r = Router();

r.post("/list", requireCircuitOpen, requireWalletLimits("marketplace__list"), requireIdempotency, async (req, res) => {
  try {
    const seller = pk(req.body.seller);
    const mint = pk(req.body.mint);
    const priceLamports = new BN(req.body.priceLamports);
    const [config] = configPda();
    const [listing] = listingPda(mint);
    const sellerToken = getAssociatedTokenAddressSync(mint, seller);
    const listingVault = getAssociatedTokenAddressSync(mint, listing, true);

    const ix = await (program.methods as any)
      .marketplaceList(priceLamports as any)
      .accounts({
        config,
        seller,
        mint,
        sellerToken,
        listing,
        listingVault,
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

r.post("/buy", requireCircuitOpen, requireWalletLimits("marketplace__buy"), requireIdempotency, async (req, res) => {
  try {
    const buyer = pk(req.body.buyer);
    const seller = pk(req.body.seller);
    const treasury = pk(req.body.treasury);
    const mint = pk(req.body.mint);
    const [config] = configPda();
    const [tool] = toolPda(mint);
    const [listing] = listingPda(mint);
    const listingVault = getAssociatedTokenAddressSync(mint, listing, true);
    const buyerToken = getAssociatedTokenAddressSync(mint, buyer);

    const ix = await (program.methods as any)
      .marketplaceBuy()
      .accounts({
        config,
        buyer,
        seller,
        treasury,
        mint,
        tool,
        listing,
        listingVault,
        buyerToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = await coSign([ix], buyer);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/cancel", requireCircuitOpen, requireWalletLimits("marketplace__cancel"), requireIdempotency, async (req, res) => {
  try {
    const seller = pk(req.body.seller);
    const mint = pk(req.body.mint);
    const [listing] = listingPda(mint);
    const listingVault = getAssociatedTokenAddressSync(mint, listing, true);
    const sellerToken = getAssociatedTokenAddressSync(mint, seller);

    const ix = await (program.methods as any)
      .marketplaceCancel()
      .accounts({
        mint,
        listing,
        seller,
        listingVault,
        sellerToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = await coSign([ix], seller);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
