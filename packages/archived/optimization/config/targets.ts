/**
 * Performance Targets Configuration
 *
 * Defines performance targets and budgets for different environments
 */

export interface PerformanceTargets {
  bundleSize: {
    main: number;
    chunks: number;
    gzip: number;
    brotli: number;
  };
  runtime: {
    maxFunctionTime: number;
    hotPathThreshold: number;
    eventLoopLag: number;
  };
  memory: {
    heapLimit: number;
    poolSize: number;
    maxCacheSize: number;
  };
  network: {
    maxLatency: number;
    maxRetries: number;
    batchSize: number;
  };
}

export const DEFAULT_TARGETS: PerformanceTargets = {
  bundleSize: {
    main: 500 * 1024,      // 500KB
    chunks: 244 * 1024,    // 244KB
    gzip: 150 * 1024,      // 150KB
    brotli: 120 * 1024,    // 120KB
  },
  runtime: {
    maxFunctionTime: 100,  // 100ms
    hotPathThreshold: 50,  // 50ms
    eventLoopLag: 50,      // 50ms
  },
  memory: {
    heapLimit: 100 * 1024 * 1024,  // 100MB
    poolSize: 100,
    maxCacheSize: 1000,
  },
  network: {
    maxLatency: 1000,      // 1s
    maxRetries: 3,
    batchSize: 10,
  },
};

export const STRICT_TARGETS: PerformanceTargets = {
  bundleSize: {
    main: 300 * 1024,      // 300KB
    chunks: 150 * 1024,    // 150KB
    gzip: 100 * 1024,      // 100KB
    brotli: 80 * 1024,     // 80KB
  },
  runtime: {
    maxFunctionTime: 50,   // 50ms
    hotPathThreshold: 25,  // 25ms
    eventLoopLag: 25,      // 25ms
  },
  memory: {
    heapLimit: 50 * 1024 * 1024,   // 50MB
    poolSize: 50,
    maxCacheSize: 500,
  },
  network: {
    maxLatency: 500,       // 500ms
    maxRetries: 2,
    batchSize: 5,
  },
};

export const LEAN_TARGETS: PerformanceTargets = {
  bundleSize: {
    main: 150 * 1024,      // 150KB
    chunks: 100 * 1024,    // 100KB
    gzip: 50 * 1024,       // 50KB
    brotli: 40 * 1024,     // 40KB
  },
  runtime: {
    maxFunctionTime: 25,   // 25ms
    hotPathThreshold: 10,  // 10ms
    eventLoopLag: 10,      // 10ms
  },
  memory: {
    heapLimit: 25 * 1024 * 1024,   // 25MB
    poolSize: 25,
    maxCacheSize: 250,
  },
  network: {
    maxLatency: 200,       // 200ms
    maxRetries: 1,
    batchSize: 3,
  },
};

export const TARGETS_BY_ENV = {
  development: DEFAULT_TARGETS,
  staging: DEFAULT_TARGETS,
  production: STRICT_TARGETS,
  'edge-production': LEAN_TARGETS,
};

export function getTargets(environment: keyof typeof TARGETS_BY_ENV = 'production'): PerformanceTargets {
  return TARGETS_BY_ENV[environment] || DEFAULT_TARGETS;
}
