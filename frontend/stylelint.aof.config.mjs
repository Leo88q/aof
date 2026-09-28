export default {
  plugins: ['./scripts/stylelint/no-raw-color.mjs'],
  // forge.css — единственный слой представления и одновременно место, где
  // объявлена палитра «Морозное стекло»: сырые цвета допустимы только здесь.
  // Правило продолжает стеречь любой будущий компонентный CSS.
  ignoreFiles: ['src/theme/forge.css'],
  rules: {
    'aof/no-raw-color': true,
    'declaration-no-important': true,
  },
};
