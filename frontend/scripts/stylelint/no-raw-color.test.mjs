import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const configFile = path.join(projectRoot, 'stylelint.aof.config.mjs');
async function lint(code, filename = 'src/ui/demos/Test.css') {
  return stylelint.lint({
    code, codeFilename: path.join(projectRoot, filename), configFile,
  });
}
function warnings(result) {
  return result.results.flatMap((entry) => entry.warnings);
}
test('accepts AOF variables and token mixtures', async () => {
  const result = await lint(`
    .sample {
      color: var(--aof-forest);
      background: color-mix(in srgb, var(--aof-parchment) 90%, var(--aof-oak));
      box-shadow: var(--aof-shadow-md);
    }
  `);
  assert.equal(result.errored, false);
});
test('rejects raw colors and nested fallbacks', async () => {
  const result = await lint(`
    .sample {
      color: #abc;
      background: rgb(10 20 30 / 50%);
      border-color: hsl(30 20% 40%);
      outline-color: var(--aof-copper, #ffffff);
      text-decoration-color: oklch(60% 0.1 40);
    }
  `);
  const violations = warnings(result).filter(w => w.rule === 'aof/no-raw-color');
  assert.equal(result.errored, true);
  assert.equal(violations.length, 5);
});
test('accepts strings, comments and URL fragments', async () => {
  const result = await lint(`
    /* Reference text: #abc */
    .sample {
      content: "#abc";
      mask-image: url("/assets/ui/sprites/test.svg#abc");
      color: var(--aof-forest);
    }
  `);
  assert.equal(result.errored, false);
});
test('rejects important declarations', async () => {
  const result = await lint(`
    .sample { color: var(--aof-forest) !important; }
  `);
  assert.equal(result.errored, true);
  assert.ok(warnings(result).some(w => w.rule === 'declaration-no-important'));
});
test('exempts only the canonical tokens file', async () => {
  const result = await lint(':root { --aof-test: #abc; }', 'src/ui/tokens.css');
  assert.equal(result.errored, false);
  assert.equal(result.results[0]?.ignored, true);
  const nested = await lint(':root { --aof-test: #abc; }', 'src/ui/demos/tokens.css');
  assert.equal(nested.errored, true);
});
