import { BN } from "bn.js";
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { program } from "../provider";
import { configPda, craftOrderPda } from "../lib/pda";
import { coSign, pk } from "../lib/tx";

const r = Router();

r.post("/create", async (req, res) => {
  try {
    const creator = pk(req.body.creator);
    const woodNeeded = new BN(req.body.woodNeeded);
    const stoneNeeded = new BN(req.body.stoneNeeded);
    const premiumLamports = new BN(req.body.premiumLamports);
    const [config] = configPda();
    const [craftOrder] = craftOrderPda(creator);

    const ix = await (program.methods as any)
      .craftOrderCreate(woodNeeded as any, stoneNeeded as any, premiumLamports as any)
      .accounts({ config, creator, craftOrder, systemProgram: SystemProgram.programId })
      .instruction();

    const tx = await coSign([ix], creator);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/fulfill", async (req, res) => {
  try {
    const fulfiller = pk(req.body.fulfiller);
    const creator = pk(req.body.creator);
    const treasury = pk(req.body.treasury);
    const woodMint = pk(req.body.woodMint);
    const stoneMint = pk(req.body.stoneMint);
    const [config] = configPda();
    const [craftOrder] = craftOrderPda(creator);
    const fulfillerWood = getAssociatedTokenAddressSync(woodMint, fulfiller);
    const creatorWood = getAssociatedTokenAddressSync(woodMint, creator);
    const fulfillerStone = getAssociatedTokenAddressSync(stoneMint, fulfiller);
    const creatorStone = getAssociatedTokenAddressSync(stoneMint, creator);

    const ix = await (program.methods as any)
      .craftOrderFulfill()
      .accounts({
        config,
        fulfiller,
        craftOrder,
        creatorRefund: creator,
        treasury,
        woodMint,
        fulfillerWood,
        creatorWood,
        stoneMint,
        fulfillerStone,
        creatorStone,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = await coSign([ix], fulfiller);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/cancel", async (req, res) => {
  try {
    const creator = pk(req.body.creator);
    const [craftOrder] = craftOrderPda(creator);

    const ix = await (program.methods as any)
      .craftOrderCancel()
      .accounts({ creator, craftOrder })
      .instruction();

    const tx = await coSign([ix], creator);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
