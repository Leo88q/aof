module.exports = {
  env: {
    es2022: true, // or es2020+, enables newer globals too
    node: true,
  },
  parserOptions: {
    ecmaVersion: "latest", // <- was 2018; this fixes ?. and ?? parsing
    sourceType: "script",
  },
  extends: ["eslint:recommended", "google"],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "max-len": "off",
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
    // "no-console": "off",
    "camelcase": "off",
    // "require-jsdoc": "off",
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {mocha: true},
      rules: {},
    },
  ],
  // Optional: ignore built files if any
  // ignorePatterns: ["lib/**", "dist/**"],
};
