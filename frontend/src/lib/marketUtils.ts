import { useEffect, useState } from "react";
import { api } from "./api";

// Ресурсные минты (заданы /admin/set-resource-mints) + kind из контракта (ResourceKind)
export const RESOURCE_MINTS = [
  // [REBRAND] NeuroForge: keys = API-имена ресурсов (lowercase), kind = дискриминант ResourceKind
  { key: "data", mint: "", kind: 0, label: "Данные", icon: "📊" },
  { key: "circuit", mint: "", kind: 1, label: "Схема", icon: "🔌" },
  { key: "silicon", mint: "", kind: 2, label: "Кремний", icon: "🧱" },
  { key: "mind", mint: "", kind: 26, label: "MIND", icon: "🧠" },
];

const IMG = {
  plasma_cutter: "/assets/nfts/plasma-cutter.png",
  silicon_extractor: "/assets/nfts/silicon-extractor.png",
  data_harvester: "/assets/nfts/data-harvester.png",
  quantum_transmitter: "/assets/nfts/quantum-transmitter.png",
  neural_seeder: "/assets/nfts/neural-seeder.png",
};
// [REBRAND] NeuroForge tool art; legacy pre-rebrand ids alias to the same images.
export const TOOL_ICONS: Record<string, string> = {
  plasma_cutter: IMG.plasma_cutter, silicon_extractor: IMG.silicon_extractor,
  data_harvester: IMG.data_harvester, quantum_transmitter: IMG.quantum_transmitter,
  neural_seeder: IMG.neural_seeder,
  axe: IMG.plasma_cutter, pick: IMG.silicon_extractor, spear: IMG.data_harvester,
  bow: IMG.quantum_transmitter, reaper: IMG.neural_seeder,
};

export const RARITY_LABEL: Record<string, string> = {
  common: "Базовый", uncommon: "Усиленный", rare: "Квантовый", epic: "Сингулярность", legendary: "Трансцендентный",
};

// Предметный визуальный язык рынка (ТЗ v3 §0): редкость = цвет урожая
export const RARITY_COLOR: Record<string, string> = {
  common: "text-straw",
  uncommon: "text-sprout-500",
  rare: "text-water-500",
  epic: "text-wheat-500",
  legendary: "text-gold",
};

export function rarityKey(r: any): string {
  if (typeof r === "string") return r.toLowerCase();
  if (r && typeof r === "object") return (Object.keys(r)[0] || "common").toLowerCase();
  return "common";
}

// BN/число/строка → number
export function toNum(v: any): number {
  const n = Number(v?.toString?.() ?? v ?? 0);
  return isFinite(n) ? n : 0;
}

export function fmtSol(lamports: any): string {
  const n = toNum(lamports);
  return (n / 1e9).toLocaleString("ru-RU", { maximumFractionDigits: 4 });
}

export function fmtNum(v: any): string {
  return toNum(v).toLocaleString("ru-RU");
}

export function shortAddr(a?: string | null): string {
  if (!a) return "—";
  return a.slice(0, 4) + "…" + a.slice(-4);
}

// Обратный отсчёт до unix-секунд
export function timeLeftStr(untilSec: number): string {
  const s = Math.max(0, Math.floor(untilSec - Date.now() / 1000));
  if (s <= 0) return "завершён";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}д ${h}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Казна из ончейн-конфига (нужна для buy/settle/accept/лотереи/матчинга)
export function useTreasury(): string | null {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    api.query.config().then((c: any) => setT(c?.treasury ?? null)).catch(() => {});
  }, []);
  return t;
}

// Тикающее "сейчас" для обратных отсчётов
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// Вспышка статуса транзакции (единый паттерн с HotMarket)
export function useFlash(): [string | null, (m: string, ms?: number) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (m: string, ms = 5000) => {
    setMsg(m);
    setTimeout(() => setMsg(null), ms);
  };
  return [msg, flash];
}

export type TradeResource = { key: string; label: string; icon: string; mint: string; kind: number };

export const ALL_TRADE_RESOURCES: TradeResource[] = [
  // ResourceKind discriminants are kept in the same order as aof-core.
  { key: "DATA", label: "Данные", icon: "📊", mint: "", kind: 0 },
  { key: "CIRCUIT", label: "Схема", icon: "🔌", mint: "", kind: 1 },
  { key: "SILICON", label: "Кремний", icon: "🧱", mint: "", kind: 2 },
  { key: "NEURON", label: "Нейрон", icon: "⚡", mint: "", kind: 3 },
  { key: "SYNAPSE", label: "Синапс", icon: "🔗", mint: "", kind: 4 },
  { key: "SIGNAL", label: "Сигнал", icon: "📡", mint: "", kind: 5 },
  { key: "MODEL", label: "Модель", icon: "🤖", mint: "", kind: 6 },
  { key: "POWER", label: "Энергопоток", icon: "🔋", mint: "", kind: 7 },
  { key: "COMPUTE", label: "Вычислительный цикл", icon: "💻", mint: "", kind: 8 },
  { key: "DATASET", label: "Датасет", icon: "🗂️", mint: "", kind: 9 },
  { key: "BLUE_CORE", label: "Синее ядро", icon: "🔵", mint: "", kind: 10 },
  { key: "PURPLE_CORE", label: "Фиолетовое ядро", icon: "🟣", mint: "", kind: 11 },
  { key: "RED_CORE", label: "Красное ядро", icon: "🔴", mint: "", kind: 12 },
  { key: "CLEAR_QUARTZ", label: "Чистый кварц", icon: "⚪", mint: "", kind: 13 },
  { key: "ROSE_QUARTZ", label: "Розовый кварц", icon: "🩷", mint: "", kind: 14 },
  { key: "AMBER_QUARTZ", label: "Янтарный кварц", icon: "🟡", mint: "", kind: 15 },
  { key: "QUANTUM_BIT", label: "Квантовый бит", icon: "💎", mint: "", kind: 16 },
  { key: "NEURAL_CHIP", label: "Нейрочип", icon: "🟠", mint: "", kind: 17 },
  { key: "PHOTON_BIT", label: "Фотонный бит", icon: "✨", mint: "", kind: 18 },
  { key: "BIO_CHIP", label: "Биочип", icon: "🟢", mint: "", kind: 19 },
  { key: "CRYO_FLUID", label: "Крио-флюид", icon: "🧊", mint: "", kind: 20 },
  { key: "VOLT_FLUID", label: "Вольт-флюид", icon: "🌩️", mint: "", kind: 21 },
  { key: "BIO_FLUID", label: "Био-флюид", icon: "🧬", mint: "", kind: 22 },
  { key: "NANO_FLUID", label: "Нано-флюид", icon: "⚛️", mint: "", kind: 23 },
  { key: "QUANTUM_FLUID", label: "Квантовый флюид", icon: "🌀", mint: "", kind: 24 },
  { key: "SOUL_CORE", label: "Ядро души", icon: "❤️", mint: "", kind: 25 },
  { key: "MIND", label: "MIND", icon: "🧠", mint: "", kind: 26 },
];
