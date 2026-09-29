import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { readActiveSeason } from "./currentSeasonReadings";
import { readVipSnapshot, type VipSnapshot } from "./vipReadings";
import { useStore } from "../store/useStore";
import { useWalletStr } from "./useWalletStr";

type Reading = { owner: string; kind: 'loading' | 'ready' | 'error'; seasonId?: number; snapshot?: VipSnapshot };

/** Only a verified current Season PDA AND canonical pass grant VIP. A failed
 * RPC or an old/mismatched season revokes the visual entitlement. UI storage
 * is not a source of access rights. The root loader alone updates global VIP;
 * detail pages do not race it with an independent response. */
export function useVipStatus(syncGlobal = false) {
  const user = useWalletStr();
  const setVip = useStore(s => s.setVip);
  const [reading, setReading] = useState<Reading | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(n => n + 1), []);
  // Rollover, expiry and RPC failures must revoke cosmetics on open tabs.
  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [user, refresh]);
  useEffect(() => {
    let active = true;
    if (syncGlobal) setVip(false);
    if (!user) { setReading(null); return () => { active = false; }; }
    setReading({ owner: user, kind: 'loading' });
    (async () => {
      const season = readActiveSeason(await api.season.current());
      if (!season) throw new Error('No verified active season');
      const snapshot = readVipSnapshot(await api.season.vipStatus(user, season.seasonId), user, season.seasonId);
      if (!snapshot) throw new Error('Invalid canonical VIP response');
      if (!active) return;
      if (syncGlobal) setVip(snapshot.isVip, snapshot.privileges);
      setReading({ owner: user, kind: 'ready', snapshot, seasonId: season.seasonId });
    })().catch(() => {
      if (active) { if (syncGlobal) setVip(false); setReading({ owner: user, kind: 'error' }); }
    });
    return () => { active = false; };
  }, [user, syncGlobal, setVip, version]);
  const current = reading?.owner === user ? reading : null;
  return { reading: current, seasonId: current?.kind === 'ready' ? current.seasonId ?? null : null, user, refresh };
}
