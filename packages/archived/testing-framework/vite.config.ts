import { defineConfig } from 'vite'
import { resolve } from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    nodePolyfills()
  ],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ClaudeFlareTestingFramework',
      fileName: 'index'
    },
    rollupOptions: {
      external: [
        'fs',
        'path',
        'os',
        'util',
        'stream',
        'http',
        'https',
        'events',
        'url',
        'querystring',
        'zlib',
        'buffer',
        'crypto',
        'typescript'
      ],
      output: {
        globals: {
          fs: 'fs',
          path: 'path',
          os: 'os',
          util: 'util',
          stream: 'stream',
          http: 'http',
          https: 'https',
          events: 'events',
          url: 'url',
          querystring: 'querystring',
          zlib: 'zlib',
          buffer: 'buffer',
          crypto: 'crypto',
          typescript: 'typescript'
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@claudeflare/testing-framework': resolve(__dirname, 'src')
    }
  }
})