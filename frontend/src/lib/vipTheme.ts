// Cosmetic-only seasonal entitlement. Browser storage is a preference, NEVER
// evidence of ownership: caller must pass the canonical on-chain VIP result.
export type VipTheme = 'copper' | 'orchid';
const themes: readonly VipTheme[] = ['copper', 'orchid'];
const key = (owner: string, season: number) => `nf:vip-theme:${season}:${owner}`;

export function vipThemeFor(owner: string, season: number, verifiedVip: boolean, stored: string | null): VipTheme | null {
  if (!owner || !Number.isSafeInteger(season) || season < 0 || !verifiedVip) return null;
  return themes.includes(stored as VipTheme) ? stored as VipTheme : 'copper';
}

export function readVipTheme(owner: string, season: number, verifiedVip: boolean): VipTheme | null {
  if (!verifiedVip || !owner) return null;
  try { return vipThemeFor(owner, season, verifiedVip, window.localStorage.getItem(key(owner, season))); }
  catch { return vipThemeFor(owner, season, verifiedVip, null); }
}

export function applyVipTheme(owner: string, season: number, verifiedVip: boolean): void {
  const shell = document.querySelector('.app-shell');
  if (!shell) return;
  const theme = readVipTheme(owner, season, verifiedVip);
  if (theme) shell.setAttribute('data-vip-theme', theme);
  else shell.removeAttribute('data-vip-theme');
}

/** A saved preference may only be applied while the caller has rechecked VIP. */
export function chooseVipTheme(owner: string, season: number, verifiedVip: boolean, theme: VipTheme): boolean {
  if (!vipThemeFor(owner, season, verifiedVip, theme) || !themes.includes(theme)) return false;
  try { window.localStorage.setItem(key(owner, season), theme); } catch { /* private browsing */ }
  applyVipTheme(owner, season, verifiedVip);
  return true;
}
