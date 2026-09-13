import stylelint from 'stylelint';
import valueParser from 'postcss-value-parser';
const ruleName = 'aof/no-raw-color';
const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (value) => `Unexpected raw color "${value}". Use var(--aof-*) instead.`,
});
const rawFunctions = new Set([
  'rgb','rgba','hsl','hsla','hwb','lab','lch','oklab','oklch','color','device-cmyk',
]);
const hexColor = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;
const ruleFunction = (enabled) => (root, result) => {
  const valid = stylelint.utils.validateOptions(result, ruleName, {
    actual: enabled, possible: [true],
  });
  if (!valid) return;
  root.walkDecls((declaration) => {
    valueParser(declaration.value).walk((node) => {
      if (node.type === 'function') {
        const name = node.value.toLowerCase();
        if (name === 'url') return false;
        if (rawFunctions.has(name)) {
          stylelint.utils.report({
            result, ruleName, node: declaration,
            message: messages.rejected(valueParser.stringify(node)),
          });
          return false;
        }
      }
      if (node.type === 'word' && hexColor.test(node.value)) {
        stylelint.utils.report({
          result, ruleName, node: declaration,
          message: messages.rejected(node.value),
        });
      }
      return undefined;
    });
  });
};
ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
export default stylelint.createPlugin(ruleName, ruleFunction);
