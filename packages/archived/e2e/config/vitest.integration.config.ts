import { defineConfig } from 'vitest/config';

/**
 * Vitest Integration Test Configuration
 *
 * Tests integration between components, API endpoints, and services
 */
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    isolate: false,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4
      }
    },
    reporters: ['verbose', 'json', 'junit'],
    outputFile: {
      json: './test-results/integration-results.json',
      junit: './test-results/integration-junit.xml'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/*.config.ts'
      ]
    },
    setupFiles: ['./tests/integration/setup.ts'],
    teardownFiles: ['./tests/integration/teardown.ts']
  }
});
