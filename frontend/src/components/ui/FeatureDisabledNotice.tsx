/**
 * Single source of truth for mechanics that are fail-closed in this release.
 *
 * Each entry mirrors an on-chain guard (`require!(false, ...Disabled)`) and the
 * matching 503 error code in aof_backend/src/routes/*. The site content
 * (src/site/content/mechanics.ts) marks the same ids as status:'soon'.
 * Keep the three in sync; scripts/check-idl-drift.py does not cover this list,
 * so review it whenever a guard is added or removed.
 */
export const DISABLED_MECHANICS = {
  lottery: {
    title: "Покупка билетов временно недоступна",
    reason:
      "Дневной лимит билетов ещё не хранится on-chain. Программа возвращает FeatureDisabled, API — 503 LOTTERY_TICKETS_DISABLED_UNTIL_ONCHAIN_DAILY_CAP_EXISTS.",
  },
  exploration: {
    title: "Экспедиции временно недоступны",
    reason:
      "Ресурсы сжигаются до раскрытия, а on-chain пути возврата ещё нет. Программа возвращает FeatureDisabled, API — 503 EXPLORATION_COMMITS_DISABLED_UNTIL_EXPIRY_REFUND_WORKER_IS_DEPLOYED.",
  },
  forge: {
    title: "Кузница временно недоступна",
    reason:
      "forge_attempt_commit возвращает FeatureDisabled до появления канонической стоимости мяса и пути возврата.",
  },
  reroll: {
    title: "Случайный reroll временно недоступен",
    reason: "Инструмент сжигается до раскрытия, пути возврата нет. Программа возвращает FeatureDisabled.",
  },
  drum: {
    title: "Барабан временно недоступен",
    reason: "drum_commit возвращает FeatureDisabled до появления пути возврата.",
  },
  hot_market: {
    title: "Событийный рынок временно недоступен",
    reason: "hot_market_buy/sell возвращают TradingDisabled до атомарной передачи ToolData.",
  },
  collectors: {
    title: "Коллекции временно недоступны",
    reason: "collector_stake возвращает CollectorNotConfigured до настройки канонических mint.",
  },
  rebirth: {
    title: "Rebirth временно недоступен",
    reason: "do_rebirth возвращает FeatureDisabled до реализации атомарного полного сброса.",
  },
  session: {
    title: "Сессионные ключи временно недоступны",
    reason: "session_create возвращает AtomicBindingRequired; API /session/* отвечает 503.",
  },
} as const;

export type DisabledMechanicId = keyof typeof DISABLED_MECHANICS;

export function isMechanicDisabled(id: string): id is DisabledMechanicId {
  return Object.prototype.hasOwnProperty.call(DISABLED_MECHANICS, id);
}

export function FeatureDisabledNotice({ id }: { id: DisabledMechanicId }) {
  const m = DISABLED_MECHANICS[id];
  return (
    <div
      role="status"
      data-testid={`feature-disabled-${id}`}
      className="rounded-2xl border border-wheat-600/40 bg-soil-800 px-4 py-3 text-xs text-parchment"
    >
      <p className="font-semibold text-wheat-500">{m.title}</p>
      <p className="mt-1 text-straw">{m.reason}</p>
      <p className="mt-1 text-straw">Транзакции не отправляются и средства не списываются, пока механика отключена.</p>
    </div>
  );
}
