import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {AUTHORITY_PUBKEY} from "../config";
import { program, connection } from "../provider";
import { authPda, configPda, enchantSlotPda, forgeCommitPda, toolPda } from "../lib/pda";
import { coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits } from "../middleware/security";
import { reservePoolSlot, vrfCommitAccounts } from "../lib/vrf";
import { commitStatus, selfSettleTransaction } from "../lib/vrfSettlement";

const r = Router();

/**
 * [F-06] Forge attempt: circuit/silicon burned, fee (+protector) escrowed, level
 * snapshotted, Switchboard commit on a pool slot (operator co-signs as the
 * backend gate). Settled by the vrf-settler or by the player (POST /reveal).
 */
r.post("/commit", requireCircuitOpen, requireWalletLimits("forge_commit"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const toolMint = pk(req.body.toolMint);
    const slotType = Number(req.body.slotType);
    if (!Number.isInteger(slotType) || slotType < 0 || slotType > 2) throw new Error("slotType must be 0, 1 or 2");
    const useProtector = req.body.useProtector === true;
    const [config] = configPda();
    const cfg: any = await (program.account as any).config.fetch(config);
    const [forgeCommit] = forgeCommitPda(toolMint, slotType);
    const slot = await reservePoolSlot(program, connection);
    const vrf = await vrfCommitAccounts(program, connection, slot);

    const ix = await (program.methods as any)
      .forgeAttemptCommit(slotType, useProtector)
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        user,
        tool: toolPda(toolMint)[0],
        toolMint,
        enchantSlot: enchantSlotPda(toolMint, slotType)[0],
        forgeCommit,
        circuitMint: cfg.circuitMint,
        userCircuit: getAssociatedTokenAddressSync(cfg.circuitMint, user),
        siliconMint: cfg.siliconMint,
        userSilicon: getAssociatedTokenAddressSync(cfg.siliconMint, user),
        ...vrf,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx, forgeCommit: forgeCommit.toBase58() });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

r.get("/status/:forgeCommit", async (req, res) => {
  try {
    res.json(await commitStatus("forge", new PublicKey(req.params.forgeCommit)));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** Transaction for the player to settle (or after the window refund) an attempt. */
r.post("/reveal", requireCircuitOpen, requireWalletLimits("forge_reveal"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const commit = req.body.forgeCommit
      ? pk(req.body.forgeCommit)
      : forgeCommitPda(pk(req.body.toolMint), Number(req.body.slotType))[0];
    res.json(await selfSettleTransaction("forge", commit, user));
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});


// §3.8: маршруты сняты вместе с предметом. «Лук» и скины — доребрендовая
// механика Age of Farming: в текущей программе нет ни `SkinAccount`, ни
// констант seeds для скина, ни инструкций `bow_reward_commit/reveal`;
// «bow» остался только в списке старых имён инструментов, которые миграция
// переименовывает в инструменты (`aof-core/src/state.rs`,
// `canonical_tool_type`). Скины заменены обычными NFT-инструментами, а награда
// за попытку крафта выдаётся инструкциями `forge_attempt_*`.
//
// 410, а не 404: старый клиент должен получить объяснение, а не «страница не
// найдена», и не ждать, пока механика «включится». Инструкцию для этого
// маршрута писать не будут — предмета нет.
r.post("/bow/commit", (_req, res) => {
  res.status(410).json({ error: "BOW_REWARD_ROUTE_RETIRED_LEGACY_ITEM" });
});
r.post("/bow/reveal", (_req, res) => {
  res.status(410).json({ error: "BOW_REWARD_ROUTE_RETIRED_LEGACY_ITEM" });
});

export default r;
