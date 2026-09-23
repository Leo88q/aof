import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import {AUTHORITY_PUBKEY} from "../config";
import { program } from "../provider";
import { authPda, configPda, explorationCommitPda, explorationStatePda, materialMintsPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";
import { newCommit, peekSecret, markUsed } from "../lib/secretStore";

const r = Router();

r.post("/start/commit", requireCircuitOpen, requireWalletLimits("exploration_commit"), async (req, res) => {
  // Exploration commits burn four resource mints immediately. Without a
  // typed expiry refund/cancel instruction it is unsafe to accept new ones.
  return res.status(503).json({
    error: "EXPLORATION_COMMITS_DISABLED_UNTIL_EXPIRY_REFUND_WORKER_IS_DEPLOYED",
  });
  try {
    const user = pk(req.body.user);
    const toolMint = pk(req.body.toolMint);
    const tool = pk(req.body.toolData || req.body.tool);
    const foodMint = pk(req.body.foodMint);
    const woodMint = pk(req.body.woodMint);
    const stoneMint = pk(req.body.stoneMint);
    const meatMint = pk(req.body.meatMint);
    const { hash } = await newCommit(`explore:${toolMint.toBase58()}`);

    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [explorationState] = explorationStatePda(user);
    const [explorationCommit] = explorationCommitPda(toolMint);
    const userFood = getAssociatedTokenAddressSync(foodMint, user);
    const userWood = getAssociatedTokenAddressSync(woodMint, user);
    const userStone = getAssociatedTokenAddressSync(stoneMint, user);
    const userMeat = getAssociatedTokenAddressSync(meatMint, user);

    const ix = await (program.methods as any)
      .startExplorationCommit(hash)
      .accounts({
        config,
        materialMints,
        user,
        explorationState,
        tool,
        toolMint,
        explorationCommit,
        foodMint,
        userFood,
        woodMint,
        userWood,
        stoneMint,
        userStone,
        meatMint,
        userMeat,
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

r.post("/reveal", requireCircuitOpen, requireWalletLimits("exploration_reveal"), requireIdempotency, async (req, res) => {
  try {
    const toolMint = pk(req.body.toolMint);
    const user = pk(req.body.user);
    const woodMint = pk(req.body.woodMint);
    const stoneMint = pk(req.body.stoneMint);
    const key = `explore:${toolMint.toBase58()}`;
    const secret = await peekSecret(key);

    const [config] = configPda();
    const [explorationState] = explorationStatePda(user);
    const [explorationCommit] = explorationCommitPda(toolMint);
    const userWood = getAssociatedTokenAddressSync(woodMint, user);
    const userStone = getAssociatedTokenAddressSync(stoneMint, user);
    const [auth] = authPda();

    const ix = await (program.methods as any)
      .exploreReveal(secret)
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        explorationState,
        explorationCommit,
        payer: user,
        woodMint,
        userWood,
        stoneMint,
        userStone,
        auth,
        slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    await markUsed(key);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/upgrade-tier", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const woodMint = pk(req.body.woodMint);
    const stoneMint = pk(req.body.stoneMint);
    const foodMint = pk(req.body.foodMint);

    const [config] = configPda();
    const [explorationState] = explorationStatePda(user);
    const userWood = getAssociatedTokenAddressSync(woodMint, user);
    const userStone = getAssociatedTokenAddressSync(stoneMint, user);
    const userFood = getAssociatedTokenAddressSync(foodMint, user);

    const ix = await (program.methods as any)
      .upgradeExplorationTier()
      .accounts({
        config,
        user,
        explorationState,
        woodMint,
        userWood,
        stoneMint,
        userStone,
        foodMint,
        userFood,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
