import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    tracing: 'src/tracing/index.ts',
    logging: 'src/logging/index.ts',
    profiling: 'src/profiling/index.ts',
    memory: 'src/memory/index.ts',
    inspection: 'src/inspection/index.ts',
    recording: 'src/recording/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  target: 'es2022',
  platform: 'browser',
});
