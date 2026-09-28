import React, { useCallback, useEffect, useState } from "react";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
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
import { Note, Panel, Readout, Readouts, Sticker } from "../../ui/forge/kit";
import { MixerStrips } from "../../ui/forge/devices";

export function ToolsHome() {
  const { push } = useNav();
  const { address } = useWalletStore();
  // null = не прочитано (загрузка или сбой), [] = пусто по-настоящему.
  const [tools, setTools] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTools = useCallback(async () => {
    if (!address) { setTools(null); return; }
    setLoading(true);
    try {
      const r: any = await api.query.myTools(address);
      setTools(Array.isArray(r) ? r : r?.tools || []);
    } catch {
      setTools(null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { loadTools(); }, [loadTools]);

  // Каналы пульта: реальные инструменты из /query/my-tools, а до подключения
  // кошелька — каталог инструментов в положении «нет данных» (пустая стойка
  // честно подписана, выдуманной прочности нет).
  const CATALOG: Array<{ key: string; name: string }> = [
    { key: "plasma_cutter", name: "Плазменный резчик" },
    { key: "silicon_extractor", name: "Экстрактор кремния" },
    { key: "data_harvester", name: "Сборщик данных" },
    { key: "quantum_transmitter", name: "Квантовый передатчик" },
    { key: "neural_seeder", name: "Станция засева" },
  ];
  const rack = tools ?? [];
  const channels = rack.length
    ? rack.slice(0, 8).map((tool: any) => ({
        key: tool.mint,
        name: tool.toolType || "инструмент",
        load: Number.isFinite(Number(tool.durability)) ? Number(tool.durability) / 20 : null,
        hours: Number.isFinite(Number(tool.durability)) ? Number(tool.durability) : null,
        active: !!(tool.isMining || tool.mining),
      }))
    : CATALOG.map((c) => ({ key: c.key, name: c.name, load: null, hours: null, active: false }));
  const working = rack.filter((t: any) => t.isMining || t.mining).length;
  const rackNote = !address
    ? "Подключи кошелёк — покажем прочность твоих инструментов."
    : tools === null
      ? "Стойка не читается: сеть не ответила."
      : rack.length === 0
        ? "Инструментов пока нет: собери первый в кузнице или открой капсулу."
        : "";

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

      {/* К5 · пульт стоит на экране всегда: без кошелька каналы показывают
          каталог инструментов в режиме «нет данных», чтобы приборная панель
          мастерской была видна и до подключения. */}
      <div className="content-pad" style={{ marginBottom: 12 }}>
        <Panel
          tier="panel"
          device="mix"
          id={<Sticker>{rack.length ? `СТОЙКА · ${rack.length}` : "СТОЙКА"}</Sticker>}
          meta={rack.length ? "ПУЛЬТ" : "НЕТ ДАННЫХ"}
          title="Пульт мастерской"
          sub="прочность и режим каналов"
        >
          <MixerStrips maxHours={20} channels={channels} />
          <div style={{ marginTop: 14 }}>
            <Readouts>
              <Readout
                label="В работе"
                value={rack.length ? String(working) : undefined}
                dash={!rack.length}
                hint={rack.length ? "каналы с включённым M" : "нет данных о смене"}
              />
              <Readout
                label="В стойке"
                value={rack.length ? String(rack.length) : undefined}
                dash={!rack.length}
                hint={rack.length ? "всего инструментов" : "стойка пуста"}
              />
            </Readouts>
          </div>
          {rackNote && <Note quiet>{rackNote}</Note>}
        </Panel>
      </div>

      <Section label="Ваши инструменты">
        <div className="content-pad">
          {!address && (
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <ResourceGlyph icon={UI_ICONS.inbox} alt="" className="w-10 h-10 inline-block" />
              <div style={{ color: "var(--fg-dim)", marginTop: 8 }}>
                Подключите кошелёк, чтобы увидеть инвентарь
              </div>
            </div>
          )}
          {address && tools === null && (
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <ResourceGlyph icon={UI_ICONS.adminGear} alt="" className="w-10 h-10 inline-block" />
              <div style={{ color: "var(--fg-dim)", marginTop: 8 }}>
                {loading
                  ? "Читаем инструменты…"
                  : "Инструменты недоступны из сети — не удалось прочитать стойку"}
              </div>
            </div>
          )}
          {address && tools !== null && tools.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <ResourceGlyph icon={UI_ICONS.adminGear} alt="" className="w-10 h-10 inline-block" />
              <div style={{ color: "var(--fg-dim)", marginTop: 8 }}>
                Инструментов пока нет — откройте первую капсулу дропа
              </div>
            </div>
          )}
          {(tools ?? []).map((tool) => (
            <ToolMiningCard key={tool.mint} tool={tool} onAction={handleMiningAction} onChanged={loadTools} />
          ))}
        </div>
      </Section>
    </>
  );
}
