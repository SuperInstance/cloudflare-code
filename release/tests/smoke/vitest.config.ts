import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'smoke-tests',
    environment: 'node',
    globals: true,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 30000,
    hookTimeout: 60000,
    teardownTimeout: 60000,
    isolate: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/smoke-results.json',
      html: './test-results/smoke-report.html',
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
