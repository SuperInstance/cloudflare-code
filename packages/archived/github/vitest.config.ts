import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**',
        '**/index.ts'
      ]
    },
    setupFiles: [],
    testMatch: [
      '**/tests/**/*.test.ts'
    ],
    include: [
      'src/**/*.ts'
    ],
    exclude: [
      'node_modules/',
      'dist/'
    ]
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
