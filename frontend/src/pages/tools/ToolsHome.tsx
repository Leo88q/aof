import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "../../i18n/LocaleProvider";
import { toolsCopy, toolName } from "../../i18n/toolsCopy";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { NavHeader } from "../../components/NavHeader";
import type { GameHeaderId } from "../../i18n/gameHeaders";
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
  const { language } = useLocale();
  const copy = toolsCopy[language].home;
  const { push } = useNav();
  const { address } = useWalletStore();
  // null = не прочитано (загрузка или сбой), [] = пусто по-настоящему.
  const [tools, setTools] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedAddress, setLoadedAddress] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadTools = useCallback(async () => {
    const request = ++requestId.current;
    if (!address) { setTools(null); setLoadedAddress(null); setLoading(false); return; }
    setLoading(true);
    try {
      const r: any = await api.query.myTools(address);
      const items = Array.isArray(r) ? r : r?.tools;
      if (!Array.isArray(items)) throw new Error("Unexpected tools response");
      if (request === requestId.current) { setTools(items); setLoadedAddress(address); }
    } catch {
      if (request === requestId.current) { setTools(null); setLoadedAddress(null); }
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadTools();
    return () => { requestId.current++; };
  }, [loadTools]);
  // Never show another wallet's cached tools, or render a failed read as []/zero.
  const knownTools = address && loadedAddress === address && !loading ? tools : null;

  // Каналы пульта: реальные инструменты из /query/my-tools, а до подключения
  // кошелька — каталог инструментов в положении «нет данных» (пустая стойка
  // честно подписана, выдуманной прочности нет).
  const CATALOG = (['plasma_cutter', 'silicon_extractor', 'data_harvester', 'quantum_transmitter', 'neural_seeder'] as const)
    .map(key => ({ key, name: toolsCopy[language].names[key] }));
  const rack = knownTools ?? [];
  const channels = rack.length
    ? rack.slice(0, 8).map((tool: any) => ({
        key: tool.mint,
        name: toolName(language, tool.toolType),
        load: tool.durability != null && Number.isFinite(Number(tool.durability)) ? Number(tool.durability) / 20 : null,
        hours: tool.durability != null && Number.isFinite(Number(tool.durability)) ? Number(tool.durability) : null,
        active: !!(tool.isMining || tool.mining),
      }))
    : CATALOG.map((c) => ({ key: c.key, name: c.name, load: null, hours: null, active: false }));
  const working = rack.filter((t: any) => t.isMining || t.mining).length;
  const rackNote = !address ? copy.connectHint
    : knownTools === null ? (loading || loadedAddress !== address && tools !== null ? copy.loadingHint : copy.networkHint)
    : rack.length === 0 ? copy.emptyHint : "";
  const go = (key: string, el: React.ReactNode, headerId: GameHeaderId) =>
    push("tools", key, (
      <>
        <NavHeader headerId={headerId} tabKey="tools" />
        {el}
      </>
    ));

  return (
    <>
      <NavHeader title={copy.title} tabKey="tools" />
      <div className="large-title" lang={language}>{copy.title}</div>

      <div lang={language}>
        <Section label={copy.workshop}>
          <div className="list">
          <ListRow icon={UI_ICONS.packs} iconBg="rgba(90, 176, 214, 0.2)" label={copy.packs}
            onClick={() => go("packs", <PacksPage />, 'capsules')} />
          <ListRow icon={UI_ICONS.craft} iconBg="rgba(107, 191, 89, 0.2)" label={copy.craft}
            onClick={() => go("craft", <CraftPage />, 'craft')} />
          <ListRow icon={UI_ICONS.repair} iconBg="rgba(232, 163, 61, 0.2)" label={copy.repair}
            onClick={() => go("repair", <RepairPage />, 'repair')} />
          <ListRow icon="▣" iconBg="rgba(94, 231, 255, 0.16)" label={copy.collection}
            onClick={() => go("collection", <CollectionPage />, 'collection')} />
          </div>
        </Section>

      {/* К5 · пульт стоит на экране всегда: без кошелька каналы показывают
          каталог инструментов в режиме «нет данных», чтобы приборная панель
          мастерской была видна и до подключения. */}
      <div className="content-pad" style={{ marginBottom: 12 }}>
        <Panel
          tier="panel"
          device="mix"
          id={<Sticker>{rack.length ? `${copy.sticker} · ${rack.length}` : copy.sticker}</Sticker>}
          meta={knownTools === null ? copy.noData : rack.length ? copy.console : copy.emptyRack}
          title={copy.consoleTitle}
          sub={copy.consoleSubtitle}
        >
          <MixerStrips maxHours={20} channels={channels} labels={{ active: copy.working, racked: copy.onRack }} />
          <div style={{ marginTop: 14 }}>
            <Readouts>
              <Readout
                label={copy.working}
                value={knownTools !== null ? String(working) : undefined}
                dash={knownTools === null}
                hint={rack.length ? copy.channelsOn : knownTools !== null ? copy.emptyRack : copy.noShift}
              />
              <Readout
                label={copy.onRack}
                value={knownTools !== null ? String(rack.length) : undefined}
                dash={knownTools === null}
                hint={rack.length ? copy.totalTools : copy.emptyRack}
              />
            </Readouts>
          </div>
          {rackNote && <Note quiet>{rackNote}</Note>}
        </Panel>
      </div>

      <Section label={copy.inventory}>
        <div className="content-pad">
          {!address && (
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <ResourceGlyph icon={UI_ICONS.inbox} alt="" className="w-10 h-10 inline-block" />
              <div style={{ color: "var(--fg-dim)", marginTop: 8 }}>
                {copy.inventoryConnect}
              </div>
            </div>
          )}
          {address && knownTools === null && (
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <ResourceGlyph icon={UI_ICONS.adminGear} alt="" className="w-10 h-10 inline-block" />
              <div style={{ color: "var(--fg-dim)", marginTop: 8 }}>
                {loading || loadedAddress !== address && tools !== null
                  ? copy.inventoryLoading
                  : copy.inventoryUnavailable}
              </div>
            </div>
          )}
          {address && knownTools !== null && knownTools.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <ResourceGlyph icon={UI_ICONS.adminGear} alt="" className="w-10 h-10 inline-block" />
              <div style={{ color: "var(--fg-dim)", marginTop: 8 }}>
                {copy.inventoryEmpty}
              </div>
            </div>
          )}
          {(knownTools ?? []).map((tool) => (
            <ToolMiningCard key={tool.mint} tool={tool} onChanged={loadTools} />
          ))}
        </div>
      </Section>
      </div>
    </>
  );
}
