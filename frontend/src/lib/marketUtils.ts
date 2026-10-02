import { useEffect, useRef, useState } from "react";
import { resourceIcon } from "./visualAssets";
import type { Language } from "../i18n/translations";
import { homeResourceNames } from "../i18n/homeDetail";
import { toolsCopy } from "../i18n/toolsCopy";
import { marketTimeCopy } from "../i18n/marketTimeCopy";
import { api } from "./api";

// Ресурсные минты (заданы /admin/set-resource-mints) + kind из контракта (ResourceKind)
export const RESOURCE_MINTS = [
  // [REBRAND] NeuroForge: keys = API-имена ресурсов (lowercase), kind = дискриминант ResourceKind
  { key: "data", mint: "", kind: 0, label: homeResourceNames.ru.data, icon: resourceIcon("DATA") || "" },
  { key: "circuit", mint: "", kind: 1, label: homeResourceNames.ru.circuit, icon: resourceIcon("CIRCUIT") || "" },
  { key: "silicon", mint: "", kind: 2, label: homeResourceNames.ru.silicon, icon: resourceIcon("SILICON") || "" },
  { key: "mind", mint: "", kind: 26, label: "MIND", icon: resourceIcon("MIND") || "" },
];

const IMG = {
  plasma_cutter: "/assets/nfts/plasma-cutter.jpg",
  silicon_extractor: "/assets/nfts/silicon-extractor.jpg",
  data_harvester: "/assets/nfts/data-harvester.jpg",
  quantum_transmitter: "/assets/nfts/quantum-transmitter.jpg",
  neural_seeder: "/assets/nfts/neural-seeder.jpg",
};
// Current NeuroForge tool art.
export const TOOL_ICONS: Record<string, string> = {
  plasma_cutter: IMG.plasma_cutter, silicon_extractor: IMG.silicon_extractor,
  data_harvester: IMG.data_harvester, quantum_transmitter: IMG.quantum_transmitter,
  neural_seeder: IMG.neural_seeder,
};

export const RARITY_LABEL: Record<string, string> = Object.fromEntries(
  ['common', 'uncommon', 'rare', 'epic', 'legendary'].map((key, index) =>
    [key, toolsCopy.ru.collectionPage.rarities[index]]),
);

// Предметный визуальный язык рынка (ТЗ v3 §0): редкость = цвет урожая
export const RARITY_COLOR: Record<string, string> = {
  common: "text-straw",
  uncommon: "text-sprout-500",
  rare: "text-info-500",
  epic: "text-accent-500",
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

export function fmtSol(lamports: any, language: Language = "ru"): string {
  const n = toNum(lamports);
  return (n / 1e9).toLocaleString(language, { maximumFractionDigits: 4 });
}

export function fmtNum(v: any, language: Language = "ru"): string {
  return toNum(v).toLocaleString(language);
}

export function shortAddr(a?: string | null): string {
  if (!a) return "—";
  return a.slice(0, 4) + "…" + a.slice(-4);
}

// Countdown to Unix seconds; callers must pass the active locale when rendering this text.
// The default preserves the old Russian format for any legacy callers.
export function timeLeftStr(untilSec: number, language: Language = "ru"): string {
  const s = Math.max(0, Math.floor(untilSec - Date.now() / 1000));
  const text = marketTimeCopy[language];
  if (s <= 0) return text.finished;
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return text.daysHours(d, h);
  if (h > 0) return text.hoursMinutes(h, m);
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
export function useFlash(language: Language): [string | null, (m: string, ms?: number) => void] {
  const [entry, setEntry] = useState<{ text: string; language: Language } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeLanguage = useRef(language);
  activeLanguage.current = language;

  useEffect(() => {
    setEntry(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [language]);

  const flash = (text: string, ms = 5000) => {
    // An async operation started under a previous locale must not publish its old copy.
    if (activeLanguage.current !== language) return;
    if (timer.current) clearTimeout(timer.current);
    setEntry({ text, language });
    timer.current = setTimeout(() => {
      timer.current = null;
      setEntry(null);
    }, ms);
  };
  return [entry?.language === language ? entry.text : null, flash];
}

export type TradeResource = { key: string; label: string; icon: string; mint: string; kind: number };

export const ALL_TRADE_RESOURCES: TradeResource[] = [
  // ResourceKind discriminants are kept in the same order as aof-core.
  { key: "DATA", label: homeResourceNames.ru.data, icon: resourceIcon("DATA") || "", mint: "", kind: 0 },
  { key: "CIRCUIT", label: homeResourceNames.ru.circuit, icon: resourceIcon("CIRCUIT") || "", mint: "", kind: 1 },
  { key: "SILICON", label: homeResourceNames.ru.silicon, icon: resourceIcon("SILICON") || "", mint: "", kind: 2 },
  { key: "NEURON", label: homeResourceNames.ru.neuron, icon: resourceIcon("NEURON") || "", mint: "", kind: 3 },
  { key: "SYNAPSE", label: homeResourceNames.ru.synapse, icon: resourceIcon("SYNAPSE") || "", mint: "", kind: 4 },
  { key: "SIGNAL", label: homeResourceNames.ru.signal, icon: resourceIcon("SIGNAL") || "", mint: "", kind: 5 },
  { key: "MODEL", label: homeResourceNames.ru.model, icon: resourceIcon("MODEL") || "", mint: "", kind: 6 },
  { key: "POWER", label: homeResourceNames.ru.power, icon: resourceIcon("POWER") || "", mint: "", kind: 7 },
  { key: "COMPUTE", label: homeResourceNames.ru.compute, icon: resourceIcon("COMPUTE") || "", mint: "", kind: 8 },
  { key: "DATASET", label: homeResourceNames.ru.dataset, icon: resourceIcon("DATASET") || "", mint: "", kind: 9 },
  { key: "BLUE_CORE", label: homeResourceNames.ru.blueCore, icon: resourceIcon("BLUE_CORE") || "", mint: "", kind: 10 },
  { key: "PURPLE_CORE", label: homeResourceNames.ru.purpleCore, icon: resourceIcon("PURPLE_CORE") || "", mint: "", kind: 11 },
  { key: "RED_CORE", label: homeResourceNames.ru.redCore, icon: resourceIcon("RED_CORE") || "", mint: "", kind: 12 },
  { key: "CLEAR_QUARTZ", label: homeResourceNames.ru.clearQuartz, icon: resourceIcon("CLEAR_QUARTZ") || "", mint: "", kind: 13 },
  { key: "ROSE_QUARTZ", label: homeResourceNames.ru.roseQuartz, icon: resourceIcon("ROSE_QUARTZ") || "", mint: "", kind: 14 },
  { key: "AMBER_QUARTZ", label: homeResourceNames.ru.amberQuartz, icon: resourceIcon("AMBER_QUARTZ") || "", mint: "", kind: 15 },
  { key: "QUANTUM_BIT", label: homeResourceNames.ru.quantumBit, icon: resourceIcon("QUANTUM_BIT") || "", mint: "", kind: 16 },
  { key: "NEURAL_CHIP", label: homeResourceNames.ru.neuralChip, icon: resourceIcon("NEURAL_CHIP") || "", mint: "", kind: 17 },
  { key: "PHOTON_BIT", label: homeResourceNames.ru.photonBit, icon: resourceIcon("PHOTON_BIT") || "", mint: "", kind: 18 },
  { key: "BIO_CHIP", label: homeResourceNames.ru.bioChip, icon: resourceIcon("BIO_CHIP") || "", mint: "", kind: 19 },
  { key: "CRYO_FLUID", label: homeResourceNames.ru.cryoFluid, icon: resourceIcon("CRYO_FLUID") || "", mint: "", kind: 20 },
  { key: "VOLT_FLUID", label: homeResourceNames.ru.voltFluid, icon: resourceIcon("VOLT_FLUID") || "", mint: "", kind: 21 },
  { key: "BIO_FLUID", label: homeResourceNames.ru.bioFluid, icon: resourceIcon("BIO_FLUID") || "", mint: "", kind: 22 },
  { key: "NANO_FLUID", label: homeResourceNames.ru.nanoFluid, icon: resourceIcon("NANO_FLUID") || "", mint: "", kind: 23 },
  { key: "QUANTUM_FLUID", label: homeResourceNames.ru.quantumFluid, icon: resourceIcon("QUANTUM_FLUID") || "", mint: "", kind: 24 },
  { key: "SOUL_CORE", label: homeResourceNames.ru.soulCore, icon: resourceIcon("SOUL_CORE") || "", mint: "", kind: 25 },
  { key: "MIND", label: homeResourceNames.ru.mind, icon: resourceIcon("MIND") || "", mint: "", kind: 26 },
];
