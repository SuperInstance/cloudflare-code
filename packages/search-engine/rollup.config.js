import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const isProduction = process.env.NODE_ENV === 'production';

export default [
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: !isProduction,
    },
    plugins: [
      nodeResolve({
        browser: true,
      }),
      typescript(),
    ],
    external: [
      'compromise',
      'natural',
      'nanoid',
      'bloom-filters',
    ],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: !isProduction,
    },
    plugins: [
      nodeResolve({
        browser: true,
      }),
      typescript(),
    ],
    external: [
      'compromise',
      'natural',
      'nanoid',
      'bloom-filters',
    ],
  },
];