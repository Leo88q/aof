/**
 * Bootstrap preflight: «можно ли начинать включение игры на этом backend'е».
 *
 * Зачем. Раньше scripts/devnet-bringup.sh проверял backend запросом
 * `GET /admin/config/mining` и требовал строго HTTP 200. Но этот маршрут читает
 * `Config` — аккаунт, которого до инициализации нет (а инициализировать его
 * можно только после деплоя, то есть ПОСЛЕ этой проверки): до деплоя он отвечал
 * 400 «Account does not exist», и скрипт упирался в замкнутый круг. «Принять
 * любой 400» нельзя — так «принимается» и неверный токен, и чужой сервис.
 *
 * Эта проверка не требует ни программ, ни Config. Она отвечает на вопросы,
 * от которых зависит безопасность первой транзакции:
 *   * кто мы: публичный ключ authority и режим (hot/read-only), может ли
 *     процесс подписывать;
 *   * с какой сетью говорим: genesis-хеш RPC (и совпадает ли он с
 *     EXPECTED_GENESIS_HASH, если тот задан);
 *   * какие program ID у backend'а (по всем шести программам) и развёрнуты ли они;
 *   * существует ли Config.
 *
 * Только чтение: ничего не подписывает и не отправляет, секретов (ключа
 * authority, ADMIN_TOKEN, RPC URL с API-ключом) в ответе нет. Решение
 * принимает вызывающий скрипт — fail-closed.
 */
import { createHash } from "crypto";
import type { Request, Response } from "express";
import type { PublicKey } from "@solana/web3.js";

export const BOOTSTRAP_PREFLIGHT_KIND = "aof.bootstrap-preflight";
export const BOOTSTRAP_PREFLIGHT_SCHEMA = 1;
export const BPF_LOADER_UPGRADEABLE = "BPFLoaderUpgradeab1e11111111111111111111111";

/** Имена программ — те же, что в security/program-registry.json и watchtower/addresses.json. */
export const BOOTSTRAP_PROGRAM_NAMES = [
  "aof_core",
  "aof_market",
  "aof_quests",
  "aof_rebirth",
  "aof_liquidity",
  "aof_session_keys",
] as const;
export type BootstrapProgramName = (typeof BOOTSTRAP_PROGRAM_NAMES)[number];

/** Минимум, который нужен от соединения: так проверку можно гонять без сети. */
export interface PreflightConnection {
  getGenesisHash(): Promise<string>;
  getMultipleAccountsInfo(keys: PublicKey[]): Promise<Array<{ owner: PublicKey; executable: boolean; data: Buffer } | null>>;
}

export interface BootstrapPreflightDeps {
  connection: PreflightConnection;
  /** "hot" — у процесса есть секрет authority; "read-only" — нет. */
  authorityMode: "hot" | "read-only";
  canSign: boolean;
  authorityPubkey: PublicKey;
  programs: Record<BootstrapProgramName, PublicKey>;
  coreProgramId: PublicKey;
  configPda: PublicKey;
  expectedGenesisHash?: string | undefined;
}

export interface BootstrapProgramState {
  programId: string;
  deployed: boolean;
  /** Не null, если аккаунт есть, но это не исполняемая upgradeable-программа. */
  anomaly: string | null;
}

export interface BootstrapPreflight {
  kind: typeof BOOTSTRAP_PREFLIGHT_KIND;
  schemaVersion: typeof BOOTSTRAP_PREFLIGHT_SCHEMA;
  service: "aof-backend";
  authority: { pubkey: string; mode: "hot" | "read-only"; canSign: boolean };
  rpc: { genesisHash: string; expectedGenesisHash: string | null; genesisMatchesExpected: boolean | null };
  programs: Record<BootstrapProgramName, BootstrapProgramState>;
  config: { pda: string; exists: boolean; anomaly: string | null };
}

/** Anchor: первые 8 байт sha256("account:<Имя>") — по ним отличаем настоящий Config от чужого аккаунта. */
export function anchorAccountDiscriminator(name: string): Buffer {
  return createHash("sha256").update(`account:${name}`).digest().subarray(0, 8);
}

function programState(programId: PublicKey, info: { owner: PublicKey; executable: boolean } | null): BootstrapProgramState {
  if (!info) return { programId: programId.toBase58(), deployed: false, anomaly: null };
  if (info.owner.toBase58() !== BPF_LOADER_UPGRADEABLE) {
    return { programId: programId.toBase58(), deployed: false, anomaly: "account-exists-but-not-owned-by-upgradeable-loader" };
  }
  if (!info.executable) {
    return { programId: programId.toBase58(), deployed: false, anomaly: "account-exists-but-not-executable" };
  }
  return { programId: programId.toBase58(), deployed: true, anomaly: null };
}

export async function buildBootstrapPreflight(deps: BootstrapPreflightDeps): Promise<BootstrapPreflight> {
  const names = BOOTSTRAP_PROGRAM_NAMES;
  const keys = [...names.map((name) => deps.programs[name]), deps.configPda];
  const [genesisHash, infos] = await Promise.all([deps.connection.getGenesisHash(), deps.connection.getMultipleAccountsInfo(keys)]);
  if (typeof genesisHash !== "string" || infos.length !== keys.length) {
    throw new Error("unexpected RPC answer");
  }

  const programs = {} as Record<BootstrapProgramName, BootstrapProgramState>;
  names.forEach((name, index) => {
    programs[name] = programState(deps.programs[name], infos[index]);
  });

  const configInfo = infos[names.length];
  let configExists = false;
  let configAnomaly: string | null = null;
  if (configInfo) {
    if (configInfo.owner.toBase58() !== deps.coreProgramId.toBase58()) {
      configAnomaly = "account-exists-but-not-owned-by-aof-core";
    } else if (!configInfo.data.subarray(0, 8).equals(anchorAccountDiscriminator("Config"))) {
      configAnomaly = "account-exists-but-is-not-a-Config";
    } else if (!programs.aof_core.deployed) {
      configAnomaly = "config-exists-but-aof-core-is-not-deployed";
    } else {
      configExists = true;
    }
  }

  const expected = deps.expectedGenesisHash && deps.expectedGenesisHash.length > 0 ? deps.expectedGenesisHash : null;
  return {
    kind: BOOTSTRAP_PREFLIGHT_KIND,
    schemaVersion: BOOTSTRAP_PREFLIGHT_SCHEMA,
    service: "aof-backend",
    authority: { pubkey: deps.authorityPubkey.toBase58(), mode: deps.authorityMode, canSign: deps.canSign },
    rpc: { genesisHash, expectedGenesisHash: expected, genesisMatchesExpected: expected === null ? null : expected === genesisHash },
    programs,
    config: { pda: deps.configPda.toBase58(), exists: configExists, anomaly: configAnomaly },
  };
}

/**
 * Описание сбоя для лога: имя ошибки и сообщение, из которого вырезаны URL.
 * Текст ошибки RPC-клиента может содержать адрес узла вместе с API-ключом
 * провайдера, а логгер маскирует только заранее названные поля.
 */
export function sanitizeRpcError(error: unknown): { name: string; message: string } {
  const name = error instanceof Error ? error.name : typeof error;
  const raw = error instanceof Error ? error.message : String(error);
  return { name, message: raw.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[url]").slice(0, 200) };
}

/**
 * Обработчик маршрута. Авторизацию (ops-токен) навешивает вызывающий — здесь её
 * нет намеренно: так нельзя «забыть» защиту внутри самого обработчика, а
 * тесты проверяют именно связку «роутер + guard».
 */
export function bootstrapPreflightHandler(getDeps: () => BootstrapPreflightDeps, onError?: (error: unknown) => void) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const body = await buildBootstrapPreflight(getDeps());
      res.setHeader("Cache-Control", "no-store");
      res.json(body);
    } catch (error) {
      onError?.(error);
      // Текст ошибки RPC может содержать URL с API-ключом — наружу только код.
      res.status(502).json({ error: "BOOTSTRAP_PREFLIGHT_RPC_UNAVAILABLE" });
    }
  };
}
