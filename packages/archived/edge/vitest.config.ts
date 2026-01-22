import { defineConfig } from 'vitest/config';
import { coverageConfigDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      bindings: {
        // Environment variables
        ENVIRONMENT: 'test',
        API_VERSION: '0.1.0',

        // Mock KV Namespaces
        CACHE_KV: {},
        CONFIG_KV: {},

        // Mock R2 Bucket
        STORAGE_R2: {},

        // Mock D1 Database
        DB: {},

        // Mock Durable Objects
        SESSIONS: {},
        AGENTS: {},
        VECTOR_DB: {},

        // Mock Queue
        QUEUE_PRODUCER: {},
      },
    },
    include: [
      'packages/edge/src/**/*.test.ts',
      'tests/unit/**/*.test.ts',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.wrangler',
      'packages/edge/dist',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'dist/',
        '.wrangler/',
        'packages/edge/dist/',
        'scripts/',
        '**/types/',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    sequence: {
      shuffle: false,
      concurrent: true,
    },
    alias: {
      '@': '/packages/edge/src',
      '@test': '/tests',
    },
  },
});
