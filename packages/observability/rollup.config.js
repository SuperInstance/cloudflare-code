import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

const isDevelopment = process.env.NODE_ENV === 'development';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      exports: 'named',
      sourcemap: true
    },
    {
      file: pkg.module,
      format: 'esm',
      exports: 'named',
      sourcemap: true
    }
  ],
  external: [
    'crypto',
    'stream',
    'util',
    'events',
    'url',
    'path',
    'fs',
    'http',
    'https',
    'zlib',
    'buffer',
    'querystring',
    'os',
    'process',
    'child_process',
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {})
  ],
  plugins: [
    resolve({
      browser: true,
      dedupe: ['react']
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist',
      exclude: ['**/*.test.ts', '**/*.spec.ts']
    }),
    !isDevelopment && terser({
      compress: {
        drop_console: false,
        drop_debugger: true
      },
      mangle: true
    }),
    isDevelopment && terser({
      compress: {
        drop_console: false,
        drop_debugger: false
      }
    })
  ].filter(Boolean)
};