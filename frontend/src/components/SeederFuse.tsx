import { useRef, useState } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import { chainMomentCopy } from "../i18n/chainMomentCopy";
import { toolName } from "../i18n/toolsCopy";
import { api } from "../lib/api";
import { handleTxResponse } from "../lib/txFlow";
import { actionErrorFeedback } from "../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../i18n/walletRuntimeCopy";
import { TOOL_LINE_KEYS } from "../lib/chainMoments";
import { rarityKey } from "../lib/toolMeta";
import { TOOL_RARITIES } from "../lib/visualAssets";

type ToolRow = { mint?: string; toolType?: string; rarity?: unknown };

export function SeederFuse({ tools, address }: { tools: ToolRow[] | null; address: string | null }) {
  const { language } = useLocale();
  const copy = chainMomentCopy[language];
  const running = useRef(false);
  const [mintA, setMintA] = useState("");
  const [mintB, setMintB] = useState("");
  const [toolType, setToolType] = useState<string>("neural_seeder");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = (tools ?? []).filter((tool) => typeof tool.mint === "string" && tool.mint);
  const a = rows.find((tool) => tool.mint === mintA);
  const b = rows.find((tool) => tool.mint === mintB);
  const sameRarity = !!a && !!b && mintA !== mintB && rarityKey(a.rarity) === rarityKey(b.rarity);
  const notLegendary = sameRarity && rarityKey(a?.rarity) !== "legendary" && TOOL_RARITIES.includes(rarityKey(a?.rarity) as typeof TOOL_RARITIES[number]);
  const canFuse = !!address && notLegendary && TOOL_LINE_KEYS.includes(toolType as typeof TOOL_LINE_KEYS[number]) && !busy;

  async function fuse() {
    if (running.current || !canFuse || !address || !a?.mint || !b?.mint) return;
    running.current = true;
    setBusy(true);
    setMessage(copy.fuseBusy);
    try {
      const prepared: any = await api.tools.prepMint({ owner: address });
      const preparedTx = await handleTxResponse(prepared);
      if (!preparedTx.success || typeof prepared.mint !== "string" || !prepared.mint) {
        setMessage(preparedTx.error || walletRuntimeCopy[language].unconfirmedResponse);
        return;
      }
      const response: any = await api.reroll.fuse({
        user: address,
        mintA: a.mint,
        mintB: b.mint,
        newMint: prepared.mint,
        newType: toolType,
      });
      const result = await handleTxResponse(response);
      setMessage(result.success
        ? `${toolName(language, toolType)}${result.signature ? `: ${result.signature.slice(0, 10)}…` : ""}`
        : (result.error || walletRuntimeCopy[language].unconfirmedResponse));
    } catch (error) {
      setMessage(actionErrorFeedback(error, language, walletRuntimeCopy[language].unconfirmedResponse));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2 rounded-xl border border-straw/20 bg-soil-800/40 p-3">
      <h3 className="text-parchment text-sm font-semibold">{copy.fuseTitle}</h3>
      <p className="text-straw text-xs break-words">{copy.seederBirth}</p>
      <p className="text-straw text-xs break-words">{copy.fuseNeed}</p>
      <label className="block text-xs text-straw">
        A
        <select className="mt-1 w-full bg-soil-900 border border-straw/20 rounded px-2 py-1 text-parchment" value={mintA} onChange={(event) => setMintA(event.target.value)}>
          <option value="">—</option>
          {rows.map((tool) => <option key={tool.mint} value={tool.mint}>{toolName(language, String(tool.toolType || ""))} · {rarityKey(tool.rarity) || "?"}</option>)}
        </select>
      </label>
      <label className="block text-xs text-straw">
        B
        <select className="mt-1 w-full bg-soil-900 border border-straw/20 rounded px-2 py-1 text-parchment" value={mintB} onChange={(event) => setMintB(event.target.value)}>
          <option value="">—</option>
          {rows.filter((tool) => tool.mint !== mintA).map((tool) => <option key={tool.mint} value={tool.mint}>{toolName(language, String(tool.toolType || ""))} · {rarityKey(tool.rarity) || "?"}</option>)}
        </select>
      </label>
      <label className="block text-xs text-straw">
        {copy.fuseType}
        <select className="mt-1 w-full bg-soil-900 border border-straw/20 rounded px-2 py-1 text-parchment" value={toolType} onChange={(event) => setToolType(event.target.value)}>
          {TOOL_LINE_KEYS.map((key) => <option key={key} value={key}>{toolName(language, key)}</option>)}
        </select>
      </label>
      {message && <p className="text-parchment text-xs break-words">{message}</p>}
      <button type="button" className="btn btn-primary" disabled={!canFuse} onClick={fuse}>{busy ? copy.fuseBusy : copy.fuseAction}</button>
    </section>
  );
}
