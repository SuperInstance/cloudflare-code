import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        'examples/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.d.ts'
      ]
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000
  }
});
