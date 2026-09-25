import { ActiveBuffs } from "../../components/ActiveBuffs";
import { useEffect, useState } from "react";
import { useNav } from "../../nav/NavContext";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { useStore } from "../../store/useStore";
import { StatChip } from "../../components/ui/StatChip";
import { LiquidBar } from "../../components/ui/LiquidBar";
import { Card } from "../../components/ui/Card";
import { useWalletStr } from "../../lib/useWalletStr";
import { FarmPlot } from "./FarmPlot";
import { ResourceBar } from "../../components/ui/ResourceBar";
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

export function FarmDashboard() {
  const walletAddr = useWalletStr();
  const { push } = useNav();
  const { user, setUser, weather, setWeather, energy, setEnergy } = useStore();
  const [streak, setStreak] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem("aof_onboarded") === "1");
  const [subTab, setSubTab] = useState<SubTab>("dashboard");

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
        setStreak(null);
        return;
      }
      const [weatherData, energyData, streakData] = await Promise.all([
        api.weather.current().catch(() => null),
        api.energy.balance(walletAddr).catch(() => null),
        api.streaks.get(walletAddr).catch(() => null),
      ]);
      setWeather(weatherData);
      setEnergy(energyData);
      setStreak(streakData);
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
          localStorage.setItem("aof_onboarded", "1");
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
      {/* Заголовок */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-start mb-4"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => push("farm", "drum", (<><NavHeader title="Барабан урожая" tabKey="farm" /><DrumSpin /></>))}
            className="w-10 h-10 rounded-xl bg-soil-800 border border-straw/20 flex items-center justify-center text-xl hover:bg-soil-700 transition"
            title="Барабан урожая"
          >
            <img src={UI_ICONS.drum} alt="" width={22} height={22} style={{ objectFit: "contain", display: "block" }} />
          </button>
          <button
            onClick={() => push("farm", "lottery", (<><NavHeader title="Лотерея" tabKey="farm" /><LotteryPage /></>))}
            className="w-10 h-10 rounded-xl bg-soil-800 border border-straw/20 flex items-center justify-center text-xl hover:bg-soil-700 transition"
            title="Лотерея"
          >
            <img src={UI_ICONS.lottery} alt="" width={22} height={22} style={{ objectFit: "contain", display: "block" }} />
          </button>
          <button
            onClick={() => push("farm", "exploration", (<><NavHeader title="Экспедиция" tabKey="farm" /><ExplorationPage /></>))}
            className="w-10 h-10 rounded-xl bg-soil-800 border border-straw/20 flex items-center justify-center text-xl hover:bg-soil-700 transition"
            title="Экспедиция"
          >
            <img src={UI_ICONS.expedition} alt="" width={22} height={22} style={{ objectFit: "contain", display: "block" }} />
          </button>
        </div>
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-parchment">🧠 Нейро-лаборатория</h1>
          <p className="text-straw text-sm mt-1">С возвращением, оператор</p>
        </div>
        <WeatherWidget />
      </motion.div>

      {/* Подвкладки */}
      <div className="flex gap-1 bg-soil-800/50 p-1 rounded-lg mb-4 overflow-x-auto">
        {subTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex-1 min-w-max px-2 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${
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
            {t.label}
          </button>
        ))}
      </div>

      {/* РЕНДЕР: ОБЗОР (оригинальный HomeDashboard) */}
      {subTab === "dashboard" && (
        <>
          <ActiveBuffs />

          <ResourceBar owner={walletAddr} refreshKey={refreshKey} />

          <div className="grid grid-cols-3 gap-2 mb-4 mt-4">
            <StatChip icon={resourceIcon("POWER")} value="12.4" label="SOL газ" accent="gold" />
            <StatChip
              icon={resourceIcon("POWER")}
              value={energy && typeof energy.amount === "number" ? `${energy.amount}/${energy.cap ?? 100}` : "—"}
              label="Энергия"
              accent="water"
            />
            <StatChip icon={UI_ICONS.rewardDaily} value={streak && typeof streak.current !== "undefined" ? String(streak.current) : "—"} label="Стрик" accent="green" />
          </div>

          {energy && typeof energy.amount === "number" && typeof energy.cap === "number" && energy.cap > 0 && (
            <Card className="mb-4">
              <LiquidBar
                level={(energy.amount / energy.cap) * 100}
                color="#5ab0d6"
                label="Энергия"
                icon={resourceIcon("POWER")}
              />
            </Card>
          )}

          <Card className="mb-4" onClick={() => push("farm", "farm", <FarmPlot />)}>
            <h3 className="text-sm font-semibold text-parchment mb-3">Твоя лаборатория →</h3>
            <div className="aspect-video bg-gradient-to-br from-wheat-800/60 via-soil-800 to-soil-850 rounded-2xl flex items-center justify-center relative overflow-hidden">
              <div className="text-center">
                <span className="text-3xl tracking-widest">🌾 🪚 ⛏️ 🏹</span>
                <p className="text-straw text-xs mt-2">Визуализация построек из канонических инструментов</p>
              </div>
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
                <span>🌱</span>
                <span className="text-straw">Погода сегодня: {weather?.type || "недоступна"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span>⛏️</span>
                <span className="text-straw">История добычи недоступна без канонического индексатора</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span>📈</span>
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
