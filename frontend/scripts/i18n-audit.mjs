// Inventory Russian literals in application source. Historical input aliases
// are not display copy. This does not certify privacy or authorize a release.
import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../src');
const legacyAliases = new Set(['Фотон-бит', 'Био-чип', 'Ядро души', 'Голубое ядро']);
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Only locale catalogs are excluded; every other source file is scanned.
      if (entry.name !== 'i18n') walk(join(dir, entry.name));
    } else if (/\.tsx?$/.test(entry.name)) files.push(join(dir, entry.name));
  }
}
walk(root);
const findings = [];
const ru = /[А-Яа-яЁё]/;
function belongsToDeclaration(node, declarationName) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isVariableDeclaration(parent) && parent.name.getText() === declarationName) return true;
  }
  return false;
}
for (const file of files) {
  const rel = relative(root, file);
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = node => {
    if (ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const text = (node.text ?? node.getText(source)).replace(/\s+/g, ' ').trim();
      if (ru.test(text)) {
        // Historic resource identifiers must be accepted as input, never used
        // as a display string. Only these exact four property names qualify.
        const category = rel === 'lib/visualAssets.ts' && legacyAliases.has(text) &&
          ts.isStringLiteral(node) && ts.isPropertyAssignment(node.parent) &&
          node.parent.name === node && belongsToDeclaration(node, 'LEGACY_RESOURCE_ID')
          ? 'legacy-input-alias' : 'unreviewed';
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        findings.push({ file: rel, line, text: text.slice(0, 180), category });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
const byCategory = {};
for (const { category } of findings) byCategory[category] = (byCategory[category] || 0) + 1;
const retainedAliasNames = new Set(findings.filter(x => x.category === 'legacy-input-alias').map(x => x.text));
const retainedValid = byCategory['legacy-input-alias'] === legacyAliases.size &&
  retainedAliasNames.size === legacyAliases.size && [...legacyAliases].every(name => retainedAliasNames.has(name));
const unreviewed = findings.filter(entry => entry.category === 'unreviewed');
const report = {
  rawRussianLiterals: findings.length,
  files: new Set(findings.map(x => x.file)).size,
  retainedOriginals: { legacyAliases: byCategory['legacy-input-alias'] || 0 },
  unreviewedCandidates: unreviewed.length,
  protectedSourcesIntact: retainedValid,
  sample: (process.argv.includes('--all') ? findings : findings.slice(0, 25)),
};
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Russian source literals outside locale catalogs: ${report.rawRussianLiterals} across ${report.files} files`);
  console.log(`  retained historic resource-input aliases: ${report.retainedOriginals.legacyAliases}`);
  console.log(`  unreviewed candidates: ${report.unreviewedCandidates}`);
  if (!retainedValid) console.error('Historic input aliases changed: review old resource identifiers.');
  console.log('This checks source classification, not browser copy, legal sign-off or payment safety.');
}
if (process.argv.includes('--strict') && (!retainedValid || unreviewed.length)) process.exitCode = 1;
