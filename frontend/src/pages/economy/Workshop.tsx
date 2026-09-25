import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useWalletStore } from "../../store/walletStore";
import { handleTxResponse } from "../../lib/txFlow";
import { getMintAsync } from "../../lib/mints";
import { UI_ICONS, resourceIcon } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

// Рецепты мгновенного крафта (из мастер-документа §6)
const FULL_RECIPES = [
  // === ГЕМЫ (из камней и песка) ===
  {
    id: 0, category: "gems",
    label: "Квантовый бит", icon: resourceIcon("Квантовый бит") || "",
    output: { key: "QUANTUM_BIT", amount: 1 },
    inputs: [
      { key: "BLUE_CORE", label: "Голубое ядро", icon: resourceIcon("BLUE_CORE") || "", amount: 1 },
    ]
  },
  {
    id: 1, category: "gems",
    label: "Нейрочип", icon: resourceIcon("Нейрочип") || "",
    output: { key: "NEURAL_CHIP", amount: 1 },
    inputs: [
      { key: "RED_CORE", label: "Красное ядро", icon: resourceIcon("RED_CORE") || "", amount: 1 },
    ]
  },
  {
    id: 2, category: "gems",
    label: "Фотон-бит", icon: resourceIcon("Фотон-бит") || "",
    output: { key: "PHOTON_BIT", amount: 1 },
    inputs: [
      { key: "CLEAR_QUARTZ", label: "Чистый кварц", icon: resourceIcon("CLEAR_QUARTZ") || "", amount: 1 },
    ]
  },
  // === ФЛАКОНЫ (зелья) ===
  {
    id: 3, category: "flask",
    label: "Крио-флюид", icon: resourceIcon("Крио-флюид") || "",
    output: { key: "CRYO_FLUID", amount: 1 },
    inputs: [
      { key: "QUANTUM_BIT", label: "Квантовый бит", icon: resourceIcon("QUANTUM_BIT") || "", amount: 2 },
      { key: "DATA", label: "Данные", icon: resourceIcon("DATA") || "", amount: 5 },
    ]
  },
  {
    id: 4, category: "flask",
    label: "Вольт-флюид", icon: resourceIcon("Вольт-флюид") || "",
    output: { key: "VOLT_FLUID", amount: 1 },
    inputs: [
      { key: "NEURAL_CHIP", label: "Нейрочип", icon: resourceIcon("NEURAL_CHIP") || "", amount: 2 },
      { key: "SILICON", label: "Кремний", icon: resourceIcon("SILICON") || "", amount: 3 },
    ]
  },
  {
    id: 5, category: "flask",
    label: "Био-флюид", icon: resourceIcon("Био-флюид") || "",
    output: { key: "BIO_FLUID", amount: 1 },
    inputs: [
      { key: "CIRCUIT", label: "Схема", icon: resourceIcon("CIRCUIT") || "", amount: 5 },
      { key: "NEURON", label: "Нейрон", icon: resourceIcon("NEURON") || "", amount: 5 },
    ]
  },
  {
    id: 6, category: "flask",
    label: "Нано-флюид", icon: resourceIcon("Нано-флюид") || "",
    output: { key: "NANO_FLUID", amount: 1 },
    inputs: [
      { key: "ROSE_QUARTZ", label: "Розовый кварц", icon: resourceIcon("ROSE_QUARTZ") || "", amount: 3 },
      { key: "DATA", label: "Данные", icon: resourceIcon("DATA") || "", amount: 5 },
    ]
  },
  {
    id: 7, category: "flask",
    label: "Квантовый флюид", icon: resourceIcon("Квантовый флюид") || "",
    output: { key: "QUANTUM_FLUID", amount: 1 },
    inputs: [
      { key: "PURPLE_CORE", label: "Фиолетовое ядро", icon: resourceIcon("PURPLE_CORE") || "", amount: 1 },
      { key: "BIO_CHIP", label: "Био-чип", icon: resourceIcon("BIO_CHIP") || "", amount: 1 },
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
          <img src={UI_ICONS.gems} alt="" width={16} height={16} style={{ objectFit: "contain", display: "inline-block", verticalAlign: "text-bottom", marginRight: 4 }} />
          Гемы
        </button>
        <button
          className={"sub-tab-btn" + (section === "flask" ? " active" : "")}
          onClick={() => setSection("flask")}
        >
          <img src={UI_ICONS.flasks} alt="" width={16} height={16} style={{ objectFit: "contain", display: "inline-block", verticalAlign: "text-bottom", marginRight: 4 }} />
          Флаконы
        </button>
        <button
          className={"sub-tab-btn" + (section === "trans" ? " active" : "")}
          onClick={() => setSection("trans")}
        >
          <img src={UI_ICONS.transformations} alt="" width={16} height={16} style={{ objectFit: "contain", display: "inline-block", verticalAlign: "text-bottom", marginRight: 4 }} />
          Превращения
        </button>
        <button
          className={"sub-tab-btn" + (section === "timed" ? " active" : "")}
          onClick={() => setSection("timed")}
        >
          <img src={UI_ICONS.workshopTimer} alt="" width={16} height={16} style={{ objectFit: "contain", display: "inline-block", verticalAlign: "text-bottom", marginRight: 4 }} />
          Тренировка/Переработка
        </button>
      </div>

      {msg && <div className="workshop-msg">{msg}</div>}

      {section !== "timed" && (
        <div className="recipe-grid">
          {FULL_RECIPES.filter(r => r.category === section).map((r) => (
            <div key={r.id} className="recipe-card" style={{background: "rgba(30, 41, 59, 0.6)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(251, 191, 36, 0.2)"}}>
              <div style={{display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px"}}>
                <ResourceGlyph icon={r.icon} alt={r.label} className="w-7 h-7" />
                <div>
                  <div style={{color: "#fbbf24", fontSize: "13px", fontWeight: "bold"}}>{r.label}</div>
                  {(r as any).effect && <div style={{color: "#94a3b8", fontSize: "10px"}}>{(r as any).effect}</div>}
                </div>
              </div>

              <div style={{background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px", marginBottom: "8px"}}>
                <div style={{color: "#94a3b8", fontSize: "10px", marginBottom: "4px"}}>Ингредиенты:</div>
                {(r as any).inputs?.map((inp: any, i: number) => (
                  <div key={i} style={{display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#cbd5e1"}}>
                    <ResourceGlyph icon={inp.icon} alt={inp.label} className="w-4 h-4" />
                    <span>{inp.label}</span>
                    <span style={{color: "#fbbf24", fontWeight: "bold", marginLeft: "auto"}}>×{inp.amount}</span>
                  </div>
                ))}
              </div>

              <div style={{background: "rgba(16, 185, 129, 0.2)", padding: "6px", borderRadius: "6px", textAlign: "center", border: "1px solid rgba(16, 185, 129, 0.3)"}}>
                <span style={{color: "#10b981", fontSize: "11px", fontWeight: "bold"}}>
                  → <ResourceGlyph icon={resourceIcon((r as any).output.key) || (r as any).output.icon || r.icon} alt="" className="inline-block w-4 h-4 align-text-bottom" /> ×{(r as any).output.amount}
                </span>
              </div>
              {(r as any).effect && <div className="recipe-effect" style={{color: "#f59e0b", fontSize: "11px", marginTop: "4px"}}>{(r as any).effect}</div>}
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
            Модуль переработки и Тренировка теперь во вкладке "Лаборатория"
          </h3>
          <p style={{color: "#94a3b8", fontSize: "13px", marginBottom: "16px", lineHeight: "1.6", maxWidth: "400px", margin: "0 auto 16px"}}>
            Перейди во вкладку <b style={{color: "#10b981"}}>🧠 Нейро-лаборатория</b> → подвкладки
            <b style={{color: "#10b981"}}> 🏭 Переработка</b> и <b style={{color: "#10b981"}}>🔥 Тренировка</b>,
            чтобы запустить переработку сигнала или тренировку модели.
          </p>
          <div style={{background: "rgba(16, 185, 129, 0.1)", padding: "12px 16px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.3)", display: "inline-block"}}>
            <div style={{color: "#10b981", fontSize: "12px", fontWeight: "bold"}}>
              💡 Там же ты найдёшь 🔋 Сетевая станция и 🌱 Посадку семян
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
