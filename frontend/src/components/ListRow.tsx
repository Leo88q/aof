import React from "react";

export function ListRow({
  icon, label, value, onClick,
}: {
  icon: string;
  /** Оставлено для совместимости вызовов: подложка теперь одна на весь список
      (см. .list-row .icon в theme/forge.css), цветные плитки убраны. */
  iconBg?: string;
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  return (
    <button className="list-row" onClick={onClick}>
      {/* Прозрачные PNG-иконки лежат прямо на плате, без цветной подложки */}
      <span className="icon">
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
