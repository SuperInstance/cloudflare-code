import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/smoke/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.wrangler'],
    coverage: false,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
