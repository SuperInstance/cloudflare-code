/**
 * Bundle Optimization Configuration
 *
 * Advanced tree-shaking and code splitting configuration for
 * optimal bundle size and cold start performance.
 *
 * Targets:
 * - Bundle size: <3MB (Workers limit)
 * - Cold start: <100ms
 * - Tree shaking: Maximum elimination
 * - Code splitting: Route-based and provider-based
 */

import type { BuildOptions, Format } from 'esbuild';

/**
 * Bundle optimization configuration
 */
export interface BundleOptimizationConfig {
  /** Target environment */
  environment: 'development' | 'production';
  /** Output format */
  format: Format;
  /** Enable minification */
  minify: boolean;
  /** Enable tree shaking */
  treeShaking: boolean;
  /** Enable source maps */
  sourceMap: boolean;
  /** Output directory */
  outdir: string;
  /** Entry points */
  entryPoints: string[];
}

/**
 * Manual chunk configuration for code splitting
 */
export interface ChunkConfig {
  /** Chunk name */
  name: string;
  /** Include patterns (glob) */
  include: string[];
  /** Priority for loading (lower = earlier) */
  priority: number;
  /** Lazy load this chunk */
  lazy?: boolean;
}

/**
 * Code splitting strategy
 */
export interface CodeSplittingConfig {
  /** Manual chunks to create */
  chunks: ChunkConfig[];
  /** Split by routes */
  routeBased: boolean;
  /** Split by providers */
  providerBased: boolean;
  /** Split large modules (>100KB) */
  splitLargeModules: boolean;
}

/**
 * Default bundle optimization configuration
 */
export const defaultBundleConfig: BundleOptimizationConfig = {
  environment: 'production',
  format: 'esm',
  minify: true,
  treeShaking: true,
  sourceMap: false,
  outdir: 'dist',
  entryPoints: ['src/index.ts'],
};

/**
 * Code splitting configuration for optimal bundle size
 *
 * Strategy:
 * 1. Vendor chunk: External dependencies (hono, zod)
 * 2. Providers chunk: AI provider implementations
 * 3. Utils chunk: Utility functions
 * 4. Cache chunk: Cache implementations
 * 5. Routes chunk: API routes
 * 6. DO chunk: Durable Objects
 */
export const codeSplittingConfig: CodeSplittingConfig = {
  chunks: [
    {
      name: 'vendor',
      include: [
        'hono',
        'zod',
        '@hono/*',
      ],
      priority: 0,
      lazy: false, // Load immediately
    },
    {
      name: 'providers',
      include: [
        'src/lib/providers/**/*.ts',
        '!src/lib/providers/index.ts',
      ],
      priority: 2,
      lazy: true, // Lazy load providers
    },
    {
      name: 'cache',
      include: [
        'src/lib/cache/**/*.ts',
        'src/lib/embeddings.ts',
        'src/lib/hnsw.ts',
      ],
      priority: 1,
      lazy: false, // Cache is critical
    },
    {
      name: 'utils',
      include: [
        'src/lib/utils.ts',
        'src/lib/errors.ts',
        'src/lib/compression.ts',
      ],
      priority: 0,
      lazy: false, // Load immediately
    },
    {
      name: 'routes',
      include: [
        'src/routes/**/*.ts',
      ],
      priority: 1,
      lazy: true, // Lazy load routes
    },
    {
      name: 'do',
      include: [
        'src/do/**/*.ts',
      ],
      priority: 3,
      lazy: true, // Lazy load DOs
    },
    {
      name: 'metrics',
      include: [
        'src/lib/metrics/**/*.ts',
      ],
      priority: 4,
      lazy: true, // Lazy load metrics
    },
    {
      name: 'rate-limit',
      include: [
        'src/lib/rate-limit/**/*.ts',
        'src/lib/quota.ts',
        'src/lib/circuit-breaker.ts',
        'src/lib/retry.ts',
      ],
      priority: 5,
      lazy: true, // Lazy load rate limiting
    },
    {
      name: 'storage',
      include: [
        'src/lib/kv.ts',
        'src/lib/r2.ts',
        'src/lib/storage.ts',
      ],
      priority: 1,
      lazy: false, // Storage is critical
    },
  ],
  routeBased: true,
  providerBased: true,
  splitLargeModules: true,
};

/**
 * Tree-shaking configuration
 *
 * Ensures dead code elimination is maximized
 */
export const treeShakingConfig = {
  /** Mark side effects in package.json */
  sideEffects: [
    '**/*.css',
    '**/*.scss',
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
  ],

  /** Explicitly mark modules with no side effects */
  noSideEffects: [
    'src/lib/utils.ts',
    'src/lib/errors.ts',
    'src/lib/providers/base.ts',
    'src/lib/cache/semantic.ts',
    'src/lib/compression.ts',
  ],

  /** Use pure annotations for better tree-shaking */
  pure: [
    'console.log',
    'console.debug',
    'console.info',
  ],
};

/**
 * esbuild build options with optimizations
 */
export function createEsbuildBuildOptions(
  config: Partial<BundleOptimizationConfig> = {}
): BuildOptions {
  const finalConfig = { ...defaultBundleConfig, ...config };

  return {
    entryPoints: finalConfig.entryPoints,
    format: finalConfig.format,
    minify: finalConfig.minify,
    sourcemap: finalConfig.sourceMap,
    outdir: finalConfig.outdir,
    treeShaking: finalConfig.treeShaking,
    target: 'es2020', // Edge runtime compatible
    platform: 'browser', // Cloudflare Workers

    // Bundle optimization
    bundle: true,
    splitting: true,
    chunkNames: '[name]-[hash]',
    metafile: true, // Generate bundle analysis

    // Advanced tree-shaking
    // Note: esbuild doesn't support manual chunks directly,
    // but we can use plugins for code splitting

    // External dependencies (don't bundle Workers APIs)
    external: [
      '@cloudflare/workers-types',
    ],

    // Define constants for tree-shaking
    define: {
      'process.env.NODE_ENV': finalConfig.environment === 'production'
        ? '"production"'
        : '"development"',
      'process.env.ENVIRONMENT': finalConfig.environment === 'production'
        ? '"production"'
        : '"development"',
    },

    // Ignore warnings
    logLevel: 'error',

    // Plugins for advanced optimization
    plugins: [], // Add plugins as needed
  };
}

/**
 * Analyze bundle size and provide recommendations
 */
export interface BundleAnalysis {
  /** Total bundle size in bytes */
  totalSize: number;
  /** Chunk sizes */
  chunks: Array<{
    name: string;
    size: number;
    percentage: number;
  }>;
  /** Large modules to split */
  largeModules: Array<{
    path: string;
    size: number;
  }>;
  /** Duplicate dependencies */
  duplicates: Array<{
    module: string;
    instances: string[];
  }>;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Analyze bundle from esbuild metafile
 */
export function analyzeBundle(metafile: any): BundleAnalysis {
  const outputs = Object.values(metafile.outputs);

  let totalSize = 0;
  const chunks: BundleAnalysis['chunks'] = [];

  for (const output of outputs as any[]) {
    const size = output.bytes || 0;
    totalSize += size;

    const name = output.path.split('/').pop() || 'unknown';
    chunks.push({
      name,
      size,
      percentage: 0, // Will calculate after total
    });
  }

  // Calculate percentages
  for (const chunk of chunks) {
    chunk.percentage = totalSize > 0 ? (chunk.size / totalSize) * 100 : 0;
  }

  // Sort by size
  chunks.sort((a, b) => b.size - a.size);

  // Generate recommendations
  const recommendations: string[] = [];

  if (totalSize > 3 * 1024 * 1024) {
    recommendations.push('Bundle exceeds 3MB limit. Enable aggressive code splitting.');
  }

  const largeChunks = chunks.filter(c => c.size > 500 * 1024);
  if (largeChunks.length > 0) {
    recommendations.push(
      `Found ${largeChunks.length} chunks >500KB. Consider splitting further.`
    );
  }

  if (chunks.length < 5) {
    recommendations.push('Consider more granular code splitting for better caching.');
  }

  return {
    totalSize,
    chunks,
    largeModules: [],
    duplicates: [],
    recommendations,
  };
}

/**
 * Print bundle analysis report
 */
export function printBundleAnalysis(analysis: BundleAnalysis): void {
  console.log('\n=== Bundle Analysis ===\n');
  console.log(`Total size: ${(analysis.totalSize / 1024 / 1024).toFixed(2)} MB\n`);

  console.log('Chunks:');
  for (const chunk of analysis.chunks) {
    console.log(
      `  ${chunk.name}: ${(chunk.size / 1024).toFixed(2)} KB (${chunk.percentage.toFixed(1)}%)`
    );
  }

  if (analysis.recommendations.length > 0) {
    console.log('\nRecommendations:');
    for (const rec of analysis.recommendations) {
      console.log(`  • ${rec}`);
    }
  }

  console.log('\n');
}

/**
 * Generate dynamic import wrapper for lazy loading
 */
export function createDynamicImport<T>(path: string): () => Promise<T> {
  return () => import(path);
}

/**
 * Lazy load provider
 */
export function lazyLoadProvider(providerName: string): () => Promise<any> {
  const providerMap: Record<string, string> = {
    'cloudflare-ai': './lib/providers/cloudflare-ai',
    'groq': './lib/providers/groq',
    'cerebras': './lib/providers/cerebras',
    'openrouter': './lib/providers/openrouter',
  };

  const path = providerMap[providerName];
  if (!path) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  return createDynamicImport(path);
}

/**
 * Preload critical chunks
 */
export async function preloadChunks(chunks: string[]): Promise<void> {
  await Promise.all(
    chunks.map(chunk => import(chunk))
  );
}

/**
 * Get recommended preload order
 */
export function getPreloadOrder(): string[] {
  return [
    // Critical path
    './lib/utils',
    './lib/errors',
    './lib/kv',
    './lib/storage',

    // Cache layer
    './lib/cache/semantic',
    './lib/embeddings',
    './lib/hnsw',

    // Core providers
    './lib/providers/cloudflare-ai',
    './lib/providers/groq',
  ];
}

/**
 * Bundle size thresholds
 */
export const bundleSizeThresholds = {
  /** Maximum bundle size for Cloudflare Workers */
  maximum: 3 * 1024 * 1024, // 3MB

  /** Target for optimal cold start */
  target: 1.5 * 1024 * 1024, // 1.5MB

  /** Maximum individual chunk size */
  maxChunk: 500 * 1024, // 500KB

  /** Target for vendor chunk */
  targetVendor: 500 * 1024, // 500KB

  /** Target for providers chunk */
  targetProviders: 300 * 1024, // 300KB
};

/**
 * Validate bundle size against thresholds
 */
export function validateBundleSize(analysis: BundleAnalysis): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check total size
  if (analysis.totalSize > bundleSizeThresholds.maximum) {
    errors.push(
      `Bundle size ${(analysis.totalSize / 1024 / 1024).toFixed(2)}MB exceeds maximum ${bundleSizeThresholds.maximum / 1024 / 1024}MB`
    );
  } else if (analysis.totalSize > bundleSizeThresholds.target) {
    warnings.push(
      `Bundle size ${(analysis.totalSize / 1024 / 1024).toFixed(2)}MB exceeds target ${bundleSizeThresholds.target / 1024 / 1024}MB`
    );
  }

  // Check chunk sizes
  for (const chunk of analysis.chunks) {
    if (chunk.size > bundleSizeThresholds.maxChunk) {
      warnings.push(
        `Chunk '${chunk.name}' (${(chunk.size / 1024).toFixed(2)}KB) exceeds target ${bundleSizeThresholds.maxChunk / 1024}KB`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
