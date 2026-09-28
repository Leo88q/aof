import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

/**
 * Граница ошибок для игрового шелла.
 *
 * До неё любой сбой в одном компоненте (например, ответ API без ожидаемого
 * поля) размонтировал всё дерево React и игрок видел пустой экран без единого
 * сообщения. Теперь падение локализуется: показываем состояние и кнопку
 * «Перезагрузить», остальной каркас остаётся живым.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[NeuroForge] Ошибка интерфейса:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="p-4 pt-6" role="alert">
        <div className="nf-chip relative p-4 rounded-2xl border border-ember/40 bg-soil-850">
          <p className="text-parchment font-semibold">Экран не смог отрисоваться</p>
          <p className="text-straw text-xs mt-1">
            {this.props.label ? `Раздел: ${this.props.label}. ` : ""}
            Данные не потеряны — повторите попытку.
          </p>
          <p className="text-straw text-[10px] mt-2 break-all opacity-70">{error.message}</p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="flex-1 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment text-sm font-semibold"
            >
              Повторить
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 py-2 rounded-xl bg-sprout-600 text-parchment text-sm font-semibold"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      </div>
    );
  }
}
