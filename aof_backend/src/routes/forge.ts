import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { program } from "../provider";
import { authPda, configPda, enchantSlotPda, forgeCommitPda, toolPda, bowCommitPda, skinPda, materialMintsPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { fetchOne } from "../lib/decode";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";
import { newCommit, peekSecret, markUsed } from "../lib/secretStore";

const r = Router();

r.post("/commit", requireCircuitOpen, requireWalletLimits("forge_commit"), async (req, res) => {
  // Forge commits burn resources/fees and have no typed expiry refund path.
  // Do not accept a paid irreversible state until the recovery worker exists.
  return res.status(503).json({
    error: "FORGE_COMMITS_DISABLED_UNTIL_EXPIRY_REFUND_WORKER_IS_DEPLOYED",
  });
  try {
    const user = pk(req.body.user);
    const toolMint = pk(req.body.toolMint);
    const slotType = Number(req.body.slotType);
    const useProtector = Boolean(req.body.useProtector);
    const woodMint = pk(req.body.woodMint);
    const stoneMint = pk(req.body.stoneMint);
    const treasury = pk(req.body.treasury);
    const [materialMints] = materialMintsPda();
    const materials: any = await fetchOne("materialMints", materialMints);
    if (!materials?.meat) {
      return res.status(503).json({ error: "FORGE_MEAT_MINT_NOT_CONFIGURED" });
    }
    const meatMint = new PublicKey(materials.meat);
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
        meatMint,
        userMeat: getAssociatedTokenAddressSync(meatMint, user),
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
    const key = `forge:${toolMint.toBase58()}:${slotType}`;
    const secret = await peekSecret(key);

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
    await markUsed(key);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// Disabled: no bow_reward_commit/reveal entrypoints exist in aof-core.
r.post("/bow/commit", (_req, res) => {
  res.status(503).json({ error: "BOW_REWARD_DISABLED_UNTIL_ONCHAIN_INSTRUCTION_EXISTS" });
});
r.post("/bow/reveal", (_req, res) => {
  res.status(503).json({ error: "BOW_REWARD_DISABLED_UNTIL_ONCHAIN_INSTRUCTION_EXISTS" });
});

/*
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
    const key = `bow:${toolMint.toBase58()}`;
    const secret = await peekSecret(key);
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
    await markUsed(key);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
*/

export default r;
