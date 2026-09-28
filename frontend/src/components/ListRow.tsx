import React from "react";

export function ListRow({
  icon, iconBg, label, value, onClick,
}: {
  icon: string; iconBg: string; label: string; value?: string; onClick?: () => void;
}) {
  return (
    <button className="list-row" onClick={onClick}>
      {/* Прозрачные PNG-иконки лежат прямо на плате, без цветной подложки */}
      <span className="icon" style={icon.startsWith("/") ? undefined : { background: iconBg }}>
        {icon.startsWith("/") ? (
          <img src={icon} alt="" width={28} height={28} style={{ objectFit: "contain", display: "block" }} />
        ) : icon}
      </span>
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
