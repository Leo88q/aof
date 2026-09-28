import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../ui/Card";
import { api } from "../../lib/api";
import { fmtNum } from "../../lib/marketUtils";
import { ResourceGlyph } from "../visual/ResourceGlyph";
import { resourceIcon, UI_ICONS } from "../../lib/visualAssets";
import { useNav } from "../../nav/NavContext";
import { useWalletStr } from "../../lib/useWalletStr";

/**
 * Панели обзора лаборатории.
 *
 * Раньше на этом экране жили две пересекающиеся панели: `ResourceBar`
 * (Данные / Схема / Кремний) и ряд StatChip (SOL газ / Энергия / Стрик).
 * Из шести полей два были мёртвыми:
 *   • «SOL газ» — литерал 12.4 в разметке, ни одного запроса к цепи;
 *   • «Стрик» — `/streaks/:user` отвечает 503 (каноническая инструкция
 *     стрика ещё не развёрнута), поэтому там всегда «—».
 * Плюс базовые три ресурса дублировались с полным списком в «Экономике».
 *
 * Здесь один источник правды: SPL-балансы набора, который производит сама
 * лаборатория (базовые + модельная цепочка), и отдельный ряд состояния из
 * реальных ончейн-аккаунтов (EnergyAccount, GasTank, WeatherState).
 */

/** Набор производства лаборатории: базовые ресурсы + модельная цепочка. */
const LAB_RESOURCES = [
  { key: "DATA", label: "Данные" },
  { key: "CIRCUIT", label: "Схема" },
  { key: "SILICON", label: "Кремний" },
  { key: "POWER", label: "Энергопоток" },
  { key: "NEURON", label: "Нейрон" },
  { key: "SYNAPSE", label: "Синапс" },
  { key: "SIGNAL", label: "Сигнал" },
  { key: "MODEL", label: "Модель" },
] as const;

export function LabResourcePanel({ owner, refreshKey }: { owner: string | null; refreshKey?: any }) {
  const { setTab } = useNav();
  const [balances, setBalances] = useState<Record<string, number> | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!owner) {
      setBalances(null);
      setUnavailable(false);
      return;
    }
    let alive = true;
    api.query
      .balances(owner)
      .then((b: any) => {
        if (!alive) return;
        if (b && typeof b === "object") {
          setBalances(b);
          setUnavailable(false);
        } else {
          setBalances(null);
          setUnavailable(true);
        }
      })
      .catch(() => {
        if (!alive) return;
        setBalances(null);
        setUnavailable(true);
      });
    return () => {
      alive = false;
    };
  }, [owner, refreshKey]);

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-parchment truncate">Ресурсы лаборатории</h3>
        <button
          type="button"
          onClick={() => setTab("economy")}
          className="shrink-0 text-[11px] font-semibold text-wheat-500 hover:underline"
        >
          Все 26 →
        </button>
      </div>

      <div className="grid grid-cols-4 gap-x-1.5 gap-y-3">
        {LAB_RESOURCES.map((it) => (
          <div key={it.key} className="min-w-0 text-center">
            <ResourceGlyph icon={resourceIcon(it.key)} alt={it.label} className="w-7 h-7 mx-auto" />
            <div className="mt-1 text-[11px] font-bold text-parchment tabular-nums truncate">
              {!owner ? "—" : balances ? fmtNum(balances[it.key] ?? 0) : "…"}
            </div>
            <div className="text-[9.5px] leading-tight text-straw truncate" title={it.label}>
              {it.label}
            </div>
          </div>
        ))}
      </div>

      {!owner && <p className="mt-3 text-[10px] text-straw">Подключи кошелёк — покажем балансы из канонической сети.</p>}
      {owner && unavailable && (
        <p className="mt-3 text-[10px] text-amber-400">
          Балансы недоступны из канонической сети. Повтори обновление позже.
        </p>
      )}
    </Card>
  );
}

const GAS_LABEL = "SOL газ";

/** SOL-микросы газ-бака (1e6 за 1 SOL) -> читаемый ◎. */
export function microsToSol(micros: any): number {
  const n = Number(micros);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n / 1_000_000;
}

function trimSol(v: number): string {
  if (v === 0) return "0";
  if (v >= 1) return v.toFixed(3).replace(/\.?0+$/, "");
  return v.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

const LOAD_LABELS: Record<string, string> = {
  sunny: "Номинал",
  rain: "Скачок",
  drought: "Блэкаут",
  festival: "Френзи",
  harvest_festival: "Френзи",
};

type LabStateProps = {
  owner: string | null;
  refreshKey?: any;
  /** Энергия из общего стора (тот же вызов, что и раньше, без второго запроса). */
  energy: { amount?: number; cap?: number } | null;
  weather: any;
};

/**
 * Ряд состояния лаборатории. Три реальных источника:
 *   • EnergyAccount (кап 20, +1 за 30 мин) — платит за посев/сбор/переработку/тренировку;
 *   • GasTank (SOL-микросы) — платит за unstake/craft/reroll;
 *   • WeatherState — множитель накопления энергопотока.
 * Мёртвый «Стрик» убран: `/streaks` отвечает 503 до развёртывания инструкции.
 */
export function LabStateRow({ owner, energy, weather }: LabStateProps) {
  const [gasMicros, setGasMicros] = useState<number | null>(null);

  useEffect(() => {
    if (!owner) {
      setGasMicros(null);
      return;
    }
    let alive = true;
    api.query
      .gastank(owner)
      .then((g: any) => {
        if (!alive) return;
        setGasMicros(g && typeof g === "object" ? Number(g.balanceMicros ?? g.balance_micros ?? 0) : null);
      })
      .catch(() => alive && setGasMicros(null));
    return () => {
      alive = false;
    };
  }, [owner]);

  const energyAmount = typeof energy?.amount === "number" ? energy.amount : null;
  const energyCap = typeof energy?.cap === "number" && energy.cap > 0 ? energy.cap : null;
  const load = typeof weather?.type === "string" ? LOAD_LABELS[weather.type] || weather.type : null;

  const items = [
    {
      key: "energy",
      icon: resourceIcon("POWER"),
      label: "Энергия",
      value: energyAmount !== null ? `${energyAmount}/${energyCap ?? 20}` : "—",
      hint: energyAmount === null ? "появится после первого действия on-chain" : undefined,
      progress: energyAmount !== null && energyCap ? (energyAmount / energyCap) * 100 : null,
    },
    {
      key: "gas",
      icon: UI_ICONS.tokenCoin,
      label: GAS_LABEL,
      value: gasMicros !== null ? `◎ ${trimSol(microsToSol(gasMicros))}` : "—",
      hint: gasMicros === null ? "газ-бак ещё не создан" : undefined,
      progress: null,
    },
    {
      key: "load",
      icon: UI_ICONS.chartsUp,
      label: "Нагрузка сети",
      value: load || "—",
      hint: load ? undefined : "нет WeatherState",
      progress: null,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {items.map((it) => (
        <motion.div
          key={it.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-w-0 rounded-2xl bg-soil-850 border border-straw/10 px-2.5 py-2 shadow-card"
          title={it.hint}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <ResourceGlyph icon={it.icon} alt="" className="w-4 h-4 shrink-0" />
            <span className="text-straw text-[10px] truncate">{it.label}</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-parchment tabular-nums truncate">{it.value}</div>
          {it.progress !== null && (
            <div className="mt-1 h-1 rounded-full bg-soil-700 overflow-hidden">
              <div className="h-full bg-water-500" style={{ width: `${Math.min(100, Math.max(0, it.progress))}%` }} />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
