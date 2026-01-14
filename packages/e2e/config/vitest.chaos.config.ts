import { defineConfig } from 'vitest/config';

/**
 * Vitest Chaos Engineering Configuration
 *
 * Tests system resilience under failure conditions
 */
export default defineConfig({
  test: {
    include: ['tests/chaos/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 60000,
    hookTimeout: 60000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
        minThreads: 1,
        maxThreads: 1
      }
    },
    reporters: ['verbose', 'json', 'junit'],
    outputFile: {
      json: './test-results/chaos-results.json',
      junit: './test-results/chaos-junit.xml'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/'
      ]
    },
    setupFiles: ['./tests/chaos/setup.ts'],
    teardownFiles: ['./tests/chaos/teardown.ts']
  }
});
