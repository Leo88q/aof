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
export const DISABLED_MECHANICS = {
  hot_market: {
    title: "Событийный рынок временно недоступен",
    reason:
      "Обмен инструментов пойдёт только тогда, когда сеть научится передавать инструмент одним действием: сейчас покупатель и продавец не могут обменяться без риска.",
    guard: "hot_market_buy/sell → TradingDisabled; /hot-market/buy|sell → 503.",
  },
  collectors: {
    title: "Коллекции временно недоступны",
    reason:
      "Стейкинг коллекций включим, когда в сети будут прописаны адреса коллекционных наборов. До этого награду за коллекцию нельзя начислить корректно.",
    guard: "collector_stake → CollectorNotConfigured.",
  },
  rebirth: {
    title: "Перерождение временно недоступно",
    reason:
      "Полный сброс прогресса должен проходить одним действием: либо сбрасывается всё, либо ничего. Пока сеть так не умеет, кнопка неактивна — сбросить прогресс нельзя.",
    guard: "do_rebirth → FeatureDisabled; /rebirth/do → 503.",
  },
  session: {
    title: "Сессионные ключи временно недоступны",
    reason:
      "Ключи сессии требуют привязки к вашему кошельку в сети. Пока её нет, игра подписывает каждое действие обычным подтверждением в кошельке.",
    guard: "session_create → AtomicBindingRequired; /session/* → 503.",
  },
  tools_repair: {
    title: "Ремонт инструментов временно недоступен",
    reason:
      "Ремонт списывает Кремний и Схему одним действием вместе с восстановлением прочности. Пока в сети не прописаны адреса этих ресурсов, кнопка заблокирована: починить инструмент всё равно не получится, а ресурсы не должны списываться зря.",
    guard: "POST /tools/repair → 503 REPAIR_RESOURCES_NOT_CONFIGURED (Config без woodMint/stoneMint).",
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
      <p className="mt-1 text-straw">Ничего не отправляется и не списывается, пока механика отключена.</p>
      {/* Служебная строка для поддержки и QA: игрок видит её только если раскроет */}
      <details className="mt-2">
        <summary className="text-[10px] text-straw/60 cursor-pointer">Код для поддержки</summary>
        <p className="mt-1 text-[10px] text-straw/60">{m.guard}</p>
      </details>
    </div>
  );
}
