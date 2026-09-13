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
  maxLamportsSpent?: number;            // Лимит SOL на fees (в lamports)
  maxTokenOutflows?: Record<string, number>; // Лимиты по токенам (в base units)
  allowedPrograms?: string[];           // Разрешённые program IDs
  blockedPrograms?: string[];           // Заблокированные program IDs
  blockedAddresses?: string[];          // Чёрный список адресов
}

// Program IDs Solana (известные безопасные)
const SAFE_PROGRAMS = new Set([
  "11111111111111111111111111111111",           // System Program
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // Token Program
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", // Associated Token
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",   // Token-2022
]);

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

    // 2. Анализируем логи симуляции
    const logs = simulation.value.logs || [];
    const programsInvoked = extractPrograms(logs);
    const lamportsSpent = estimateLamportsSpent(logs, user);
    const tokenOutflows = estimateTokenOutflows(logs, user);

    // 3. Проверка на заблокированные программы
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

    // 4. Проверка лимита SOL
    if (cfg.maxLamportsSpent && lamportsSpent > cfg.maxLamportsSpent) {
      risk = "HIGH";
      warnings.push(
        `⚠️ Высокая стоимость: ${(lamportsSpent / 1e9).toFixed(6)} SOL (лимит ${(cfg.maxLamportsSpent / 1e9).toFixed(6)})`
      );
    }

    // 5. Проверка лимитов токенов
    for (const [mint, amount] of Object.entries(tokenOutflows)) {
      const limit = cfg.maxTokenOutflows?.[mint];
      if (limit && amount > limit) {
        risk = "HIGH";
        warnings.push(
          `⚠️ Большое списание токена ${mint.slice(0, 8)}...: ${amount} (лимит ${limit})`
        );
      }
    }

    // 6. Проверка неизвестных программ (если список allowed задан)
    if (cfg.allowedPrograms && cfg.allowedPrograms.length > 0) {
      const unknownPrograms = programsInvoked.filter(
        (p) => !cfg.allowedPrograms!.includes(p) && !SAFE_PROGRAMS.has(p)
      );
      if (unknownPrograms.length > 0) {
        if (risk !== "HIGH") risk = "MEDIUM";
        warnings.push(
          `⚠️ Неизвестные программы: ${unknownPrograms.map((p) => p.slice(0, 8)).join(", ")}`
        );
      }
    }

    // 7. Если есть warnings но не HIGH — это MEDIUM
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
      warnings: ["Ошибка симуляции"],
    };
  }
}

/**
 * Извлекает program IDs из логов симуляции
 */
function extractPrograms(logs: string[]): string[] {
  const programs = new Set<string>();
  const programRegex = /Program ([A-Za-z1-9]{32,44}) invoke/;
  
  for (const log of logs) {
    const match = log.match(programRegex);
    if (match) {
      programs.add(match[1]);
    }
  }
  
  return Array.from(programs);
}

/**
 * Оценка потраченных lamports (грубая, из логов)
 */
function estimateLamportsSpent(logs: string[], user: PublicKey): number {
  let spent = 0;
  const userStr = user.toBase58();
  
  // Ищем transfers из user
  for (const log of logs) {
    if (log.includes("Transfer") && log.includes(userStr)) {
      // Парсим "Transfer: N lamports"
      const match = log.match(/(\d+) lamports/);
      if (match) {
        spent += parseInt(match[1], 10);
      }
    }
  }
  
  return spent;
}

/**
 * Оценка исходящих токенов (грубая, из логов)
 */
function estimateTokenOutflows(
  logs: string[],
  user: PublicKey
): Record<string, number> {
  const outflows: Record<string, number> = {};
  const userStr = user.toBase58();
  
  // Ищем "Transfer X tokens from Y to Z"
  for (const log of logs) {
    if (log.includes("Transfer") && log.includes("tokens")) {
      // TODO: улучшить парсинг (сейчас заглушка)
      // В реальном проде парсить account-ключи из инструкций
    }
  }
  
  return outflows;
}

/**
 * Конфиг для Age of Farming — безопасные программы игры
 */
export function getAofGuardConfig(gameProgramId: string): GuardConfig {
  return {
    maxLamportsSpent: 500_000, // 0.0005 SOL
    maxTokenOutflows: {
      // POTATO: максимум 10,000 за транзакцию
      // (mint address подставим когда узнаем)
    },
    allowedPrograms: [
      gameProgramId,
      ...Array.from(SAFE_PROGRAMS),
    ],
    blockedPrograms: Array.from(KNOWN_SCAM_PROGRAMS),
    blockedAddresses: [],
  };
}
