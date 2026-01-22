/**
 * Jest configuration for contract tests
 */

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/contract'],
  testMatch: ['**/*.contract.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/index.ts'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: './reports/contract/coverage',
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: './reports/contract', outputName: 'junit.xml' }]
  ],
  testTimeout: 30000
};
