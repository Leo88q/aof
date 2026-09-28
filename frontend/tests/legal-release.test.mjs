import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateOperator, securityText } from '../scripts/legal-release.mjs';
const draft = JSON.parse(readFileSync(new URL('../src/legal/operator.json',import.meta.url),'utf8'));
// Synthetic structure-only fixture: not an operational operator/contact.
const fixture = {...draft, approved:true, operatorName:'Fixture', operatorAddress:'Fixture address', operatorCountry:'CZ', registrationDetails:'Fixture registration', governingLaw:'Fixture law', retentionPolicy:'Fixture schedule', transferSafeguards:'Fixture review', privacyRepresentative:'Fixture role', contactEmail:'contact@fixture.neuroforge.org', privacyEmail:'privacy@fixture.neuroforge.org', securityEmail:'security@fixture.neuroforge.org', canonicalOrigin:'https://fixture.neuroforge.org', audienceCountries:['CZ'], processors:['Fixture processor, country, purpose']};
test('unfinished documents cannot pass the release gate', () => { assert.ok(validateOperator({...draft,approved:false}).length > 0); });
test('required fields cannot be bypassed by an approval flag', () => {
  assert.ok(validateOperator({...fixture,privacyEmail:''}).length);
  assert.ok(validateOperator({...fixture,canonicalOrigin:'http://localhost'}).length);
  assert.ok(validateOperator({...fixture,securityEmail:'x@example.com'}).length);
  assert.ok(validateOperator({...fixture,securityEmail:'x@real.org\nExpires: never'}).length);
  assert.ok(validateOperator({...fixture,processors:[]}).length);
});
test('security.txt uses checked contacts, canonical origin and bounded expiry', () => {
  assert.deepEqual(validateOperator(fixture), []);
  const text = securityText(fixture, new Date('2026-09-28T00:00:00Z'));
  assert.match(text, /Contact: mailto:security@fixture.neuroforge.org/);
  assert.match(text, /Canonical: https:\/\/fixture.neuroforge.org\/\.well-known\/security.txt/);
  assert.match(text, /Expires: 2027-03-27T00:00:00.000Z/);
  assert.throws(() => securityText({...fixture,approved:false}));
});
