import { functionalStorage } from "../../legal/consent";
import { ActiveBuffs } from "../../components/ActiveBuffs";
import { useEffect, useState } from "react";
import { useNav } from "../../nav/NavContext";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { fetchWeatherSnapshot } from "../../lib/weather";
import { useStore } from "../../store/useStore";
import { Card } from "../../components/ui/Card";
import { Key } from "../../ui/forge/kit";
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
import { UI_ICONS } from "../../lib/visualAssets";
import { LabHero } from "../../components/farm/LabHero";
import { buildingFor } from "../../lib/buildings";
import { EchoTrace, PlateGrid } from "../../ui/forge/devices";
import { Note, Panel, Row, Rows, Sticker } from "../../ui/forge/kit";

/** Пустой микропланшет: все лунки свободны — состояние участка без инструментов. */
function emptyPlateWells(rows: number, cols: number) {
  const out: Array<{ r: number; c: number; state: "empty" }> = [];
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) out.push({ r, c, state: "empty" });
  return out;
}

export function FarmDashboard() {
  const walletAddr = useWalletStr();
  const { push } = useNav();
  const { user, setUser, weather, setWeather, energy, setEnergy } = useStore();
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [onboarded, setOnboarded] = useState(() => functionalStorage.getItem("aof_onboarded") === "1");
  const [subTab, setSubTab] = useState<SubTab>("dashboard");
  // null = неизвестно (загрузка или сбой /query/my-tools), [] = реально пусто.
  const [staked, setStaked] = useState<any[] | null>(null);
  const [toolsFailed, setToolsFailed] = useState(false);

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
        setStaked(null);
        setToolsFailed(false);
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
      if (toolsData == null) {
        // Ошибка чтения инвентаря — неизвестно, а не «ноль построек».
        setStaked(null);
        setToolsFailed(true);
      } else {
        const tools = Array.isArray(toolsData) ? toolsData : toolsData?.tools || [];
        setStaked(tools.filter((t: any) => t?.staked || t?.isMining));
        setToolsFailed(false);
      }
    } catch (e) {
      console.error("Не удалось загрузить данные:", e);
      setStaked(null);
      setToolsFailed(true);
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

  // К7 · микропланшет участка: 48 лунок-мест, занятые берутся из реального
  // списка инструментов (/query/my-tools). Ничего не выдумываем: если список
  // неизвестен, прибор не рисуется вовсе — экран скажет об этом словами.
  const PLATE_COLS = 8;
  const plateWells = (staked ?? []).slice(0, 48).map((t: any, i: number) => ({
    r: Math.floor(i / PLATE_COLS),
    c: i % PLATE_COLS,
    state: (t?.isMining || t?.mining ? "g" : "q") as "g" | "q",
    level: t?.isMining || t?.mining ? 1 : undefined,
    title: buildingFor(t.toolType)?.name || t.toolType || "инструмент",
  }));

  const subTabs: { key: SubTab; label: string; icon: string }[] = [
    { key: "dashboard", label: "Обзор", icon: UI_ICONS.labOverview },
    { key: "well", label: "Сетевая станция", icon: UI_ICONS.gridStation },
    { key: "plant", label: "Культивация", icon: UI_ICONS.plant },
    { key: "mill", label: "Сепарация", icon: UI_ICONS.mill },
    { key: "oven", label: "Обучение", icon: UI_ICONS.trainer },
  ];

  return (
    <div className="px-4 pt-5">
      {/* Заголовок: сначала титул на всю ширину, затем ряд действий.
          Раньше титул, три кнопки и погодный чип делили одну строку и на 360–390px
          распирали её до 440px: чип уезжал за правый край экрана. */}
      {/* Подвкладки: на узких экранах переносятся в две строки, ничего не прячем */}
      <div className="sub-tabs mb-4">
        {subTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            className={"sub-tab-btn" + (subTab === t.key ? " active" : "")}
            aria-current={subTab === t.key ? "page" : undefined}
          >
            {t.icon.startsWith("/") ? (
              <>
                <img src={t.icon} alt="" className="sub-tab-icon" width={15} height={15} style={{ objectFit: "contain" }} />
                {t.label}
              </>
            ) : (
              t.label
            )}
          </button>
        ))}
      </div>

      {/* РЕНДЕР: ОБЗОР (оригинальный HomeDashboard) */}
      {subTab === "dashboard" && (
        <>
          <ActiveBuffs />

          <LabHero
            owner={walletAddr}
            refreshKey={refreshKey}
            energy={energy}
            weather={weather}
            staked={staked}
            toolsFailed={toolsFailed}
            actions={
              <>
                <Key onClick={() => push("farm", "exploration", (<><NavHeader title="Экспедиция" tabKey="farm" /><ExplorationPage /></>))}>
                  Экспедиция
                </Key>
                <Key onClick={() => push("farm", "drum", (<><NavHeader title="Квантовый барабан" tabKey="farm" /><DrumSpin /></>))}>
                  Барабан
                </Key>
                <Key onClick={() => push("farm", "lottery", (<><NavHeader title="Лотерея" tabKey="farm" /><LotteryPage /></>))}>
                  Лотерея
                </Key>
                <WeatherWidget compact />
              </>
            }
          />

          <Card className="mb-4" onClick={() => push("farm", "farm", <FarmPlot />)}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-parchment">Участок →</h3>
              <span className="text-[11px] text-straw">
                {staked === null
                  ? toolsFailed ? "построек: —" : "построек: …"
                  : staked.length > 0 ? `построек: ${staked.length}` : "построек нет"}
              </span>
            </div>
            {staked === null ? (
              <div className="fg-quiet text-center">
                <p className="fg-note" style={{ margin: 0 }}>
                  {toolsFailed
                    ? "Не удалось прочитать инструменты из сети — постройки неизвестны."
                    : "Читаем инструменты…"}
                </p>
              </div>
            ) : staked.length > 0 ? (
              /* К7 · микропланшет: каждая лунка — место в стойке. Лунка со
                 свечением занята работающим инструментом, контурная — тем, что
                 просто стоит в стойке. Пустые лунки участка — это места. */
              <>
                <PlateGrid
                  rows={6}
                  cols={8}
                  wells={plateWells}
                  onWell={(w) => push("farm", "farm", <FarmPlot />)}
                />
                <div className="plate-legend">
                  <span><i className="lg-g" /> в работе</span>
                  <span><i className="lg-q" /> в стойке</span>
                  <span><i className="lg-empty" /> место свободно</span>
                </div>
              </>
            ) : (
              /* К7 · планшет стоит и с пустой стойкой: все лунки свободны,
                 прибор видно до покупки инструментов. */
              <>
                <PlateGrid rows={6} cols={8} wells={emptyPlateWells(6, 8)} />
                <div className="text-center" style={{ marginTop: 10 }}>
                  <p className="text-straw text-xs">
                    Поставь инструмент в стойку — лунка займёт своё место
                  </p>
                </div>
              </>
            )}
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

          {/* К6 · эхолот журнала: лента пока пустая, и прибор говорит об этом
              прямо. История добычи появится, когда включится архив сети: рисовать
              её «примерно» проект себе не позволяет. */}
          <Panel
            tier="panel"
            device="sonar"
            id={<Sticker alt>ЖУРНАЛ</Sticker>}
            meta="ЛЕНТА НЕ ЗАПРАВЛЕНА"
            title="Журнал смены"
            sub="нагрузка и работа участка"
          >
            <EchoTrace marks={[]} depth={null} />
            <Rows>
              <Row
                k="Нагрузка сети сегодня"
                v={({ sunny: "Номинал", rain: "Скачок", drought: "Блэкаут", festival: "Френзи" } as Record<string, string>)[weather?.type || ""] || "—"}
              />
              <Row k="История добычи" v="—" note="архив не ведётся" />
              <Row k="Динамика цен" v="—" note="только текущие прилавки" />
            </Rows>
            <Note quiet>
              Лента глубин пишется по архиву сети — пока его нет, прибор честно молчит вместо
              выдуманного графика.
            </Note>
          </Panel>
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
