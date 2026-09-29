import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { readEconomyBalances } from '../../lib/economyBalances';

/** Bind every response to its owner. The first read and every wallet switch
 * show a loading state; an RPC failure or incomplete response never becomes
 * an empty/zero-filled inventory. */
export function useEconomyBalances(address: string | null, refreshKey = 0) {
  const [reading, setReading] = useState<{ address: string; balances: Record<string, number> } | null>(null);
  const [status, setStatus] = useState<{ address: string; kind: 'loading' | 'ready' | 'error' } | null>(null);
  useEffect(() => {
    let active = true;
    if (!address) { setReading(null); setStatus(null); return; }
    setReading(null);
    setStatus({ address, kind: 'loading' });
    api.query.balances(address)
      .then((raw: unknown) => {
        if (!active) return;
        const balances = readEconomyBalances(raw);
        if (!balances) throw new Error('Incomplete on-chain balances');
        setReading({ address, balances });
        setStatus({ address, kind: 'ready' });
      })
      .catch(() => { if (active) { setReading(null); setStatus({ address, kind: 'error' }); } });
    return () => { active = false; };
  }, [address, refreshKey]);
  return {
    balances: status?.address === address && status.kind === 'ready' && reading?.address === address ? reading.balances : null,
    state: !address ? 'disconnected' : status?.address !== address ? 'loading' : status.kind,
  } as const;
}
