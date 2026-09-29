import { useLocale } from "../../i18n/LocaleProvider";
import { disabledMechanicCopy } from "../../i18n/disabledMechanicCopy";

/**
 * Единый список механик, закрытых в этом релизе.
 *
 * [F-06] Паки, кузница, лотерея, экспедиции, реролл и барабан из списка вышли:
 * они рассчитываются через пул Switchboard On-Demand, принадлежащий программе
 * (docs/VRF_SWITCHBOARD.md), и живые во всех слоях.
 *
 * Каждая запись соответствует сторожевой проверке on-chain
 * (`require!(false, ...Disabled)`) и коду 503 в aof_backend/src/routes/*.
 * Контент сайта (src/site/content/mechanics.ts) помечает те же id как
 * status:'soon'. Держать три места синхронными; scripts/check-idl-drift.py
 * этот список не покрывает, поэтому его проверяют вручную при добавлении или
 * снятии ограничения.
 *
 * Тексты для игрока (`reason`) — без путей API и внутренних имён; техническая
 * причина лежит в `guard` отдельной приглушённой строкой.
 */
// Only stable guard identifiers belong here. Human-readable copy lives in
// disabledMechanicCopy for all seven languages, including Russian.
export const DISABLED_MECHANICS = {
  hot_market: { guard: "hot_market_buy/sell → TradingDisabled; /hot-market/buy|sell → 503." },
  collectors: { guard: "collector_stake → CollectorNotConfigured." },
  rebirth: { guard: "do_rebirth → FeatureDisabled; /rebirth/do → 503." },
  session: { guard: "session_create → AtomicBindingRequired; /session/* → 503." },
  tools_repair: { guard: "POST /tools/repair → 503 REPAIR_RESOURCES_NOT_CONFIGURED (Config missing woodMint/stoneMint)." },
} as const;

export type DisabledMechanicId = keyof typeof DISABLED_MECHANICS;

export function isMechanicDisabled(id: string): id is DisabledMechanicId {
  return Object.prototype.hasOwnProperty.call(DISABLED_MECHANICS, id);
}

export function FeatureDisabledNotice({ id }: { id: DisabledMechanicId }) {
  const { language } = useLocale();
  const m = DISABLED_MECHANICS[id];
  const localized = disabledMechanicCopy[language].explanations[id];
  const { noCharge, supportCode } = disabledMechanicCopy[language];
  return (
    <div
      role="status"
      lang={language}
      data-testid={`feature-disabled-${id}`}
      className="rounded-2xl border border-wheat-600/40 bg-soil-800 px-4 py-3 text-xs text-parchment"
    >
      <p className="font-semibold text-wheat-500">{localized.title}</p>
      <p className="mt-1 text-straw">{localized.reason}</p>
      <p className="mt-1 text-straw">{noCharge}</p>
      {/* Служебная строка для поддержки и QA: игрок видит её только если раскроет */}
      <details className="mt-2">
        <summary className="text-[10px] text-straw/60 cursor-pointer">{supportCode}</summary>
        <p className="mt-1 text-[10px] text-straw/60">{m.guard}</p>
      </details>
    </div>
  );
}
