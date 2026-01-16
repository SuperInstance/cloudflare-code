/**
 * Algorithm Engine - Factory and coordinator for rate limiting algorithms
 */

// @ts-nocheck
import { RateLimitAlgorithm as AlgorithmType } from '../types/index.js';
import { TokenBucketAlgorithm } from './token-bucket.js';
import { LeakyBucketAlgorithm } from './leaky-bucket.js';
import { SlidingWindowAlgorithm } from './sliding-window.js';
import { FixedWindowAlgorithm } from './fixed-window.js';
import type {
  RateLimitResult,
  RateLimitConfig,
  RateLimitState,
  RateLimitContext,
  TokenBucketState,
  LeakyBucketState,
  SlidingWindowState,
  FixedWindowState
} from '../types/index.js';

/**
 * Custom algorithm interface
 */
export interface CustomAlgorithm {
  check(
    state: RateLimitState | null,
    context: RateLimitContext
  ): Promise<RateLimitResult>;
  reset(): RateLimitState;
  updateConfig(config: Partial<RateLimitConfig>): void;
}

/**
 * Algorithm engine class
 */
export class AlgorithmEngine {
  private algorithms: Map<AlgorithmType, any>;
  private customAlgorithms: Map<string, CustomAlgorithm>;

  constructor() {
    this.algorithms = new Map();
    this.customAlgorithms = new Map();
  }

  /**
   * Get algorithm instance
   */
  getAlgorithm(config: RateLimitConfig): CustomAlgorithm {
    const { algorithm } = config;

    // Check custom algorithms first
    if (algorithm === AlgorithmType.CUSTOM && config.metadata?.customAlgorithm) {
      const customName = config.metadata.customAlgorithm as string;
      const customAlgo = this.customAlgorithms.get(customName);

      if (!customAlgo) {
        throw new Error(`Custom algorithm '${customName}' not found`);
      }

      return customAlgo;
    }

    // Return cached algorithm or create new one
    const cacheKey = this.getCacheKey(config);

    if (!this.algorithms.has(cacheKey)) {
      const instance = this.createAlgorithm(config);
      this.algorithms.set(cacheKey, instance);
    }

    return this.algorithms.get(cacheKey);
  }

  /**
   * Create algorithm instance based on type
   */
  private createAlgorithm(config: RateLimitConfig): CustomAlgorithm {
    switch (config.algorithm) {
      case AlgorithmType.TOKEN_BUCKET:
        return new TokenBucketAlgorithm(config);

      case AlgorithmType.LEAKY_BUCKET:
        return new LeakyBucketAlgorithm(config);

      case AlgorithmType.SLIDING_WINDOW:
        return new SlidingWindowAlgorithm(config);

      case AlgorithmType.FIXED_WINDOW:
        return new FixedWindowAlgorithm(config);

      case AlgorithmType.CUSTOM:
        if (!config.metadata?.customAlgorithm) {
          throw new Error('Custom algorithm name not specified');
        }
        const customName = config.metadata.customAlgorithm as string;
        const customAlgo = this.customAlgorithms.get(customName);

        if (!customAlgo) {
          throw new Error(`Custom algorithm '${customName}' not found`);
        }

        return customAlgo;

      default:
        throw new Error(`Unknown algorithm: ${config.algorithm}`);
    }
  }

  /**
   * Register a custom algorithm
   */
  registerCustomAlgorithm(name: string, algorithm: CustomAlgorithm): void {
    this.customAlgorithms.set(name, algorithm);
  }

  /**
   * Unregister a custom algorithm
   */
  unregisterCustomAlgorithm(name: string): boolean {
    return this.customAlgorithms.delete(name);
  }

  /**
   * Get cache key for algorithm
   */
  private getCacheKey(config: RateLimitConfig): string {
    return `${config.algorithm}-${config.limit}-${config.window}-${config.burst || 0}-${config.rate || 0}`;
  }

  /**
   * Clear cached algorithms
   */
  clearCache(): void {
    this.algorithms.clear();
  }

  /**
   * Check rate limit using specified algorithm
   */
  async check(
    config: RateLimitConfig,
    state: RateLimitState | null,
    context: RateLimitContext
  ): Promise<RateLimitResult> {
    const algorithm = this.getAlgorithm(config);
    return algorithm.check(state, context);
  }

  /**
   * Reset algorithm state
   */
  reset(config: RateLimitConfig): RateLimitState {
    const algorithm = this.getAlgorithm(config);
    return algorithm.reset();
  }

  /**
   * Update algorithm configuration
   */
  updateConfig(config: RateLimitConfig): void {
    const cacheKey = this.getCacheKey(config);
    const algorithm = this.algorithms.get(cacheKey);

    if (algorithm) {
      algorithm.updateConfig(config);
    }
  }

  /**
   * Get statistics for all cached algorithms
   */
  getStats(): Record<string, unknown> {
    const stats: Record<string, unknown> = {
      cachedAlgorithms: this.algorithms.size,
      customAlgorithms: this.customAlgorithms.size,
      algorithms: {}
    };

    for (const [key, algorithm] of this.algorithms.entries()) {
      stats.algorithms[key] = algorithm.getState();
    }

    return stats;
  }

  /**
   * Check if algorithm supports weighted requests
   */
  supportsWeightedRequests(config: RateLimitConfig): boolean {
    return config.algorithm === AlgorithmType.SLIDING_WINDOW ||
           config.algorithm === AlgorithmType.FIXED_WINDOW;
  }

  /**
   * Check with weight if supported
   */
  async checkWithWeight(
    config: RateLimitConfig,
    state: RateLimitState | null,
    context: RateLimitContext,
    weight: number
  ): Promise<RateLimitResult> {
    const algorithm = this.getAlgorithm(config);

    // Check if algorithm supports weighted requests
    if ('checkWithWeight' in algorithm) {
      return (algorithm as any).checkWithWeight(state, context, weight);
    }

    // Fall back to regular check
    return algorithm.check(state, context);
  }

  /**
   * Get available algorithms
   */
  getAvailableAlgorithms(): AlgorithmType[] {
    return [
      AlgorithmType.TOKEN_BUCKET,
      AlgorithmType.LEAKY_BUCKET,
      AlgorithmType.SLIDING_WINDOW,
      AlgorithmType.FIXED_WINDOW,
      AlgorithmType.CUSTOM
    ];
  }

  /**
   * Get algorithm metadata
   */
  getAlgorithmMetadata(algorithm: AlgorithmType): {
    name: string;
    description: string;
    burstHandling: boolean;
    precision: 'low' | 'medium' | 'high';
    memoryUsage: 'low' | 'medium' | 'high';
    cpuUsage: 'low' | 'medium' | 'high';
    bestFor: string[];
  } {
    const metadata: Record<AlgorithmType, {
      name: string;
      description: string;
      burstHandling: boolean;
      precision: 'low' | 'medium' | 'high';
      memoryUsage: 'low' | 'medium' | 'high';
      cpuUsage: 'low' | 'medium' | 'high';
      bestFor: string[];
    }> = {
      [AlgorithmType.TOKEN_BUCKET]: {
        name: 'Token Bucket',
        description: 'Allows bursts up to capacity, then refills at steady rate',
        burstHandling: true,
        precision: 'high',
        memoryUsage: 'low',
        cpuUsage: 'low',
        bestFor: ['API rate limiting', 'Bandwidth throttling', 'Bursty traffic']
      },
      [AlgorithmType.LEAKY_BUCKET]: {
        name: 'Leaky Bucket',
        description: 'Smooths traffic by processing at constant rate',
        burstHandling: true,
        precision: 'high',
        memoryUsage: 'low',
        cpuUsage: 'low',
        bestFor: ['Traffic shaping', 'Data streaming', 'Message queues']
      },
      [AlgorithmType.SLIDING_WINDOW]: {
        name: 'Sliding Window',
        description: 'Rolling time window with precise rate limiting',
        burstHandling: false,
        precision: 'high',
        memoryUsage: 'medium',
        cpuUsage: 'medium',
        bestFor: ['API rate limiting', 'Precise rate limiting', 'Preventing bursts']
      },
      [AlgorithmType.FIXED_WINDOW]: {
        name: 'Fixed Window',
        description: 'Simple counter reset at fixed intervals',
        burstHandling: false,
        precision: 'low',
        memoryUsage: 'low',
        cpuUsage: 'low',
        bestFor: ['Simple rate limiting', 'High throughput', 'Basic protection']
      },
      [AlgorithmType.CUSTOM]: {
        name: 'Custom',
        description: 'User-defined algorithm',
        burstHandling: false,
        precision: 'medium',
        memoryUsage: 'medium',
        cpuUsage: 'medium',
        bestFor: ['Specialized use cases', 'Custom business logic']
      }
    };

    return metadata[algorithm];
  }

  /**
   * Recommend algorithm based on use case
   */
  recommendAlgorithm(requirements: {
    allowBursts?: boolean;
    highPrecision?: boolean;
    lowMemory?: boolean;
    lowCPU?: boolean;
    highThroughput?: boolean;
  }): AlgorithmType {
    if (requirements.allowBursts && requirements.lowMemory) {
      return AlgorithmType.TOKEN_BUCKET;
    }

    if (requirements.allowBursts && !requirements.lowCPU) {
      return AlgorithmType.LEAKY_BUCKET;
    }

    if (requirements.highPrecision && !requirements.lowMemory) {
      return AlgorithmType.SLIDING_WINDOW;
    }

    if (requirements.highThroughput && requirements.lowMemory) {
      return AlgorithmType.FIXED_WINDOW;
    }

    // Default to sliding window for most cases
    return AlgorithmType.SLIDING_WINDOW;
  }

  /**
   * Validate algorithm state
   */
  validateState(
    config: RateLimitConfig,
    state: RateLimitState
  ): boolean {
    const now = Date.now();

    // Check if state is outdated
    if (now - state.lastUpdate > config.window * 2) {
      return false;
    }

    // Algorithm-specific validation
    switch (config.algorithm) {
      case AlgorithmType.TOKEN_BUCKET:
        const tbState = state as TokenBucketState;
        return typeof tbState.tokens === 'number' &&
               typeof tbState.lastRefill === 'number';

      case AlgorithmType.LEAKY_BUCKET:
        const lbState = state as LeakyBucketState;
        return typeof lbState.volume === 'number' &&
               typeof lbState.lastLeak === 'number';

      case AlgorithmType.SLIDING_WINDOW:
        const swState = state as SlidingWindowState;
        return Array.isArray(swState.requests);

      case AlgorithmType.FIXED_WINDOW:
        const fwState = state as FixedWindowState;
        return typeof fwState.windowStart === 'number' &&
               typeof fwState.count === 'number';

      default:
        return true;
    }
  }
}

// Export singleton instance
export const algorithmEngine = new AlgorithmEngine();
