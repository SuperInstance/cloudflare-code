import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'es2022',
  external: ['@anthropic-ai/sdk'],
  treeshake: true,
  banner: {
    js: `/**\n * @claudeflare/sdk-ts v0.1.0\n * (c) ${new Date().getFullYear()} ClaudeFlare\n */`,
  },
});
