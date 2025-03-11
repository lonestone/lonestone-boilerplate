import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { config as baseConfig } from "./packages/eslint-config/base.js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...baseConfig,
  { 
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
  },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
];