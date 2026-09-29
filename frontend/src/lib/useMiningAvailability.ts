import { useSyncExternalStore } from 'react';
import { api } from './api';

/** Live on-chain Config via the backend. Unknown/error means disabled. */
export async function readMiningEnabled(): Promise<boolean> {
  try {
    const config: any = await api.query.config();
    return config?.miningEnabled === true;
  } catch {
    return false;
  }
}

// All tool cards and the plot share ONE poller. A single page of 25 NFTs must
// not turn into 25 independent RPC requests every ten seconds.
let enabled = false;
let generation = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
function emit() { for (const listener of listeners) listener(); }
function refresh() {
  const current = ++generation;
  enabled = false; // stale positives never survive a network read or pause
  emit();
  void readMiningEnabled().then(value => {
    if (generation === current && listeners.size) { enabled = value; emit(); }
  });
}
function visible() { if (!document.hidden) refresh(); }
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    refresh();
    timer = setInterval(refresh, 10_000);
    document.addEventListener('visibilitychange', visible);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      if (timer) clearInterval(timer);
      timer = undefined;
      document.removeEventListener('visibilitychange', visible);
      ++generation;
      enabled = false;
    }
  };
}
const snapshot = () => enabled;
const serverSnapshot = () => false;
export function useMiningAvailability(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
