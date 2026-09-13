export const AOF_COLOR_VARS = {
  concrete: '--aof-concrete',
  oak: '--aof-oak',
  oakLight: '--aof-oak-light',
  oakDark: '--aof-oak-dark',
  copper: '--aof-copper',
  copperBright: '--aof-copper-bright',
  copperDark: '--aof-copper-dark',
  terracotta: '--aof-terracotta',
  sage: '--aof-sage',
  golden: '--aof-golden',
  forest: '--aof-forest',
  parchment: '--aof-parchment',
  ember: '--aof-ember',
} as const;

export type AofColorName = keyof typeof AOF_COLOR_VARS;
export const AOF_COLOR_NAMES = Object.keys(AOF_COLOR_VARS) as AofColorName[];

export const AOF_DURATION_VARS = {
  press: '--aof-dur-press',
  release: '--aof-dur-release',
  panel: '--aof-dur-panel',
  tooltip: '--aof-dur-tooltip',
  tab: '--aof-dur-tab',
  toastIn: '--aof-dur-toast-in',
  page: '--aof-dur-page',
} as const;
export type AofDurationName = keyof typeof AOF_DURATION_VARS;

export const AOF_SHADOW_VARS = {
  sm: '--aof-shadow-sm',
  md: '--aof-shadow-md',
  lg: '--aof-shadow-lg',
  xl: '--aof-shadow-xl',
  inset: '--aof-shadow-inset',
} as const;
export type AofShadowName = keyof typeof AOF_SHADOW_VARS;

function cssReferences<K extends string>(
  variables: Readonly<Record<K, string>>,
): Readonly<Record<K, string>> {
  const result = {} as Record<K, string>;
  for (const key of Object.keys(variables) as K[]) {
    result[key] = `var(${variables[key]})`;
  }
  return Object.freeze(result);
}

export const AOF_TOKENS = {
  colors: cssReferences<AofColorName>(AOF_COLOR_VARS),
  fonts: {
    display: "'Playfair Display', Georgia, serif",
    body: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  shadows: cssReferences<AofShadowName>(AOF_SHADOW_VARS),
  radii: { sm: 4, md: 8, lg: 12 },
  unit: 8,
  durations: {
    press: 80, release: 120, panel: 300, tooltip: 100,
    tab: 200, toastIn: 250, page: 400,
  },
} as const;

export interface AofResolvedTokens {
  colors: Record<AofColorName, string>;
  shadows: Record<AofShadowName, string>;
  durations: Record<AofDurationName, number>;
}

export function readAofTokens(scope: Element): AofResolvedTokens {
  const view = scope.ownerDocument.defaultView;
  if (!view) throw new Error('AOF: element has no associated window');
  const computed = view.getComputedStyle(scope);
  const read = (variable: string): string => {
    const value = computed.getPropertyValue(variable).trim();
    if (!value) throw new Error(`AOF: missing CSS token ${variable}`);
    return value;
  };
  const colors = {} as Record<AofColorName, string>;
  const shadows = {} as Record<AofShadowName, string>;
  const durations = {} as Record<AofDurationName, number>;
  for (const name of AOF_COLOR_NAMES) colors[name] = read(AOF_COLOR_VARS[name]);
  for (const name of Object.keys(AOF_SHADOW_VARS) as AofShadowName[])
    shadows[name] = read(AOF_SHADOW_VARS[name]);
  for (const name of Object.keys(AOF_DURATION_VARS) as AofDurationName[]) {
    const value = read(AOF_DURATION_VARS[name]);
    if (!value.endsWith('ms')) throw new Error(`AOF: duration must use milliseconds: ${name}`);
    const milliseconds = Number(value.slice(0, -2));
    if (!Number.isFinite(milliseconds) || milliseconds < 0)
      throw new Error(`AOF: invalid duration: ${name}`);
    durations[name] = milliseconds;
  }
  return { colors, shadows, durations };
}
