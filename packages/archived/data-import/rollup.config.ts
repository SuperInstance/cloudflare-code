import { defineConfig } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';

export default defineConfig({
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
      exports: 'named',
    },
  ],
  plugins: [
    nodeResolve({
      browser: false,
      preferBuiltins: true,
    }),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist',
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    }),
    commonjs(),
  ],
  external: [
    'stream',
    'fs',
    'path',
    'crypto',
    'util',
    'events',
    'buffer',
    'querystring',
    'url',
    'http',
    'https',
  ],
});