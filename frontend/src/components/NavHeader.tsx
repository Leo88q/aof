import React from "react";
import { ResourceGlyph } from "./visual/ResourceGlyph";
import { useNav } from "../nav/NavContext";

export function NavHeader({ title, tabKey, icon }: { title: string; tabKey: string; icon?: string }) {
  const { stacks, pop } = useNav();
  const canPop = (stacks[tabKey]?.length ?? 0) > 1;
  return (
    <div className="nav-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px" }}>
      <div style={{ minWidth: 60 }}>
        {canPop ? (
          <button className="nav-back" onClick={() => pop(tabKey)} style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "6px 12px", color: "#00D4FF", fontSize: "13px", fontWeight: "bold" }}>
            <span style={{ fontSize: "18px" }}>‹</span> Назад
          </button>
        ) : (
          <div />
        )}
      </div>
      <div className="nav-title" style={{ flex: 1, textAlign: "center", fontSize: "16px", fontWeight: "bold", color: "#00D4FF", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>{icon ? <ResourceGlyph icon={icon} alt="" className="w-5 h-5" /> : null}<span>{title}</span></div>
      <div style={{ minWidth: 60 }} />
    </div>
  );
}
