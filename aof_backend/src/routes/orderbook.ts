import { BN } from "bn.js";
import { Router } from "express";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { program } from "../provider";
import { configPda, materialMintsPda, resourceOrderPda } from "../lib/pda";
import { coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";

const r = Router();

r.post("/buy/place", requireCircuitOpen, requireWalletLimits("orderbook__buy_place"), requireIdempotency, async (req, res) => {
  try {
    const maker = pk(req.body.maker);
    const mint = pk(req.body.mint);
    const kind = Number(req.body.kind);
    const priceLamportsPerUnit = new BN(req.body.priceLamportsPerUnit);
    const amount = new BN(req.body.amount);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [order] = resourceOrderPda(maker, mint);

    const ix = await (program.methods as any)
      .placeBuyOrder(kind, priceLamportsPerUnit as any, amount as any)
      .accounts({ config, maker, mint, materialMints, order, systemProgram: SystemProgram.programId })
      .instruction();

    const tx = await coSign([ix], maker);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/sell/place", requireCircuitOpen, requireWalletLimits("orderbook__sell_place"), requireIdempotency, async (req, res) => {
  try {
    const maker = pk(req.body.maker);
    const mint = pk(req.body.mint);
    const kind = Number(req.body.kind);
    const priceLamportsPerUnit = new BN(req.body.priceLamportsPerUnit);
    const amount = new BN(req.body.amount);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [order] = resourceOrderPda(maker, mint);
    const makerToken = getAssociatedTokenAddressSync(mint, maker);
    const orderVault = getAssociatedTokenAddressSync(mint, order, true);

    const ix = await (program.methods as any)
      .placeSellOrder(kind, priceLamportsPerUnit as any, amount as any)
      .accounts({
        config,
        maker,
        mint,
        materialMints,
        makerToken,
        order,
        orderVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const createVaultAta = createAssociatedTokenAccountIdempotentInstruction(
      maker,
      orderVault,
      order,
      mint,
    );
    const tx = await coSign([createVaultAta, ix], maker);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/buy/cancel", async (req, res) => {
  try {
    const maker = pk(req.body.maker);
    const mint = pk(req.body.mint);
    const [order] = resourceOrderPda(maker, mint);

    const ix = await (program.methods as any)
      .cancelBuyOrder()
      .accounts({ maker, mint, order })
      .instruction();

    const tx = await coSign([ix], maker);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/sell/cancel", async (req, res) => {
  try {
    const maker = pk(req.body.maker);
    const mint = pk(req.body.mint);
    const [order] = resourceOrderPda(maker, mint);
    const orderVault = getAssociatedTokenAddressSync(mint, order, true);
    const makerToken = getAssociatedTokenAddressSync(mint, maker);

    const ix = await (program.methods as any)
      .cancelSellOrder()
      .accounts({ maker, mint, order, orderVault, makerToken, tokenProgram: TOKEN_PROGRAM_ID })
      .instruction();

    const tx = await coSign([ix], maker);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/match", requireCircuitOpen, requireWalletLimits("orderbook__match"), requireIdempotency, async (req, res) => {
  try {
    const caller = pk(req.body.caller);
    const mint = pk(req.body.mint);
    const buyMaker = pk(req.body.buyMaker);
    const sellMaker = pk(req.body.sellMaker);
    const treasury = pk(req.body.treasury);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [buyOrder] = resourceOrderPda(buyMaker, mint);
    const [sellOrder] = resourceOrderPda(sellMaker, mint);
    const sellVault = getAssociatedTokenAddressSync(mint, sellOrder, true);
    const buyerToken = getAssociatedTokenAddressSync(mint, buyMaker);

    const ix = await (program.methods as any)
      .matchResourceOrders()
      .accounts({
        config,
        materialMints,
        mint,
        buyOrder,
        sellOrder,
        seller: sellMaker,
        treasury,
        sellVault,
        buyerToken,
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
