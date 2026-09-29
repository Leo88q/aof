import { useLocale } from "../i18n/LocaleProvider";
import { gameTabs, type GameTab } from "../i18n/gameLabels";
import { errorScreenCopy } from "../i18n/errorScreenCopy";

// Shown while a tab chunk loads; announce its localized name to screen readers.
export function TabFallback({ label }: { label: GameTab }) {
  const { language } = useLocale();
  return (
    <div lang={language} className="page flex flex-col gap-3 p-3 sm:p-4" role="status" aria-live="polite">
      <span className="sr-only">{gameTabs[language][label].full}: {errorScreenCopy[language].loading}</span>
      <div className="h-9 w-2/3 rounded-xl bg-soil-800/70 animate-pulse" aria-hidden="true" />
      <div className="h-24 w-full rounded-2xl bg-soil-800/70 animate-pulse" aria-hidden="true" />
      <div className="h-24 w-full rounded-2xl bg-soil-800/70 animate-pulse" aria-hidden="true" />
    </div>
  );
}
