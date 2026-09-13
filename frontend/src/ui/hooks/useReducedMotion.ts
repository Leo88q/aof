import { useSyncExternalStore } from 'react';
const QUERY = '(prefers-reduced-motion: reduce)';
function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const media = window.matchMedia(QUERY);
  const listener = (): void => onChange();
  media.addEventListener('change', listener);
  return () => { media.removeEventListener('change', listener); };
}
function getSnapshot(): boolean { return window.matchMedia(QUERY).matches; }
function getServerSnapshot(): boolean { return true; }
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
