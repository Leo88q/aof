import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/Card";
import { RARITY_META, rarityKey } from "../../lib/toolMeta";
import { toolPlate } from "../../lib/visualAssets";
import { resourceIcon, UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { fmtNum, shortAddr } from "../../lib/marketUtils";
import { useWalletStore } from "../../store/walletStore";
import { useFlash } from "../../lib/marketUtils";
import { useNav } from "../../nav/NavContext";

const MAX_DURABILITY = 20;

interface FriendFarmPageProps {
  address: string;
}

export function FriendFarmPage({ address }: FriendFarmPageProps) {
  const { address: myAddress } = useWalletStore();
  const { pop } = useNav();
  const [farm, setFarm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [visitsLeft, setVisitsLeft] = useState<number | null>(null);
  const [txStatus] = useFlash();

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    api.query.friendFarm(address)
      .then((data: any) => setFarm(data))
      .catch(() => setFarm(null))
      .finally(() => setLoading(false));

    // Загружаем лимит визитов
    if (myAddress) {
      api.neighbors.list(myAddress)
        .then((data: any) => setVisitsLeft(data?.visitsLeftToday ?? null))
        .catch(() => {});
    }
  }, [address, myAddress]);

  if (loading) return (
    <div className="p-4">
      <button onClick={() => pop("profile")} className="text-wheat-500 text-sm mb-4">← Назад в свою лабораторию</button>
      <p className="text-straw text-sm">Загружаю лабораторию {address}…</p>
    </div>
  );

  if (!farm) return (
    <div className="p-4">
      <button onClick={() => pop("profile")} className="text-wheat-500 text-sm mb-4">← Назад в свою лабораторию</button>
      <Card className="text-center py-8">
        <ResourceGlyph icon={UI_ICONS.noticeError} alt="" className="w-12 h-12 mx-auto" />
        <p className="text-parchment text-sm">Лаборатория не найдена</p>
      </Card>
    </div>
  );

  const { tools, balances } = farm;

  return (
    <div className="p-4 pt-2 pb-24 space-y-4">
      <button onClick={() => pop("profile")} className="text-wheat-500 text-sm mb-2">← Назад в свою лабораторию</button>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          {txStatus}
        </motion.div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ResourceGlyph icon={resourceIcon("DATA")} alt="" className="w-12 h-12" />
          <div>
            <h1 className="text-parchment font-bold text-lg">Лаборатория {shortAddr(address)}</h1>
            <p className="text-straw text-xs">Просмотр (только чтение)</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gold">{visitsLeft ?? "—"}</div>
          <div className="text-xs text-straw">визитов</div>
        </div>
      </div>

      {/* Кладовка (упрощённо) */}
      <Card>
        <h2 className="text-parchment font-semibold text-sm mb-3 flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.catalog} alt="" className="w-4 h-4" /> Кладовка</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-parchment font-bold text-xl">{fmtNum(balances.FOOD || 0)}</p>
            <p className="text-straw text-xs flex items-center gap-1"><ResourceGlyph icon={resourceIcon("DATA")} alt="" className="w-3.5 h-3.5" /> Данные</p>
          </div>
          <div>
            <p className="text-parchment font-bold text-xl">{fmtNum(balances.WOOD || 0)}</p>
            <p className="text-straw text-xs flex items-center gap-1"><ResourceGlyph icon={resourceIcon("CIRCUIT")} alt="" className="w-3.5 h-3.5" /> Схема</p>
          </div>
          <div>
            <p className="text-parchment font-bold text-xl">{fmtNum(balances.STONE || 0)}</p>
            <p className="text-straw text-xs flex items-center gap-1"><ResourceGlyph icon={resourceIcon("SILICON")} alt="" className="w-3.5 h-3.5" /> Кремний</p>
          </div>
        </div>
      </Card>

      {/* Инструменты (только список) */}
      <Card>
        <h2 className="text-parchment font-semibold text-sm mb-3 flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.repair} alt="" className="w-4 h-4" /> Инструменты ({tools.length})</h2>
        {tools.length === 0 ? (
          <p className="text-straw text-xs text-center py-4">Инструментов нет</p>
        ) : (
          <div className="space-y-2">
            {tools.map((t: any) => {
              const rk = rarityKey(t.rarity);
              const durability = Number(t.durability);
              const pct = (durability / MAX_DURABILITY) * 100;
              return (
                <div key={t.mint} className="flex items-center gap-3 p-2 rounded-xl bg-soil-800/60 border border-straw/10">
                  <ArtPlate src={toolPlate(t.toolType, rk)} alt={t.toolType || "Инструмент"} size={36} />
                  <div className="flex-1">
                    <p className="text-parchment text-sm">
                      {t.toolType} <span style={{ color: RARITY_META[rk]?.color }}>({RARITY_META[rk]?.label})</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 rounded-full bg-soil-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#6bbf59" }} />
                      </div>
                      <span className="text-straw text-xs">{durability}/{MAX_DURABILITY}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Помочь другу */}
      <Card>
        <h2 className="text-parchment font-semibold text-sm mb-2 flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.friends} alt="" className="w-4 h-4" /> Помочь другу</h2>
        <p className="text-amber-400 text-xs">
          Социальные бонусы временно недоступны: канонические on-chain эффекты
          полива и ремонта ещё не развернуты.
        </p>
      </Card>
    </div>
  );
}
