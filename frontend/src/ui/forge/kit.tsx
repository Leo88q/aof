import { ReactNode } from "react";

/**
 * Набор приборов NeuroForge — примитивы (Этап 2, 2026-09-28).
 *
 * Язык: лицевая панель прибора + экран под стеклом. Свет идёт от экрана и
 * ламп, а не от рамки; значения — моно-цифры; неизвестное значение — прочерк
 * с честной подписью, никогда не ноль.
 *
 * Уровни панелей вместо одной рамки на всём:
 *   hero  — «Твоя лаборатория» и другие главные окна (уникальный прибор);
 *   panel — рабочие окна (по умолчанию);
 *   quiet — тихие блоки, подписи, предупреждения (без корпуса).
 */

export type PanelTier = "hero" | "panel" | "quiet";

/** Аппарат, из которого «сделан» экран (см. src/lib/panelDevices.ts). */
export type PanelDevice =
  | "plain"
  | "cryo"     // биобанк: стеллаж образцов и сосуд с азотом
  | "mix"      // студийный пульт: канальные полосы
  | "sonar"    // эхолот/сонар: лента глубины и разворотка
  | "plate"    // клинический микропланшет 96 лунок
  | "gel"      // гель-электрофорез: дорожки и полосы
  | "cross"    // кросс-панель: порты и патч-корды
  | "cards"    // перфокарты Жаккарда: пробитые шаги
  | "baro"     // барограф: барабанная диаграмма
  | "monitor"; // прикроватный монитор: волна и мягкие клавиши

export function Panel({
  tier = "panel",
  device = "plain",
  id,
  meta,
  title,
  sub,
  children,
  className = "",
  onClick,
  ariaLabel,
}: {
  tier?: PanelTier;
  device?: PanelDevice;
  /** Этикетка прибора. Номер в ней — только если за ним реальные данные. */
  id?: ReactNode;
  meta?: ReactNode;
  title?: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const cls = [
    "fg",
    tier === "hero" ? "fg-hero" : "",
    tier === "quiet" ? "fg-quiet" : "",
    device !== "plain" ? `fg--${device}` : "",
    onClick ? "cursor-pointer" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const head =
    title || sub ? (
      <div className="fg-screen__head">
        <span className="fg-screen__title">{title}</span>
        {sub ? <span className="fg-screen__sub">{sub}</span> : null}
      </div>
    ) : null;

  const body = (
    <>
      {id || meta ? (
        <div className="fg__id">
          {id ? <span className="fg-sticker">{id}</span> : <span />}
          {meta ? <span className="fg__no">{meta}</span> : null}
        </div>
      ) : null}
      {tier === "quiet" ? (
        children
      ) : (
        <div className="fg-screen">
          {head}
          {children}
        </div>
      )}
    </>
  );

  if (!onClick) {
    return (
      <section className={cls} aria-label={ariaLabel}>
        {body}
      </section>
    );
  }
  return (
    <div
      className={cls}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {body}
    </div>
  );
}

/** Показание прибора: подпись, значение, единица, необязательная приписка. */
export function Readout({
  label,
  value,
  unit,
  hint,
  dash,
}: {
  label: string;
  value?: ReactNode;
  unit?: string;
  hint?: string;
  dash?: boolean;
}) {
  return (
    <div className="fg-ro__cell">
      <div className="fg-ro__label">{label}</div>
      <div className={"fg-ro__value" + (dash ? " fg-ro__value--dash" : "")}>
        {dash ? "—" : value}
        {unit && !dash ? <small>{unit}</small> : null}
      </div>
      {hint ? <div className="fg-ro__hint">{hint}</div> : null}
    </div>
  );
}

export function Readouts({ children }: { children: ReactNode }) {
  return <div className="fg-ro">{children}</div>;
}

/** Лампа состояния. Никогда не рисуется без реального источника данных. */
export function Lamp({
  tone = "ok",
  children,
}: {
  tone?: "ok" | "wait" | "err";
  children: ReactNode;
}) {
  return (
    <span className={"fg-lamp" + (tone === "wait" ? " fg-lamp--wait" : tone === "err" ? " fg-lamp--err" : "")}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

export function Lamps({ children }: { children: ReactNode }) {
  return <div className="fg-lamps">{children}</div>;
}

/** Клавиша. Одно поведение и один вид во всех окнах. */
export function Key({
  tone = "plain",
  tiny,
  disabled,
  onClick,
  children,
}: {
  tone?: "primary" | "plain" | "ghost";
  tiny?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const cls = [
    "fg-key",
    tone === "primary" ? "fg-key--primary" : tone === "ghost" ? "fg-key--ghost" : "",
    tiny ? "fg-key--tiny" : "",
    disabled ? "fg-key--off" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function Keys({ children }: { children: ReactNode }) {
  return <div className="fg-keys">{children}</div>;
}

/** Этикетка прибора. Номер — только за реальными данными (партия, стенд, ID). */
export function Sticker({ bars, alt, children }: { bars?: boolean; alt?: boolean; children: ReactNode }) {
  return (
    <span className={"fg-sticker" + (alt ? " fg-sticker--alt" : "")}>
      {bars ? <span className="fg-sticker__bars" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Строки показателей внутри прибора. */
export function Row({ k, v, note }: { k: ReactNode; v: ReactNode; note?: string }) {
  return (
    <div className="fg-row">
      <span className="fg-row__k">{k}</span>
      <span className="fg-row__v">
        {v}
        {note ? <small>{note}</small> : null}
      </span>
    </div>
  );
}

export function Rows({ children }: { children: ReactNode }) {
  return <div className="fg-rows">{children}</div>;
}

/** Честная подпись вместо выдуманного значения. */
export function Gap({ children }: { children: ReactNode }) {
  return <span className="fg-gap">{children}</span>;
}

export function Note({ quiet, children }: { quiet?: boolean; children: ReactNode }) {
  return <p className={"fg-note" + (quiet ? " fg-note--quiet" : "")}>{children}</p>;
}

/** Плитка ресурса: глиф, число, подпись. */
export function Tile({
  icon,
  value,
  name,
  onClick,
}: {
  icon?: string | null;
  value: ReactNode;
  name: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {icon ? <img className="fg-tile__icon" src={icon} alt="" draggable={false} /> : null}
      <span className="fg-tile__val">{value}</span>
      <span className="fg-tile__name">{name}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="fg-tile" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="fg-tile">{inner}</div>
  );
}

export function Tiles({ children }: { children: ReactNode }) {
  return <div className="fg-tiles">{children}</div>;
}
