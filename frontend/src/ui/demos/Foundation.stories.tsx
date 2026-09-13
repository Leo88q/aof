import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { Foundation } from './Foundation';
import {
  AOF_COLOR_NAMES, AOF_COLOR_VARS, AOF_DURATION_VARS, AOF_SHADOW_VARS,
  AOF_TOKENS, readAofTokens, type AofDurationName, type AofShadowName,
} from '../tokens';
const meta = {
  title: 'AOF/Foundation/Tokens', component: Foundation, tags: ['autodocs'],
} satisfies Meta<typeof Foundation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
export const TokenParity: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scope = canvas.getByTestId('aof-foundation');
    const doc = scope.ownerDocument;
    const view = doc.defaultView;
    if (!view) throw new Error('Storybook window is unavailable');
    const styles = view.getComputedStyle(scope);
    const resolved = readAofTokens(scope);
    const read = (name: string): string => styles.getPropertyValue(name).trim();
    const probe = doc.createElement('span');
    probe.hidden = true;
    scope.appendChild(probe);
    const drawing = doc.createElement('canvas').getContext('2d');
    if (!drawing) { probe.remove(); throw new Error('Canvas 2D is unavailable'); }
    try {
      for (const name of AOF_COLOR_NAMES) {
        const value = resolved.colors[name];
        await expect(value).not.toBe('');
        await expect(CSS.supports('color', value)).toBe(true);
        await expect(read(AOF_COLOR_VARS[name])).toBe(value);
        const swatch = scope.querySelector<HTMLElement>(`[data-color="${name}"]`);
        if (!swatch) throw new Error(`Missing swatch: ${name}`);
        probe.style.color = value;
        await expect(view.getComputedStyle(swatch).backgroundColor)
          .toBe(view.getComputedStyle(probe).color);
        drawing.fillStyle = value;
        probe.style.color = drawing.fillStyle;
        await expect(view.getComputedStyle(probe).color)
          .toBe(view.getComputedStyle(swatch).backgroundColor);
      }
      for (const name of Object.keys(AOF_SHADOW_VARS) as AofShadowName[]) {
        const sample = scope.querySelector<HTMLElement>(`[data-shadow="${name}"]`);
        if (!sample) throw new Error(`Missing shadow sample: ${name}`);
        await expect(resolved.shadows[name]).not.toBe('');
        probe.style.boxShadow = resolved.shadows[name];
        await expect(view.getComputedStyle(sample).boxShadow)
          .toBe(view.getComputedStyle(probe).boxShadow);
      }
    } finally { probe.remove(); }
    const normalizeFont = (value: string): string =>
      value.replace(/["']/g, '').replace(/\s+/g, '');
    for (const [name, value] of Object.entries(AOF_TOKENS.fonts)) {
      await expect(normalizeFont(read(`--aof-font-${name}`)))
        .toBe(normalizeFont(value));
    }
    for (const [name, value] of Object.entries(AOF_TOKENS.radii)) {
      await expect(read(`--aof-radius-${name}`)).toBe(`${value}px`);
    }
    await expect(read('--aof-unit')).toBe(`${AOF_TOKENS.unit}px`);
    const reduced = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const name of Object.keys(AOF_DURATION_VARS) as AofDurationName[]) {
      const expected = reduced ? 0 : AOF_TOKENS.durations[name];
      await expect(resolved.durations[name]).toBe(expected);
      await expect(read(AOF_DURATION_VARS[name])).toBe(`${expected}ms`);
    }
  },
};
