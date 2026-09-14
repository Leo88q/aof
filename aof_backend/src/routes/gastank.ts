import { BN } from "bn.js";
import { Router } from "express";
import { validate } from "../middleware/validate";
import { gastankDepositSchema } from "../lib/validation";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { program } from "../provider";
import { configPda, gastankPda } from "../lib/pda";
import { coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits } from "../middleware/security";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

r.post("/deposit", validate(gastankDepositSchema), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const amount = new BN(req.body.amount);
    const [config] = configPda();
    const [gastank] = gastankPda(user);
    const ix = await (program.methods as any)
      .depositGas(amount as any)
      .accounts({
        config,
        user,
        gastank,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/withdraw", requireCircuitOpen, requireWalletLimits("gastank_withdraw"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const amount = new BN(req.body.amount);
    const [config] = configPda();
    const [gastank] = gastankPda(user);
    const ix = await (program.methods as any)
      .withdrawGas(amount as any)
      .accounts({
        config,
        user,
        gastank,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/sweep", requireAdmin, async (req, res) => {
  try {
    const owner = pk(req.body.owner);
    const treasury = pk(req.body.treasury);
    const { AUTHORITY } = await import("../config");
    const [config] = configPda();
    const [gastank] = gastankPda(owner);
    const ix = await (program.methods as any)
      .sweepGasFees()
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        gastank,
        treasury,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const { authorityOnly } = await import("../lib/tx");
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
