import { BN } from "bn.js";
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import {AUTHORITY_PUBKEY} from "../config";
import { connection, program } from "../provider";
import { authPda, configPda, materialMintsPda, seasonPassPda, seasonPda } from "../lib/pda";
import { authorityOnly, coSignQuoted, pk } from "../lib/tx";
import { SEASON_PASS_ACCOUNT_SIZE } from "../lib/accountSizes";
import { requireAdmin } from "../middleware/adminAuth";
import { requireNoFraudHold } from "../security/fraudHold";
import { requireWalletProof } from "../security/walletProof";

const r = Router();

r.post("/init", requireAdmin, async (req, res) => {
  try {
    const seasonId = Number(req.body.seasonId);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [season] = seasonPda(seasonId);

    const ix = await (program.methods as any)
      .initSeason(seasonId)
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        season,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Paid purchases remain closed until BOTH tracks, deterministic XP and
// enforceable VIP benefits pass the devnet acceptance tests. Historical passes
// can still be read and rewards claimed via the existing routes.
r.post("/pass/purchase", (_req, res) => {
  res.status(503).json({ error: "SEASON_PASS_PAID_TRACK_NOT_READY" });
});

/**
 * [PAYER] Player may initialize a pass separately; an XP entitlement claim
 * also creates the pass and its once-per-season replay cursor with player-paid
 * rent when either account is absent.
 */
r.post("/pass/init", requireWalletProof("season_pass_init", "player"), async (req, res) => {
  try {
    const player = pk(req.body.player);
    const seasonId = Number(req.body.seasonId);
    const [config] = configPda();
    const [season] = seasonPda(seasonId);
    const [seasonPass] = seasonPassPda(player, seasonId);
    const existingPass = await connection.getAccountInfo(seasonPass, "confirmed");
    if (existingPass) {
      return res.status(409).json({ error: "SEASON_PASS_ALREADY_INITIALIZED" });
    }

    const ix = await (program.methods as any)
      .initSeasonPass(seasonId)
      .accounts({
        config,
        player,
        season,
        seasonPass,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // The quote is bound to this exact player-paid, authority-free message.
    const prepared = await coSignQuoted([ix], player, [
      { name: "season_pass", address: seasonPass, size: SEASON_PASS_ACCOUNT_SIZE, strategy: "init" },
    ]);
    res.json(prepared);
  } catch (e: any) {
    res.status(e?.status || 400).json({ error: e.message });
  }
});

r.post("/reward/claim", requireAdmin, requireNoFraudHold("owner", "season_reward_claim"), async (req, res) => {
  try {
    const owner = pk(req.body.owner);
    const seasonId = Number(req.body.seasonId);
    const level = Number(req.body.level);
    const premiumTrack = Boolean(req.body.premiumTrack);
    const circuitMint = pk(req.body.circuitMint);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [season] = seasonPda(seasonId);
    const [seasonPass] = seasonPassPda(owner, seasonId);
    const [auth] = authPda();
    const userCircuit = getAssociatedTokenAddressSync(circuitMint, owner);

    const ix = await (program.methods as any)
      .claimSeasonReward(level, premiumTrack)
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        materialMints,
        season,
        seasonPass,
        circuitMint,
        userCircuit,
        auth,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
