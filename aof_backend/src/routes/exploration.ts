import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {AUTHORITY_PUBKEY} from "../config";
import { program, connection } from "../provider";
import { configPda, explorationCommitPda, explorationStatePda, materialMintsPda, toolPda } from "../lib/pda";
import { coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits } from "../middleware/security";
import { reservePoolSlot, vrfCommitAccounts } from "../lib/vrf";
import { commitStatus, selfSettleTransaction } from "../lib/vrfSettlement";

const r = Router();

/**
 * [F-06] Start an exploration trip: the trip cost is burned, the tier is
 * snapshotted and a Switchboard commit locks a pool slot (operator co-signs as
 * the backend gate). The vrf-settler reveals it; POST /reveal lets the player
 * do it (or refund after the window) without the backend.
 */
r.post("/start/commit", requireCircuitOpen, requireWalletLimits("exploration_commit"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const toolMint = pk(req.body.toolMint);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const cfg: any = await (program.account as any).config.fetch(config);
    const mm: any = await (program.account as any).materialMints.fetch(materialMints);
    const ata = (mint: PublicKey) => getAssociatedTokenAddressSync(mint, user);
    const [explorationCommit] = explorationCommitPda(toolMint);
    const slot = await reservePoolSlot(program, connection);
    const vrf = await vrfCommitAccounts(program, connection, slot);

    const ix = await (program.methods as any)
      .startExplorationCommit()
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        materialMints,
        user,
        explorationState: explorationStatePda(user)[0],
        toolMint,
        tool: toolPda(toolMint)[0],
        explorationCommit,
        foodMint: cfg.foodMint,
        userFood: ata(cfg.foodMint),
        woodMint: cfg.woodMint,
        userWood: ata(cfg.woodMint),
        stoneMint: cfg.stoneMint,
        userStone: ata(cfg.stoneMint),
        meatMint: mm.meat,
        userMeat: ata(mm.meat),
        ...vrf,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx, explorationCommit: explorationCommit.toBase58() });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

r.get("/status/:explorationCommit", async (req, res) => {
  try {
    res.json(await commitStatus("exploration", new PublicKey(req.params.explorationCommit)));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** Transaction for the player to settle (or after the window refund) a trip. */
r.post("/reveal", requireCircuitOpen, requireWalletLimits("exploration_reveal"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const commit = req.body.explorationCommit ? pk(req.body.explorationCommit) : explorationCommitPda(pk(req.body.toolMint))[0];
    res.json(await selfSettleTransaction("exploration", commit, user));
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
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
