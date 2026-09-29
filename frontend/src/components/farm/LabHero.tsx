import { ReactNode, useEffect, useState } from "react";
import { useLocale } from "../../i18n/LocaleProvider";
import { labHeroCopy } from "../../i18n/labHeroCopy";
import { homeResourceNames, type ResourceId } from "../../i18n/homeDetail";
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
  { key: "DATA" },
  { key: "CIRCUIT" },
  { key: "SILICON" },
  { key: "POWER" },
  { key: "NEURON" },
  { key: "SYNAPSE" },
  { key: "SIGNAL" },
  { key: "MODEL" },
] as const;

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
  const { language } = useLocale();
  const copy = labHeroCopy[language];
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
  const weatherType = weather?.type === 'harvest_festival' ? 'festival' : weather?.type;
  const load = typeof weatherType === 'string'
    ? copy.load[weatherType as keyof typeof copy.load] ?? null : null;

  // Уровень соломинки — доля от самого полного образца в стойке. Если балансов
  // нет, соломинки сухие: прибор не рисует выдуманные уровни.
  const top = balances
    ? Math.max(1, ...LAB_RESOURCES.map((r) => Number(balances[r.key] ?? 0)))
    : null;
  const strawOf = (r: (typeof LAB_RESOURCES)[number]): Straw => {
    const raw = balances ? Number(balances[r.key] ?? 0) : null;
    return {
      key: r.key,
      name: homeResourceNames[language][r.key.toLowerCase() as ResourceId],
      value: !owner ? "—" : unavailable ? "—" : balances ? fmtNum(raw ?? 0, language) : "…",
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
      ariaLabel={copy.title}
      id={<Sticker bars>{copy.sticker}</Sticker>}
      meta={owner ? copy.connectedMeta : copy.disconnectedMeta}
      title={copy.title}
      sub={copy.subtitle}
      className="mb-4"
    >
      <Lamps>
        <Lamp tone={!owner ? "wait" : unavailable ? "err" : "ok"}>
          {!owner ? copy.disconnected : unavailable ? copy.networkLost : copy.connected}
        </Lamp>
        <Lamp tone={energyAmount !== null ? "ok" : "wait"}>
          {energyAmount !== null ? copy.pressure : copy.noEnergy}
        </Lamp>
      </Lamps>

      <div className="cryo-body" style={{ marginTop: 14 }}>
        <Dewar level={energyShare} />
        <div>
          <CryoRack
            title={copy.rackA}
            meta={top ? copy.normal : copy.noData}
            slots={base}
          />
          <CryoRack
            title={copy.rackB}
            meta={top ? copy.monitoring : copy.noData}
            slots={chain}
          />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <Readouts>
          <Readout
            label={copy.energy}
            value={energyAmount !== null ? String(energyAmount) : undefined}
            unit={energyCap ? `/${energyCap}` : undefined}
            dash={energyAmount === null}
            hint={
              energyAmount === null
                ? copy.energyMissing
                : undefined
            }
          />
          <Readout label={copy.gas} value={gas ? `◎ ${gas}` : undefined} dash={gas === null} hint={gas === null ? copy.gasMissing : undefined} />
          <Readout
            label={copy.rack}
            value={staked !== null ? String(staked.length) : toolsFailed ? undefined : "…"}
            dash={staked === null && toolsFailed}
            hint={toolsFailed ? copy.toolsUnavailable : staked === null ? copy.readingTools : copy.toolsInRack}
          />
          <Readout
            label={copy.networkLoad}
            value={load ?? undefined}
            dash={!load}
            hint={!load ? copy.weatherMissing : copy.powerMultiplier}
          />
        </Readouts>
      </div>

      {actions ? <div className="fg-keys">{actions}</div> : null}

      {!owner && <Note quiet>{copy.connectWallet}</Note>}
      {owner && unavailable && (
        <Note quiet>{copy.balancesUnavailable}</Note>
      )}
    </Panel>
  );
}

/** Плитка ресурса для мест, где стойка не нужна (экраны экономики). */
export const LAB_RESOURCE_KEYS = LAB_RESOURCES.map((r) => r.key);
export const labResourceIcon = (key: string) => resourceIcon(key);
