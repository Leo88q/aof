import { farmPlotCopy } from "../i18n/farmPlotCopy";
import { UI_ICONS } from "./visualAssets";

/**
 * Постройки участка по типу инструмента (ТЗ v4 §1: резчик — плазменный цех,
 * экстрактор — кремниевая шахта, передатчик — вышка данных, сеятель — посевная
 * станция).
 *
 * Живёт отдельно от FarmPlot: карточка обзора в лаборатории и сам участок
 * обязаны показывать одну и ту же постройку.
 */
export const BUILDINGS: Record<string, { icon: string; name: string; resource: string }> = {
  plasma_cutter: { icon: UI_ICONS.buildingPlasma, name: farmPlotCopy.ru.buildings.plasma_cutter, resource: "CIRCUIT" },
  silicon_extractor: { icon: UI_ICONS.buildingSilicon, name: farmPlotCopy.ru.buildings.silicon_extractor, resource: "SILICON" },
  data_harvester: { icon: UI_ICONS.buildingData, name: farmPlotCopy.ru.buildings.data_harvester, resource: "DATASET" },
  quantum_transmitter: { icon: UI_ICONS.buildingQuantum, name: farmPlotCopy.ru.buildings.quantum_transmitter, resource: "DATASET" },
  neural_seeder: { icon: UI_ICONS.buildingNeural, name: farmPlotCopy.ru.buildings.neural_seeder, resource: "NEURON" },
};

export function buildingFor(toolType?: string | null) {
  if (!toolType) return undefined;
  return BUILDINGS[String(toolType).toLowerCase()];
}
