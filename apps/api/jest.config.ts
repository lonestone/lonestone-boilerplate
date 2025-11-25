/** @jest-config-loader ts-node */
import type { Config } from 'jest'

const commonConfig: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: './tsconfig.jest.json',
    }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
  },
  maxWorkers: 1,
  transformIgnorePatterns: [
    'node_modules/(?!(prosemirror-highlight|@blocknote|prosemirror-.*)/)',
  ],
}

const configE2E: Config = {
  ...commonConfig,
  testRegex: '.*\\.e2e-spec\\.ts$',
  setupFilesAfterEnv: [
    '<rootDir>/test/test.setup.ts',
    '<rootDir>/test/test.e2e-setup.ts',
  ],
}

const configUnit: Config = {
  ...commonConfig,
  testRegex: ['^.+\\.service\\.spec\\.ts$', '^.+\\.processor\\.spec\\.ts$'],
  setupFilesAfterEnv: [
    '<rootDir>/test/test.setup.ts',
  ],
}

const config: Config = {
  projects: [
    configE2E,
    configUnit,
  ],
}

export default config
