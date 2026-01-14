import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.wrangler'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        'dist/',
        '.wrangler/',
      ],
    },
    setupFiles: ['./tests/integration/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
