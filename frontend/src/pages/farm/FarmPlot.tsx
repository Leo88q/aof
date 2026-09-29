import { readMiningEnabled, useMiningAvailability } from "../../lib/useMiningAvailability";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../i18n/LocaleProvider";
import { farmPlotCopy, buildingKeys } from "../../i18n/farmPlotCopy";
import { toolsCopy } from "../../i18n/toolsCopy";
import { labHeroCopy } from "../../i18n/labHeroCopy";
import { WEATHER_BY_INDEX } from "../../lib/weather";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { actionErrorFeedback } from "../../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../../i18n/walletRuntimeCopy";
import { useWalletStore } from "../../store/walletStore";
import { useStore } from "../../store/useStore";
import { Card } from "../../components/ui/Card";
import { RARITY_META, rarityKey } from "../../lib/toolMeta";
import { toolPlate, resourceIcon, TOOL_RARITIES, type ToolRarity } from "../../lib/visualAssets";
import { UI_ICONS } from "../../lib/visualAssets";
import { buildingFor } from "../../lib/buildings";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { WeatherOverlay } from "../../components/farm/WeatherOverlay";
import { toNum, useFlash } from "../../lib/marketUtils";
import { NoticeMsg } from "../../components/visual/NoticeMsg";

const GRID = 8;
// Structure positions on the plot.
const SLOTS = [
  { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 4 },
  { x: 2, y: 2 }, { x: 5, y: 2 }, { x: 2, y: 5 }, { x: 5, y: 5 },
  { x: 1, y: 3 }, { x: 6, y: 3 }, { x: 3, y: 1 }, { x: 4, y: 6 },
];

export function FarmPlot() {
  const { language } = useLocale();
  const copy = farmPlotCopy[language];
  const conditions = labHeroCopy[language].load;
  const buildingName = (type?: string | null) => {
    const key = type && buildingKeys[type.toLowerCase()];
    return key ? copy.buildings[key] : copy.building;
  };
  const rarityLabel = (value: unknown) => {
    const index = TOOL_RARITIES.indexOf(rarityKey(value) as ToolRarity);
    return index < 0 ? toolsCopy[language].card.unknownRarity : toolsCopy[language].collectionPage.rarities[index];
  };
  const MINING_ENABLED = useMiningAvailability();
  const { address } = useWalletStore();
  const { weather } = useStore() as any;
  // null = инвентарь не прочитан (загрузка или 503), [] = пусто по-настоящему.
  const [tools, setTools] = useState<any[] | null>(null);
  const [toolsFailed, setToolsFailed] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [txStatus, flash] = useFlash(language);

  const load = useCallback(() => {
    if (!address) return;
    api.query.myTools(address)
      .then((r: any) => {
        setTools(Array.isArray(r) ? r : r?.tools || []);
        setToolsFailed(false);
      })
      .catch(() => {
        setTools(null);
        setToolsFailed(true);
      });
  }, [address]);

  useEffect(() => {
    if (!address) { setTools(null); setSelected(null); setToolsFailed(false); }
    else load();
  }, [address, load]);

  const staked = (tools ?? []).filter((t) => t.staked || t.isMining);
  const freeCount = (tools ?? []).length - staked.length;
  const weatherType = weather?.type === "harvest_festival" ? "festival" : weather?.type;
  const weatherState = Object.values(WEATHER_BY_INDEX).find((value) => value.type === weatherType);
  const weatherLabel = weatherState ? conditions[weatherState.type] : copy.unknownLoad;
  const weatherEffect = weatherState ? (weatherState.rate ? copy.powerGain(weatherState.rate) : copy.powerStopped) : '';

  // Карта тайлов: постройки из реальных застейканных инструментов + декор
  const tileMap = new Map<string, any>();
  staked.slice(0, SLOTS.length).forEach((t, i) => {
    tileMap.set(`${SLOTS[i].x}-${SLOTS[i].y}`, t);
  });

  async function quick(action: "start" | "collect") {
    if (!MINING_ENABLED || !await readMiningEnabled()) return flash(copy.disabled);
    if (!address) return flash(`❌ ${copy.connectWallet}`);
    if (!selected) return;
    setBusy(true);
    try {
      flash(action === "start" ? copy.starting : copy.opening);
      const resp = action === "start"
        ? await api.tools.startMining({ user: address, mint: selected.mint, hours: 4 })
        : await api.tools.collectMining({ user: address, mint: selected.mint });
      const r = await handleTxResponse(resp);
      flash(r.success ? (r.signature ? `${copy.completed}: ${r.signature.slice(0, 10)}…` : copy.completed) : (r.error || copy.failed));
      if (r.success) {
        setSelected(null);
        setTimeout(load, 2500);
      }
    } catch (e: any) {
      flash(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 pt-6 pb-24" lang={language}>
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-parchment leading-tight">{copy.title}</h1>
        <p className="text-straw text-[11px] mt-0.5">{copy.lead}</p>
      </div>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment mb-3">
          <NoticeMsg text={txStatus} />
        </motion.div>
      )}

      {/* Участок */}
      <Card className="relative overflow-hidden mb-4">
        {weatherState && <WeatherOverlay type={weatherState.type} />}
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}>
          {Array.from({ length: GRID * GRID }).map((_, i) => {
            const x = i % GRID;
            const y = Math.floor(i / GRID);
            const tool = tileMap.get(`${x}-${y}`);
            const locked = x === GRID - 1 && y === GRID - 1;
            const decor = !tool && !locked && (x * 7 + y * 3) % 9 === 0;
            const done = tool?.isMining && toNum(tool.miningEnd) <= Date.now() / 1000;
            return (
              <button key={i} type="button" disabled={!tool} aria-label={tool ? buildingName(tool.toolType) : locked ? copy.expansion : copy.emptySlot} onClick={() => tool && setSelected(tool)}
                className={`aspect-square rounded-md flex items-center justify-center text-base sm:text-lg border ${
                  tool
                    ? done ? "bg-gold/20 border-gold/50" : "bg-soil-600/70 border-wheat-600/30"
                    : locked
                      ? "bg-soil-900/80 border-soil-800"
                      : decor
                        ? "bg-sprout-700/20 border-sprout-600/10"
                        : "bg-soil-700/40 border-transparent"
                } ${tool ? "cursor-pointer" : "cursor-default"}`}>
                {tool ? (
                  <span className="relative inline-flex items-center justify-center">
                    {/* На участке показываем постройку, а не сырой инструмент:
                        обрезанная иконка постройки читается на 40px, тогда как
                        квадратная плашка NFT в тайле выглядела как чёрный ящик. */}
                    <ResourceGlyph
                      icon={buildingFor(tool.toolType)?.icon || toolPlate(tool.toolType, rarityKey(tool.rarity))}
                      alt=""
                      className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_0_6px_rgba(0,212,255,0.35)]"
                    />
                    {tool.isMining && !done && (
                      <span className="absolute -top-2 -right-2 animate-pulse"><ResourceGlyph icon={UI_ICONS.adminGear} alt="" className="w-3.5 h-3.5" /></span>
                    )}
                    {done && <span className="absolute -top-2 -right-2"><ResourceGlyph icon={UI_ICONS.noticeSuccess} alt="" className="w-3.5 h-3.5" /></span>}
                  </span>
                ) : locked ? <ResourceGlyph icon={UI_ICONS.privileges} alt="" className="w-5 h-5" /> : decor ? <ResourceGlyph icon={resourceIcon("synapse") || ""} alt="" className="w-5 h-5" /> : ""}
              </button>
            );
          })}
        </div>
        {/* Легенда: переносится по строкам, ничего не выезжает за карточку */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-straw mt-3 text-center">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
            <ResourceGlyph icon={buildingFor("plasma_cutter")?.icon} alt="" className="w-4 h-4" />
            <ResourceGlyph icon={buildingFor("silicon_extractor")?.icon} alt="" className="w-4 h-4" />
            {copy.legendBuilding}
          </span>
          <span className="inline-flex min-w-0 flex-wrap items-center gap-1"><ResourceGlyph icon={UI_ICONS.adminGear} alt="" className="w-4 h-4" /> {copy.mining}</span>
          <span className="inline-flex min-w-0 flex-wrap items-center gap-1"><ResourceGlyph icon={UI_ICONS.privileges} alt="" className="w-4 h-4" /> {copy.expansion}</span>
        </div>
      </Card>

      {/* Погода */}
      {weather && typeof weather.type === "string" && (
        <Card className="mb-4 flex items-center gap-3">
          <span className="text-2xl">
            {weatherState && <ResourceGlyph
              icon={weatherState?.type === "rain" ? UI_ICONS.weatherSurge
                : weatherState?.type === "sunny" ? UI_ICONS.weatherNominal
                : weatherState?.type === "festival" ? UI_ICONS.weatherFrenzy
                : UI_ICONS.weatherBlackout}
              alt=""
              className="w-8 h-8"
            />}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-parchment">{weatherLabel}</p>
            <p className="text-xs text-straw">{weatherEffect}</p>
          </div>
        </Card>
      )}

      {/* Сводка */}
      <Card className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-parchment text-sm font-semibold">
            {copy.structures}: {!address || toolsFailed ? "—" : tools === null ? "…" : staked.length}
          </p>
          <p className="text-straw text-xs">
            {!address ? copy.connectWallet : tools === null
              ? toolsFailed ? copy.toolsUnknown : copy.toolsLoading
              : `${copy.freeTools}: ${freeCount}`}
          </p>
        </div>
        <span className="text-2xl"><ResourceGlyph icon={UI_ICONS.locServerRuins} alt="" className="w-8 h-8" /></span>
      </Card>

      {/* Bottom sheet по тапу на постройку */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
            className="fixed bottom-20 left-0 right-0 max-w-md mx-auto px-4 z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto">
            <Card className="bg-soil-900/95 backdrop-blur-xl border border-soil-700">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-parchment font-semibold flex items-center gap-2 min-w-0 [overflow-wrap:anywhere]">
                  <ArtPlate src={toolPlate(selected.toolType, rarityKey(selected.rarity))} alt="" size={36} />
                  {buildingName(selected.toolType)}
                </h3>
                <button type="button" onClick={() => setSelected(null)} aria-label={copy.close} className="text-straw px-2">✕</button>
              </div>
              <p className="text-xs mb-1" style={{ color: RARITY_META[rarityKey(selected.rarity)]?.color }}>
                {rarityLabel(selected.rarity)} · {copy.durability} {Number(selected.durability)}/20
              </p>
              {selected.isMining ? (
                toNum(selected.miningEnd) <= Date.now() / 1000 ? (
                  <button onClick={() => quick("collect")} disabled={!MINING_ENABLED || busy}
                    className="w-full mt-2 py-2.5 rounded-xl bg-soil-800 text-straw font-bold text-sm disabled:opacity-60 cursor-not-allowed">
                    {MINING_ENABLED ? copy.collect : copy.collectDisabled}
                  </button>
                ) : (
                  <p className="text-straw text-xs mt-1 inline-flex items-center gap-1"><ResourceGlyph icon={toolPlate("silicon_extractor") || ""} alt="" className="w-4 h-4" /> {copy.miningInProgress}</p>
                )
              ) : (
                <button onClick={() => quick("start")} disabled={!MINING_ENABLED || busy || Number(selected.durability) < 1}
                  className="w-full mt-2 py-2.5 rounded-xl bg-soil-800 text-straw font-semibold text-sm disabled:opacity-60 cursor-not-allowed">
                  {MINING_ENABLED ? copy.start : copy.startDisabled}
                </button>
              )}
              {!MINING_ENABLED && (
                <p className="text-straw text-[10px] mt-2 text-center leading-relaxed">
                  {copy.disabledNote}
                </p>
              )}
              <p className="text-straw text-xs mt-2 text-center">{copy.fineTuning}</p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
