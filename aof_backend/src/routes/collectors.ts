import { BN } from "bn.js";
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { program } from "../provider";
import { collectorPda, configPda, gastankPda, playerPda, vaultPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";

const r = Router();

const kindMap: Record<string, any> = {
  historian: { historian: {} },
  medallion: { medallion: {} },
};

r.post("/stake", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const mint = pk(req.body.mint);
    const kind = kindMap[req.body.kind];
    const [config] = configPda();
    const [vault] = vaultPda();
    const [stakedCollector] = collectorPda(mint);
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

r.post("/adjust-capacity", async (req, res) => {
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
