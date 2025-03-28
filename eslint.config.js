import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";
import nodePlugin from "eslint-plugin-n";

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Ignores
  {
    ignores: [
      "**/.react-router/**",
      "**/dist/**",
      "**/*.gen.ts",
      "**/build/**",
      "./packages/schematics/**",
    ],
  },
  // Include all files for our default configs
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
  },

  // Default and recommended configs, will be applied to all matching files
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      n: nodePlugin,
    },
  },

  // Custom shared rules
  {
    rules: {
      "sort-imports": ["error"],
    },
  },

  // React project configs (hooks, etc)
  {
    files: [
      "apps/web-spa/**/*.{jsx,tsx}",
      "apps/web-spa-admin/**/*.{jsx,tsx}",
      "packages/ui/**/*.{jsx,tsx}",
    ],
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      // React scope no longer necessary with new JSX transform.
      "react/react-in-jsx-scope": "off",
    },
  },

  // Nestjs projects configs
  {
    files: ["apps/api/**/*.ts", "apps/api/**/*.json"],
    rules: {
      // Mandatory for NestJS, as type imports can screw things up at runtime
      "@typescript-eslint/consistent-type-imports": "off",
      "n/prefer-global/process": ["error", "always"],
    },
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
