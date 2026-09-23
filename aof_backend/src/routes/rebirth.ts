import { Router } from "express";
import { SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import {AUTHORITY_PUBKEY} from "../config";
import { rebirthProgram } from "../provider";
import { rebirthConfigPda, rebirthProgramDataPda, rebirthRecordPda } from "../lib/pda";
import { authorityOnly, pk } from "../lib/tx";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

// Инициализация конфигурации ребёрта
r.post("/config/init", requireAdmin, async (req, res) => {
  try {
    const bonusPerRebirthBps = Number(req.body.bonusPerRebirthBps || 200);
    const maxBonusBps = Number(req.body.maxBonusBps || 2000);
    const maxRebirths = Number(req.body.maxRebirths || 10);
    // [ФИКС] Новые параметры: казна, цена возрождения (SOL), кулдаун
    const treasury = pk(req.body.treasury);
    const rebirthCostLamports = new BN(req.body.rebirthCostLamports || 100_000_000); // 0.1 SOL по умолчанию
    const cooldownSeconds = new BN(req.body.cooldownSeconds || 604800); // 7 дней по умолчанию

    const [rebirthConfig] = rebirthConfigPda();
    const [programData] = rebirthProgramDataPda();

    const ix = await (rebirthProgram.methods as any)
      .initRebirthConfig(
        bonusPerRebirthBps,
        maxBonusBps,
        maxRebirths,
        treasury,
        rebirthCostLamports,
        cooldownSeconds
      )
      .accounts({
        rebirthConfig,
        authority: AUTHORITY_PUBKEY,
        programData,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Disabled until the on-chain instruction atomically resets the canonical
// seasonal state and burns/settles every asset promised by the game rules.
// Charging SOL while only incrementing RebirthRecord would be an irreversible
// economic mismatch, so this route fails closed rather than accepting funds.
r.post("/do", (_req, res) => {
  res.status(503).json({
    error: "REBIRTH_DISABLED_UNTIL_FULL_RESET_IMPLEMENTED",
  });
});

/*
r.post("/do", async (req, res) => {
  try {
    const user = pk(req.body.user);

    const [rebirthConfig] = rebirthConfigPda();
    const [rebirthRecord] = rebirthRecordPda(user);

    // [ФИКС] Читаем конфиг чтобы взять адрес казны (цена возрождения уходит в SOL)
    const config: any = await (rebirthProgram.account as any)["rebirthConfig"].fetch(rebirthConfig);

    const ix = await (rebirthProgram.methods as any)
      .doRebirth()
      .accounts({
        rebirthConfig,
        rebirthRecord,
        user,
        treasury: config.treasury,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
*/

export default r;
