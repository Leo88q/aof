/**
 * Mint-адреса всех ресурсов игры.
 * Загружаются динамически из /query/material-mints (блокчейн).
 * Если не задеплоен — используется fallback (пустые строки).
 */

import { api } from "./api";

type ResourceId = 
  | "SEEDS" | "WHEAT" | "FLOUR" | "BREAD" | "WOOD" | "STONE" | "COAL" 
  | "MEAT" | "WATER" | "FOOD"
  | "SAND_WHITE" | "SAND_PINK" | "SAND_YELLOW"
  | "STONE_BLUE" | "STONE_PURPLE" | "STONE_RED"
  | "GEM_BLUE" | "GEM_ORANGE" | "GEM_WHITE" | "GEM_GREEN"
  | "FLASK_BLUE" | "FLASK_YELLOW" | "FLASK_GREEN" | "FLASK_PINK" | "FLASK_PURPLE";

// Кэш mint-адресов
let mintCache: Partial<Record<ResourceId, string>> | null = null;
let mintPromise: Promise<Partial<Record<ResourceId, string>>> | null = null;

export async function loadMints(): Promise<Partial<Record<ResourceId, string>>> {
  if (mintCache) return mintCache;
  if (mintPromise) return mintPromise;
  
  mintPromise = (async () => {
    try {
      const data = await api.query.materialMints();
      if (data.initialized && data.mints && Object.keys(data.mints).length > 0) {
        mintCache = data.mints;
        console.log(`✅ Loaded ${Object.keys(data.mints).length} mints from chain`);
        return data.mints;
      }
      console.warn("⚠️ MaterialMints не инициализирован. Игра работает в демо-режиме.");
      console.warn("   Для полной работы нужно вызвать init_material_mints через admin endpoint.");
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

// Инструмент — нужен отдельный endpoint или хардкод
export const TOOL_MINT = "";  // TODO: загружать из toolsPda

// Предзагрузка при старте приложения
if (typeof window !== "undefined") {
  loadMints().catch(() => {});
}
