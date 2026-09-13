import React from "react";

export function ListRow({
  icon, iconBg, label, value, onClick,
}: {
  icon: string; iconBg: string; label: string; value?: string; onClick?: () => void;
}) {
  return (
    <button className="list-row" onClick={onClick}>
      <span className="icon" style={{ background: iconBg }}>{icon}</span>
      <span className="label">{label}</span>
      {value && <span className="value">{value}</span>}
      <span className="chevron">›</span>
    </button>
  );
}

export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="section-label">{label}</div>
      <div className="content-pad">{children}</div>
    </>
  );
}
