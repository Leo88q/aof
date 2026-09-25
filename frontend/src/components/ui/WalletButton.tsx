import { motion } from "framer-motion";
import { UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../visual/ResourceGlyph";
import { useWalletStore } from "../../store/walletStore";
import { useStore } from "../../store/useStore";

export function WalletButton() {
  const { address, connected, connecting, connect, disconnect, walletName } =
    useWalletStore();
  const { isVip } = useStore();

  async function handleClick() {
    if (connected) {
      await disconnect();
    } else {
      try {
        await connect();
      } catch (e: any) {
        alert(e.message);
      }
    }
  }

  const shortAddr = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : "";

  return (
    <motion.button
      onClick={handleClick}
      whileTap={{ scale: 0.95 }}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
        connected
          ? "bg-sprout-600 text-white"
          : "bg-wheat-600 text-soil-950"
      }`}
    >
      {connecting
        ? "Подключение..."
        : connected
        ? <span className="inline-flex items-center gap-1.5">
            <ResourceGlyph icon={isVip ? UI_ICONS.rewardCrown : UI_ICONS.noticeSuccess} alt="" className="w-4 h-4" />
            {walletName} • {shortAddr}
          </span>
        : <span className="inline-flex items-center gap-1.5">
            <ResourceGlyph icon={UI_ICONS.catalog} alt="" className="w-4 h-4" /> Подключить кошелёк
          </span>}
    </motion.button>
  );
}
