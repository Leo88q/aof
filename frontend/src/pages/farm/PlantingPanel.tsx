import { useToast } from "../../components/ui/Toast";
import { useLocale } from "../../i18n/LocaleProvider";
import { plantingCopy } from "../../i18n/plantingCopy";
import { useState, useEffect } from "react";
import { Card } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useWalletStr } from "../../lib/useWalletStr";
import { handleTxResponse } from "../../lib/txFlow";
import { actionErrorFeedback } from "../../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../../i18n/walletRuntimeCopy";
import { getMintAsync } from "../../lib/mints";
import { UI_ICONS, resourceIcon } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

interface FarmTile {
  index: number;
  planted: boolean;
  ready: boolean;
  seedsAmount: number;
  progress: number;
  plantedAt: number;
  cropType: string | null;
}

export function PlantingPanel() {
  const { language } = useLocale();
  const copy = plantingCopy[language];
  const toast = useToast();
  const walletAddr = useWalletStr();
  const [tiles, setTiles] = useState<FarmTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<number | null>(null);
  const [seedsAmount, setSeedsAmount] = useState(10);
  const [planting, setPlanting] = useState(false);
  const [harvesting, setHarvesting] = useState<number | null>(null);
  const [seeder, setSeeder] = useState<{ mint: string; pubkey: string } | null>(null);

  useEffect(() => {
    if (!walletAddr) return;
    setLoading(true);
    setTiles([]);
    setSelectedPlot(null);
    loadTiles();
    api.query.myTools(walletAddr)
      .then((tools: any[]) => {
        const found = (tools || []).find((tool: any) =>
          String(tool.toolType || tool.tool_type || "").toLowerCase() === "neural_seeder"
        );
        setSeeder(found?.mint && found?.pubkey ? { mint: found.mint, pubkey: found.pubkey } : null);
      })
      .catch(() => setSeeder(null));
    // Автообновление каждые 10 секунд
    const interval = setInterval(loadTiles, 10000);
    return () => clearInterval(interval);
  }, [walletAddr]);

  async function loadTiles() {
    if (!walletAddr) return;
    try {
      const data = await api.query.farmTiles(walletAddr);
      setTiles(data.tiles || []);
      setLoadError(false);
    } catch (e) {
      console.error("loadTiles:", e);
      // An RPC failure is not an empty farm. Keep no synthetic tile state.
      setTiles([]);
      setLoadError(true);
      setSelectedPlot(null);
    } finally {
      setLoading(false);
    }
  }

  async function handlePlant() {
    if (selectedPlot === null || !walletAddr) return;
    setPlanting(true);
    try {
      const seedsMint = await getMintAsync("NEURON");
      if (!seedsMint) {
        toast.show(copy.missingNeuron, "error", language);
        return;
      }
      const resp = await api.chain.plantSeeds({
        user: walletAddr,
        tileIndex: selectedPlot,
        amount: seedsAmount,
        seedsMint,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(`🌱 ${copy.planted(seedsAmount, selectedPlot + 1)}`, "success", language);
        setSelectedPlot(null);
        setTimeout(loadTiles, 2000);
      } else {
        toast.show(`${r.error || copy.plantFailed}`, "error", language);
      }
    } catch (e: any) {
      toast.show(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse), "error", language);
    } finally {
      setPlanting(false);
    }
  }

  async function handleHarvest(tileIndex: number) {
    if (!walletAddr) return;
    setHarvesting(tileIndex);
    try {
      const wheatMint = await getMintAsync("SYNAPSE");
      if (!wheatMint) {
        toast.show(copy.missingSynapse, "error", language);
        return;
      }
      if (!seeder) {
        toast.show(copy.missingSeeder, "error", language);
        return;
      }
      const toolMint = seeder.mint;
      const resp = await api.chain.harvestWheat({
        user: walletAddr,
        tileIndex,
        wheatMint,
        toolMint,
        toolData: seeder.pubkey,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(`🌱 ${copy.harvested(tileIndex + 1)}`, "success", language);
        setTimeout(loadTiles, 2000);
      } else {
        toast.show(`${r.error || copy.harvestFailed}`, "error", language);
      }
    } catch (e: any) {
      toast.show(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse), "error", language);
    } finally {
      setHarvesting(null);
    }
  }

  if (!walletAddr) {
    return (
      <div lang={language}><Card className="p-4">
        <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><img src={UI_ICONS.plant} alt="" className="w-5 h-5 object-contain" /> {copy.title}</h3>
        <p className="text-straw text-sm text-center py-4">{copy.connectWallet}</p>
      </Card></div>
    );
  }

  if (loading) {
    return (
      <div lang={language}><Card className="p-4">
        <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><img src={UI_ICONS.plant} alt="" className="w-5 h-5 object-contain" /> {copy.title}</h3>
        <p className="text-straw text-sm text-center py-4">{copy.loading}</p>
      </Card></div>
    );
  }

  return (
    <div lang={language}><Card className="p-4 space-y-3">
      <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><img src={UI_ICONS.plant} alt="" className="w-5 h-5 object-contain" /> {copy.title}</h3>

      {loadError ? (
        <p className="text-gold-400 text-sm text-center py-4">
          {copy.networkUnavailable}
        </p>
      ) : (
      <>
      {tiles.length === 0 && <p className="text-straw text-sm text-center py-4">{copy.empty}</p>}
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div
            key={tile.index}
            role="button"
            tabIndex={tile.planted ? -1 : 0}
            onClick={() => !tile.planted && setSelectedPlot(tile.index)}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !tile.planted) { e.preventDefault(); setSelectedPlot(tile.index); } }}
            className={`min-w-0 p-3 rounded-lg text-center transition [overflow-wrap:anywhere] ${
              selectedPlot === tile.index
                ? "bg-sprout-600/30 border-2 border-sprout-500"
                : tile.planted
                ? "bg-gold-900/20 border border-gold-700/40 cursor-not-allowed"
                : "bg-soil-700/50 border border-straw/20 hover:border-sprout-500"
            }`}
          >
            <div className="mb-1">
              {tile.ready ? (
                <ResourceGlyph icon={resourceIcon("SYNAPSE") || ""} alt="" className="w-7 h-7" />
              ) : tile.planted ? (
                <ResourceGlyph icon={resourceIcon("NEURON") || ""} alt="" className="w-7 h-7" />
              ) : (
                <div className="w-7 h-7 rounded border border-straw/10 bg-soil-800/40" />
              )}
            </div>
            <div className="text-[10px] text-parchment font-bold">{copy.well(tile.index + 1)}</div>
            {tile.planted && (
              <>
                <div className="text-[10px] text-straw inline-flex items-center gap-0.5">{tile.seedsAmount} <ResourceGlyph icon={resourceIcon("NEURON") || ""} alt="" className="w-3 h-3" /></div>
                <div className="w-full bg-soil-700 rounded-full h-1 mt-1 overflow-hidden">
                  <div
                    className={`h-full ${tile.ready ? "bg-gold-500" : "bg-sprout-500"}`}
                    style={{ width: `${tile.progress}%` }}
                  />
                </div>
                {tile.ready && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleHarvest(tile.index); }}
                    disabled={harvesting === tile.index || !seeder}
                    title={!seeder ? copy.seederRequired : undefined}
                    className="mt-1 max-w-full text-[10px] bg-gold-600 text-parchment px-2 py-0.5 rounded disabled:opacity-50 [overflow-wrap:anywhere]"
                  >
                    {harvesting === tile.index ? "…" : copy.ready}
                  </button>
                )}
              </>
            )}
            {!tile.planted && <div className="text-[10px] text-straw">{copy.available}</div>}
          </div>
        ))}
      </div>
      </>
      )}

      {!loadError && selectedPlot !== null && (
        <div className="bg-soil-800/50 rounded-lg p-3 space-y-2">
          <p className="text-straw text-xs"><b className="text-parchment">{copy.plantIn(selectedPlot + 1)}</b></p>
          <div className="flex items-center gap-2">
            <span className="text-straw text-xs inline-flex items-center gap-1"><ResourceGlyph icon={resourceIcon("NEURON") || ""} alt="" className="w-3.5 h-3.5" /> {copy.seed}:</span>
            <input
              aria-label={copy.seed}
              type="range"
              min="1"
              max="50"
              value={seedsAmount}
              onChange={(e) => setSeedsAmount(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-parchment font-bold text-sm w-10">{seedsAmount}</span>
          </div>
          <p className="text-[10px] text-straw flex flex-wrap items-center gap-1 justify-center"><ResourceGlyph icon={resourceIcon("power") || ""} alt="" className="w-3.5 h-3.5" /> {copy.cost}: 1 {copy.energy} + {seedsAmount} <ResourceGlyph icon={resourceIcon("neuron") || ""} alt="" className="w-3.5 h-3.5" /></p>
          <button
            onClick={handlePlant}
            disabled={planting}
            className="btn btn-primary"
          >
            {planting ? copy.planting : copy.plantButton(seedsAmount)}
          </button>
        </div>
      )}
    </Card></div>
  );
}
