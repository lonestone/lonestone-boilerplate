// eslint.config.js
import antfu from '@antfu/eslint-config'

export default antfu(
  // Configures for antfu's config and global rules
  {
    react: true,
    css: true,
    html: true,
    ignores: [
      '**/.react-router/**',
      '**/*.gen.ts',
      '**/dist/',
      '**/temp/',
      '**/build/',
      'packages/schematics/src/files/',
      'packages/openapi-generator/client/',
    ],
    rules: {
      'ts/no-explicit-any': 'error',
    },
  },
  // Starting from the second arguments they are ESLint Flat Configs
  // Careful, antfu renames some plugins for consistency https://github.com/antfu/eslint-config?tab=readme-ov-file#plugins-renaming
  {
    files: ['apps/api/**/*.ts', 'apps/api/**/*.json'],
    rules: {
      'ts/consistent-type-imports': 'off',
      'node/prefer-global/process': ['error', 'always'],
    },
  },
)
