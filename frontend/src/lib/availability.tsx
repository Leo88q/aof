import { useLocale } from "../i18n/LocaleProvider";
import { unavailableDataCopy } from "../i18n/unavailableDataCopy";
import { apiErrorCopy, type ApiErrorCode } from "../i18n/apiErrorCopy";
import { isKnownVrfCode } from "./vrfErrors";
import type { Language } from "../i18n/translations";
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

export const UNAVAILABLE_DATA = unavailableDataCopy.ru;

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

/** Translate only structured fail-closed codes. api.ts replaces unknown server
 * prose with locale-specific fallback and retains the raw error.code for diagnostics. */
export function humanizeApiError(raw: string, language: Language = 'ru'): string {
  const code = raw.trim();
  const copy = apiErrorCopy[language];
  if (Object.prototype.hasOwnProperty.call(copy.messages, code)) {
    return copy.messages[code as ApiErrorCode];
  }
  // VRF codes pass through to the next, VRF-specific localization stage in
  // api.ts. A generic unavailable message would hide their actual reason.
  if (isKnownVrfCode(code)) return code;
  if (FAIL_CLOSED_PATTERN.test(code) && /^[A-Z0-9_]{8,}$/.test(code)) {
    return copy.unknownCode(code);
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
  const { language } = useLocale();
  const entry = unavailableDataCopy[language][id];
  return (
    <div
      role="status"
      lang={language}
      data-testid={`data-unavailable-${id}`}
      className={
        "rounded-xl border border-gold-500/30 bg-soil-800/70 px-3 py-2 text-parchment " +
        (compact ? "text-[11px]" : "text-xs") +
        (className ? " " + className : "")
      }
    >
      <p className="font-semibold text-gold-400">{entry.title}</p>
      <p className="mt-0.5 text-straw">{entry.reason}</p>
    </div>
  );
}
