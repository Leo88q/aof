import { lazy } from "react";

// Каждая вкладка — отдельный чанк. Раньше все шесть экранов и их панели
// попадали в стартовый бандл: игрок скачивал игру целиком, чтобы увидеть
// одну лабораторию. Теперь первый экран приходит сразу, остальные —
// по намерению (наведение/фокус на кнопке вкладки) или при первом переходе.

const LOADERS = {
  farm: () => import("../pages/farm/FarmDashboard"),
  tools: () => import("../pages/tools/ToolsHome"),
  economy: () => import("../pages/economy"),
  market: () => import("../pages/market/MarketHome"),
  quests: () => import("../pages/quests/QuestsHome"),
  profile: () => import("../pages/profile/ProfileHome"),
};

export const TAB_VIEWS = {
  farm: lazy(() => LOADERS.farm().then((m) => ({ default: m.FarmDashboard }))),
  tools: lazy(() => LOADERS.tools().then((m) => ({ default: m.ToolsHome }))),
  economy: lazy(() => LOADERS.economy().then((m) => ({ default: m.EconomyHome }))),
  market: lazy(() => LOADERS.market().then((m) => ({ default: m.MarketHome }))),
  quests: lazy(() => LOADERS.quests().then((m) => ({ default: m.QuestsHome }))),
  profile: lazy(() => LOADERS.profile().then((m) => ({ default: m.ProfileHome }))),
};

export type TabViewKey = keyof typeof TAB_VIEWS;

const warmed = new Set<string>();

// Тот же модуль, что и у lazy() выше: подгрузка прогревает общий кеш загрузчика
// и не создаёт вторую копию кода. Сбой снимаем, чтобы повторное намерение
// попробовало ещё раз.
export function prefetchTab(tab: string) {
  if (warmed.has(tab)) return;
  const load = (LOADERS as Record<string, (() => Promise<unknown>) | undefined>)[tab];
  if (!load) return;
  warmed.add(tab);
  load().catch(() => warmed.delete(tab));
}
