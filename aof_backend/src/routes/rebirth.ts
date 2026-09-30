import { Router } from "express";
import { SystemProgram, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, unpackAccount } from "@solana/spl-token";
import BN from "bn.js";
import { AUTHORITY_PUBKEY } from "../config";
import { connection, program, rebirthProgram } from "../provider";
import {
  configPda,
  materialMintsPda,
  playerPda,
  rebirthConfigPda,
  rebirthProgramDataPda,
  rebirthRecordPda,
  seasonPda,
  seasonPassPda,
} from "../lib/pda";
import {
  buildCanonicalResourceMints,
  resourceMintEntries,
  type CanonicalResourceMints,
} from "../lib/resourceRegistry";
import { fetchOne } from "../lib/decode";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireAdmin } from "../middleware/adminAuth";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";
import { requireWalletProof } from "../security/walletProof";

const r = Router();

/**
 * [§3.4] Предел числа пар `(mint, token_account)`, которые перерождение
 * сжигает за одну транзакцию. Обязан совпадать с
 * `REBIRTH_RESET_MAX_RESOURCE_ACCOUNTS` в `aof-core/src/constants.rs`: предел
 * держат и размер транзакции (1232 байта), и бюджет вычислений.
 */
export const REBIRTH_RESET_MAX_RESOURCE_ACCOUNTS = 16;

export type RebirthSurplusAccount = {
  key: string;
  mint: string;
  tokenAccount: string;
  amountAtoms: string;
};

const rebirthConfigFetch = async () => {
  const [rebirthConfig] = rebirthConfigPda();
  try {
    return await (rebirthProgram.account as any)["rebirthConfig"].fetch(rebirthConfig);
  } catch {
    return null;
  }
};

const accountExists = async (address: PublicKey): Promise<boolean> =>
  (await connection.getAccountInfo(address)) !== null;

/** Текущий сезон — по наибольшему `season_id` среди существующих аккаунтов. */
const currentSeason = async () => {
  const seasons: any[] = await (program.account as any).season.all();
  if (seasons.length === 0) return null;
  return seasons
    .map((entry) => entry.account)
    .sort((a: any, b: any) => Number(b.seasonId) - Number(a.seasonId))[0];
};

/**
 * Полный список излишков игрока: каждый ресурсный ATA с ненулевым остатком,
 * канонический и принадлежащий игроку. Это тот же список, который уходит в
 * `remaining_accounts` перерождения, поэтому «частичного сброса» не бывает:
 * бэкенд перечисляет всё, а инструкция сжигает всё перечисленное.
 */
export async function enumerateRebirthSurplus(
  user: PublicKey,
  mints: CanonicalResourceMints,
): Promise<RebirthSurplusAccount[]> {
  const byAddress = new Map<string, string>();
  for (const [key, mint] of resourceMintEntries(mints)) byAddress.set(mint.toBase58(), key);

  const { value } = await connection.getTokenAccountsByOwner(user, { programId: TOKEN_PROGRAM_ID });
  const surplus: RebirthSurplusAccount[] = [];
  for (const { pubkey, account } of value) {
    let parsed;
    try {
      parsed = unpackAccount(pubkey, account, TOKEN_PROGRAM_ID);
    } catch {
      continue;
    }
    const key = byAddress.get(parsed.mint.toBase58());
    if (!key) continue;
    if (!parsed.owner.equals(user)) continue;
    if (parsed.amount <= 0n) continue;
    if (!getAssociatedTokenAddressSync(parsed.mint, user).equals(pubkey)) continue;
    surplus.push({
      key,
      mint: parsed.mint.toBase58(),
      tokenAccount: pubkey.toBase58(),
      amountAtoms: parsed.amount.toString(),
    });
  }
  // Порядок в транзакции должен быть детерминированным: тот же список даёт
  // тот же intent, а значит и ту же проверку на клиенте.
  return surplus.sort((a, b) => a.key.localeCompare(b.key));
}

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

/**
 * Чтение состояния перерождения: цена, кулдаун, поколение, что именно
 * сбросится и что сгорит. Ни одно поле не выдумывается: отсутствующий аккаунт
 * возвращается как `false`/`null` с явной причиной, а недоступный конфиг — 503.
 */
r.get("/status/:user", async (req, res) => {
  try {
    const user = pk(req.params.user);
    const [rebirthConfig] = rebirthConfigPda();
    const [recordAddress] = rebirthRecordPda(user);
    const [playerAddress] = playerPda(user);
    const [coreConfigAddress] = configPda();
    const [materialMintsAddress] = materialMintsPda();

    const [rc, coreConfig, materialMints] = await Promise.all([
      rebirthConfigFetch(),
      fetchOne("config", coreConfigAddress),
      fetchOne("materialMints", materialMintsAddress),
    ]);
    if (!rc) return res.status(503).json({ error: "REBIRTH_CONFIG_NOT_INITIALIZED" });
    if (!coreConfig) return res.status(503).json({ error: "CORE_CONFIG_NOT_INITIALIZED" });

    const registry = buildCanonicalResourceMints(
      coreConfig as Record<string, unknown>,
      materialMints as Record<string, unknown> | null,
    );
    if (!registry.mints) {
      return res.status(503).json({ error: "RESOURCE_REGISTRY_INCOMPLETE", details: registry.errors });
    }

    const season = await currentSeason();
    const seasonId = season ? Number(season.seasonId) : null;
    const passAddress = seasonId === null ? null : seasonPassPda(user, seasonId)[0];
    const [player, pass, recordAccount] = await Promise.all([
      (program.account as any).player.fetch(playerAddress).catch(() => null),
      passAddress
        ? (program.account as any).seasonPass.fetch(passAddress).catch(() => null)
        : Promise.resolve(null),
      (rebirthProgram.account as any)["rebirthRecord"]
        .fetch(recordAddress)
        .catch(() => null),
    ]);

    const surplus = await enumerateRebirthSurplus(user, registry.mints);
    const now = Math.floor(Date.now() / 1000);
    const cooldownSeconds = Number(rc.cooldownSeconds.toString());
    const lastRebirthTs = Number(recordAccount?.lastRebirthTs?.toString?.() ?? 0);
    const nextAllowedAt =
      lastRebirthTs > 0 && cooldownSeconds > 0 ? lastRebirthTs + cooldownSeconds : null;

    const reasons: string[] = [];
    if (rc.paused) reasons.push("REBIRTH_PAUSED");
    if (!rc.authority.equals(AUTHORITY_PUBKEY)) reasons.push("REBIRTH_AUTHORITY_NOT_BACKEND_KEY");
    if (!(coreConfig as any).operator?.equals?.(AUTHORITY_PUBKEY)) reasons.push("CORE_OPERATOR_NOT_BACKEND_KEY");
    if (seasonId === null) reasons.push("SEASON_NOT_INITIALIZED");
    if (!player) reasons.push("REBIRTH_NO_PLAYER_PROGRESS");
    if (seasonId !== null && !pass) reasons.push("REBIRTH_SEASON_PASS_NOT_FOUND");
    if (recordAccount && Number(recordAccount.rebirthCount) >= Number(rc.maxRebirths)) {
      reasons.push("REBIRTH_MAX_REACHED");
    }
    if (nextAllowedAt !== null && now < nextAllowedAt) reasons.push("REBIRTH_COOLDOWN_ACTIVE");
    if (surplus.length > REBIRTH_RESET_MAX_RESOURCE_ACCOUNTS) {
      reasons.push("REBIRTH_SURPLUS_TOO_LARGE");
    }

    res.json({
      seasonId,
      rebirth: {
        configured: true,
        paused: Boolean(rc.paused),
        authority: rc.authority.toBase58(),
        treasury: rc.treasury.toBase58(),
        costLamports: String(rc.rebirthCostLamports),
        cooldownSeconds,
        maxRebirths: Number(rc.maxRebirths),
        bonusPerRebirthBps: Number(rc.bonusPerRebirthBps),
        maxBonusBps: Number(rc.maxBonusBps),
        generation: recordAccount ? Number(recordAccount.generation) : null,
        rebirthCount: recordAccount ? Number(recordAccount.rebirthCount) : 0,
        permanentBonusBps: recordAccount ? Number(recordAccount.permanentBonusBps) : 0,
        lastRebirthTs: recordAccount ? lastRebirthTs : null,
        nextAllowedAt,
      },
      progress: {
        player: Boolean(player),
        villagers: player ? Number(player.villagers) : null,
        villagersAvailable: player ? Number(player.villagersAvailable) : null,
        hasTent: player ? Boolean(player.hasTent) : null,
        seasonPass: Boolean(pass),
        xp: pass ? Number(pass.xp) : null,
        premium: pass ? Boolean(pass.premium) : null,
      },
      surplus: {
        limit: REBIRTH_RESET_MAX_RESOURCE_ACCOUNTS,
        accounts: surplus,
        fitsInOneTransaction: surplus.length <= REBIRTH_RESET_MAX_RESOURCE_ACCOUNTS,
      },
      canRebirth: reasons.length === 0,
      reasons,
      now,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * [§3.4] Перерождение: одна подписанная транзакция несёт и полный сброс
 * (`aof_core::reset_for_rebirth`), и запись ребёрта с оплатой
 * (`aof_rebirth::do_rebirth`). Либо применяется всё, либо не применяется
 * ничего: обе инструкции требуют подписи бэкенда (`config.operator` и
 * `rebirth_config.authority`), поэтому частичная транзакция невозможна.
 */
r.post(
  "/do",
  requireWalletProof("rebirth_do", "user"),
  requireCircuitOpen,
  requireWalletLimits("rebirth_do"),
  requireIdempotency,
  async (req, res) => {
    try {
      const user = pk(req.body.user);
      const rc = await rebirthConfigFetch();
      if (!rc) return res.status(503).json({ error: "REBIRTH_CONFIG_NOT_INITIALIZED" });
      if (rc.paused) return res.status(409).json({ error: "REBIRTH_PAUSED" });
      // Без этих подписей транзакцию пришлось бы собирать вручную, а значит
      // часть сброса могла бы не состояться. Fail closed до любых переводов.
      if (!rc.authority.equals(AUTHORITY_PUBKEY)) {
        return res.status(503).json({ error: "REBIRTH_AUTHORITY_NOT_BACKEND_KEY" });
      }

      const [coreConfigAddress] = configPda();
      const [materialMintsAddress] = materialMintsPda();
      const [coreConfig, materialMints] = await Promise.all([
        fetchOne("config", coreConfigAddress),
        fetchOne("materialMints", materialMintsAddress),
      ]);
      if (!coreConfig) return res.status(503).json({ error: "CORE_CONFIG_NOT_INITIALIZED" });
      if (!(coreConfig as any).operator?.equals?.(AUTHORITY_PUBKEY)) {
        return res.status(503).json({ error: "CORE_OPERATOR_NOT_BACKEND_KEY" });
      }
      const registry = buildCanonicalResourceMints(
        coreConfig as Record<string, unknown>,
        materialMints as Record<string, unknown> | null,
      );
      if (!registry.mints) {
        return res.status(503).json({ error: "RESOURCE_REGISTRY_INCOMPLETE", details: registry.errors });
      }

      const season = await currentSeason();
      if (!season) return res.status(409).json({ error: "SEASON_NOT_INITIALIZED" });
      const seasonId = Number(season.seasonId);

      const [playerAddress] = playerPda(user);
      const [passAddress] = seasonPassPda(user, seasonId);
      const [rebirthRecordAddress] = rebirthRecordPda(user);
      const [player, pass] = await Promise.all([
        (program.account as any).player.fetch(playerAddress).catch(() => null),
        (program.account as any).seasonPass.fetch(passAddress).catch(() => null),
      ]);
      if (!player) return res.status(409).json({ error: "REBIRTH_NO_PLAYER_PROGRESS" });
      if (!pass) return res.status(409).json({ error: "REBIRTH_SEASON_PASS_NOT_FOUND" });

      const record = await (rebirthProgram.account as any)["rebirthRecord"]
        .fetch(rebirthRecordAddress)
        .catch(() => null);
      const rebirthCount = record ? Number(record.rebirthCount) : 0;
      if (rebirthCount >= Number(rc.maxRebirths)) {
        return res.status(409).json({ error: "REBIRTH_MAX_REACHED" });
      }
      const cooldownSeconds = Number(rc.cooldownSeconds.toString());
      const lastRebirthTs = record ? Number(record.lastRebirthTs?.toString?.() ?? 0) : 0;
      const now = Math.floor(Date.now() / 1000);
      if (lastRebirthTs > 0 && cooldownSeconds > 0 && now < lastRebirthTs + cooldownSeconds) {
        return res.status(409).json({
          error: "REBIRTH_COOLDOWN_ACTIVE",
          nextAllowedAt: lastRebirthTs + cooldownSeconds,
          now,
        });
      }

      const surplus = await enumerateRebirthSurplus(user, registry.mints);
      if (surplus.length > REBIRTH_RESET_MAX_RESOURCE_ACCOUNTS) {
        return res.status(409).json({
          error: "REBIRTH_SURPLUS_TOO_LARGE",
          accounts: surplus.length,
          limit: REBIRTH_RESET_MAX_RESOURCE_ACCOUNTS,
        });
      }

      const [seasonAddress] = seasonPda(seasonId);
      const resetIx = await (program.methods as any)
        .resetForRebirth(seasonId)
        .accounts({
          config: coreConfigAddress,
          operator: AUTHORITY_PUBKEY,
          user,
          player: playerAddress,
          season: seasonAddress,
          seasonPass: passAddress,
          materialMints: materialMintsAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts(
          surplus.flatMap((entry) => [
            { pubkey: new PublicKey(entry.mint), isSigner: false, isWritable: true },
            { pubkey: new PublicKey(entry.tokenAccount), isSigner: false, isWritable: true },
          ]),
        )
        .instruction();

      const [rebirthConfig] = rebirthConfigPda();
      const doIx = await (rebirthProgram.methods as any)
        .doRebirth()
        .accounts({
          rebirthConfig,
          authority: AUTHORITY_PUBKEY,
          rebirthRecord: rebirthRecordAddress,
          user,
          treasury: rc.treasury,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      const tx = await coSign([resetIx, doIx], user);
      res.json({
        tx,
        seasonId,
        costLamports: String(rc.rebirthCostLamports),
        treasury: rc.treasury.toBase58(),
        generation: rebirthCount + 2, // generation начинается с 1 и растёт на каждый ребёрт
        rebirthCount: rebirthCount + 1,
        permanentBonusBps: Math.min(
          Number(rc.maxBonusBps),
          record ? Number(record.permanentBonusBps) + Number(rc.bonusPerRebirthBps) : Number(rc.bonusPerRebirthBps),
        ),
        resetAccounts: {
          player: playerAddress.toBase58(),
          seasonPass: passAddress.toBase58(),
          season: seasonAddress.toBase58(),
        },
        surplus,
        surplusAccounts: surplus.length,
        burnedAtoms: surplus
          .reduce((total, entry) => total + BigInt(entry.amountAtoms), 0n)
          .toString(),
      });
    } catch (e: any) {
      res.status(e.status || 400).json({ error: e.message });
    }
  },
);

export default r;
