/**
 * Operator levers that the audit required to exist on-chain.
 *
 * [AUDIT F-27] mining kill-switch, [F-03] supply ceilings, [F-01] vault
 * withdrawal guards, [F-02] two-step authority rotation, [F-16] collector
 * allowlist. All of them are authority-only on the program and admin-only
 * here; every call emits an event so the action is auditable.
 */
import { BN } from "bn.js";
import { Router } from "express";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { adminByMethod, requireAdminOps } from "../middleware/adminAuth";
import { authorityOnly, pk } from "../lib/tx";
import {
  connection, program, PROGRAM_ID, MARKET_PROGRAM_ID, QUESTS_PROGRAM_ID, REBIRTH_PROGRAM_ID,
  LIQUIDITY_PROGRAM_ID, SESSION_PROGRAM_ID,
} from "../provider";
import { AUTHORITY, AUTHORITY_PUBKEY } from "../config";
import { collectorAllowPda, configPda, materialMintsPda, vaultGuardPda } from "../lib/pda";
import { invalidateMiningFlag } from "../lib/configState";
import { bootstrapPreflightHandler, sanitizeRpcError } from "../lib/bootstrapPreflight";
import { logger } from "../lib/logger";

const r = Router();
r.use(adminByMethod);

/**
 * GET /admin/config/bootstrap-preflight — проверка ДО деплоя и инициализации.
 *
 * Не требует Config (в отличие от GET /mining, который до инициализации честно
 * отвечает 400), ничего не подписывает и не раскрывает секретов. Нужен именно
 * ops-токен: `adminByMethod` выше пропускает GET и с read-токеном, а здесь
 * раскрываются ключ authority и режим подписи. Читает scripts/devnet-bringup.sh.
 */
r.get("/bootstrap-preflight", requireAdminOps, bootstrapPreflightHandler(() => ({
  connection,
  authorityMode: AUTHORITY ? "hot" : "read-only",
  canSign: AUTHORITY !== null,
  authorityPubkey: AUTHORITY_PUBKEY,
  programs: {
    aof_core: PROGRAM_ID,
    aof_market: MARKET_PROGRAM_ID,
    aof_quests: QUESTS_PROGRAM_ID,
    aof_rebirth: REBIRTH_PROGRAM_ID,
    aof_liquidity: LIQUIDITY_PROGRAM_ID,
    aof_session_keys: SESSION_PROGRAM_ID,
  },
  coreProgramId: PROGRAM_ID,
  configPda: configPda()[0],
  expectedGenesisHash: process.env.EXPECTED_GENESIS_HASH,
}), (error) => logger.warn({ rpcError: sanitizeRpcError(error) }, "bootstrap preflight: RPC read failed")));

/** POST /admin/config/mining { enabled } — on-chain kill-switch (F-27). */
r.post("/mining", async (req, res) => {
  try {
    // String "false" is truthy in JS; never interpret it as permission to
    // enable mining. Require an explicit JSON boolean for the kill-switch.
    if (typeof req.body?.enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be a JSON boolean" });
    }
    const enabled = req.body.enabled;
    const [config] = configPda();
    const ix = await (program.methods as any)
      .setMiningEnabled(enabled)
      .accounts({ config, authority: (program.provider as any).wallet.publicKey })
      .instruction();
    const sig = await authorityOnly([ix]);
    invalidateMiningFlag();
    res.json({ sig, enabled });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** GET /admin/config/mining — current on-chain flag. */
r.get("/mining", async (_req, res) => {
  try {
    const [config] = configPda();
    const cfg: any = await (program.account as any)["config"].fetch(config);
    if (typeof cfg?.miningEnabled !== "boolean" || typeof cfg?.paused !== "boolean") {
      return res.status(503).json({ error: "MINING_CONFIG_UNAVAILABLE" });
    }
    res.json({ miningEnabled: cfg.miningEnabled, paused: cfg.paused });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** POST /admin/config/supply-cap { kind, maxSupply } (F-03). */
r.post("/supply-cap", async (req, res) => {
  try {
    const kind = req.body.kind; // e.g. { wood: {} }
    const maxSupply = new BN(String(req.body.maxSupply));
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const ix = await (program.methods as any)
      .setSupplyCap(kind, maxSupply as any)
      .accounts({ config, authority: (program.provider as any).wallet.publicKey, materialMints })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** POST /admin/config/vault-guard { mint, epochSlots, capPerEpoch, maxPerTx } (F-01). */
r.post("/vault-guard", async (req, res) => {
  try {
    const mint = pk(req.body.mint);
    const epochSlots = new BN(String(req.body.epochSlots ?? 43_200)); // ~5 hours
    const capPerEpoch = new BN(String(req.body.capPerEpoch));
    const maxPerTx = new BN(String(req.body.maxPerTx));
    const [config] = configPda();
    const [vaultGuard] = vaultGuardPda(mint);
    const authority = (program.provider as any).wallet.publicKey;
    const accounts = { config, authority, vaultGuard, mint };
    const initIx = await (program.methods as any)
      .initVaultGuard(epochSlots as any, capPerEpoch as any, maxPerTx as any)
      .accounts({ ...accounts, systemProgram: SystemProgram.programId })
      .instruction();
    // `init` fails if the guard already exists; fall back to `set`.
    let sig: string;
    try {
      sig = await authorityOnly([initIx]);
    } catch {
      const setIx = await (program.methods as any)
        .setVaultGuard(epochSlots as any, capPerEpoch as any, maxPerTx as any)
        .accounts(accounts)
        .instruction();
      sig = await authorityOnly([setIx]);
    }
    res.json({ sig, vaultGuard: vaultGuard.toBase58() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** POST /admin/config/authority/propose { newAuthority } (F-02 step 1). */
r.post("/authority/propose", async (req, res) => {
  try {
    const newAuthority = new PublicKey(pk(req.body.newAuthority));
    const [config] = configPda();
    const ix = await (program.methods as any)
      .setPendingAuthority(newAuthority)
      .accounts({ config, authority: (program.provider as any).wallet.publicKey })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig, newAuthority: newAuthority.toBase58() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** POST /admin/config/authority/cancel (F-02). */
r.post("/authority/cancel", async (_req, res) => {
  try {
    const [config] = configPda();
    const ix = await (program.methods as any)
      .cancelPendingAuthority()
      .accounts({ config, authority: (program.provider as any).wallet.publicKey })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** POST /admin/config/collector-mint { mint, kind } (F-16). */
r.post("/collector-mint", async (req, res) => {
  try {
    const mint = pk(req.body.mint);
    const kind = req.body.kind; // { historian: {} } | { medallion: {} }
    const [config] = configPda();
    const [entry] = collectorAllowPda(mint);
    const ix = await (program.methods as any)
      .registerCollectorMint(kind)
      .accounts({
        config,
        authority: (program.provider as any).wallet.publicKey,
        mint,
        entry,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig, entry: entry.toBase58() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** POST /admin/config/collector-mint/revoke { mint } (F-16). */
r.post("/collector-mint/revoke", async (req, res) => {
  try {
    const mint = pk(req.body.mint);
    const [config] = configPda();
    const [entry] = collectorAllowPda(mint);
    const ix = await (program.methods as any)
      .revokeCollectorMint()
      .accounts({ config, authority: (program.provider as any).wallet.publicKey, mint, entry })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
