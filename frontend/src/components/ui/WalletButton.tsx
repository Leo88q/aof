import { useState } from 'react';
import { WalletSafetyNotice } from '../../legal/WalletSafetyNotice';
import { motion } from 'framer-motion';
import { useLocale } from '../../i18n/LocaleProvider';
import { walletCopy } from '../../i18n/walletCopy';
import { UI_ICONS } from '../../lib/visualAssets';
import { ResourceGlyph } from '../visual/ResourceGlyph';
import { useWalletStore } from '../../store/walletStore';
import { useStore } from '../../store/useStore';
import { hasWalletSupport, isMobileBrowser, phantomBrowseLink } from '../../lib/wallet';

const WALLET_ACK_KEY = "nf:wallet-ack:v1";

function walletAcknowledged(): boolean {
  try { return localStorage.getItem(WALLET_ACK_KEY) === "1"; } catch { return false; }
}

function rememberWalletAck() {
  try { localStorage.setItem(WALLET_ACK_KEY, "1"); } catch { /* the choice still applies to this click */ }
}

export function WalletButton() {
  const { language } = useLocale();
  const copy = walletCopy[language];
  const { address, connected, connecting, connect, disconnect, walletName } = useWalletStore();
  const isVip = useStore(s => s.isVip);
  const [showNotice, setShowNotice] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setFailed(false);
    try {
      if (connected) await disconnect();
      else await connect();
    } catch {
      // Wallet adapters emit arbitrary provider errors. Do not expose raw
      // messages in another language or pretend the transaction was signed.
      setFailed(true);
    }
  }

  const shortAddr = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : '';
  const offerPhantom = !connected && !hasWalletSupport() && isMobileBrowser();

  return <div lang={language} className="flex flex-col items-end gap-1 min-w-0 max-w-full [overflow-wrap:anywhere]">
    <motion.button type="button" disabled={connecting} aria-label={connected ? `${copy.disconnect}: ${walletName} ${shortAddr}` : copy.connect}
      onClick={() => (connected || walletAcknowledged() ? void handleClick() : setShowNotice(true))}
      whileTap={{ scale: 0.95 }}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors max-w-full ${
        connected ? 'bg-sprout-600 text-white' : 'bg-accent-600 text-soil-950'}`}
    >
      {connecting ? copy.connecting : connected ? <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
        <ResourceGlyph icon={isVip ? UI_ICONS.rewardCore : UI_ICONS.noticeSuccess} alt="" className="w-4 h-4 shrink-0" />
        <span className="truncate">{walletName} • {shortAddr}</span>
      </span> : <span className="inline-flex items-center gap-1.5">
        <ResourceGlyph icon={UI_ICONS.catalog} alt="" className="w-4 h-4 shrink-0" />{copy.connect}
      </span>}
    </motion.button>
    {failed && <p role="alert" className="text-xs text-ember-400 text-right">{copy.failed}</p>}
    {showNotice && !connected && <WalletSafetyNotice
      onCancel={() => setShowNotice(false)}
      onContinue={() => { rememberWalletAck(); setShowNotice(false); void handleClick(); }}
    />}
    {offerPhantom && <a href={phantomBrowseLink()} className="text-[11px] leading-tight text-accent-500 underline underline-offset-2">
      {copy.phantom}
    </a>}
  </div>;
}
