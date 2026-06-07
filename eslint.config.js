// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const jsxA11y = require('eslint-plugin-jsx-a11y');

module.exports = defineConfig([
  expoConfig,
  jsxA11y.flatConfigs.recommended,
  {
    ignores: ["dist/*"],
  }
]);
