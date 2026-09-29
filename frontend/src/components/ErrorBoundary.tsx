import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import { errorScreenCopy } from "../i18n/errorScreenCopy";
import { gameTabs, type GameTab } from "../i18n/gameLabels";
import type { Language } from "../i18n/translations";

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

/** Keep the class boundary while passing it the current language from a hook. */
export function ErrorBoundary(props: Props) {
  const { language } = useLocale();
  return <BoundaryView {...props} language={language} />;
}

class BoundaryView extends Component<Props & { language: Language }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[NeuroForge] UI render failed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { language, label } = this.props;
    const copy = errorScreenCopy[language];
    const name = label && label in gameTabs[language]
      ? gameTabs[language][label as GameTab].full : copy.screens;
    return (
      <div lang={language} className="p-4 pt-6 min-w-0" role="alert">
        <div className="nf-chip relative p-4 rounded-2xl border border-ember/40 bg-soil-850">
          <p className="text-parchment font-semibold break-words">{copy.title}</p>
          <p className="text-straw text-xs mt-1 break-words">{copy.section(name)} {copy.hint}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" onClick={() => this.setState({ error: null })}
              className="flex-1 min-w-0 whitespace-normal py-2 px-3 rounded-xl bg-soil-800 border border-straw/20 text-parchment text-sm font-semibold">
              {copy.retry}
            </button>
            <button type="button" onClick={() => window.location.reload()}
              className="flex-1 min-w-0 whitespace-normal py-2 px-3 rounded-xl bg-sprout-600 text-parchment text-sm font-semibold">
              {copy.reload}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
