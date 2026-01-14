module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/types/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleFileExtensions: [
    'ts',
    'js',
    'json'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@sast/(.*)$': '<rootDir>/src/sast/$1',
    '^@dast/(.*)$': '<rootDir>/src/dast/$1',
    '^@dependencies/(.*)$': '<rootDir>/src/dependencies/$1',
    '^@pentest/(.*)$': '<rootDir>/src/pentest/$1',
    '^@policy/(.*)$': '<rootDir>/src/policy/$1',
    '^@compliance/(.*)$': '<rootDir>/src/compliance/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@scanners/(.*)$': '<rootDir>/src/scanners/$1',
    '^@reports/(.*)$': '<rootDir>/src/reports/$1',
    '^@integrations/(.*)$': '<rootDir>/src/integrations/$1',
    '^@workers/(.*)$': '<rootDir>/src/workers/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  maxWorkers: 4,
  verbose: true
};
