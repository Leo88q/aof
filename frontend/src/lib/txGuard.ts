/**
 * solana-tx-guard — Pre-sign симуляция транзакций
 * Защита от drain-атак и подозрительной активности
 */

import { Connection, Transaction, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { connection } from "./wallet"; // или импортируем откуда нужно

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface GuardResult {
  safe: boolean;
  risk: RiskLevel;
  reason?: string;
  warnings: string[];
  details?: {
    lamportsSpent?: number;
    tokenOutflows?: Record<string, number>;
    programsInvoked?: string[];
  };
}

export interface GuardConfig {
  maxLamportsSpent?: number;            // Лимит явного исходящего SOL (в lamports)
  maxTokenOutflows?: Record<string, number>; // Лимиты по токенам (в base units)
  allowedPrograms?: string[];           // Разрешённые program IDs
  blockedPrograms?: string[];           // Заблокированные program IDs
  blockedAddresses?: string[];          // Чёрный список адресов
}

// Program IDs Solana (известные безопасные)
const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const COMPUTE_BUDGET_PROGRAM_ID = "ComputeBudget111111111111111111111111111111";

const SAFE_PROGRAMS = new Set([
  SYSTEM_PROGRAM_ID,           // System Program
  TOKEN_PROGRAM_ID,            // Token Program
  ASSOCIATED_TOKEN_PROGRAM_ID, // Associated Token
  TOKEN_2022_PROGRAM_ID,       // Token-2022
  COMPUTE_BUDGET_PROGRAM_ID,   // Compute budget
]);

// These are the six deployed AOF programs from Anchor.toml. A transaction
// guard must not treat an arbitrary program as safe merely because simulation
// succeeded: simulation proves execution, not user intent.
const AOF_PROGRAMS = [
  "6ZnnyKkv1kUE4AJqi5uwdh5ZX6VFGfbQiwhGSkfqZ9K5", // session keys
  "Gvbo9wDEW6kCzzhjk3stEcZoVtcScbN8mGv9SNwTUJLv", // liquidity
  "4rMWC1h9mt6JTfBsUPYLMCydPED4e31cffmix5nZyuRb", // rebirth
  "4fNKhVw2nErWZBBw9hgWD3Metu1UKbDLdhFGWbCewdLU", // quests
  "4BhD6spJHdvHQ9mgyaU6AUSLU37oJbTMCDcAXyWhMRVo", // market
  "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq", // core
];

// Известные скам/MEV программы (расширять по мере обнаружения)
const KNOWN_SCAM_PROGRAMS = new Set([
  // Добавлять сюда известные скам-программы
]);

const DEFAULT_CONFIG: GuardConfig = {
  maxLamportsSpent: 100_000, // 0.0001 SOL максимум на fees
  maxTokenOutflows: {},
  allowedPrograms: [],
  blockedPrograms: Array.from(KNOWN_SCAM_PROGRAMS),
  blockedAddresses: [],
};

/**
 * Главная функция: симулирует транзакцию и проверяет риски
 */
export async function guardTransaction(
  tx: Transaction | VersionedTransaction,
  user: PublicKey,
  config: GuardConfig = {}
): Promise<GuardResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];
  let risk: RiskLevel = "LOW";

  try {
    // 1. Симуляция транзакции
    const simulation = await connection.simulateTransaction(tx as any, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });

    if (simulation.value.err) {
      return {
        safe: false,
        risk: "HIGH",
        reason: `Транзакция не пройдёт: ${JSON.stringify(simulation.value.err)}`,
        warnings: ["Симуляция вернула ошибку"],
      };
    }

    // 2. Анализируем сами инструкции, а не выдуманные строки в runtime logs.
    // Logs do not contain reliable System/SPL transfer amounts and therefore
    // are not a security boundary.
    const instructions = collectInstructions(tx);
    if (!instructions) {
      return {
        safe: false,
        risk: "HIGH",
        reason: "Не удалось разобрать инструкции транзакции",
        warnings: ["Защита остановила неподдерживаемый versioned transaction"],
      };
    }
    const logs = simulation.value.logs || [];
    const programsInvoked = Array.from(new Set([
      ...instructions.map((instruction) => instruction.programId),
      ...extractPrograms(logs),
    ]));
    const lamportsSpent = estimateLamportsSpent(instructions, user);
    const tokenOutflows = estimateTokenOutflows(instructions, user);

    // 3. The fee payer must be the wallet that is about to sign. This avoids
    // displaying a check for one wallet while another wallet pays/authorizes.
    const feePayer = transactionFeePayer(tx);
    if (!feePayer || !feePayer.equals(user)) {
      return {
        safe: false,
        risk: "HIGH",
        reason: "Плательщик транзакции не совпадает с подключённым кошельком",
        warnings: ["Неожиданный fee payer"],
        details: { programsInvoked },
      };
    }

    // 4. Проверка на заблокированные программы
    for (const program of programsInvoked) {
      if (cfg.blockedPrograms?.includes(program)) {
        return {
          safe: false,
          risk: "HIGH",
          reason: `🚨 Обнаружена заблокированная программа: ${program.slice(0, 8)}...`,
          warnings: ["Попытка взаимодействия с подозрительной программой"],
          details: { programsInvoked },
        };
      }
    }

    // 5. Проверка адресов назначения/участников из явных инструкций.
    const blockedAddress = (cfg.blockedAddresses || []).find((address) =>
      instructions.some((instruction) => instruction.keys.some((key) => key.toBase58() === address))
    );
    if (blockedAddress) {
      return {
        safe: false,
        risk: "HIGH",
        reason: `🚨 Обнаружен заблокированный адрес: ${blockedAddress.slice(0, 8)}...`,
        warnings: ["Транзакция содержит заблокированный аккаунт"],
        details: { lamportsSpent, tokenOutflows, programsInvoked },
      };
    }

    // 6. Проверка лимита SOL. This is an explicit outgoing-lamport limit,
    // not a fee estimate: runtime logs cannot be used to infer user spend.
    if (cfg.maxLamportsSpent !== undefined && lamportsSpent > cfg.maxLamportsSpent) {
      risk = "HIGH";
      warnings.push(
        `⚠️ Высокая стоимость: ${(lamportsSpent / 1e9).toFixed(6)} SOL (лимит ${(cfg.maxLamportsSpent / 1e9).toFixed(6)})`
      );
    }

    // 7. Проверка лимитов токенов. A direct SPL transfer is not produced by
    // the AOF backend's game instructions; reject it by default rather than
    // pretending the old log parser measured the amount correctly.
    for (const [mint, amount] of Object.entries(tokenOutflows)) {
      const limit = cfg.maxTokenOutflows?.[mint];
      if (limit === undefined) {
        risk = "HIGH";
        warnings.push(`⚠️ Исходящий SPL-токен без настроенного лимита: ${mint.slice(0, 8)}...`);
      } else if (amount > limit) {
        risk = "HIGH";
        warnings.push(
          `⚠️ Большое списание токена ${mint.slice(0, 8)}...: ${amount} (лимит ${limit})`
        );
      }
    }

    // 8. Проверка неизвестных программ (если список allowed задан). Unknown
    // programs are a hard stop, not a warning that a user may click through.
    if (cfg.allowedPrograms && cfg.allowedPrograms.length > 0) {
      const unknownPrograms = programsInvoked.filter(
        (p) => !cfg.allowedPrograms!.includes(p) && !SAFE_PROGRAMS.has(p)
      );
      if (unknownPrograms.length > 0) {
        risk = "HIGH";
        warnings.push(
          `⚠️ Неизвестные программы: ${unknownPrograms.map((p) => p.slice(0, 8)).join(", ")}`
        );
      }
    }

    // 9. Если есть warnings но не HIGH — это MEDIUM
    if (warnings.length > 0 && risk === "LOW") {
      risk = "MEDIUM";
    }

    return {
      safe: risk !== "HIGH",
      risk,
      warnings,
      details: {
        lamportsSpent,
        tokenOutflows,
        programsInvoked,
      },
    };
  } catch (e: any) {
    return {
      safe: false,
      risk: "HIGH",
      reason: `Не удалось проверить транзакцию: ${e.message}`,
      warnings: ["Error симуляции"],
    };
  }
}

interface GuardInstruction {
  programId: string;
  keys: PublicKey[];
  data: Uint8Array;
}

/** Extract program IDs from logs as a secondary check. Amounts are never read
 * from logs because Solana runtime logs are not a stable transfer format. */
function extractPrograms(logs: string[]): string[] {
  const programs = new Set<string>();
  const programRegex = /Program ([A-Za-z1-9]{32,44}) invoke/;
  for (const log of logs) {
    const match = log.match(programRegex);
    if (match) programs.add(match[1]);
  }
  return Array.from(programs);
}

function decodeBase58(value: string): Uint8Array {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = 0n;
  for (const character of value) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid base58 instruction data");
    number = number * 58n + BigInt(index);
  }
  const bytes: number[] = [];
  while (number > 0n) {
    bytes.push(Number(number & 0xffn));
    number >>= 8n;
  }
  bytes.reverse();
  let leadingZeros = 0;
  while (leadingZeros < value.length && value[leadingZeros] === "1") leadingZeros++;
  return Uint8Array.from([...new Array(leadingZeros).fill(0), ...bytes]);
}

function instructionData(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (typeof data === "string") return decodeBase58(data);
  throw new Error("Unsupported instruction data");
}

/**
 * Convert both legacy and lookup-table-free versioned transactions to one
 * representation. A lookup-table transaction is rejected by the guard rather
 * than checked against an incomplete account-key list.
 */
function collectInstructions(tx: Transaction | VersionedTransaction): GuardInstruction[] | null {
  const candidate = tx as any;
  if (Array.isArray(candidate.instructions)) {
    return candidate.instructions.map((instruction: any) => ({
      programId: instruction.programId.toBase58(),
      keys: instruction.keys.map((key: any) => key.pubkey),
      data: instructionData(instruction.data),
    }));
  }

  const message = candidate.message;
  const staticKeys: PublicKey[] = message?.staticAccountKeys || [];
  if (!message || (message.addressTableLookups?.length || 0) > 0) return null;
  return (message.compiledInstructions || []).map((instruction: any) => {
    const programId = staticKeys[instruction.programIdIndex];
    const keys = (instruction.accountKeyIndexes || []).map((index: number) => staticKeys[index]);
    if (!programId || keys.some((key: PublicKey) => !key)) throw new Error("Unresolved transaction account key");
    return {
      programId: programId.toBase58(),
      keys,
      data: instructionData(instruction.data),
    };
  });
}

function transactionFeePayer(tx: Transaction | VersionedTransaction): PublicKey | null {
  const candidate = tx as any;
  if (candidate.feePayer) return candidate.feePayer;
  return candidate.message?.staticAccountKeys?.[0] || null;
}

function readU32(data: Uint8Array, offset: number): number | null {
  if (data.length < offset + 4) return null;
  return data[offset] + data[offset + 1] * 2 ** 8 + data[offset + 2] * 2 ** 16 + data[offset + 3] * 2 ** 24;
}

function readU64(data: Uint8Array, offset: number): number | null {
  if (data.length < offset + 8) return null;
  let value = 0;
  for (let i = 0; i < 8; i++) value += data[offset + i] * 2 ** (8 * i);
  return Number.isSafeInteger(value) ? value : Number.MAX_SAFE_INTEGER;
}

/** Sum explicit System Program transfers whose source is the connected wallet. */
function estimateLamportsSpent(instructions: GuardInstruction[], user: PublicKey): number {
  let spent = 0;
  for (const instruction of instructions) {
    if (instruction.programId !== SYSTEM_PROGRAM_ID || instruction.keys.length < 2) continue;
    // SystemInstruction::Transfer is discriminator 2 (u32 LE), lamports at +4.
    if (readU32(instruction.data, 0) !== 2 || !instruction.keys[0].equals(user)) continue;
    spent = Math.min(Number.MAX_SAFE_INTEGER, spent + (readU64(instruction.data, 4) || 0));
  }
  return spent;
}

/**
 * Parse direct SPL Token/Token-2022 transfers authorized by the connected
 * wallet. Game program CPIs are intentionally not guessed from logs: their
 * economic limits belong to the audited on-chain program instruction.
 */
function estimateTokenOutflows(
  instructions: GuardInstruction[],
  user: PublicKey,
): Record<string, number> {
  const outflows: Record<string, number> = {};
  for (const instruction of instructions) {
    if (![TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].includes(instruction.programId)) continue;
    const opcode = instruction.data[0];
    const checked = opcode === 12;
    if (opcode !== 3 && !checked) continue;
    const authorityIndex = checked ? 3 : 2;
    if (!instruction.keys[authorityIndex]?.equals(user)) continue;
    const source = instruction.keys[0];
    const mint = checked && instruction.keys[1]
      ? instruction.keys[1].toBase58()
      : `unknown-source:${source.toBase58()}`;
    const amount = readU64(instruction.data, 1);
    if (amount === null) continue;
    outflows[mint] = Math.min(Number.MAX_SAFE_INTEGER, (outflows[mint] || 0) + amount);
  }
  return outflows;
}

/**
 * Конфиг для Age of Farming — безопасные программы игры.
 * The optional argument is retained for callers that pass one program ID;
 * the deployed six-program allowlist is always included.
 */
export function getAofGuardConfig(gameProgramId?: string): GuardConfig {
  const allowedPrograms = Array.from(new Set([
    ...AOF_PROGRAMS,
    ...(gameProgramId ? [gameProgramId] : []),
    ...Array.from(SAFE_PROGRAMS),
  ]));
  return {
    maxLamportsSpent: 500_000, // explicit direct SOL outflow, not a fee guess
    maxTokenOutflows: {},
    allowedPrograms,
    blockedPrograms: Array.from(KNOWN_SCAM_PROGRAMS),
    blockedAddresses: [],
  };
}
