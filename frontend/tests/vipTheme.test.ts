import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { vipThemeFor, chooseVipTheme, applyVipTheme } from '../src/lib/vipTheme';
import { readActiveSeason } from '../src/lib/currentSeasonReadings';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const season = { source: 'onchain', seasonId: 2, startTime: 1_700_000_000, endTime: 1_700_000_000 + 42 * 86_400 };
test('season rollover uses verified chain window and rejects stale/forged pointers', () => {
  assert.equal(readActiveSeason(season, season.startTime)?.seasonId, 2);
  assert.equal(readActiveSeason(season, season.endTime), null);
  assert.equal(readActiveSeason({ ...season, source: 'cache' }, season.startTime), null);
  assert.equal(readActiveSeason({ ...season, endTime: season.endTime + 1 }, season.startTime), null);
  assert.equal(readActiveSeason({ ...season, seasonId: 2.5 }, season.startTime), null);
  assert.equal(readActiveSeason({ ...season, seasonId: 0x1_0000_0000 }, season.startTime), null);
  assert.equal(readActiveSeason(season, season.startTime - 1), null);
});

test('both VIP visual assets are bundled as local optimized icons', () => {
  for (const name of ['copper', 'orchid']) {
    assert.ok(existsSync(join(process.cwd(), `public/assets/icons/ui/vip-${name}.png`)));
  }
});

test('a browser preference cannot grant VIP or cross wallets/seasons', () => {
  assert.equal(vipThemeFor('wallet-A', 1, false, 'orchid'), null);
  assert.equal(vipThemeFor('', 1, true, 'orchid'), null);
  assert.equal(vipThemeFor('wallet-A', 1, true, 'not-a-theme'), 'copper');
  assert.equal(vipThemeFor('wallet-A', 1, true, 'orchid'), 'orchid');

  const stored = new Map<string, string>();
  const attrs = new Map<string, string>();
  const shell = {
    setAttribute: (key: string, value: string) => attrs.set(key, value),
    removeAttribute: (key: string) => attrs.delete(key),
  };
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  try {
    globalThis.window = { localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value); },
    } } as unknown as Window & typeof globalThis;
    globalThis.document = { querySelector: () => shell } as unknown as Document;
    assert.equal(chooseVipTheme('wallet-A', 1, false, 'orchid'), false);
    assert.equal(stored.size, 0);
    assert.equal(chooseVipTheme('wallet-A', 1, true, 'orchid'), true);
    assert.equal(attrs.get('data-vip-theme'), 'orchid');
    applyVipTheme('wallet-B', 1, true);
    assert.equal(attrs.get('data-vip-theme'), 'copper');
    applyVipTheme('wallet-A', 2, true);
    assert.equal(attrs.get('data-vip-theme'), 'copper');
    applyVipTheme('wallet-A', 1, false);
    assert.equal(attrs.has('data-vip-theme'), false);
  } finally {
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
});
