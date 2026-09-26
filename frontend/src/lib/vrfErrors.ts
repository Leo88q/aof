/**
 * [F-06] Player-facing text for the Switchboard settlement errors returned by
 * the API (503 codes from lib/vrf.ts) and by the programs (AofError names).
 */
const MESSAGES: ReadonlyArray<readonly [RegExp, string]> = [
  [/VRF_POOL_EXHAUSTED|VrfSlotBusy/, "Все каналы оракула сейчас заняты. Повторите через несколько секунд."],
  [/VRF_POOL_EMPTY/, "Механика ещё не запущена: пул оракула пуст."],
  [/VRF_ORACLE_UNAVAILABLE/, "Оракулы Switchboard сейчас недоступны. Повторите через минуту, средства не списаны."],
  [/VRF_SETTLEMENT_DEGRADED/, "Оракул временно не успевает раскрывать результаты, поэтому новые открытия приостановлены. Уже оплаченные будут раскрыты или возвращены."],
  [/PRICE_ABOVE_MAXIMUM|PriceAboveMaximum/, "Цена изменилась. Обновите страницу и подтвердите новую цену."],
  [/RevealWindowClosed/, "Окно раскрытия закрыто, теперь доступен возврат."],
  [/LotterySalesClosed/, "Продажи этого раунда закрыты: идёт розыгрыш."],
];

export function humanizeVrfError(message: string): string {
  for (const [pattern, text] of MESSAGES) if (pattern.test(message)) return text;
  return message;
}
