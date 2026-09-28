/**
 * Состояния «данных нет по-честному».
 *
 * Отличие от components/ui/FeatureDisabledNotice.tsx: тот список описывает
 * механики, которые закрыты сторожевыми проверками on-chain (транзакция не
 * отправится). Здесь — читающие источники, которые на этом деплое не отдают
 * канонические данные (503 от бэкенда или отключённый индексатор). Правило
 * одно для всего UI: неизвестное значение показываем как «—» и объясняем
 * причину, а не подставляем ноль или пустой список, которые выглядят как
 * настоящее состояние игрока.
 *
 * Источники кодов в aof_backend/src/routes/*: *_UNAVAILABLE_*, *_DISABLED_*,
 * *_NOT_CONFIGURED, *_MUST_USE_*, HTTP 503.
 */

export const UNAVAILABLE_DATA = {
  resource_balances: {
    title: "Балансы ресурсов недоступны",
    reason:
      "Реестр ресурсов (Config + MaterialMints) не читается из канонической цепи. Прочерк в счётчике означает «неизвестно», ноль означал бы «пусто».",
  },
  quest_progress: {
    title: "Прогресс заданий недоступен",
    reason:
      "Задания и достижения ещё не индексируются из программы aof-quests, поэтому вместо шаблонов с нулевым прогрессом раздел пуст.",
  },
  daily_rewards: {
    title: "Ежедневные награды отключены",
    reason:
      "Ончейн-инструкция выдачи ещё не развёрнута: /daily/status и /daily/claim отвечают 503. Транзакции не отправляются и ресурсы не списываются.",
  },
  trust_profile: {
    title: "Индекс доверия недоступен",
    reason:
      "Профиль доверия читается из канонического индексатора, который ещё не развёрнут. Оценка не показывается, чтобы не выдумывать репутацию игрока.",
  },
} as const;

export type UnavailableDataId = keyof typeof UNAVAILABLE_DATA;

/** Сеть/сервер подвели или механика действительно закрыта на цепи? */
const FAIL_CLOSED_PATTERN =
  /(^|\b)503\b|_UNAVAILABLE|_DISABLED|_NOT_CONFIGURED|MUST_USE_|REQUIRES_RECONCILIATION|_DEGRADED/;

export function isFailClosedCode(raw: string): boolean {
  return FAIL_CLOSED_PATTERN.test(raw);
}

/**
 * Механика закрыта на цепи или это сбой сети? api.ts помечает ошибку флагом
 * `failClosed` до того, как код заменится человеческим текстом, иначе
 * распознать 503 по сообщению было бы уже нельзя.
 */
export function isFailClosedError(error: unknown): boolean {
  const e = error as any;
  if (e?.failClosed === true) return true;
  const message = String(e?.message ?? error ?? "");
  return FAIL_CLOSED_PATTERN.test(message);
}

/**
 * Тексты для fail-closed кодов бэкенда: игрок не должен видеть
 * REPAIR_RESOURCES_NOT_CONFIGURED как сообщение об ошибке. Неизвестный
 * закрытый код получает общую формулировку с кодом в скобках — так и понятно
 * игроку, и остаётся след для поддержки.
 */
const FAIL_CLOSED_MESSAGES: Record<string, string> = {
  MINING_DISABLED_ONCHAIN: "Добыча отключена до проверки инструкций в тестовой сети. Средства не списываются.",
  REPAIR_RESOURCES_NOT_CONFIGURED: "Ремонт пока недоступен: канонические минты ресурсов не настроены на этом деплое.",
  FLASK_USE_DISABLED_UNTIL_ONCHAIN_INSTRUCTION_EXISTS: "Фляконы включим после развёртывания ончейн-инструкции использования.",
  ENERGY_EXCHANGE_DISABLED_UNTIL_ONCHAIN_INSTRUCTION_EXISTS: "Обмен энергии включим после развёртывания ончейн-инструкции.",
  ENERGY_SPEND_MUST_USE_CANONICAL_GAME_INSTRUCTION: "Энергию списывает сама игра в ончейн-инструкции, отдельной кнопкой это не работает.",
  BOW_REWARD_DISABLED_UNTIL_ONCHAIN_INSTRUCTION_EXISTS: "Награда за лук включится после развёртывания ончейн-инструкции.",
  REFERRAL_TIERS_BIND_DISABLED_USE_CANONICAL_REFERRAL_BIND: "Привязку реферала выполняет ончейн-инструкция referral bind.",
  HOT_MARKET_DISABLED_UNTIL_CANONICAL_TOOL_TRANSFER: "Событийный рынок отключён до атомарной передачи инструмента на цепи.",
  CHALLENGE_CONTRIBUTION_DISABLED_UNTIL_SETTLEMENT_IMPLEMENTED: "Вклад в челленджи включим после реализации расчёта.",
  FRIEND_WATER_UNAVAILABLE_UNTIL_CANONICAL_SOCIAL_BONUS_IS_DEPLOYED: "Взаимные поливы включим после развёртывания социального бонуса.",
  NEIGHBOR_ACTIONS_UNAVAILABLE_UNTIL_CANONICAL_SOCIAL_EFFECTS_ARE_DEPLOYED: "Визиты к соседям включим после развёртывания социальных эффектов.",
  NEIGHBOR_LIMIT_UNAVAILABLE_UNTIL_CANONICAL_SOCIAL_INDEXING_IS_DEPLOYED: "Лимит визитов станет известен после развёртывания социального индексатора.",
  REBIRTH_DISABLED_UNTIL_FULL_RESET_IMPLEMENTED: "Rebirth отключён до реализации атомарного полного сброса.",
  LEGACY_REWARD_REQUIRES_RECONCILIATION: "Эта награда из старой системы — её нужно сверить с цепью перед выдачей.",
  TOOL_GRANT_DISABLED_UNTIL_ACCOUNT_MAP_IS_IMPLEMENTED: "Выдача инструментов отключена до реализации карты аккаунтов.",
  DAILY_REWARDS_UNAVAILABLE_UNTIL_ONCHAIN_POTATO_REWARD_IS_DEPLOYED: "Ежедневные награды появятся после развёртывания ончейн-выдачи.",
  ACHIEVEMENT_UNLOCK_DISABLED_UNTIL_CRITERIA_VERIFIED: "Достижения включим, когда программа начнёт проверять критерии сама.",
  ACHIEVEMENT_STATE_UNAVAILABLE_UNTIL_CANONICAL_INDEXING_IS_DEPLOYED: "Достижения недоступны: их состояние ещё не индексируется из программы.",
  QUEST_PROGRESS_UNAVAILABLE_UNTIL_CANONICAL_INDEXING_IS_DEPLOYED: "Прогресс заданий недоступен: он ещё не индексируется из программы.",
  STREAK_STATE_UNAVAILABLE_UNTIL_CANONICAL_INDEXING_IS_DEPLOYED: "Серия входов недоступна: состояние ещё не индексируется.",
  STREAK_REWARDS_UNAVAILABLE_UNTIL_CANONICAL_INSTRUCTION_IS_DEPLOYED: "Награды за серию включим после развёртывания ончейн-инструкции.",
  COMEBACK_REWARDS_UNAVAILABLE_UNTIL_CANONICAL_INSTRUCTION_IS_DEPLOYED: "Награды за возвращение включим после развёртывания ончейн-инструкции.",
  TRUST_PROFILE_UNAVAILABLE_UNTIL_CANONICAL_INDEXING_IS_DEPLOYED: "Индекс доверия недоступен: он ещё не читается из канонического индексатора.",
  TRUST_LEADERBOARD_UNAVAILABLE_UNTIL_CANONICAL_INDEXING_IS_DEPLOYED: "Рейтинг доверия недоступен: он ещё не читается из канонического индексатора.",
  PORTFOLIO_VALUATION_UNAVAILABLE_UNTIL_CANONICAL_INDEXING_IS_DEPLOYED: "Оценка портфеля недоступна: нет канонических цен и балансов.",
  PRIVILEGES_UNAVAILABLE_UNTIL_CANONICAL_INDEXING_IS_DEPLOYED: "Привилегии недоступны: их состояние ещё не индексируется.",
  VIP_STATUS_UNAVAILABLE_FROM_CANONICAL_SEASON_ACCOUNTS: "Сезонный статус недоступен: аккаунты сезона не читаются из цепи.",
  RESOURCE_REGISTRY_UNAVAILABLE_OR_INVALID_FROM_CANONICAL_CHAIN: "Реестр ресурсов не читается из цепи — балансы и минты недоступны.",
  RESOURCE_MINT_REGISTRY_UNAVAILABLE_OR_INVALID: "Реестр минтов ресурсов не читается из цепи.",
  FARM_STATE_UNAVAILABLE_FROM_CANONICAL_CHAIN: "Состояние участка недоступно: чтение из цепи не удалось. Это не пустая ферма.",
  ENERGY_ACCOUNT_UNAVAILABLE_FROM_CANONICAL_CHAIN: "Аккаунт энергии ещё не создан в сети — он появляется с первым действием.",
  WEATHER_STATE_UNAVAILABLE_FROM_CANONICAL_CHAIN: "Погода недоступна: состояние WeatherState не читается из цепи.",
  WEATHER_FORECAST_UNAVAILABLE_WITHOUT_CANONICAL_SOURCE: "Прогноз погоды считается по расписанию дня в интерфейсе; отдельного источника у бэкенда нет.",
  UNKNOWN_CANONICAL_WEATHER_VALUE: "В цепи неожиданное значение погоды — панели не показывают выдуманное состояние.",
};

export function humanizeApiError(raw: string): string {
  const code = raw.trim();
  const known = FAIL_CLOSED_MESSAGES[code];
  if (known) return known;
  if (FAIL_CLOSED_PATTERN.test(code) && /^[A-Z0-9_]{8,}$/.test(code)) {
    return `Механика пока недоступна на этом деплое (код: ${code}).`;
  }
  return code;
}

export function DataUnavailableNotice({
  id,
  compact = false,
  className = "",
}: {
  id: UnavailableDataId;
  compact?: boolean;
  className?: string;
}) {
  const entry = UNAVAILABLE_DATA[id];
  return (
    <div
      role="status"
      data-testid={`data-unavailable-${id}`}
      className={
        "rounded-xl border border-amber-500/30 bg-soil-800/70 px-3 py-2 text-parchment " +
        (compact ? "text-[11px]" : "text-xs") +
        (className ? " " + className : "")
      }
    >
      <p className="font-semibold text-amber-400">{entry.title}</p>
      <p className="mt-0.5 text-straw">{entry.reason}</p>
    </div>
  );
}
