'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const anchorToml = fs.readFileSync(path.join(root, 'Anchor.toml'), 'utf8');

test('Anchor local-validator clone entries have an explicit source RPC URL', () => {
  const marker = '[test.validator]';
  const sectionStart = anchorToml.indexOf(marker);
  assert.notEqual(sectionStart, -1, '[test.validator] section is present');
  const sectionBody = anchorToml.slice(sectionStart + marker.length);
  const nextSection = sectionBody.search(/^\[/m);
  const section = nextSection < 0 ? sectionBody : sectionBody.slice(0, nextSection);
  assert.match(section, /^\s*url\s*=\s*"https?:\/\/[^\"]+"\s*$/m,
    'test.validator.url must identify the cluster used to clone accounts');
  assert.match(anchorToml, /^\[\[test\.validator\.clone\]\]$/m,
    'the URL is required because Anchor.toml configures cloned accounts');
});
