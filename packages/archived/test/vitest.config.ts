import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      modules: true,
      script: 'service-worker',
      compatibilityFlags: ['nodejs_compat'],
      bindings: {
        ENVIRONMENT: 'test',
        API_VERSION: 'v1',
      },
      kvNamespaces: ['TEST_CACHE_KV', 'TEST_CONFIG_KV', 'TEST_KV'],
      r2Buckets: ['TEST_STORAGE_R2'],
      d1Databases: ['TEST_DB'],
      durableObjects: {
        TEST_SESSIONS: 'SessionsDO',
        TEST_DIRECTOR: 'DirectorDO',
        TEST_PLANNER: 'PlannerDO',
        TEST_EXECUTOR: 'ExecutorDO',
        TEST_AGENT_REGISTRY: 'AgentRegistryDO',
        TEST_VECTOR_DB: 'VectorDBDO',
      },
    },
    setupFiles: ['./src/e2e/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['../edge/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/dist/**',
        '**/node_modules/**',
        '**/types/**',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      },
    },
    reporters: ['verbose', 'json', 'html'],
    outputFile: './test-results/results.json',
  },
});
