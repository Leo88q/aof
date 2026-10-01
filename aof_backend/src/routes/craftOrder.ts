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
    const circuitNeeded = new BN(req.body.circuitNeeded);
    const siliconNeeded = new BN(req.body.siliconNeeded);
    const premiumLamports = new BN(req.body.premiumLamports);
    const [config] = configPda();
    const [craftOrder] = craftOrderPda(creator);

    const ix = await (program.methods as any)
      .craftOrderCreate(circuitNeeded as any, siliconNeeded as any, premiumLamports as any)
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
    const circuitMint = pk(req.body.circuitMint);
    const siliconMint = pk(req.body.siliconMint);
    const [config] = configPda();
    const [craftOrder] = craftOrderPda(creator);
    const fulfillerCircuit = getAssociatedTokenAddressSync(circuitMint, fulfiller);
    const creatorCircuit = getAssociatedTokenAddressSync(circuitMint, creator);
    const fulfillerSilicon = getAssociatedTokenAddressSync(siliconMint, fulfiller);
    const creatorSilicon = getAssociatedTokenAddressSync(siliconMint, creator);

    const ix = await (program.methods as any)
      .craftOrderFulfill()
      .accounts({
        config,
        fulfiller,
        craftOrder,
        creatorRefund: creator,
        treasury,
        circuitMint,
        fulfillerCircuit,
        creatorCircuit,
        siliconMint,
        fulfillerSilicon,
        creatorSilicon,
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
    const [config] = configPda();
    const [craftOrder] = craftOrderPda(creator);

    const ix = await (program.methods as any)
      .craftOrderCancel()
      .accounts({ config, creator, craftOrder })
      .instruction();

    const tx = await coSign([ix], creator);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
