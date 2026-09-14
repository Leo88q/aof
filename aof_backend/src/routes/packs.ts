import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { program } from "../provider";
import { authPda, configPda, packCommitPda, packConfigPda, toolPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";
import { requireAdmin } from "../middleware/adminAuth";
import { newCommit, peekSecret, markUsed } from "../lib/secretStore";

const r = Router();
const packTypeMap: Record<string, any> = {
  small: { small: {} },
  medium: { medium: {} },
  big: { big: {} },
};

r.post("/commit", requireCircuitOpen, requireWalletLimits("packs_commit"), async (req, res) => {
  // A pack commit transfers SOL immediately, but the current on-chain
  // programs have no typed expiry-refund instruction and the worker cannot
  // safely reconstruct every reveal account. Do not accept new paid commits
  // until reveal/refund recovery is implemented and tested.
  return res.status(503).json({
    error: "PACK_COMMITS_DISABLED_UNTIL_EXPIRY_REFUND_WORKER_IS_DEPLOYED",
  });
  try {
    const user = pk(req.body.user);
    const mint = pk(req.body.mint);
    const packType = req.body.packType;
    const packTypeIdx = ["small", "medium", "big"].indexOf(packType);
    const { hash } = await newCommit(`pack:${mint.toBase58()}`);

    const [config] = configPda();
    const [packConfig] = packConfigPda(packTypeIdx);
    const [packCommit] = packCommitPda(mint);
    const treasury = pk(req.body.treasury);

    const ix = await (program.methods as any)
      .packOpenCommit(packTypeMap[packType], hash)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        user,
        treasury,
        packConfig,
        auth: authPda()[0],
        mint,
        packCommit,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/reveal", requireCircuitOpen, requireWalletLimits("packs_reveal"), requireIdempotency, async (req, res) => {
  try {
    const mint = pk(req.body.mint);
    const user = pk(req.body.user);
    const packType = req.body.packType;
    const packTypeIdx = ["small", "medium", "big"].indexOf(packType);
    const key = `pack:${mint.toBase58()}`;
    const secret = await peekSecret(key);

    const [config] = configPda();
    const [packCommit] = packCommitPda(mint);
    const [packConfig] = packConfigPda(packTypeIdx);
    const [toolData] = toolPda(mint);
    const [auth] = authPda();
    const userToken = getAssociatedTokenAddressSync(mint, user);

    const ix = await (program.methods as any)
      .packOpenReveal(secret)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        packCommit,
        user,
        packConfig,
        mint,
        userToken,
        toolData,
        auth,
        slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    await markUsed(key);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/config/init", requireAdmin, async (req, res) => {
  try {
    const packType = Number(req.body.packType);
    const priceLamports = new (require("bn.js"))(req.body.priceLamports);
    const oddsBps = req.body.oddsBps;

    const [config] = configPda();
    const [packConfig] = packConfigPda(packType);

    const ix = await (program.methods as any)
      .initPackConfig(packType, priceLamports, oddsBps)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        packConfig,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/config/set", requireAdmin, async (req, res) => {
  try {
    const packType = Number(req.body.packType);
    const priceLamports = new (require("bn.js"))(req.body.priceLamports);
    const oddsBps = req.body.oddsBps;

    const [config] = configPda();
    const [packConfig] = packConfigPda(packType);

    const ix = await (program.methods as any)
      .setPackConfig(priceLamports, oddsBps)
      .accounts({ config, authority: AUTHORITY.publicKey, packConfig })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
