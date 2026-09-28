import { UI_ICONS } from "./visualAssets";

/**
 * Постройки участка по типу инструмента (ТЗ v4 §1: резчик — плазменный цех,
 * экстрактор — кремниевая шахта, передатчик — вышка данных, сеятель — посевная
 * станция). Legacy-id (axe/pick/spear/bow/reaper) указывают на те же постройки,
 * чтобы старые NFT не оставались без визуала.
 *
 * Живёт отдельно от FarmPlot: карточка обзора в лаборатории и сам участок
 * обязаны показывать одну и ту же постройку.
 */
export const BUILDINGS: Record<string, { icon: string; name: string; resource: string }> = {
  plasma_cutter: { icon: UI_ICONS.buildingPlasma, name: "Плазменный цех", resource: "CIRCUIT" },
  silicon_extractor: { icon: UI_ICONS.buildingSilicon, name: "Кремниевая шахта", resource: "SILICON" },
  data_harvester: { icon: UI_ICONS.buildingData, name: "Пост сбора данных", resource: "DATA" },
  quantum_transmitter: { icon: UI_ICONS.buildingQuantum, name: "Квантовая вышка", resource: "SIGNAL" },
  neural_seeder: { icon: UI_ICONS.buildingNeural, name: "Посевная станция", resource: "NEURON" },
  axe: { icon: UI_ICONS.buildingPlasma, name: "Плазменный цех", resource: "CIRCUIT" },
  pick: { icon: UI_ICONS.buildingSilicon, name: "Кремниевая шахта", resource: "SILICON" },
  spear: { icon: UI_ICONS.buildingData, name: "Пост сбора данных", resource: "DATA" },
  bow: { icon: UI_ICONS.buildingQuantum, name: "Квантовая вышка", resource: "SIGNAL" },
  reaper: { icon: UI_ICONS.buildingNeural, name: "Посевная станция", resource: "NEURON" },
};

export function buildingFor(toolType?: string | null) {
  if (!toolType) return undefined;
  return BUILDINGS[String(toolType).toLowerCase()];
}
