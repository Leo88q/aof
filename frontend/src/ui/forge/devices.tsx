import { ReactNode } from "react";

/**
 * Восемь аппаратов набора (Этап 2, 2026-09-28). Каждый — из своей отрасли,
 * объединены палитрой, материалами и правилами света (см. theme/forge.css).
 *
 * Все компоненты принимают только реальные данные. Если данных нет —
 * вызывающий код передаёт `null`, и прибор рисует прочерк или пустую колбу,
 * а не ноль (правило проекта: «неизвестно» ≠ «пусто»).
 */

/* ─────────────── Криобанк: стеллаж соломинок и сосуд с азотом ─────────────── */

export type Straw = {
  key: string;
  /** Подпись под соломинкой: имя ресурса или «—». */
  name: string;
  /** Число под соломинкой (уже отформатированное) или «—». */
  value: string;
  /** Уровень 0…1. null — сосуда нет / данных нет. */
  level: number | null;
  reward?: boolean;
};

export function CryoRack({
  title,
  meta,
  slots,
  onSlot,
}: {
  title: string;
  meta?: string;
  slots: Straw[];
  onSlot?: (key: string) => void;
}) {
  return (
    <div className="cryo-rack">
      <div className="cryo-rack__id">
        <span>{title}</span>
        {meta ? <span>{meta}</span> : null}
      </div>
      <div className="slots">
        {slots.map((s) => {
          const empty = s.level === null;
          return (
            <button
              key={s.key}
              type="button"
              className={"slot" + (empty ? " slot--empty" : "")}
              onClick={onSlot ? () => onSlot(s.key) : undefined}
              title={`${s.name}: ${s.value}`}
            >
              <span className={"straw" + (empty ? " straw--empty" : "")}>
                <span className={"straw__cap" + (s.reward ? " straw__cap--reward" : "")} />
                {!empty && s.level! > 0 ? (
                  <span
                    className={"straw__liq" + (s.reward ? " straw__liq--reward" : "")}
                    style={{ height: `${Math.round(Math.min(1, Math.max(0.04, s.level!)) * 100)}%` }}
                  />
                ) : null}
              </span>
              <span className="slot__val fg-num">{s.value}</span>
              <span className="slot__name">{s.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Dewar({ level, label = "ЖИДК. N₂" }: { level: number | null; label?: string }) {
  return (
    <div className="dewar">
      <div className="dewar__glass">
        {level !== null ? <div className="dewar__ln2" style={{ height: `${Math.round(level * 100)}%` }} /> : null}
      </div>
      <small>{label}</small>
      <small className="fg-num" style={{ color: "var(--fg-text)", fontSize: 12 }}>
        {level === null ? "—" : `${Math.round(level * 100)} %`}
      </small>
    </div>
  );
}

/* ─────────────── Микшерный пульт: канальные полосы инструментов ─────────────── */

export type Channel = {
  key: string;
  name: string;
  /** Загрузка 0…1 (прочность/занятость) — положение стрелки. null — нет данных. */
  load: number | null;
  /** Часы работы: положение фейдера. null — канал не работает. */
  hours: number | null;
  active?: boolean;
  onToggle?: () => void;
};

export function MixerStrips({
  channels,
  maxHours = 12,
  onChannel,
}: {
  channels: Channel[];
  maxHours?: number;
  onChannel?: (key: string) => void;
}) {
  return (
    <div className="strips">
      {channels.map((c) => {
        const idle = c.hours === null;
        const fader = idle ? 0 : Math.min(1, Math.max(0, c.hours! / maxHours));
        const needle = c.load === null ? null : -52 + 104 * Math.min(1, Math.max(0, c.load));
        return (
          <div key={c.key} className={"strip" + (idle ? " strip--idle" : "")}>
            <span className="strip__name">{c.name}</span>
            <svg className="vu" viewBox="0 0 46 30" aria-hidden="true">
              <path className="arc" d="M6 26 A 20 20 0 0 1 40 26" />
              <path className="tick" d="M23 8 v3" />
              <line
                className="needle"
                x1="23"
                y1="26"
                x2="23"
                y2="8"
                style={{
                  transformOrigin: "23px 26px",
                  transform: `rotate(${needle === null ? -52 : needle}deg)`,
                  stroke: needle === null ? "#6B7684" : undefined,
                }}
              />
            </svg>
            <span className="fader">
              <span className="fader__track" />
              {!idle ? <span className="fader__fill" style={{ height: `${Math.round(fader * 92)}%` }} /> : null}
              <span className="fader__knob" style={{ bottom: `${4 + Math.round(fader * 84)}%` }} />
            </span>
            <span className="strip__mini">
              <button
                type="button"
                className={"mini" + (c.active ? " mini--on" : "")}
                onClick={onChannel ? () => onChannel(c.key) : undefined}
                aria-pressed={!!c.active}
                title="в работе"
              >
                M
              </button>
              <button type="button" className="mini" title="в стойке">
                S
              </button>
            </span>
            <span className="strip__val fg-num">{c.hours === null ? "—" : c.hours}</span>
          </div>
        );
      })}
    </div>
  );
}

export function MixerBus({ label, value, dash }: { label: string; value?: string; dash?: boolean }) {
  return (
    <div className="mix__bus">
      <span>{label}</span>
      <i aria-hidden="true" />
      <span className="fg-num" style={{ color: "var(--fg-text)" }}>
        {dash || !value ? "—" : value}
      </span>
    </div>
  );
}

/* ─────────────── Эхолот: лента глубины ─────────────── */

export type EchoMark = { at: number; depth: number; size?: number };

export function EchoTrace({
  marks,
  depth,
}: {
  marks: EchoMark[];
  /** Текущая глубина 0…1 или null, если эхолот молчит. */
  depth: number | null;
}) {
  const W = 420;
  const H = 118;
  const y = (d: number) => 8 + d * (H - 30);
  const bottom =
    depth === null
      ? `M0 ${H} L${W} ${H}`
      : `M0 ${y(depth)} C 60 ${y(depth) - 4}, 90 ${y(depth) + 6}, 150 ${y(depth) + 2}` +
        ` C 210 ${y(depth) - 2}, 250 ${y(depth) + 8}, 310 ${y(depth) + 4}` +
        ` C 360 ${y(depth) + 1}, 390 ${y(depth) - 6}, ${W} ${y(depth) - 8}`;
  return (
    <svg className="echo" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Лента глубины: добыча во времени">
      <g className="grid">
        <line x1="0" y1={y(0)} x2={W} y2={y(0)} />
        <line x1="0" y1={y(0.33)} x2={W} y2={y(0.33)} />
        <line x1="0" y1={y(0.66)} x2={W} y2={y(0.66)} />
        <line x1="0" y1={y(1)} x2={W} y2={y(1)} />
      </g>
      <text className="gridlabel" x="6" y={y(0) - 3}>0 м</text>
      <text className="gridlabel" x="6" y={y(0.5) - 3}>40</text>
      <text className="gridlabel" x="6" y={y(1) - 3}>80</text>
      <path className="bottom" d={`${bottom} L${W} ${H} L0 ${H} Z`} />
      {marks.map((m, i) => (
        <g key={i}>
          <path className="target" d={`M${m.at - 8} ${y(m.depth)} a${10 + (m.size ?? 1) * 4} ${10 + (m.size ?? 1) * 4} 0 0 1 ${20 + (m.size ?? 1) * 8} 0`} />
          <circle className="blip" cx={m.at + (m.size ?? 1) * 2} cy={y(m.depth) - 2} r={2 + (m.size ?? 1) * 0.4} />
        </g>
      ))}
      {depth !== null ? <rect className="sweep-line" x="0" y="0" width="2" height={H} /> : null}
    </svg>
  );
}

export function SonarPPI({
  blips,
  legend,
}: {
  blips: { x: number; y: number; r?: number }[];
  legend: ReactNode;
}) {
  return (
    <div className="ppi-wrap">
      <svg className="ppi" viewBox="0 0 120 120" role="img" aria-label="Круговой индикатор">
        <defs>
          <radialGradient id="fg-sweepg">
            <stop offset="0%" stopColor="rgba(143,227,240,.42)" />
            <stop offset="100%" stopColor="rgba(143,227,240,0)" />
          </radialGradient>
        </defs>
        <circle className="ring" cx="60" cy="60" r="52" />
        <circle className="ring ring--thin" cx="60" cy="60" r="34" />
        <circle className="ring ring--thin" cx="60" cy="60" r="16" />
        <g className="tick">
          <line x1="60" y1="8" x2="60" y2="13" />
          <line x1="112" y1="60" x2="107" y2="60" />
          <line x1="60" y1="112" x2="60" y2="107" />
          <line x1="8" y1="60" x2="13" y2="60" />
        </g>
        <g className="ppi__sweep">
          <path d="M60 60 L60 8 A52 52 0 0 1 96 24 Z" fill="url(#fg-sweepg)" />
        </g>
        {blips.map((b, i) => (
          <circle key={i} className="blip" cx={b.x} cy={b.y} r={b.r ?? 2.4} />
        ))}
      </svg>
      <div className="sonar__legend">{legend}</div>
    </div>
  );
}

/* ─────────────── Микропланшет 96 лунок ─────────────── */

export type WellState = "empty" | "q" | "g" | "d" | "x";
export type PlateWell = { r: number; c: number; state: WellState; level?: number; title?: string };

export function PlateGrid({
  wells,
  rows = 8,
  cols = 12,
  onWell,
}: {
  wells: PlateWell[];
  rows?: number;
  cols?: number;
  onWell?: (w: PlateWell) => void;
}) {
  const at = new Map(wells.map((w) => [`${w.r}:${w.c}`, w]));
  const letters = "ABCDEFGH".slice(0, rows).split("");
  const cells: ReactNode[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const w = at.get(`${r}:${c}`);
      const state = w?.state ?? "empty";
      const cls =
        "well" +
        (state !== "empty" ? ` well--${state}` : "");
      const style =
        state === "g" ? ({ ["--h" as string]: `${Math.round((w?.level ?? 0.5) * 100)}%` } as React.CSSProperties) : undefined;
      cells.push(
        <button
          key={`${r}-${c}`}
          type="button"
          className={cls}
          style={style}
          title={w?.title ?? `${letters[r]}${c + 1}`}
          aria-label={w?.title ?? `${letters[r]}${c + 1}`}
          onClick={onWell && w ? () => onWell(w) : undefined}
        />,
      );
    }
  }
  return (
    <div className="plate-frame">
      <div className="plate-lab plate-lab--rows">
        {letters.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="wells">{cells}</div>
      <div className="plate-lab plate-lab--cols">
        {Array.from({ length: cols }, (_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
    </div>
  );
}

export function PlateReader({
  boxes,
  onRead,
}: {
  boxes: { label: string; value: ReactNode; dash?: boolean; tone?: "err" }[];
  onRead?: () => void;
}) {
  return (
    <div className="reader">
      {boxes.map((b) => (
        <div className="reader__box" key={b.label}>
          <div className="fg-ro__label">{b.label}</div>
          <div
            className="fg-ro__value"
            style={{ fontSize: 18, color: b.tone === "err" ? "var(--fg-err)" : undefined }}
          >
            {b.dash ? "—" : b.value}
          </div>
        </div>
      ))}
      {onRead ? (
        <button type="button" className="fg-key fg-key--primary" onClick={onRead}>
          Считать
        </button>
      ) : null}
    </div>
  );
}

/* ─────────────── Гель-электрофорез ─────────────── */

export type GelBand = { at: number; kind?: "fresh" | "weak" | "ref" };
export type GelLane = { key: string; name: string; bands: GelBand[] };

export function GelLanes({ lanes }: { lanes: GelLane[] }) {
  return (
    <div className="gel-bed">
      <div className="lanes">
        {lanes.map((l) => (
          <div className="lane" key={l.key}>
            <span className="lane__well" />
            {l.bands.map((b, i) => (
              <span
                key={i}
                className={
                  "band" + (b.kind === "weak" ? " band--weak" : b.kind === "ref" ? " band--ref" : "")
                }
                style={{ top: `${Math.round(Math.min(0.94, Math.max(0.04, b.at)) * 100)}%` }}
              />
            ))}
            <span className="lane__name">{l.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── Кросс-панель: порты и патч-корды ─────────────── */

export type CrossPort = { label: string; lamp?: "ok" | "idle" | "err" };
export type CrossLink = { from: number; to: number; cord: 1 | 2 | 3 | 4 | "free"; pulse?: boolean };

export function CrossPanel({
  top,
  bottom,
  links,
}: {
  top: CrossPort[];
  bottom: CrossPort[];
  links: CrossLink[];
}) {
  const W = 420;
  const topY = 12;
  const botY = 132;
  const px = (i: number, count: number) => 14 + (i * (W - 28)) / Math.max(1, count - 1);
  const cords = links.map((l, idx) => {
    const x1 = px(l.from, top.length);
    const x2 = px(l.to, bottom.length);
    const sag = 40 + ((idx * 17) % 46);
    const d = `M${x1} ${topY + 16} C ${x1} ${topY + 16 + sag}, ${x2} ${botY - sag}, ${x2} ${botY}`;
    return { ...l, d };
  });
  return (
    <svg className="cross-svg" viewBox={`0 0 ${W} 168`} role="img" aria-label="Кросс-панель">
      {top.map((p, i) => {
        const x = px(i, top.length) - 17;
        return (
          <g key={`t${i}`}>
            <rect className="port" x={x} y={topY} width="34" height="16" rx="3" />
            <circle className="port__hole" cx={x + 10} cy={topY + 8} r="2.4" />
            <circle className="port__hole" cx={x + 24} cy={topY + 8} r="2.4" />
            <text className="port__num" x={x} y={topY - 3}>{String(i + 1).padStart(2, "0")}</text>
            <circle
              className={"port__lamp" + (p.lamp === "idle" ? " port__lamp--idle" : "")}
              cx={x + 4}
              cy={topY + 23}
              r="2.4"
            />
          </g>
        );
      })}
      {cords.map((c, i) => (
        <path key={`c${i}`} className={`cord cord--${c.cord}`} d={c.d} />
      ))}
      {cords
        .filter((c) => c.pulse)
        .map((c, i) => (
          <circle key={`p${i}`} className="pulse" r="3.2" style={{ offsetPath: `path('${c.d}')`, animationDelay: `${-i * 1.4}s` }} />
        ))}
      {bottom.map((p, i) => {
        const x = px(i, bottom.length) - 17;
        return (
          <g key={`b${i}`}>
            <rect className="port" x={x} y={botY} width="34" height="16" rx="3" />
            <circle className="port__hole" cx={x + 10} cy={botY + 8} r="2.4" />
            <circle className="port__hole" cx={x + 24} cy={botY + 8} r="2.4" />
            <text className="port__num" x={x} y={botY + 28}>{p.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─────────────── Перфокарты Жаккарда ─────────────── */

export type StepState = "done" | "next" | "open";

export function PunchedCard({
  title,
  steps,
  rows = 5,
  footLeft,
  footMid,
  footRight,
}: {
  title: string;
  steps: StepState[];
  rows?: number;
  footLeft?: string;
  footMid?: string;
  footRight?: string;
}) {
  const holes: ReactNode[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < steps.length; c += 1) {
      const st = steps[c];
      // у сделанных шагов пробиты не все ряды — как на настоящей карте
      const punched = st === "done" && (c % 3 === 0 ? r === 1 || r === 2 : r === 0 || r === 2 || r === 4);
      holes.push(
        <span
          key={`${r}-${c}`}
          className={"hole" + (punched ? " hole--punched" : st === "next" ? " hole--next" : "")}
        />,
      );
    }
  }
  const done = steps.filter((s) => s === "done").length;
  return (
    <div className="card-stack">
      <div className="pcard">
        <div className="pcard__head">
          <span>{title}</span>
          <span>
            {done}/{steps.length}
          </span>
        </div>
        <div className="holes">{holes}</div>
        <div className="pcard__foot">
          <span>{footLeft ?? `ПРОБИТО ${done}`}</span>
          <span>{footMid ?? ""}</span>
          <span>{footRight ?? `ОСТАЛОСЬ ${steps.length - done}`}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Барограф: барабанная диаграмма ─────────────── */

export function DrumChart({
  points,
  dayLabels,
  scaleLabels = ["ФРЕНЗИ", "НОМИНАЛ", "БЛЭКАУТ"],
}: {
  /** Значения 0…1 по точкам ленты. Пустой массив — пера нет. */
  points: number[];
  dayLabels: string[];
  scaleLabels?: [string, string, string] | string[];
}) {
  const W = 420;
  const H = 112;
  const y = (v: number) => 8 + v * (H - 26);
  const path =
    points.length > 1
      ? points
          .map((v, i) => {
            const x = (i * W) / (points.length - 1);
            return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y(v).toFixed(1)}`;
          })
          .join(" ")
      : "";
  const last = points.length ? points[points.length - 1] : null;
  return (
    <div className="drum">
      <div className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Лента нагрузки сети">
          <g className="hgrid">
            {[0.1, 0.4, 0.7, 1].map((v) => (
              <line key={v} x1="0" y1={y(v)} x2={W} y2={y(v)} />
            ))}
          </g>
          <g className="vtime">
            {dayLabels.map((_, i) => (
              <line key={i} x1={(i + 1) * (W / (dayLabels.length + 1))} y1="0" x2={(i + 1) * (W / (dayLabels.length + 1))} y2={H} />
            ))}
          </g>
          <text x="4" y="12">{scaleLabels[0]}</text>
          <text x="4" y={y(0.55)}>{scaleLabels[1]}</text>
          <text x="4" y={y(1)}>{scaleLabels[2]}</text>
          {dayLabels.map((d, i) => (
            <text key={d} x={16 + i * (W / (dayLabels.length + 1))} y={H - 4}>
              {d}
            </text>
          ))}
          {path ? <path className="pen" d={path} /> : null}
          {last !== null ? <circle className="pen-now" cx={W} cy={y(last)} r="3.6" /> : null}
        </svg>
      </div>
      <div className="baro__drumedge" aria-hidden="true" />
    </div>
  );
}

/* ─────────────── Монитор состояния ─────────────── */

export function StateMonitor({
  items,
  trace,
}: {
  items: { label: string; value?: ReactNode; unit?: string; dash?: boolean }[];
  /** Волна 0…1; пусто — прибор не пишет линию. */
  trace: number[];
}) {
  const W = 420;
  const H = 94;
  const points = trace.length > 1 ? trace : [];
  const path =
    points.length > 1
      ? points.map((v, i) => `${i === 0 ? "M" : "L"}${((i * W) / (points.length - 1)).toFixed(1)} ${(74 - v * 52).toFixed(1)}`).join(" ")
      : "";
  return (
    <>
      <div className="wave">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Волна состояния">
          <defs>
            <pattern id="fg-mm3" width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M6 0H0V6" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth=".6" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#fg-mm3)" />
          {path ? (
            <>
              <path className="trace" d={path} />
              <path className="trace trace--sweep" d={path} />
            </>
          ) : (
            <text x="12" y={H / 2} fill="var(--fg-muted)" fontSize="11">
              линия не пишется — нет данных
            </text>
          )}
        </svg>
      </div>
      <div className="big-ro" style={{ marginTop: 14 }}>
        {items.map((it) => (
          <div key={it.label}>
            <div className="big-ro__l">{it.label}</div>
            <div className={"big-ro__v" + (it.dash ? " big-ro__v--dash" : "")}>
              {it.dash ? "—" : it.value}
              {!it.dash && it.unit ? <small>{it.unit}</small> : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
