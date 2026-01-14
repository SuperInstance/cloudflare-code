import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'canary-tests',
    environment: 'node',
    globals: true,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 60000,
    hookTimeout: 120000,
    teardownTimeout: 120000,
    isolate: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        minForks: 1,
        maxForks: 5,
      },
    },
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/canary-results.json',
      html: './test-results/canary-report.html',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test-results/',
        '**/*.test.ts',
        '**/*.config.ts',
      ],
    },
  },
});
