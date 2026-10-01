import { BN } from "bn.js";
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import {AUTHORITY_PUBKEY} from "../config";
import { connection, program } from "../provider";
import { authPda, configPda, materialMintsPda, seasonPassPda, seasonPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
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
 * [PAYER] Создание сезонного пропуска — действие игрока: его подпись и его
 * rent. Операторская выдача XP (`/xp/grant`) пропуск больше не создаёт, иначе
 * платный аккаунт игрока появлялся бы за счёт проекта.
 */
r.post("/pass/init", requireWalletProof("season_pass_init", "player"), async (req, res) => {
  try {
    const player = pk(req.body.player);
    const seasonId = Number(req.body.seasonId);
    const [config] = configPda();
    const [season] = seasonPda(seasonId);
    const [seasonPass] = seasonPassPda(player, seasonId);

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

    // Инструкция player-funded и player-signed: authority здесь не нужен.
    const tx = await coSign([ix], player);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/xp/grant", requireAdmin, async (req, res) => {
  try {
    const user = pk(req.body.user);
    const seasonId = Number(req.body.seasonId);
    const amount = Number(req.body.amount);
    const [config] = configPda();
    const [season] = seasonPda(seasonId);
    const [seasonPass] = seasonPassPda(user, seasonId);

    // [PAYER] Пропуск обязан существовать: его создаёт сам игрок
    // (`init_season_pass`). Операторская выдача не создаёт и не оплачивает
    // аккаунт игрока, поэтому отсутствие пропуска — понятная ошибка клиенту.
    const passInfo = await connection.getAccountInfo(seasonPass, "confirmed");
    if (!passInfo) {
      return res.status(409).json({
        error: "SEASON_PASS_NOT_INITIALIZED",
        hint: "player must call POST /season/pass/init first",
      });
    }

    const ix = await (program.methods as any)
      .grantSeasonXp(amount)
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        user,
        season,
        seasonPass,
      })
      .instruction();

    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
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
