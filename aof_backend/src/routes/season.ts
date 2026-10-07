import { BN } from "bn.js";
import { Router } from "express";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import {AUTHORITY_PUBKEY} from "../config";
import { connection, program } from "../provider";
import { authPda, configPda, issuanceCapPda, materialMintsPda, seasonPassPda, seasonPremiumClaimsPda, seasonPda } from "../lib/pda";
import { authorityOnly, coSignQuoted, pk } from "../lib/tx";
import { TransactionExecutionFailed, TransactionOutcomeUnknown } from "../lib/transactionLifecycle";
import {
  SEASON_PASS_ACCOUNT_SIZE,
  SEASON_PREMIUM_CLAIMS_ACCOUNT_SIZE,
} from "../lib/accountSizes";
import { requireAdmin } from "../middleware/adminAuth";
import { requirePaidSeasonPassSales } from "../middleware/seasonPassSales";
import { requireNoFraudHold } from "../security/fraudHold";
import { requireWalletProof } from "../security/walletProof";

const r = Router();
const SEASON_PASS_MAX_LEVEL = 42;
const SEASON_XP_PER_LEVEL = 1_000;
const SEASON_LENGTH_SECONDS = 42 * 86_400;

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

/**
 * [PAYER] The wallet signs one exact purchase instruction and pays rent for
 * whichever of the pass / premium-claim ledger accounts is missing. The quote
 * is bound to this message; the on-chain instruction enforces the fixed price,
 * active season window, treasury destination and one-time upgrade.
 */
r.post("/pass/purchase", requirePaidSeasonPassSales, requireWalletProof("season_pass_purchase", "user"), requireNoFraudHold("user", "season_pass_purchase"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const seasonId = Number(req.body.seasonId);
    if (!Number.isInteger(seasonId) || seasonId < 0 || seasonId > 0xffff_ffff) {
      return res.status(400).json({ error: "INVALID_SEASON_ID" });
    }
    const [config] = configPda();
    const [season] = seasonPda(seasonId);
    const [seasonPass] = seasonPassPda(user, seasonId);
    const [premiumClaims] = seasonPremiumClaimsPda(user, seasonId);
    const [configState, seasonState, passState] = await Promise.all([
      (program.account as any).config.fetch(config),
      (program.account as any).season.fetchNullable(season),
      (program.account as any).seasonPass.fetchNullable(seasonPass),
    ]);
    if (!seasonState) return res.status(404).json({ error: "SEASON_NOT_FOUND" });
    if (passState?.premium) return res.status(409).json({ error: "SEASON_PASS_ALREADY_PREMIUM" });
    const treasury = pk(configState.treasury.toBase58());
    if (req.body.treasury && !pk(req.body.treasury).equals(treasury)) {
      return res.status(409).json({ error: "SEASON_TREASURY_CHANGED" });
    }

    const ix = await (program.methods as any)
      .purchaseSeasonPass()
      .accounts({
        config,
        user,
        treasury,
        season,
        seasonPass,
        premiumClaims,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const prepared = await coSignQuoted([ix], user, [
      { name: "season_pass", address: seasonPass, size: SEASON_PASS_ACCOUNT_SIZE, strategy: "init_if_needed" },
      { name: "premium_claims", address: premiumClaims, size: SEASON_PREMIUM_CLAIMS_ACCOUNT_SIZE, strategy: "init_if_needed" },
    ]);
    res.json({ ...prepared, treasury: treasury.toBase58(), seasonId, priceLamports: "150000000" });
  } catch (e: any) {
    res.status(e?.status || 400).json({ error: e.message });
  }
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

r.post("/reward/claim", requireWalletProof("season_reward_claim", "owner"), requireNoFraudHold("owner", "season_reward_claim"), async (req, res) => {
  try {
    const owner = pk(req.body.owner);
    const seasonId = Number(req.body.seasonId);
    const level = Number(req.body.level);
    const premiumTrack = req.body.premiumTrack;
    if (!Number.isSafeInteger(seasonId) || seasonId < 0 || seasonId > 0xffff_ffff) {
      return res.status(400).json({ error: "INVALID_SEASON_ID" });
    }
    if (!Number.isInteger(level) || level < 1 || level > SEASON_PASS_MAX_LEVEL || typeof premiumTrack !== "boolean") {
      return res.status(400).json({ error: "INVALID_SEASON_REWARD_CLAIM" });
    }

    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [season] = seasonPda(seasonId);
    const [seasonPass] = seasonPassPda(owner, seasonId);
    const [premiumClaims] = seasonPremiumClaimsPda(owner, seasonId);
    const [auth] = authPda();
    const [issuanceCapCircuit] = issuanceCapPda("circuit");
    const [configState, seasonState, passState] = await Promise.all([
      (program.account as any).config.fetch(config),
      (program.account as any).season.fetchNullable(season),
      (program.account as any).seasonPass.fetchNullable(seasonPass),
    ]);
    if (!configState.operator?.equals?.(AUTHORITY_PUBKEY)) {
      return res.status(503).json({ error: "SEASON_REWARD_AUTHORITY_CONFIGURATION_MISMATCH" });
    }
    if (!seasonState || Number(seasonState.seasonId) !== seasonId) {
      return res.status(404).json({ error: "SEASON_NOT_FOUND" });
    }
    const now = Math.floor(Date.now() / 1_000);
    const start = Number(seasonState.startTime);
    const end = start + SEASON_LENGTH_SECONDS;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || now < start || now >= end) {
      return res.status(409).json({ error: "SEASON_NOT_ACTIVE" });
    }
    if (!passState || !passState.owner?.equals?.(owner) || Number(passState.seasonId) !== seasonId) {
      return res.status(409).json({ error: "SEASON_PASS_REQUIRED" });
    }
    if (Number(passState.xp) < level * SEASON_XP_PER_LEVEL) {
      return res.status(409).json({ error: "SEASON_INSUFFICIENT_XP" });
    }

    const bit = 1n << BigInt(level - 1);
    let premiumClaimsState: any = null;
    if (premiumTrack) {
      if (passState.premium !== true) return res.status(403).json({ error: "SEASON_PREMIUM_REQUIRED" });
      premiumClaimsState = await (program.account as any).seasonPremiumClaims.fetchNullable(premiumClaims);
      if (!premiumClaimsState || !premiumClaimsState.owner?.equals?.(owner) ||
          Number(premiumClaimsState.seasonId) !== seasonId) {
        return res.status(409).json({ error: "SEASON_PREMIUM_CLAIMS_LEDGER_UNAVAILABLE" });
      }
      if ((BigInt(premiumClaimsState.claimedBitmap.toString()) & bit) !== 0n) {
        return res.status(409).json({ error: "SEASON_REWARD_ALREADY_CLAIMED" });
      }
    } else if ((BigInt(passState.claimedBitmap.toString()) & bit) !== 0n) {
      return res.status(409).json({ error: "SEASON_REWARD_ALREADY_CLAIMED" });
    }

    const authority = pk(configState.operator.toBase58());
    const circuitMint = pk(configState.circuitMint.toBase58());
    const userCircuit = getAssociatedTokenAddressSync(circuitMint, owner);
    const method = premiumTrack
      ? (program.methods as any).claimPremiumSeasonReward(level)
      : (program.methods as any).claimSeasonReward(level, false);
    const accounts = {
      config,
      authority,
      materialMints,
      season,
      seasonPass,
      ...(premiumTrack ? { premiumClaims } : {}),
      circuitMint,
      userCircuit,
      auth,
      tokenProgram: TOKEN_PROGRAM_ID,
      issuanceCapCircuit,
    };
    const rewardIx = await method.accounts(accounts).instruction();
    // The player authorizes the request with a one-time wallet proof. The
    // operator submits the on-chain claim and pays both the transaction fee
    // and any first-time recipient ATA rent; the player never signs the tx.
    const ataIx = createAssociatedTokenAccountIdempotentInstruction(
      AUTHORITY_PUBKEY,
      userCircuit,
      owner,
      circuitMint,
      TOKEN_PROGRAM_ID,
    );
    const sig = await authorityOnly([ataIx, rewardIx]);
    return res.json({ sig, owner: owner.toBase58(), seasonId, level, premiumTrack });
  } catch (e: any) {
    if (e instanceof TransactionOutcomeUnknown) {
      return res.status(202).json({
        pending: true,
        signature: e.signature,
        owner: typeof req.body.owner === "string" ? req.body.owner : undefined,
        seasonId: req.body.seasonId,
        level: req.body.level,
        premiumTrack: req.body.premiumTrack,
      });
    }
    if (e instanceof TransactionExecutionFailed) {
      return res.status(409).json({ error: "SEASON_REWARD_TRANSACTION_FAILED" });
    }
    return res.status(e?.status || 500).json({ error: "SEASON_REWARD_PREPARE_FAILED" });
  }
});

export default r;
