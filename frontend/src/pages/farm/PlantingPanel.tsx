import { useToast } from "../../components/ui/Toast";
import { useState, useEffect } from "react";
import { Card } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useWalletStr } from "../../lib/useWalletStr";
import { handleTxResponse } from "../../lib/txFlow";
import { getMintAsync } from "../../lib/mints";
import { UI_ICONS } from "../../lib/visualAssets";

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
  const toast = useToast();
  const walletAddr = useWalletStr();
  const [tiles, setTiles] = useState<FarmTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<number | null>(null);
  const [seedsAmount, setSeedsAmount] = useState(10);
  const [planting, setPlanting] = useState(false);
  const [harvesting, setHarvesting] = useState<number | null>(null);
  const [reaper, setReaper] = useState<{ mint: string; pubkey: string } | null>(null);

  useEffect(() => {
    if (!walletAddr) return;
    loadTiles();
    api.query.myTools(walletAddr)
      .then((tools: any[]) => {
        const found = (tools || []).find((tool: any) =>
          String(tool.toolType || tool.tool_type || "").toLowerCase() === "reaper"
        );
        setReaper(found?.mint && found?.pubkey ? { mint: found.mint, pubkey: found.pubkey } : null);
      })
      .catch(() => setReaper(null));
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
        toast.show("❌ Mint SEEDS не найден. Проверьте деплой контракта.");
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
        toast.show(`🌱 Посажено ${seedsAmount} семян на тайл ${selectedPlot + 1}!`);
        setSelectedPlot(null);
        setTimeout(loadTiles, 2000);
      } else {
        toast.show(`❌ ${r.error || "Error посадки"}`);
      }
    } catch (e: any) {
      toast.show(`❌ ${e.message || "Error"}`);
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
        toast.show("❌ Mint WHEAT не найден");
        return;
      }
      if (!reaper) {
        toast.show("❌ Инструмент Reaper не найден в инвентаре");
        return;
      }
      const toolMint = reaper.mint;
      const resp = await api.chain.harvestWheat({
        user: walletAddr,
        tileIndex,
        wheatMint,
        toolMint,
        toolData: reaper.pubkey,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(`🧠 Сбор завершён с кластера ${tileIndex + 1}!`);
        setTimeout(loadTiles, 2000);
      } else {
        toast.show(`❌ ${r.error || "Error сбора"}`);
      }
    } catch (e: any) {
      toast.show(`❌ ${e.message || "Error"}`);
    } finally {
      setHarvesting(null);
    }
  }

  if (loading) {
    return (
      <Card className="p-4">
        <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><img src={UI_ICONS.plant} alt="" className="w-5 h-5 object-contain" /> Посадка семян</h3>
        <p className="text-straw text-sm text-center py-4">Loading участка...</p>
      </Card>
    );
  }

  if (!walletAddr) {
    return (
      <Card className="p-4">
        <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><img src={UI_ICONS.plant} alt="" className="w-5 h-5 object-contain" /> Посадка семян</h3>
        <p className="text-straw text-sm text-center py-4">Подключите кошелёк для посадки</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><img src={UI_ICONS.plant} alt="" className="w-5 h-5 object-contain" /> Посадка семян</h3>

      {loadError ? (
        <p className="text-amber-400 text-sm text-center py-4">
          Состояние участка недоступно из канонической сети. Повторите попытку позже.
        </p>
      ) : (
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div
            key={tile.index}
            role="button"
            tabIndex={tile.planted ? -1 : 0}
            onClick={() => !tile.planted && setSelectedPlot(tile.index)}
            onKeyDown={(e) => { if (e.key === "Enter" && !tile.planted) setSelectedPlot(tile.index); }}
            className={`p-3 rounded-lg text-center transition ${
              selectedPlot === tile.index
                ? "bg-green-600/30 border-2 border-green-500"
                : tile.planted
                ? "bg-amber-900/20 border border-amber-700/40 cursor-not-allowed"
                : "bg-soil-700/50 border border-straw/20 hover:border-green-500"
            }`}
          >
            <div className="text-2xl mb-1">
              {tile.ready ? "🌾" : tile.planted ? "🌱" : "⬜"}
            </div>
            <div className="text-[10px] text-parchment font-bold">Тайл {tile.index + 1}</div>
            {tile.planted && (
              <>
                <div className="text-[10px] text-straw">{tile.seedsAmount} 🌰</div>
                <div className="w-full bg-soil-700 rounded-full h-1 mt-1 overflow-hidden">
                  <div
                    className={`h-full ${tile.ready ? "bg-amber-500" : "bg-green-500"}`}
                    style={{ width: `${tile.progress}%` }}
                  />
                </div>
                {tile.ready && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleHarvest(tile.index); }}
                    disabled={harvesting === tile.index || !reaper}
                    title={!reaper ? "Нужен инструмент Reaper" : undefined}
                    className="mt-1 text-[10px] bg-amber-600 text-parchment px-2 py-0.5 rounded disabled:opacity-50"
                  >
                    {harvesting === tile.index ? "..." : "Собрать"}
                  </button>
                )}
              </>
            )}
            {!tile.planted && <div className="text-[10px] text-straw">Свободен</div>}
          </div>
        ))}
      </div>
      )}

      {selectedPlot !== null && (
        <div className="bg-soil-800/50 rounded-lg p-3 space-y-2">
          <p className="text-straw text-xs">Посадка на <b className="text-parchment">Тайл {selectedPlot + 1}</b></p>
          <div className="flex items-center gap-2">
            <span className="text-straw text-xs">🌰 Нейрон:</span>
            <input
              type="range"
              min="1"
              max="50"
              value={seedsAmount}
              onChange={(e) => setSeedsAmount(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-parchment font-bold text-sm w-10">{seedsAmount}</span>
          </div>
          <p className="text-[10px] text-straw">⚡ Стоимость: 1 Energy + {seedsAmount} 🌰</p>
          <button
            onClick={handlePlant}
            disabled={planting}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-parchment font-bold text-sm disabled:opacity-50 hover:brightness-110 transition"
          >
            {planting ? "🌱 Сажаем..." : `🌱 Посадить ${seedsAmount} семян`}
          </button>
        </div>
      )}
    </Card>
  );
}
