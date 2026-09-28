import { ReactNode, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { fmtNum } from "../../lib/marketUtils";
import { resourceIcon } from "../../lib/visualAssets";
import { Panel, Readout, Readouts, Lamp, Lamps, Sticker, Note } from "../../ui/forge/kit";
import { CryoRack, Dewar, type Straw } from "../../ui/forge/devices";

/**
 * Герой «Твоя лаборатория» — лицейная панель криобанка (К4).
 *
 * Это единственный экран, который «сделан» из уникального аппарата: стеллаж
 * образцов (ресурсы — соломинки с уровнем), сосуд с азотом (заряд энергии) и
 * ряд показаний. Всё, что показывает прибор, приходит из реальных источников:
 *
 *   • ресурсы — SPL-балансы владельца (/query/balances, те же 8 позиций,
 *     что производит лаборатория: базовые + модельная цепочка);
 *   • газ — GasTank (/query/gastank, поле balanceMicros);
 *   • энергия — EnergyAccount из общего стора (тот же вызов, что и раньше);
 *   • нагрузка сети — WeatherState;
 *   • стойка — инструменты из /query/my-tools.
 *
 * Прежние две панели (ResourceBar-плитка ресурсов и ряд StatChip) сведены в
 * одну: они дублировали друг друга, а два их поля были мёртвыми («SOL газ» —
 * литерал 12.4 в разметке, «Стрик» — /streaks отвечает 503).
 *
 * Правило данных: неизвестное значение — «—» и подпись, никогда не ноль.
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

const LOAD_LABELS: Record<string, string> = {
  sunny: "Номинал",
  rain: "Скачок",
  drought: "Блэкаут",
  festival: "Френзи",
  harvest_festival: "Френзи",
};

/** SOL-микросы газ-бака (1e6 за 1 SOL) → читаемый ◎. */
export function microsToSol(micros: any): number {
  const n = Number(micros);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n / 1_000_000;
}

function trimSol(v: number): string {
  if (v === 0) return "0";
  if (v >= 1) return v.toFixed(3).replace(/\.?0+$/, "");
  return v
    .toFixed(6)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

export function LabHero({
  owner,
  refreshKey,
  energy,
  weather,
  staked,
  toolsFailed,
  actions,
}: {
  owner: string | null;
  refreshKey?: any;
  energy: { amount?: number; cap?: number } | null;
  weather: any;
  staked: any[] | null;
  toolsFailed: boolean;
  actions?: ReactNode;
}) {
  const [balances, setBalances] = useState<Record<string, number> | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [gasMicros, setGasMicros] = useState<number | null>(null);

  useEffect(() => {
    if (!owner) {
      setBalances(null);
      setUnavailable(false);
      setGasMicros(null);
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
  }, [owner, refreshKey]);

  const energyAmount = typeof energy?.amount === "number" ? energy.amount : null;
  const energyCap = typeof energy?.cap === "number" && energy.cap > 0 ? energy.cap : null;
  const load = typeof weather?.type === "string" ? LOAD_LABELS[weather.type] || null : null;

  // Уровень соломинки — доля от самого полного образца в стойке. Если балансов
  // нет, соломинки сухие: прибор не рисует выдуманные уровни.
  const top = balances
    ? Math.max(1, ...LAB_RESOURCES.map((r) => Number(balances[r.key] ?? 0)))
    : null;
  const strawOf = (r: (typeof LAB_RESOURCES)[number]): Straw => {
    const raw = balances ? Number(balances[r.key] ?? 0) : null;
    return {
      key: r.key,
      name: r.label,
      value: !owner ? "—" : unavailable ? "—" : balances ? fmtNum(raw ?? 0) : "…",
      level: raw === null ? null : top ? raw / top : 0,
      reward: r.key === "MODEL" || r.key === "NEURON",
    };
  };

  const base = LAB_RESOURCES.slice(0, 3).map(strawOf);
  const chain = LAB_RESOURCES.slice(3).map(strawOf);
  const energyShare = energyAmount !== null && energyCap ? energyAmount / energyCap : null;
  const gas = gasMicros === null ? null : trimSol(microsToSol(gasMicros));

  return (
    <Panel
      tier="hero"
      device="cryo"
      ariaLabel="Твоя лаборатория"
      id={<Sticker bars>ЛАБОРАТОРИЯ</Sticker>}
      meta={owner ? "КРИОБАНК ОБРАЗЦОВ" : "КОШЕЛЁК НЕ ПОДКЛЮЧЁН"}
      title="Твоя лаборатория"
      sub="стойка A · глубокий холод"
      className="mb-4"
    >
      <Lamps>
        <Lamp tone={!owner ? "wait" : unavailable ? "err" : "ok"}>
          {!owner ? "кошелёк не подключён" : unavailable ? "связь с сетью потеряна" : "связь с сетью"}
        </Lamp>
        <Lamp tone={energyAmount !== null ? "ok" : "wait"}>
          {energyAmount !== null ? "сосуд под давлением" : "энергии в сети нет"}
        </Lamp>
      </Lamps>

      <div className="cryo-body" style={{ marginTop: 14 }}>
        <Dewar level={energyShare} />
        <div>
          <CryoRack
            title="Стойка A · базовые"
            meta={top ? "норма" : "нет данных"}
            slots={base}
          />
          <CryoRack
            title="Стойка B · модельная цепочка"
            meta={top ? "контроль" : "нет данных"}
            slots={chain}
          />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <Readouts>
          <Readout
            label="Энергия"
            value={energyAmount !== null ? String(energyAmount) : undefined}
            unit={energyCap ? `/${energyCap}` : undefined}
            dash={energyAmount === null}
            hint={
              energyAmount === null
                ? "аккаунта энергии ещё нет в сети"
                : undefined
            }
          />
          <Readout label="Газ" value={gas ? `◎ ${gas}` : undefined} dash={gas === null} hint={gas === null ? "газ-бак ещё не создан" : undefined} />
          <Readout
            label="Стойка"
            value={staked !== null ? String(staked.length) : toolsFailed ? undefined : "…"}
            dash={staked === null && toolsFailed}
            hint={toolsFailed ? "инструменты недоступны из сети" : staked === null ? "читаем инструменты" : "инструментов в стойке"}
          />
          <Readout
            label="Нагрузка сети"
            value={load ?? undefined}
            dash={!load}
            hint={!load ? "нет WeatherState" : "множитель энергопотока"}
          />
        </Readouts>
      </div>

      {actions ? <div className="fg-keys">{actions}</div> : null}

      {!owner && <Note quiet>Подключи кошелёк — покажем балансы из сети.</Note>}
      {owner && unavailable && (
        <Note quiet>Балансы недоступны из сети. Повтори обновление позже.</Note>
      )}
    </Panel>
  );
}

/** Плитка ресурса для мест, где стойка не нужна (экраны экономики). */
export const LAB_RESOURCE_KEYS = LAB_RESOURCES.map((r) => r.key);
export const labResourceIcon = (key: string) => resourceIcon(key);
