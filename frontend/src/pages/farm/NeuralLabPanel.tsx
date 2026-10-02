import { useToast } from "../../components/ui/Toast";
import { useLocale } from "../../i18n/LocaleProvider";
import { neuralLabCopy } from "../../i18n/neuralLabCopy";
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

interface LabTile {
  index: number;
  active: boolean;
  ready: boolean;
  neuronAmount: number;
  progress: number;
  startedAt: number;
  outputKind: string | null;
}

export function NeuralLabPanel() {
  const { language } = useLocale();
  const copy = neuralLabCopy[language];
  const toast = useToast();
  const walletAddr = useWalletStr();
  const [tiles, setTiles] = useState<LabTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [neuronAmount, setNeuronAmount] = useState(10);
  const [startingSynthesis, setStartingSynthesis] = useState(false);
  const [collectingTileIndex, setCollectingTileIndex] = useState<number | null>(null);
  const [seeder, setSeeder] = useState<{ mint: string; pubkey: string } | null>(null);

  useEffect(() => {
    if (!walletAddr) return;
    setLoading(true);
    setTiles([]);
    setSelectedCell(null);
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
      const data = await api.query.labTiles(walletAddr);
      setTiles(data.tiles || []);
      setLoadError(false);
    } catch (e) {
      console.error("loadLabTiles:", e);
      // An RPC failure is not an empty laboratory. Keep no synthetic cell state.
      setTiles([]);
      setLoadError(true);
      setSelectedCell(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartSynthesis() {
    if (selectedCell === null || !walletAddr) return;
    setStartingSynthesis(true);
    try {
      const neuronMint = await getMintAsync("NEURON");
      if (!neuronMint) {
        toast.show(copy.missingNeuron, "error", language);
        return;
      }
      const resp = await api.chain.plantNeuron({
        user: walletAddr,
        tileIndex: selectedCell,
        amount: neuronAmount,
        neuronMint,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(`🧠 ${copy.started(neuronAmount, selectedCell + 1)}`, "success", language);
        setSelectedCell(null);
        setTimeout(loadTiles, 2000);
      } else {
        toast.show(`${r.error || copy.startFailed}`, "error", language);
      }
    } catch (e: any) {
      toast.show(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse), "error", language);
    } finally {
      setStartingSynthesis(false);
    }
  }

  async function handleCollectSynapse(tileIndex: number) {
    if (!walletAddr) return;
    setCollectingTileIndex(tileIndex);
    try {
      const synapseMint = await getMintAsync("SYNAPSE");
      if (!synapseMint) {
        toast.show(copy.missingSynapse, "error", language);
        return;
      }
      if (!seeder) {
        toast.show(copy.missingSeeder, "error", language);
        return;
      }
      const toolMint = seeder.mint;
      const resp = await api.chain.harvestSynapse({
        user: walletAddr,
        tileIndex,
        synapseMint,
        toolMint,
        toolData: seeder.pubkey,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(`🧠 ${copy.collected(tileIndex + 1)}`, "success", language);
        setTimeout(loadTiles, 2000);
      } else {
        toast.show(`${r.error || copy.collectFailed}`, "error", language);
      }
    } catch (e: any) {
      toast.show(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse), "error", language);
    } finally {
      setCollectingTileIndex(null);
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
            tabIndex={tile.active ? -1 : 0}
            onClick={() => !tile.active && setSelectedCell(tile.index)}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !tile.active) { e.preventDefault(); setSelectedCell(tile.index); } }}
            className={`min-w-0 p-3 rounded-lg text-center transition [overflow-wrap:anywhere] ${
              selectedCell === tile.index
                ? "bg-sprout-600/30 border-2 border-sprout-500"
                : tile.active
                ? "bg-gold-900/20 border border-gold-700/40 cursor-not-allowed"
                : "bg-soil-700/50 border border-straw/20 hover:border-sprout-500"
            }`}
          >
            <div className="mb-1">
              {tile.ready ? (
                <ResourceGlyph icon={resourceIcon("SYNAPSE") || ""} alt="" className="w-7 h-7" />
              ) : tile.active ? (
                <ResourceGlyph icon={resourceIcon("NEURON") || ""} alt="" className="w-7 h-7" />
              ) : (
                <div className="w-7 h-7 rounded border border-straw/10 bg-soil-800/40" />
              )}
            </div>
            <div className="text-[10px] text-parchment font-bold">{copy.tile(tile.index + 1)}</div>
            {tile.active && (
              <>
                <div className="text-[10px] text-straw inline-flex items-center gap-0.5">{tile.neuronAmount} <ResourceGlyph icon={resourceIcon("NEURON") || ""} alt="" className="w-3 h-3" /></div>
                <div className="w-full bg-soil-700 rounded-full h-1 mt-1 overflow-hidden">
                  <div
                    className={`h-full ${tile.ready ? "bg-gold-500" : "bg-sprout-500"}`}
                    style={{ width: `${tile.progress}%` }}
                  />
                </div>
                {tile.ready && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCollectSynapse(tile.index); }}
                    disabled={collectingTileIndex === tile.index || !seeder}
                    title={!seeder ? copy.seederRequired : undefined}
                    className="mt-1 max-w-full text-[10px] bg-gold-600 text-parchment px-2 py-0.5 rounded disabled:opacity-50 [overflow-wrap:anywhere]"
                  >
                    {collectingTileIndex === tile.index ? "…" : copy.ready}
                  </button>
                )}
              </>
            )}
            {!tile.active && <div className="text-[10px] text-straw">{copy.available}</div>}
          </div>
        ))}
      </div>
      </>
      )}

      {!loadError && selectedCell !== null && (
        <div className="bg-soil-800/50 rounded-lg p-3 space-y-2">
          <p className="text-straw text-xs"><b className="text-parchment">{copy.activateIn(selectedCell + 1)}</b></p>
          <div className="flex items-center gap-2">
            <span className="text-straw text-xs inline-flex items-center gap-1"><ResourceGlyph icon={resourceIcon("NEURON") || ""} alt="" className="w-3.5 h-3.5" /> {copy.neuron}:</span>
            <input
              aria-label={copy.neuron}
              type="range"
              min="1"
              max="50"
              value={neuronAmount}
              onChange={(e) => setNeuronAmount(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-parchment font-bold text-sm w-10">{neuronAmount}</span>
          </div>
          <p className="text-[10px] text-straw flex flex-wrap items-center gap-1 justify-center"><ResourceGlyph icon={resourceIcon("power") || ""} alt="" className="w-3.5 h-3.5" /> {copy.cost}: 1 {copy.energy} + {neuronAmount} <ResourceGlyph icon={resourceIcon("neuron") || ""} alt="" className="w-3.5 h-3.5" /></p>
          <button
            onClick={handleStartSynthesis}
            disabled={startingSynthesis}
            className="btn btn-primary"
          >
            {startingSynthesis ? copy.starting : copy.startButton(neuronAmount)}
          </button>
        </div>
      )}
    </Card></div>
  );
}
