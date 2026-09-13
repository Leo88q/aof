import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { useWalletStore } from "../../store/walletStore";
import { api } from "../../lib/api";
import { useFlash } from "../../lib/marketUtils";

const EXPLORATION_COST = {
  food: 75,
  wood: 35,
  stone: 35,
  meat: 50, // [НОВОЕ] Добавляем мясо
};

export function ExplorationPage() {
  const { address } = useWalletStore();
  const [txStatus, flash] = useFlash();
  const [loading, setLoading] = useState(false);

  async function startExploration() {
    if (!address) return flash("❌ Подключите кошелёк");
    
    setLoading(true);
    flash("🗺️ Отправляем исследователя в поход...");
    
    try {
      const resp = await api.exploration.startCommit({
        user: address,
        toolMint: "", // TODO: выбрать лук из инвентаря
        foodMint: "", // TODO: взять из Config
        woodMint: "",
        stoneMint: "",
        meatMint: "", // [НОВОЕ]
      });
      
      if (resp.success) {
        flash(`✅ Исследование запущено! Ждите результата...`);
      } else {
        flash(`❌ ${resp.error}`);
      }
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold mb-4">🗺️ Исследование</h1>
      
      <Card className="mb-4">
        <div className="text-center mb-4">
          <span className="text-5xl">🏹</span>
          <h2 className="text-parchment font-bold text-lg mt-3">Экспедиция</h2>
          <p className="text-straw text-sm mt-2">
            Отправьте лучника в опасное путешествие за редкими ресурсами
          </p>
        </div>

        <div className="bg-soil-800/60 rounded-xl p-4 mb-4">
          <h3 className="text-parchment font-semibold text-sm mb-3">Стоимость похода:</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-straw">🌾 Зерно (FOOD)</span>
              <span className="text-parchment font-bold">{EXPLORATION_COST.food}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-straw">🪵 Древесина (WOOD)</span>
              <span className="text-parchment font-bold">{EXPLORATION_COST.wood}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-straw">🪨 Камень (STONE)</span>
              <span className="text-parchment font-bold">{EXPLORATION_COST.stone}</span>
            </div>
            <div className="flex justify-between border-t border-straw/20 pt-2 mt-2">
              <span className="text-wheat-500 font-semibold">🍖 Мясо (MEAT)</span>
              <span className="text-wheat-500 font-bold">{EXPLORATION_COST.meat}</span>
            </div>
          </div>
        </div>

        <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 mb-4">
          <h3 className="text-gold font-semibold text-sm mb-2">Возможные награды:</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-xl">💎</span>
              <span className="text-parchment">Сапфировый гем</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🟠</span>
              <span className="text-parchment">Янтарный гем</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🟢</span>
              <span className="text-parchment">Изумрудный гем</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🧪</span>
              <span className="text-parchment">Флаконы</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🌰</span>
              <span className="text-parchment">Редкие семена</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <span className="text-parchment">Коллекционные NFT</span>
            </div>
          </div>
        </div>

        <div className="bg-purple-600/10 border border-purple-500/30 rounded-xl p-4 mb-4">
          <h3 className="text-purple-400 font-semibold text-sm mb-2">Требования:</h3>
          <ul className="space-y-1 text-xs text-straw">
            <li>✓ Инструмент: <span className="text-parchment">Лук (Bow)</span></li>
            <li>✓ Ресурсы: FOOD, WOOD, STONE, MEAT</li>
            <li>✓ Кулдаун: 12 часов между походами</li>
            <li>✓ Лимит: 2 похода в день</li>
          </ul>
        </div>

        {txStatus && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment mb-4"
          >
            {txStatus}
          </motion.div>
        )}

        <button
          onClick={startExploration}
          disabled={loading || !address}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-wheat-600 text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform"
        >
          {loading ? "Отправляем..." : "🗺️ Отправить в поход"}
        </button>
      </Card>

      <Card>
        <h3 className="text-parchment font-semibold text-sm mb-3">Как это работает:</h3>
        <div className="space-y-2 text-xs text-straw">
          <p>1. <span className="text-parchment">Commit:</span> Вы отправляете ресурсы и создаёте коммит</p>
          <p>2. <span className="text-parchment">Ожидание:</span> Ждёте несколько блоков для энтропии</p>
          <p>3. <span className="text-parchment">Reveal:</span> Сервер раскрывает результат</p>
          <p>4. <span className="text-parchment">Награда:</span> Получаете редкие ресурсы или NFT</p>
        </div>
      </Card>
    </div>
  );
}
