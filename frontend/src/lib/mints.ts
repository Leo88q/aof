/**
 * Mint-адреса всех ресурсов игры.
 * Загружаются динамически из /query/material-mints (канонический блокчейн).
 * При неполном или неподтверждённом registry операции блокируются, без fallback-адресов.
 */

import { PublicKey } from "@solana/web3.js";
import { api } from "./api";

type ResourceId = 
  | "NEURON" | "SYNAPSE" | "SIGNAL" | "MODEL" | "CIRCUIT" | "SILICON" | "COMPUTE" 
  | "DATASET" | "POWER" | "DATA" | "MIND"
  | "CLEAR_QUARTZ" | "ROSE_QUARTZ" | "AMBER_QUARTZ"
  | "BLUE_CORE" | "PURPLE_CORE" | "RED_CORE"
  | "QUANTUM_BIT" | "NEURAL_CHIP" | "PHOTON_BIT" | "BIO_CHIP"
  | "CRYO_FLUID" | "VOLT_FLUID" | "BIO_FLUID" | "NANO_FLUID" | "QUANTUM_FLUID" | "SOUL_CORE";

const CANONICAL_RESOURCE_IDS: readonly ResourceId[] = [
  "DATA", "CIRCUIT", "SILICON", "MIND", "NEURON", "SYNAPSE", "SIGNAL", "MODEL",
  "POWER", "COMPUTE", "DATASET", "BLUE_CORE", "PURPLE_CORE", "RED_CORE",
  "CLEAR_QUARTZ", "ROSE_QUARTZ", "AMBER_QUARTZ", "QUANTUM_BIT", "NEURAL_CHIP",
  "PHOTON_BIT", "BIO_CHIP", "CRYO_FLUID", "VOLT_FLUID", "BIO_FLUID",
  "NANO_FLUID", "QUANTUM_FLUID", "SOUL_CORE",
];

function isCompleteCanonicalRegistry(value: unknown): value is Record<ResourceId, string> {
  if (!value || typeof value !== "object") return false;
  const mints = value as Record<string, unknown>;
  const keys = Object.keys(mints).sort();
  const expected = [...CANONICAL_RESOURCE_IDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return false;
  return CANONICAL_RESOURCE_IDS.every((key) => {
    const address = mints[key];
    if (typeof address !== "string" || address.length === 0) return false;
    try {
      return !new PublicKey(address).equals(PublicKey.default);
    } catch {
      return false;
    }
  });
}

// Кэш mint-адресов. Empty strings are never valid resource configuration.
let mintCache: Partial<Record<ResourceId, string>> | null = null;
let mintPromise: Promise<Partial<Record<ResourceId, string>>> | null = null;

export async function loadMints(): Promise<Partial<Record<ResourceId, string>>> {
  if (mintCache) return mintCache;
  if (mintPromise) return mintPromise;
  
  mintPromise = (async () => {
    try {
      const data = await api.query.materialMints();
      if (data && data.initialized === true && isCompleteCanonicalRegistry(data.mints)) {
        mintCache = data.mints;
        console.log(`✅ Loaded ${Object.keys(data.mints).length} canonical mints from chain`);
        return data.mints;
      }
      console.warn("⚠️ Canonical resource registry is incomplete or invalid. Игровые операции недоступны.");
      return {};
    } catch (e) {
      console.error("❌ Failed to load mints:", e);
      return {};
    } finally {
      mintPromise = null;
    }
  })();
  
  return mintPromise;
}

export function getMint(resourceId: ResourceId): string {
  return mintCache?.[resourceId] || "";
}

export async function getMintAsync(resourceId: ResourceId): Promise<string> {
  const mints = await loadMints();
  const mint = mints[resourceId];
  if (!mint) {
    console.warn(`⚠️ Mint ${resourceId} не найден. Контракт не инициализирован.`);
  }
  return mint || "";
}

/**
 * Проверка: контракт инициализирован?
 */
export async function isContractInitialized(): Promise<boolean> {
  const mints = await loadMints();
  return Object.keys(mints).length > 0;
}

// Удобные геттеры
export const RESOURCE_MINTS = new Proxy({} as Record<ResourceId, string>, {
  get: (_, prop: string) => {
    const value = mintCache?.[prop as ResourceId];
    if (!value) {
      console.warn(`⚠️ Mint для ${prop} не загружен. Вызовите loadMints() или используйте getMintAsync()`);
      return "";
    }
    return value;
  },
});

// Предзагрузка при старте приложения
if (typeof window !== "undefined") {
  loadMints().catch(() => {});
}
