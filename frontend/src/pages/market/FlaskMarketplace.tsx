import { useState } from "react";
import { Card } from "../../components/ui/Card";

const FLASKS = [
  { key: "FLASK_BLUE",   label: "Зелье энергии", icon: "🧪", color: "#3b82f6", price: 50,  desc: "+20% добыча на 1ч" },
  { key: "FLASK_YELLOW", label: "Зелье газа",    icon: "🧪", color: "#eab308", price: 40,  desc: "+100 газа" },
  { key: "FLASK_GREEN",  label: "Зелье роста",   icon: "🧪", color: "#10b981", price: 80,  desc: "×2 скорость на 1ч" },
  { key: "FLASK_PINK",   label: "Зелье любви",   icon: "🧪", color: "#ec4899", price: 60,  desc: "+3 ❤️ к соседу" },
  { key: "FLASK_PURPLE", label: "Зелье удачи",   icon: "🧪", color: "#a855f7", price: 120, desc: "+50% Forge на 1ч" },
];

export function FlaskMarketplace() {
  const [selectedFlask, setSelectedFlask] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState(1);
  const [price, setPrice] = useState(50);

  const mockOrders = [
    { type: "sell", flask: "FLASK_GREEN", amount: 3, price: 75, seller: "A3x7...9kL2" },
    { type: "sell", flask: "FLASK_PURPLE", amount: 1, price: 115, seller: "B9m4...2pQ8" },
    { type: "buy",  flask: "FLASK_BLUE", amount: 5, price: 48, buyer: "C2n6...5rW1" },
    { type: "sell", flask: "FLASK_PINK", amount: 2, price: 58, seller: "D7k3...8sT4" },
  ];

  const handleCreateOrder = () => {
    if (!selectedFlask) return;
    alert(`📋 ${orderType === "buy" ? "Покупка" : "Продажа"}: ${amount} шт × ${price} POTATO`);
  };

  const selectedFlaskData = FLASKS.find(f => f.key === selectedFlask);

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h3 className="text-parchment font-bold text-lg mb-3">🧪 Торговля зельями</h3>
        
        {/* Выбор флакона */}
        <div className="grid grid-cols-5 gap-2 mb-3">
          {FLASKS.map(f => (
            <button
              key={f.key}
              onClick={() => { setSelectedFlask(f.key); setPrice(f.price); }}
              className={`p-2 rounded-lg text-center transition ${
                selectedFlask === f.key
                  ? "border-2"
                  : "bg-soil-700/50 border border-straw/20 hover:border-straw/40"
              }`}
              style={selectedFlask === f.key ? { 
                background: f.color + "20", 
                borderColor: f.color 
              } : {}}
            >
              <div className="text-2xl">{f.icon}</div>
              <div className="text-[10px] text-parchment font-bold">{f.label.split(" ")[1]}</div>
              <div className="text-[9px] text-straw">{f.price} 🥔</div>
            </button>
          ))}
        </div>

        {/* Форма ордера */}
        {selectedFlask && selectedFlaskData && (
          <div className="bg-soil-800/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{selectedFlaskData.icon}</span>
              <div>
                <div className="text-parchment text-sm font-bold">{selectedFlaskData.label}</div>
                <div className="text-straw text-[10px]">{selectedFlaskData.desc}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOrderType("buy")}
                className={`flex-1 py-1.5 rounded text-xs font-bold transition ${
                  orderType === "buy" 
                    ? "bg-emerald-600 text-parchment" 
                    : "bg-soil-700 text-straw"
                }`}
              >
                📈 Купить
              </button>
              <button
                onClick={() => setOrderType("sell")}
                className={`flex-1 py-1.5 rounded text-xs font-bold transition ${
                  orderType === "sell" 
                    ? "bg-red-600 text-parchment" 
                    : "bg-soil-700 text-straw"
                }`}
              >
                📉 Продать
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-straw text-[10px]">Количество</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-soil-700 text-parchment text-sm rounded px-2 py-1.5 border border-straw/20"
                />
              </div>
              <div>
                <label className="text-straw text-[10px]">Цена за шт (🥔)</label>
                <input
                  type="number"
                  min="1"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full bg-soil-700 text-parchment text-sm rounded px-2 py-1.5 border border-straw/20"
                />
              </div>
            </div>

            <div className="bg-soil-900/50 rounded p-2 text-xs">
              <div className="flex justify-between text-straw">
                <span>Итого:</span>
                <span className="text-parchment font-bold">{amount * price} 🥔</span>
              </div>
            </div>

            <button
              onClick={handleCreateOrder}
              className={`w-full py-2 rounded-lg text-parchment font-bold text-sm transition ${
                orderType === "buy"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110"
                  : "bg-gradient-to-r from-red-600 to-orange-600 hover:brightness-110"
              }`}
            >
              {orderType === "buy" ? "📈 Создать ордер на покупку" : "📉 Создать ордер на продажу"}
            </button>
          </div>
        )}
      </Card>

      {/* Книга ордеров */}
      <Card className="p-4">
        <h3 className="text-parchment font-bold text-sm mb-2">📋 Активные ордера</h3>
        <div className="space-y-1.5">
          {mockOrders.map((order, idx) => {
            const flask = FLASKS.find(f => f.key === order.flask);
            if (!flask) return null;
            
            return (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded-lg"
                style={{
                  background: order.type === "buy" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                  border: `1px solid ${order.type === "buy" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                }}
              >
                <span className="text-lg">{flask.icon}</span>
                <div className="flex-1">
                  <div className="text-parchment text-xs font-bold">{flask.label}</div>
                  <div className="text-straw text-[10px]">
                    {order.type === "buy" ? `📈 Покупка` : `📉 Продажа`} • 
                    {order.amount} шт × {order.price} 🥔
                  </div>
                </div>
                <button className="px-2 py-1 text-[10px] bg-sprout-600 text-parchment rounded hover:brightness-110">
                  {order.type === "buy" ? "Продать" : "Купить"}
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
