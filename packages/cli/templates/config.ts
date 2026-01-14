/**
 * ClaudeFlare configuration template
 */

import { defineConfig } from '@claudeflare/cli';

export default defineConfig({
  name: '{{name}}',
  version: '0.1.0',
  description: '{{description}}',

  worker: {
    name: '{{workerName}}',
    main: 'src/index.ts',
    compatibility_date: '2024-01-01',
  },

  build: {
    input: 'src/index.ts',
    output: 'dist/worker.js',
    minify: true,
    sourcemap: true,
  },

  dev: {
    port: 8788,
    host: 'localhost',
    proxy: true,
    open: false,
  },

  deploy: {
    environment: 'preview',
    workers: {
      name: '{{workerName}}',
    },
  },

  monitoring: {
    enabled: true,
    metrics: true,
    traces: true,
    logs: true,
  },
});
