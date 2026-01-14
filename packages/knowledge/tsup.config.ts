import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/generator/index.ts', 'src/knowledge/index.ts', 'src/site/index.ts', 'src/code/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  target: 'es2022',
  treeshake: true,
  minify: false,
  external: [
    '@claudeflare/sdk-ts',
    '@claudeflare/workers',
    '@claudeflare/durable-objects',
    'typescript',
    'recast',
    'ast-types'
  ]
});
