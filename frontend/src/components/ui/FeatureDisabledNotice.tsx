import { useLocale } from "../../i18n/LocaleProvider";
import { disabledMechanicCopy } from "../../i18n/disabledMechanicCopy";

/**
 * Единый список механик, закрытых в этом релизе.
 *
 * [F-06] Паки, кузница, лотерея, экспедиции и случайный сплав считают исход
 * тем же раскрытием, что и открытие пака. В этот список закрытых они не
 * входят. Платный барабан остаётся закрыт: ни наличие VRF-пути, ни
 * редакционная ссылка не разрешают приём MIND.
 *
 * [§3.4] Перерождение из этого списка убрано: полный сброс существует
 * (`aof_core::reset_for_rebirth` + `aof_rebirth::do_rebirth` одной
 * транзакцией), поэтому у механики своя панель, а не заглушка.
 *
 * [AUDIT F-16] Коллекционеры тоже убраны: on-chain `require!(false,
 * CollectorNotConfigured)` больше нет, `collector_stake` переводит NFT в vault
 * PDA и обновляет счётчики перка, а доступ решает allowlist оператора
 * (`POST /admin/config/collector-mint`, шаг 8 devnet-bringup). Панель
 * `components/CollectorsPanel.tsx` работает с живым состоянием, поэтому
 * постоянная плашка «недоступно» была бы ложью.
 *
 * Гейты on-chain и backend проверяются отдельно. Сайт содержит справочные
 * страницы, а не достоверную таблицу доступности механик.
 *
 * Тексты для игрока (`reason`) — без путей API и внутренних имён; техническая
 * причина лежит в `guard` отдельной приглушённой строкой.
 */
// Only stable guard identifiers belong here. Human-readable copy lives in
// disabledMechanicCopy for all seven languages, including Russian.
export const DISABLED_MECHANICS = {
  session: { guard: "session_create → AtomicBindingRequired; /session/* → 503." },
  tools_repair: { guard: "POST /tools/repair → 503 REPAIR_RESOURCES_NOT_CONFIGURED (Config missing circuitMint/siliconMint)." },
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
      className="rounded-2xl border border-accent-600/40 bg-soil-800 px-4 py-3 text-xs text-parchment"
    >
      <p className="font-semibold text-accent-500">{localized.title}</p>
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
