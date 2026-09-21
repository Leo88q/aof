import { BN } from "bn.js";
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { program } from "../provider";
import { collectorAllowPda, collectorPda, configPda, gastankPda, playerPda, vaultPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

const kindMap: Record<string, any> = {
  historian: { historian: {} },
  medallion: { medallion: {} },
};

// [AUDIT F-16] The on-chain handler used to open with
// `require!(false, CollectorNotConfigured)`, so Historian/Medallion perks (mint
// fee discounts, referral bonus cap 5 -> 30) were unreachable and the site kept
// advertising them. Eligibility is now the per-mint allowlist entry
// (`collector_allow`) that the authority creates with
// POST /admin/config/collector-mint. With no entry the instruction still fails
// closed (CollectorMintNotAllowed) - an arbitrary NFT cannot buy the perks.
r.post("/stake", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const mint = pk(req.body.mint);
    const kind = kindMap[req.body.kind];
    if (!kind) {
      res.status(400).json({ error: "unknown collector kind (historian|medallion)" });
      return;
    }
    const [config] = configPda();
    const [vault] = vaultPda();
    const [stakedCollector] = collectorPda(mint);
    const [collectorAllow] = collectorAllowPda(mint);
    const [player] = playerPda(user);
    const userToken = getAssociatedTokenAddressSync(mint, user);
    const vaultToken = getAssociatedTokenAddressSync(mint, vault, true);

    const ix = await (program.methods as any)
      .collectorStake(kind)
      .accounts({
        config,
        user,
        mint,
        userToken,
        vault,
        vaultToken,
        stakedCollector,
        collectorAllow,
        player,
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

r.post("/unstake", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const mint = pk(req.body.mint);
    const [config] = configPda();
    const [vault] = vaultPda();
    const [stakedCollector] = collectorPda(mint);
    const [player] = playerPda(user);
    const [gastank] = gastankPda(user);
    const userToken = getAssociatedTokenAddressSync(mint, user);
    const vaultToken = getAssociatedTokenAddressSync(mint, vault, true);

    const ix = await (program.methods as any)
      .collectorUnstake()
      .accounts({
        config,
        user,
        mint,
        userToken,
        vault,
        vaultToken,
        stakedCollector,
        player,
        gastank,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/adjust-capacity", requireAdmin, async (req, res) => {
  try {
    const owner = pk(req.body.owner);
    const delta = Number(req.body.delta);
    const hasTent = Boolean(req.body.hasTent);
    const [config] = configPda();
    const [player] = playerPda(owner);

    const ix = await (program.methods as any)
      .adjustPlayerCapacity(delta, hasTent)
      .accounts({ config, authority: AUTHORITY.publicKey, player })
      .instruction();

    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
