import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import {AUTHORITY_PUBKEY} from "../config";
import { program } from "../provider";
import {
  authPda,
  configPda,
  craftEconomyPda,
  gastankPda,
  materialMintsPda,
  rarityCounterPda,
  rerollCommitPda,
  rerollConfigPda,
  toolPda,
} from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";
import { requireAdmin } from "../middleware/adminAuth";
import { newCommit, peekSecret, markUsed } from "../lib/secretStore";

const r = Router();

r.post("/fuse", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const mintA = pk(req.body.mintA);
    const mintB = pk(req.body.mintB);
    const newMint = pk(req.body.newMint);
    const newType = req.body.newType;

    const [config] = configPda();
    const [gastank] = gastankPda(user);
    const [toolA] = toolPda(mintA);
    const [toolB] = toolPda(mintB);
    const [newToolData] = toolPda(newMint);
    const [auth] = authPda();
    const tokenA = getAssociatedTokenAddressSync(mintA, user);
    const tokenB = getAssociatedTokenAddressSync(mintB, user);
    const newToken = getAssociatedTokenAddressSync(newMint, user);

    // [AUDIT F-09] Rerolling now burns the craft bundle for the target rarity
    // and moves the rarity counter. The on-chain side derives the target rarity
    // itself (tool_a.rarity + 1); we only have to resolve the resource mints
    // from Config and derive the matching ATAs and the rarity counter PDA.
    const [craftEconomy] = craftEconomyPda();
    const cfg: any = await (program.account as any)["config"].fetch(config);
    const toolAccount: any = await (program.account as any)["toolData"].fetch(toolA);
    const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
    const rarityOf = (v: any): number => {
      if (typeof v === "number") return v;
      return RARITIES.findIndex((name) => v && typeof v === "object" && name in v);
    };
    const targetRarity = rarityOf(toolAccount.rarity) + 1;
    if (!(targetRarity >= 1 && targetRarity < RARITIES.length)) {
      throw new Error("Reroll target rarity is out of range");
    }
    const [rarityCounter] = rarityCounterPda(targetRarity);
    const resourceMints = {
      circuit: new PublicKey(cfg.woodMint),
      silicon: new PublicKey(cfg.stoneMint),
      data: new PublicKey(cfg.foodMint),
      neuron: new PublicKey(cfg.seedsMint),
      power: new PublicKey(cfg.waterMint),
      mind: new PublicKey(cfg.potatoMint),
    };
    const ata = (m: PublicKey) => getAssociatedTokenAddressSync(m, user);

    const ix = await (program.methods as any)
      .reroll(newType)
      .accounts({
        config,
        user,
        gastank,
        toolA,
        mintA,
        tokenA,
        toolB,
        mintB,
        tokenB,
        newMint,
        newToken,
        newToolData,
        auth,
        rarityCounter,
        craftEconomy,
        woodMint: resourceMints.circuit,
        userWood: ata(resourceMints.circuit),
        stoneMint: resourceMints.silicon,
        userStone: ata(resourceMints.silicon),
        foodMint: resourceMints.data,
        userFood: ata(resourceMints.data),
        seedsMint: resourceMints.neuron,
        userSeeds: ata(resourceMints.neuron),
        waterMint: resourceMints.power,
        userWater: ata(resourceMints.power),
        potatoMint: resourceMints.mind,
        userPotato: ata(resourceMints.mind),
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

r.post("/random/commit", requireCircuitOpen, requireWalletLimits("reroll_commit"), async (req, res) => {
  // The commit burns the user's tool immediately. There is currently no
  // typed expiry refund path, so fail closed instead of accepting an
  // unrecoverable paid/burned state.
  return res.status(503).json({
    error: "REROLL_COMMITS_DISABLED_UNTIL_EXPIRY_REFUND_WORKER_IS_DEPLOYED",
  });
  try {
    const user = pk(req.body.user);
    const burnMint = pk(req.body.burnMint);
    const newMint = pk(req.body.newMint);
    const { hash } = await newCommit(`reroll:${newMint.toBase58()}`);

    const [config] = configPda();
    const [gastank] = gastankPda(user);
    const [burnTool] = toolPda(burnMint);
    const [rerollCommit] = rerollCommitPda(newMint);
    const burnToken = getAssociatedTokenAddressSync(burnMint, user);

    const ix = await (program.methods as any)
      .rerollRandomCommit(hash)
      .accounts({
        config,
        user,
        gastank,
        burnTool,
        burnMint,
        burnToken,
        newMint,
        rerollCommit,
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

r.post("/random/reveal", requireCircuitOpen, requireWalletLimits("reroll_reveal"), requireIdempotency, async (req, res) => {
  try {
    const newMint = pk(req.body.newMint);
    const user = pk(req.body.user);
    const key = `reroll:${newMint.toBase58()}`;
    const secret = await peekSecret(key);

    const [config] = configPda();
    const [rerollConfig] = rerollConfigPda();
    const [rerollCommit] = rerollCommitPda(newMint);
    const [newToolData] = toolPda(newMint);
    const [auth] = authPda();
    const newToken = getAssociatedTokenAddressSync(newMint, user);

    const ix = await (program.methods as any)
      .rerollRandomReveal(secret)
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        rerollConfig,
        rerollCommit,
        payer: user,
        newMint,
        newToken,
        newToolData,
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
    const oddsBps = req.body.oddsBps;
    const [config] = configPda();
    const [rerollConfig] = rerollConfigPda();

    const ix = await (program.methods as any)
      .initRerollConfig(oddsBps)
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        rerollConfig,
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
