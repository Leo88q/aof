import { functionalStorage } from "../../legal/consent";
import { ActiveBuffs } from "../../components/ActiveBuffs";
import { useEffect, useState } from "react";
import { useNav } from "../../nav/NavContext";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { fetchWeatherSnapshot } from "../../lib/weather";
import { useStore } from "../../store/useStore";
import { Card } from "../../components/ui/Card";
import { useWalletStr } from "../../lib/useWalletStr";
import { FarmPlot } from "./FarmPlot";
import { WeatherWidget } from "../../components/ui/WeatherWidget";
import { InboxHome } from "../inbox/InboxHome";
import { CompendiumHome } from "../compendium/CompendiumHome";
import { OnboardingWizard } from "../onboarding/OnboardingWizard";
import { WellPanel } from "./WellPanel";
import { DrumSpin } from "../../components/DrumSpin";
import { NavHeader } from "../../components/NavHeader";
import { LotteryPage } from "../market/LotteryPage";
import { ExplorationPage } from "./ExplorationPage";
import { OvenPanel } from "./OvenPanel";
import { MillPanel } from "./MillPanel";
import { PlantingPanel } from "./PlantingPanel";
import { resourceIcon, UI_ICONS, toolPlate } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { LabResourcePanel, LabStateRow } from "../../components/farm/LabPanels";
import { buildingFor } from "../../lib/buildings";

export function FarmDashboard() {
  const walletAddr = useWalletStr();
  const { push } = useNav();
  const { user, setUser, weather, setWeather, energy, setEnergy } = useStore();
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [onboarded, setOnboarded] = useState(() => functionalStorage.getItem("aof_onboarded") === "1");
  const [subTab, setSubTab] = useState<SubTab>("dashboard");
  const [staked, setStaked] = useState<any[]>([]);

  type SubTab = "dashboard" | "well" | "plant" | "mill" | "oven";

  useEffect(() => {
    setUser(walletAddr);
    loadData();
  }, [walletAddr]);

  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener("aof:refresh", handler);
    return () => window.removeEventListener("aof:refresh", handler);
  }, []);

  async function loadData() {
    try {
      if (!walletAddr) {
        setWeather(null);
        setEnergy(null);
        setStaked([]);
        return;
      }
      const [weatherData, energyData, toolsData] = await Promise.all([
        // Один загрузчик для шапки, панели обзора и колодца: /weather/current,
        // при недоступности — чтение того же WeatherState PDA через /query.
        fetchWeatherSnapshot(),
        api.energy.balance(walletAddr).catch(() => null),
        api.query.myTools(walletAddr).catch(() => null),
      ]);
      setWeather(weatherData);
      setEnergy(energyData);
      const tools = Array.isArray(toolsData) ? toolsData : toolsData?.tools || [];
      setStaked(tools.filter((t: any) => t?.staked || t?.isMining));
    } catch (e) {
      console.error("Не удалось загрузить данные:", e);
    } finally {
      setLoading(false);
    }
  }

  if (!onboarded) {
    return (
      <OnboardingWizard
        onComplete={() => {
          functionalStorage.setItem("aof_onboarded", "1");
          setOnboarded(true);
        }}
      />
    );
  }

  const subTabs: { key: SubTab; label: string; icon: string }[] = [
    { key: "dashboard", label: "Обзор", icon: UI_ICONS.labOverview },
    { key: "well", label: "Сетевая станция", icon: UI_ICONS.gridStation },
    { key: "plant", label: "Посев", icon: UI_ICONS.plant },
    { key: "mill", label: "Переработка", icon: UI_ICONS.mill },
    { key: "oven", label: "Тренировка", icon: UI_ICONS.trainer },
  ];

  return (
    <div className="p-4 pt-6 pb-24">
      {/* Заголовок: сначала титул на всю ширину, затем ряд действий.
          Раньше титул, три кнопки и погодный чип делили одну строку и на 360–390px
          распирали её до 440px: чип уезжал за правый край экрана. */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <div className="flex items-center justify-center gap-2 mb-3">
          <ResourceGlyph icon={UI_ICONS.menuLab} alt="" className="w-6 h-6 shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold text-parchment leading-tight text-center">
            Нейро-лаборатория
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => push("farm", "drum", (<><NavHeader title="Квантовый барабан" tabKey="farm" /><DrumSpin /></>))}
            className="w-10 h-10 shrink-0 rounded-xl bg-soil-800 border border-straw/20 flex items-center justify-center hover:bg-soil-700 transition"
            title="Квантовый барабан"
            aria-label="Квантовый барабан"
          >
            <img src={UI_ICONS.drum} alt="" width={22} height={22} style={{ objectFit: "contain", display: "block" }} />
          </button>
          <button
            onClick={() => push("farm", "lottery", (<><NavHeader title="Лотерея" tabKey="farm" /><LotteryPage /></>))}
            className="w-10 h-10 shrink-0 rounded-xl bg-soil-800 border border-straw/20 flex items-center justify-center hover:bg-soil-700 transition"
            title="Лотерея"
            aria-label="Лотерея"
          >
            <img src={UI_ICONS.lottery} alt="" width={22} height={22} style={{ objectFit: "contain", display: "block" }} />
          </button>
          <button
            onClick={() => push("farm", "exploration", (<><NavHeader title="Экспедиция" tabKey="farm" /><ExplorationPage /></>))}
            className="w-10 h-10 shrink-0 rounded-xl bg-soil-800 border border-straw/20 flex items-center justify-center hover:bg-soil-700 transition"
            title="Экспедиция"
            aria-label="Экспедиция"
          >
            <img src={UI_ICONS.expedition} alt="" width={22} height={22} style={{ objectFit: "contain", display: "block" }} />
          </button>
          <div className="ml-auto min-w-0 flex-1 flex justify-end">
            <WeatherWidget compact />
          </div>
        </div>
      </motion.div>

      {/* Подвкладки: на узких экранах переносятся в две строки, ничего не прячем */}
      <div className="flex flex-wrap gap-1 bg-soil-800/50 p-1 rounded-lg mb-4">
        {subTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex-1 basis-[30%] min-w-0 px-2 py-1.5 rounded-md text-[11px] font-bold transition ${
              subTab === t.key
                ? "bg-sprout-600 text-parchment"
                : "text-straw hover:bg-soil-700"
            }`}
          >
            {t.icon.startsWith("/") ? (
              <img src={t.icon} alt="" className="inline-block w-4 h-4 object-contain align-text-bottom mr-1" />
            ) : (
              <span>{t.icon} </span>
            )}
            <span className="align-text-bottom">{t.label}</span>
          </button>
        ))}
      </div>

      {/* РЕНДЕР: ОБЗОР (оригинальный HomeDashboard) */}
      {subTab === "dashboard" && (
        <>
          <ActiveBuffs />

          <LabResourcePanel owner={walletAddr} refreshKey={refreshKey} />

          <LabStateRow owner={walletAddr} refreshKey={refreshKey} energy={energy} weather={weather} />

          <Card className="mb-4" onClick={() => push("farm", "farm", <FarmPlot />)}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-parchment">Твоя лаборатория →</h3>
              <span className="text-[11px] text-straw">
                {staked.length > 0 ? `построек: ${staked.length}` : "построек нет"}
              </span>
            </div>
            <div className="aspect-[16/9] bg-gradient-to-br from-wheat-800/60 via-soil-800 to-soil-850 rounded-2xl flex items-center justify-center relative overflow-hidden px-3">
              {staked.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {staked.slice(0, 6).map((t: any) => (
                    <div key={t.mint || t.toolType} className="flex flex-col items-center gap-1 w-[68px]">
                      <ResourceGlyph icon={buildingFor(t.toolType)?.icon} alt={buildingFor(t.toolType)?.name || ""} className="w-9 h-9" />
                      <span className="text-[9.5px] leading-tight text-straw text-center line-clamp-2">
                        {buildingFor(t.toolType)?.name || t.toolType}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center">
                  <span className="flex items-center justify-center gap-2">
                    <ResourceGlyph icon={buildingFor("plasma_cutter")?.icon} alt="" className="w-9 h-9" />
                    <ResourceGlyph icon={buildingFor("silicon_extractor")?.icon} alt="" className="w-9 h-9" />
                    <ResourceGlyph icon={buildingFor("data_harvester")?.icon} alt="" className="w-9 h-9" />
                    <ResourceGlyph icon={buildingFor("quantum_transmitter")?.icon} alt="" className="w-9 h-9" />
                  </span>
                  <p className="text-straw text-xs mt-2">
                    Поставь инструмент в стойку — на участке появится постройка
                  </p>
                </div>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <Card onClick={() => push("farm", "inbox", <InboxHome />)}>
              <div className="text-center py-1">
                <img src={UI_ICONS.inbox} alt="" className="w-8 h-8 object-contain mx-auto" />
                <p className="text-parchment text-sm font-semibold mt-1">Инбокс</p>
              </div>
            </Card>
            <Card onClick={() => push("farm", "compendium", <CompendiumHome />)}>
              <div className="text-center py-1">
                <img src={UI_ICONS.catalog} alt="" className="w-8 h-8 object-contain mx-auto" />
                <p className="text-parchment text-sm font-semibold mt-1">Каталог</p>
              </div>
            </Card>
          </div>

          <Card>
            <h3 className="text-sm font-semibold text-parchment mb-3">События</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <ResourceGlyph icon={resourceIcon("neuron") || ""} alt="" className="w-5 h-5" />
                <span className="text-straw">Нагрузка сегодня: {(({ sunny: "Номинал", rain: "Скачок", drought: "Блэкаут", festival: "Френзи" } as Record<string, string>)[weather?.type || ""] || weather?.type || "недоступна")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <ResourceGlyph icon={toolPlate("silicon_extractor") || ""} alt="" className="w-5 h-5" />
                <span className="text-straw">История добычи недоступна без канонического индексатора</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <ResourceGlyph icon={UI_ICONS.chartsUp} alt="" className="w-5 h-5" />
                <span className="text-straw">Рыночная динамика недоступна без проверенных ценовых данных</span>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* РЕНДЕР: КОЛОДЕЦ */}
      {subTab === "well" && <WellPanel />}

      {/* РЕНДЕР: ПОСАДКА */}
      {subTab === "plant" && <PlantingPanel />}

      {/* РЕНДЕР: МЕЛЬНИЦА */}
      {subTab === "mill" && <MillPanel />}

      {/* РЕНДЕР: ПЕЧЬ */}
      {subTab === "oven" && <OvenPanel />}

    </div>
  );
}
