import React, { useCallback, useEffect, useState } from "react";
import { NavHeader } from "../../components/NavHeader";
import { ListRow, Section } from "../../components/ListRow";
import { useNav } from "../../nav/NavContext";
import { ToolMiningCard } from "../../components/ToolMiningCard";
import { api } from "../../lib/api";
import { useWalletStore } from "../../store/walletStore";
import { PacksPage } from "./PacksPage";
import { CraftPage } from "./CraftPage";
import { RepairPage } from "./RepairPage";
import { CollectionPage } from "./CollectionPage";
import { UI_ICONS } from "../../lib/visualAssets";

export function ToolsHome() {
  const { push } = useNav();
  const { address } = useWalletStore();
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTools = useCallback(async () => {
    if (!address) { setTools([]); return; }
    setLoading(true);
    try {
      const r: any = await api.query.myTools(address);
      setTools(Array.isArray(r) ? r : r?.tools || []);
    } catch {
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { loadTools(); }, [loadTools]);

  const go = (key: string, el: React.ReactNode, title: string) =>
    push("tools", key, (
      <>
        <NavHeader title={title} tabKey="tools" />
        {el}
      </>
    ));

  async function handleMiningAction(action: string, payload: any) {
    console.log("mining action", action, payload);
    await loadTools();
    return { ok: true };
  }

  return (
    <>
      <NavHeader title="Инструменты" tabKey="tools" />
      <div className="large-title">Инструменты</div>

      <Section label="Мастерская">
        <div className="list">
          <ListRow icon={UI_ICONS.packs} iconBg="rgba(90, 176, 214, 0.2)" label="Паки (выпуск)"
            onClick={() => go("packs", <PacksPage />, "Паки")} />
          <ListRow icon={UI_ICONS.craft} iconBg="rgba(107, 191, 89, 0.2)" label="Крафт (апгрейд)"
            onClick={() => go("craft", <CraftPage />, "Крафт")} />
          <ListRow icon={UI_ICONS.repair} iconBg="rgba(232, 163, 61, 0.2)" label="Ремонт"
            onClick={() => go("repair", <RepairPage />, "Ремонт")} />
          <ListRow icon="▣" iconBg="rgba(94, 231, 255, 0.16)" label="Коллекция · 26 ресурсов и 25 NFT"
            onClick={() => go("collection", <CollectionPage />, "Коллекция")} />
        </div>
      </Section>

      <Section label="Ваши инструменты">
        <div className="content-pad">
          {!address && (
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 40 }}>👛</div>
              <div style={{ color: "var(--straw)", marginTop: 8 }}>
                Подключите кошелёк, чтобы увидеть инвентарь
              </div>
            </div>
          )}
          {address && tools.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 40 }}>🧰</div>
              <div style={{ color: "var(--straw)", marginTop: 8 }}>
                {loading ? "Loading…" : "Инструментов пока нет — откройте первый пак ✨"}
              </div>
            </div>
          )}
          {tools.map((tool) => (
            <ToolMiningCard key={tool.mint} tool={tool} onAction={handleMiningAction} onChanged={loadTools} />
          ))}
        </div>
      </Section>
    </>
  );
}
