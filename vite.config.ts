// vp migrate: merged .oxlintrc.json (e396b7c012193aa0ae0b876ae29fc423).
import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    "semi": false,
    "singleQuote": true,
    "tabWidth": 2,
    "trailingComma": "all",
    "printWidth": 100,
    "ignorePatterns": [
      "**/.react-router/**",
      "**/*.gen.ts",
      "**/dist/**",
      "**/temp/**",
      "**/build/**",
      "packages/openapi-generator/client/**",
      "**/.astro/**",
      "node_modules/**",
      "**/.worktrees/**",
      "CHANGELOG.md",
      "CLAUDE.md",
      "AGENTS.md",
      "**/README.md",
      "pnpm-workspace.yaml"
    ]
  },
  lint: {
    "plugins": [
      "typescript",
      "react",
      "import",
      "unicorn",
      "node",
      "jsx-a11y",
      "promise"
    ],
    "env": {
      "node": true,
      "browser": true
    },
    "settings": {
      "react": {
        "version": "19.2.8"
      }
    },
    "ignorePatterns": [
      "**/.react-router/**",
      "**/*.gen.ts",
      "**/dist/**",
      "**/temp/**",
      "**/build/**",
      "packages/openapi-generator/client/**",
      "**/.astro/**",
      "node_modules/**",
      "**/.worktrees/**",
      "CLAUDE.md",
      "AGENTS.md",
      "**/README.md",
      "pnpm-workspace.yaml"
    ],
    "rules": {
      "typescript/no-explicit-any": "error",
      "vite-plus/prefer-vite-plus-imports": "error"
    },
    "overrides": [
      {
        "files": [
          "apps/api/**/*.ts",
          "apps/api/**/*.json"
        ],
        "rules": {
          "typescript/consistent-type-imports": "off"
        }
      },
      {
        "files": [
          "apps/api/**/*.entity.ts"
        ],
        "rules": {
          "eslint/max-classes-per-file": [
            "error",
            1
          ]
        }
      }
    ],
    "options": {
      "typeAware": true,
      "typeCheck": true
    },
    "jsPlugins": [
      {
        "name": "vite-plus",
        "specifier": "vite-plus/oxlint-plugin"
      }
    ]
  },
});
