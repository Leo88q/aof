import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONSENT_KEY, CONSENT_VERSION, MAX_AGE, OPTIONAL_KEYS, createChoice, parseConsent, functionalStorage, saveConsent, initializePrivacy } from '../src/legal/consent';

const now = 1_800_000_000_000;
test('consent is opt-in, expires, and rejects incompatible/corrupt receipts', () => {
  assert.equal(parseConsent(null, now), null);
  assert.equal(parseConsent('{', now), null);
  const record = createChoice(true, now, false, 'test-receipt');
  assert.equal(parseConsent(JSON.stringify(record), now)?.functional, true);
  assert.equal(parseConsent(JSON.stringify(record), now + MAX_AGE), null);
  assert.equal(parseConsent(JSON.stringify(record), now - 1), null);
  for (const changes of [{version:'old'}, {functional:'true'}, {marketing:true}, {analytics:true}, {necessary:false}, {expires:now+MAX_AGE+1}, {id:''}]) {
    assert.equal(parseConsent(JSON.stringify({...record,...changes}), now), null);
  }
});
test('GPC overrides stored permission and new choices; no advertising consent', () => {
  const record = createChoice(true, now, false, 'test-receipt');
  assert.equal(parseConsent(JSON.stringify(record), now, true)?.functional, false);
  assert.equal(createChoice(true, now, true, 'test-receipt').functional, false);
  assert.equal(record.marketing, false); assert.equal(record.analytics, false);
});
test('optional storage is blocked before consent; withdrawal removes known keys only', () => {
  const map = new Map<string,string>();
  const storage = { getItem: (k:string) => map.get(k) ?? null, setItem: (k:string,v:string) => {map.set(k,v);}, removeItem: (k:string) => {map.delete(k);} };
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'localStorage', {configurable:true,value:storage});
  Object.defineProperty(globalThis, 'window', {configurable:true,value:new EventTarget()});
  try {
    functionalStorage.setItem(OPTIONAL_KEYS[0], 'blocked');
    assert.equal(map.size, 0);
    map.set(OPTIONAL_KEYS[0], 'legacy'); map.set('unrelated', 'keep');
    initializePrivacy(); assert.equal(map.has(OPTIONAL_KEYS[0]), false);
    saveConsent(true);
    functionalStorage.setItem(OPTIONAL_KEYS[0], 'allowed');
    assert.equal(functionalStorage.getItem(OPTIONAL_KEYS[0]), 'allowed');
    functionalStorage.setItem('unrecognized', 'blocked'); assert.equal(map.has('unrecognized'), false);
    saveConsent(false);
    assert.equal(map.has(OPTIONAL_KEYS[0]), false);
    assert.equal(map.get('unrelated'), 'keep');
    assert.equal(JSON.parse(map.get(CONSENT_KEY)!).version, CONSENT_VERSION);
    assert.equal(functionalStorage.getItem(OPTIONAL_KEYS[0]), null);
  } finally {
    if (oldStorage) Object.defineProperty(globalThis,'localStorage',oldStorage); else delete (globalThis as any).localStorage;
    if (oldWindow) Object.defineProperty(globalThis,'window',oldWindow); else delete (globalThis as any).window;
  }
});
test('HTML has no Google Fonts request and permits browser zoom', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /https:\/\/fonts\.(googleapis|gstatic)\.com/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
});
test('production headers prohibit inline/eval scripts and framing', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  const enforced = headers.split('\n').find(l => l.trim().startsWith('Content-Security-Policy:'))!;
  assert.match(enforced, /script-src 'self'/); assert.match(enforced, /frame-ancestors 'none'/);
  assert.doesNotMatch(enforced, /unsafe-inline|unsafe-eval/);
  assert.match(headers, /X-Frame-Options: DENY/);
});
