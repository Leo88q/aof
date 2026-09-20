import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useWalletStore } from "../../store/walletStore";
import { handleTxResponse } from "../../lib/txFlow";
import { getMintAsync } from "../../lib/mints";

// Рецепты мгновенного крафта (из мастер-документа §6)
const FULL_RECIPES = [
  // === ГЕМЫ (из камней и песка) ===
  {
    id: 0, category: "gems",
    label: "Сапфировый гем", icon: "💎",
    output: { key: "GEM_BLUE", amount: 1 },
    inputs: [
      { key: "STONE_BLUE", label: "Сапфир", icon: "🔵", amount: 1 },
    ]
  },
  {
    id: 1, category: "gems",
    label: "Янтарный гем", icon: "🟠",
    output: { key: "GEM_ORANGE", amount: 1 },
    inputs: [
      { key: "STONE_RED", label: "Рубин", icon: "🔴", amount: 1 },
    ]
  },
  {
    id: 2, category: "gems",
    label: "Кварцевый гем", icon: "⚪",
    output: { key: "GEM_WHITE", amount: 1 },
    inputs: [
      { key: "SAND_WHITE", label: "Кварцевый песок", icon: "⚪", amount: 1 },
    ]
  },
  // === ФЛАКОНЫ (зелья) ===
  {
    id: 3, category: "flask",
    label: "Зелье энергии", icon: "🧪",
    output: { key: "FLASK_BLUE", amount: 1 },
    inputs: [
      { key: "GEM_BLUE", label: "Сапфировый гем", icon: "💎", amount: 2 },
      { key: "FOOD", label: "Зерно", icon: "🌾", amount: 5 },
    ]
  },
  {
    id: 4, category: "flask",
    label: "Зелье газа", icon: "🧪",
    output: { key: "FLASK_YELLOW", amount: 1 },
    inputs: [
      { key: "GEM_ORANGE", label: "Янтарный гем", icon: "🟠", amount: 2 },
      { key: "STONE", label: "Камень", icon: "🪨", amount: 3 },
    ]
  },
  {
    id: 5, category: "flask",
    label: "Зелье роста", icon: "🧪",
    output: { key: "FLASK_GREEN", amount: 1 },
    inputs: [
      { key: "WOOD", label: "Древесина", icon: "🪵", amount: 5 },
      { key: "SEEDS", label: "Семена", icon: "🌰", amount: 5 },
    ]
  },
  {
    id: 6, category: "flask",
    label: "Зелье любви", icon: "🧪",
    output: { key: "FLASK_PINK", amount: 1 },
    inputs: [
      { key: "SAND_PINK", label: "Розовый песок", icon: "💗", amount: 3 },
      { key: "FOOD", label: "Зерно", icon: "🌾", amount: 5 },
    ]
  },
  {
    id: 7, category: "flask",
    label: "Зелье удачи", icon: "🧪",
    output: { key: "FLASK_PURPLE", amount: 1 },
    inputs: [
      { key: "STONE_PURPLE", label: "Аметист", icon: "🟣", amount: 1 },
      { key: "GEM_GREEN", label: "Изумрудный гем", icon: "🟢", amount: 1 },
    ]
  },


];


export function Workshop() {
  const { address } = useWalletStore();
  const [section, setSection] = useState<"gems" | "flask" | "trans" | "timed">("gems");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 5000);
  };

  async function craft(recipeId: number) {
    if (!address) return flash("❌ Connect wallet");
    setBusy(true);
    try {
      const recipe = FULL_RECIPES.find((item) => item.id === recipeId);
      if (!recipe) throw new Error("Рецепт не найден в on-chain таблице");
      const input1Mint = await getMintAsync(recipe.inputs[0].key as any);
      const input2Mint = await getMintAsync((recipe.inputs[1] || recipe.inputs[0]).key as any);
      const outputMint = await getMintAsync(recipe.output.key as any);
      if (!input1Mint || !input2Mint || !outputMint) {
        throw new Error("Реальный mint рецепта не найден в Config/MaterialMints");
      }
      const resp = await api.chain.craftRecipe({
        user: address,
        recipeId,
        input1Mint,
        input2Mint,
        outputMint,
      });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Скрафчено: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
    } catch (e: any) {
      flash(`❌ ${e?.response?.data?.error || e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workshop">
            <div className="sub-tabs">
        <button
          className={"sub-tab-btn" + (section === "gems" ? " active" : "")}
          onClick={() => setSection("gems")}
        >
          💎 Гемы
        </button>
        <button
          className={"sub-tab-btn" + (section === "flask" ? " active" : "")}
          onClick={() => setSection("flask")}
        >
          🧪 Флаконы
        </button>
        <button
          className={"sub-tab-btn" + (section === "trans" ? " active" : "")}
          onClick={() => setSection("trans")}
        >
          ⚗️ Превращения
        </button>
        <button
          className={"sub-tab-btn" + (section === "timed" ? " active" : "")}
          onClick={() => setSection("timed")}
        >
          ⏱️ Печь/Мельница
        </button>
      </div>

      {msg && <div className="workshop-msg">{msg}</div>}

      {section !== "timed" && (
        <div className="recipe-grid">
          {FULL_RECIPES.filter(r => r.category === section).map((r) => (
            <div key={r.id} className="recipe-card" style={{background: "rgba(30, 41, 59, 0.6)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(251, 191, 36, 0.2)"}}>
              <div style={{display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px"}}>
                <span style={{fontSize: "28px"}}>{r.icon}</span>
                <div>
                  <div style={{color: "#fbbf24", fontSize: "13px", fontWeight: "bold"}}>{r.label}</div>
                  {(r as any).effect && <div style={{color: "#94a3b8", fontSize: "10px"}}>✨ {(r as any).effect}</div>}
                </div>
              </div>

              <div style={{background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px", marginBottom: "8px"}}>
                <div style={{color: "#94a3b8", fontSize: "10px", marginBottom: "4px"}}>📋 Ингредиенты:</div>
                {(r as any).inputs?.map((inp: any, i: number) => (
                  <div key={i} style={{display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#cbd5e1"}}>
                    <span>{inp.icon}</span>
                    <span>{inp.label}</span>
                    <span style={{color: "#fbbf24", fontWeight: "bold", marginLeft: "auto"}}>×{inp.amount}</span>
                  </div>
                ))}
              </div>

              <div style={{background: "rgba(16, 185, 129, 0.2)", padding: "6px", borderRadius: "6px", textAlign: "center", border: "1px solid rgba(16, 185, 129, 0.3)"}}>
                <span style={{color: "#10b981", fontSize: "11px", fontWeight: "bold"}}>
                  → {(r as any).output.icon || r.icon} ×{(r as any).output.amount}
                </span>
              </div>
              {(r as any).effect && <div className="recipe-effect" style={{color: "#f59e0b", fontSize: "11px", marginTop: "4px"}}>✨ {(r as any).effect}</div>}
              <button
                className="recipe-btn"
                onClick={() => craft(r.id)}
                disabled={busy}
              >
                {busy ? "…" : "Скрафтить"}
              </button>
            </div>
          ))}
        </div>
      )}

      {section === "timed" && (
        <div style={{textAlign: "center", padding: "24px 16px"}}>
          <div style={{fontSize: "48px", marginBottom: "12px"}}>🏡</div>
          <h3 style={{color: "#fbbf24", fontSize: "18px", marginBottom: "8px", fontWeight: "bold"}}>
            Мельница и Печь теперь во вкладке "Ферма"
          </h3>
          <p style={{color: "#94a3b8", fontSize: "13px", marginBottom: "16px", lineHeight: "1.6", maxWidth: "400px", margin: "0 auto 16px"}}>
            Перейди во вкладку <b style={{color: "#10b981"}}>🏡 Ферма</b> → подвкладки
            <b style={{color: "#10b981"}}> 🏭 Мельница</b> и <b style={{color: "#10b981"}}>🔥 Печь</b>,
            чтобы запустить помол или выпечку хлеба.
          </p>
          <div style={{background: "rgba(16, 185, 129, 0.1)", padding: "12px 16px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.3)", display: "inline-block"}}>
            <div style={{color: "#10b981", fontSize: "12px", fontWeight: "bold"}}>
              💡 Там же ты найдёшь 💧 Колодец и 🌱 Посадку семян
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
