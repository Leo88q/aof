import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import { AUTHORITY, TREASURY } from "../config";
import { program } from "../provider";
import { authPda, configPda, enchantSlotPda, forgeCommitPda, toolPda, bowCommitPda, skinPda, materialMintsPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { fetchOne } from "../lib/decode";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";
import { requireAdmin } from "../middleware/adminAuth";
import { newCommit, peekSecret, markUsed } from "../lib/secretStore";

const r = Router();

/** Shared with services/commit-expirer: build forge_attempt_expire for a ForgeCommit PDA. */
export async function buildForgeExpireIx(forgeCommit: PublicKey) {
  const [config] = configPda();
  const [cfg, commit]: any[] = await Promise.all([
    fetchOne("config", config),
    (program.account as any).forgeCommit.fetch(forgeCommit),
  ]);
  if (!cfg) throw new Error("config account not found");
  const woodMint = new PublicKey(cfg.woodMint);
  const stoneMint = new PublicKey(cfg.stoneMint);
  return (program.methods as any)
    .forgeAttemptExpire()
    .accounts({
      config,
      forgeCommit,
      user: commit.user,
      auth: authPda()[0],
      woodMint,
      userWood: getAssociatedTokenAddressSync(woodMint, commit.user),
      stoneMint,
      userStone: getAssociatedTokenAddressSync(stoneMint, commit.user),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

r.post("/commit", requireCircuitOpen, requireWalletLimits("forge_commit"), async (req, res) => {
  // The SOL fee is escrowed on the ForgeCommit PDA and the burned wood/stone
  // amounts are recorded on it. If reveal never happens, forge_attempt_expire
  // (commit-expirer worker or anyone) re-mints the resources and refunds the
  // fee after COMMIT_EXPIRY_SLOTS.
  try {
    const user = pk(req.body.user);
    const toolMint = pk(req.body.toolMint);
    const slotType = Number(req.body.slotType);
    const useProtector = Boolean(req.body.useProtector);
    const [config] = configPda();
    const cfg: any = await fetchOne("config", config);
    if (!cfg) return res.status(503).json({ error: "CONFIG_NOT_INITIALIZED" });
    const woodMint = new PublicKey(cfg.woodMint);
    const stoneMint = new PublicKey(cfg.stoneMint);
    const { hash } = await newCommit(`forge:${toolMint.toBase58()}:${slotType}`);

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
        treasury: TREASURY,
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

/**
 * Refund of an expired forge commit: re-mints the burned wood/stone to the
 * committer and returns the escrowed fee + rent. On-chain the instruction is
 * permissionless and only succeeds after COMMIT_EXPIRY_SLOTS; admin-only here
 * because the authority pays the transaction fee (used by commit-expirer).
 */
r.post("/expire", requireCircuitOpen, requireAdmin, async (req, res) => {
  try {
    const toolMint = pk(req.body.toolMint);
    const slotType = Number(req.body.slotType);
    const [forgeCommit] = forgeCommitPda(toolMint, slotType);
    const ix = await buildForgeExpireIx(forgeCommit);
    const sig = await authorityOnly([ix]);
    await markUsed(`forge:${toolMint.toBase58()}:${slotType}`).catch(() => {});
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
