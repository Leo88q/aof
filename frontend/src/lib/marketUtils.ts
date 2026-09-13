import { useEffect, useState } from "react";
import { api } from "./api";

// Ресурсные минты (заданы /admin/set-resource-mints) + kind из контракта (ResourceKind)
export const RESOURCE_MINTS = [
  { key: "food", mint: "BTQKBbm5vVueo4ZYR34Abr5B3ftJZ1811HuSfcMFkhiu", kind: 0, label: "Зерно", icon: "🌾" },
  { key: "wood", mint: "CHj3wHZrtdQy7NTDoGGwA5XxuEogN5zstFwxVKBEwzUT", kind: 1, label: "Древесина", icon: "🪵" },
  { key: "stone", mint: "CgGcZfxJD2YYM3CsfPE5UNeGZnsqQLquCCbyx547skVi", kind: 2, label: "Камень", icon: "🪨" },
];

export const TOOL_ICONS: Record<string, string> = { axe: "🪓", pick: "⛏️", spear: "🗡️", bow: "🏹" };

export const RARITY_LABEL: Record<string, string> = {
  common: "Обычный", uncommon: "Необычный", rare: "Редкий", epic: "Эпический", legendary: "Легендарный",
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
  // === Базовые ресурсы ===
  { key: "FOOD",   label: "Зерно",      icon: "🌾", mint: "BTQKBbm5vVueo4ZYR34Abr5B3ftJZ1811HuSfcMFkhiu", kind: 0 },
  { key: "WOOD",   label: "Древесина",  icon: "🪵", mint: "CHj3wHZrtdQy7NTDoGGwA5XxuEogN5zstFwxVKBEwzUT", kind: 1 },
  { key: "STONE",  label: "Камень",     icon: "🪨", mint: "CgGcZfxJD2YYM3CsfPE5UNeGZnsqQLquCCbyx547skVi", kind: 2 },
  { key: "SEEDS",  label: "Семена",     icon: "🌰", mint: "", kind: 0 }, // TODO: подставить реальный mint
  { key: "WATER",  label: "Вода",       icon: "💧", mint: "" , kind: 0 },
  { key: "POTATO", label: "Картошка",   icon: "🥔", mint: "" , kind: 0 },
  
  // === Камни ===
  { key: "STONE_BLUE",   label: "Сапфир",         icon: "🔵", mint: "" , kind: 0 },
  { key: "STONE_PURPLE", label: "Аметист",        icon: "🟣", mint: "" , kind: 0 },
  { key: "STONE_RED",    label: "Рубин",          icon: "🔴", mint: "" , kind: 0 },
  
  // === Песок ===
  { key: "SAND_WHITE",  label: "Кварцевый песок", icon: "⚪", mint: "" , kind: 0 },
  { key: "SAND_PINK",   label: "Розовый песок",   icon: "💗", mint: "" , kind: 0 },
  { key: "SAND_YELLOW", label: "Янтарный песок",  icon: "🟡", mint: "" , kind: 0 },
  
  // === Гемы ===
  { key: "GEM_BLUE",   label: "Сапфировый гем",  icon: "💎", mint: "" , kind: 0 },
  { key: "GEM_ORANGE", label: "Янтарный гем",    icon: "🟠", mint: "" , kind: 0 },
  { key: "GEM_WHITE",  label: "Кварцевый гем",   icon: "⚪", mint: "" , kind: 0 },
  { key: "GEM_GREEN",  label: "Изумрудный гем",  icon: "🟢", mint: "" , kind: 0 },
  
  // === Хлебная цепочка ===
  { key: "WHEAT", label: "Пшеница", icon: "🌾", mint: "" , kind: 0 },
  { key: "FLOUR", label: "Мука",    icon: "🥣", mint: "" , kind: 0 },
  { key: "BREAD", label: "Хлеб",    icon: "🍞", mint: "" , kind: 0 },
  
  // === Прочее ===
  { key: "COAL", label: "Уголь", icon: "⬛", mint: "" , kind: 0 },
  { key: "MEAT", label: "Мясо",  icon: "🍖", mint: "" , kind: 0 },
  
  // === Флаконы ===
];
