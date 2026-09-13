export default {
  plugins: ['./scripts/stylelint/no-raw-color.mjs'],
  ignoreFiles: ['src/ui/tokens.css'],
  rules: {
    'aof/no-raw-color': true,
    'declaration-no-important': true,
  },
};
