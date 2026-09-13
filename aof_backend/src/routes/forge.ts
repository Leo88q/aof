import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { program } from "../provider";
import { authPda, configPda, enchantSlotPda, forgeCommitPda, toolPda, bowCommitPda, skinPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";
import { newCommit, popSecret } from "../lib/secretStore";

const r = Router();

r.post("/commit", requireCircuitOpen, requireWalletLimits("forge_commit"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const toolMint = pk(req.body.toolMint);
    const slotType = Number(req.body.slotType);
    const useProtector = Boolean(req.body.useProtector);
    const woodMint = pk(req.body.woodMint);
    const stoneMint = pk(req.body.stoneMint);
    const treasury = pk(req.body.treasury);
    const { hash } = await newCommit(`forge:${toolMint.toBase58()}:${slotType}`);

    const [config] = configPda();
    const [tool] = toolPda(toolMint);
    const [enchantSlot] = enchantSlotPda(toolMint, slotType);
    const [forgeCommit] = forgeCommitPda(toolMint, slotType);
    const userWood = getAssociatedTokenAddressSync(woodMint, user);
    const userStone = getAssociatedTokenAddressSync(stoneMint, user);

    const ix = await (program.methods as any)
      .forgeAttemptCommit(slotType, hash, useProtector)
      .accounts({
        config,
        user,
        treasury,
        tool,
        toolMint,
        enchantSlot,
        forgeCommit,
        woodMint,
        userWood,
        stoneMint,
        userStone,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/reveal", requireCircuitOpen, requireWalletLimits("forge_reveal"), requireIdempotency, async (req, res) => {
  try {
    const toolMint = pk(req.body.toolMint);
    const slotType = Number(req.body.slotType);
    const user = pk(req.body.user);
    const secret = await popSecret(`forge:${toolMint.toBase58()}:${slotType}`);

    const [config] = configPda();
    const [enchantSlot] = enchantSlotPda(toolMint, slotType);
    const [forgeCommit] = forgeCommitPda(toolMint, slotType);

    const ix = await (program.methods as any)
      .forgeAttemptReveal(secret)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        enchantSlot,
        forgeCommit,
        payer: user,
        slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// Bow: шанс на скин (коммит)
r.post("/bow/commit", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const toolMint = pk(req.body.toolMint);
    const [config] = configPda();
    const [tool] = toolPda(toolMint);
    const [bowCommit] = bowCommitPda(toolMint);
    const { hash } = await newCommit(`bow:${toolMint.toBase58()}`);
    const ix = await (program.methods as any)
      .bowRewardCommit(hash)
      .accounts({
        config,
        user,
        tool,
        toolMint,
        bowCommit,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Bow: раскрытие результата (сервер)
r.post("/bow/reveal", async (req, res) => {
  try {
    const toolMint = pk(req.body.toolMint);
    const user = pk(req.body.user);
    const skinMint = pk(req.body.skinMint);
    const skinId = Number(req.body.skinId);
    const secret = await popSecret(`bow:${toolMint.toBase58()}`);
    const [config] = configPda();
    const [bowCommit] = bowCommitPda(toolMint);
    const [skin] = skinPda(skinMint);
    const [auth] = authPda();
    const userSkinToken = getAssociatedTokenAddressSync(skinMint, user);
    const ix = await (program.methods as any)
      .bowRewardReveal(secret, skinId)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        bowCommit,
        payer: user,
        skinMint,
        userSkinToken,
        skin,
        auth,
        slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
