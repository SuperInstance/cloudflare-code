/**
 * Vitest configuration for integration tests
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4
      }
    },
    reporters: ['verbose', 'json'],
    outputFile: './reports/integration/test-results.json',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      outputDir: './reports/integration/coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/index.ts'
      ],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    }
  }
});
