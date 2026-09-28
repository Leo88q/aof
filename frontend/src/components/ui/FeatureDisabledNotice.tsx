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
      "Обмен инструментов на событийном рынке пойдёт только после того, как передача инструмента станет атомарной на цепи. Сейчас покупатель и продавец не могут обменяться в одной транзакции без риска.",
    guard: "hot_market_buy/sell → TradingDisabled; /hot-market/buy|sell → 503.",
  },
  collectors: {
    title: "Коллекции временно недоступны",
    reason:
      "Стейкинг коллекций включим, когда в программе будут настроены канонические адреса коллекционных токенов. До этого награда за коллекцию не может быть начислена корректно.",
    guard: "collector_stake → CollectorNotConfigured.",
  },
  rebirth: {
    title: "Rebirth временно недоступен",
    reason:
      "Полный сброс прогресса требует атомарной инструкции: либо сбрасывается всё, либо ничего. Пока такая инструкция не развёрнута, кнопка неактивна — прогресс сбросить невозможно.",
    guard: "do_rebirth → FeatureDisabled; /rebirth/do → 503.",
  },
  session: {
    title: "Сессионные ключи временно недоступны",
    reason:
      "Ключи сессии требуют привязки к вашему кошельку на цепи. Пока привязка не развёрнута, игра подписывает каждое действие обычным подтверждением в кошельке.",
    guard: "session_create → AtomicBindingRequired; /session/* → 503.",
  },
  tools_repair: {
    title: "Ремонт инструментов временно недоступен",
    reason:
      "Ремонт списывает Кремний и Схему одной транзакцией вместе с восстановлением прочности. Пока в конфигурации программы не заданы адреса этих ресурсов, кнопка заблокирована: чинить инструмент всё равно не получится, а ресурсы не должны списываться зря.",
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
      <p className="mt-1 text-straw">Транзакции не отправляются и ресурсы не списываются, пока механика отключена.</p>
      <p className="mt-2 text-[10px] text-straw/60">Технически: {m.guard}</p>
    </div>
  );
}
