import React from "react";

export function ProgressRing({
  value,
  max,
  size = 120,
  stroke = 12,
  color = "#FFD700",
  label,
  sub,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sub?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size/2} cy={size/2} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{label ?? `${Math.round(pct * 100)}%`}</div>
        {sub && (sub.startsWith("/")
          ? <img src={sub} alt="" draggable={false} style={{ width: 16, height: 16, objectFit: "contain", marginTop: 2 }} />
          : <div style={{ fontSize: 11, color: "var(--straw)" }}>{sub}</div>)}
      </div>
    </div>
  );
}
