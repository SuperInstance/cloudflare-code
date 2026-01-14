/**
 * Leaky Bucket Algorithm Implementation
 *
 * Leaky bucket algorithm smooths out traffic by processing requests at a constant rate.
 * Requests are added to a bucket and "leak" out at a fixed rate.
 * If the bucket overflows, requests are rejected.
 */

import type {
  RateLimitResult,
  RateLimitConfig,
  LeakyBucketState,
  RateLimitContext
} from '../types/index.js';

/**
 * Leaky bucket algorithm
 */
export class LeakyBucketAlgorithm {
  private config: RateLimitConfig;
  private capacity: number;
  private leakRate: number; // tokens per millisecond

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.capacity = config.burst || config.limit;
    // Leak rate: tokens per ms
    this.leakRate = config.rate ? config.rate / 1000 : config.limit / config.window;
  }

  /**
   * Check if request is allowed
   */
  async check(
    state: LeakyBucketState | null,
    context: RateLimitContext,
    volume: number = 1
  ): Promise<RateLimitResult> {
    const now = Date.now();

    // Initialize state if not exists
    if (!state) {
      const newState: LeakyBucketState = {
        volume: volume,
        lastLeak: now,
        count: 1,
        lastUpdate: now,
        metadata: {}
      };

      return {
        allowed: true,
        limit: this.capacity,
        remaining: this.capacity - volume,
        reset: now + Math.ceil(volume / this.leakRate),
        metadata: {
          algorithm: 'leaky_bucket',
          volume: newState.volume,
          leakRate: this.leakRate
        }
      };
    }

    // Leak volume based on time passed
    const timePassed = now - state.lastLeak;
    const leakedVolume = Math.floor(timePassed * this.leakRate);
    const newVolume = Math.max(0, state.volume - leakedVolume);

    // Check if adding volume would exceed capacity
    const allowed = newVolume + volume <= this.capacity;

    if (allowed) {
      // Add volume to bucket
      state.volume = newVolume + volume;
      state.count++;
    } else {
      // Bucket would overflow, calculate retry after
      const excessVolume = newVolume + volume - this.capacity;
      const retryAfter = Math.ceil(excessVolume / this.leakRate);
    }

    state.lastLeak = now;
    state.lastUpdate = now;

    const remaining = Math.max(0, this.capacity - state.volume);
    const leakTime = state.volume / this.leakRate;
    const resetTime = now + Math.ceil(leakTime);

    return {
      allowed,
      limit: this.capacity,
      remaining,
      reset: resetTime,
      retryAfter: allowed ? undefined : Math.ceil((newVolume + volume - this.capacity) / this.leakRate),
      metadata: {
        algorithm: 'leaky_bucket',
        volume: state.volume,
        leakRate: this.leakRate,
        capacity: this.capacity
      }
    };
  }

  /**
   * Reset the leaky bucket
   */
  reset(): LeakyBucketState {
    const now = Date.now();
    return {
      volume: 0,
      lastLeak: now,
      count: 0,
      lastUpdate: now,
      metadata: {}
    };
  }

  /**
   * Get current state snapshot
   */
  getState(): {
    capacity: number;
    leakRate: number;
    window: number;
  } {
    return {
      capacity: this.capacity,
      leakRate: this.leakRate,
      window: this.config.window
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    if (config.limit !== undefined) {
      this.config.limit = config.limit;
      this.leakRate = config.limit / this.config.window;
    }
    if (config.burst !== undefined) {
      this.capacity = config.burst;
    }
    if (config.rate !== undefined) {
      this.leakRate = config.rate / 1000;
    }
    if (config.window !== undefined) {
      this.config.window = config.window;
      if (!config.rate) {
        this.leakRate = this.config.limit / config.window;
      }
    }
  }

  /**
   * Calculate expected leak time
   */
  calculateLeakTime(currentVolume: number): number {
    return Math.ceil(currentVolume / this.leakRate);
  }

  /**
   * Get volume for request
   */
  getVolumeForRequest(context: RateLimitContext): number {
    // Can be overridden to calculate volume based on request properties
    return context.metadata?.volume ? Number(context.metadata.volume) : 1;
  }

  /**
   * Estimate volume at a future time
   */
  estimateVolumeAt(state: LeakyBucketState, futureTime: number): number {
    const timePassed = futureTime - state.lastLeak;
    const leakedVolume = Math.floor(timePassed * this.leakRate);
    return Math.max(0, state.volume - leakedVolume);
  }

  /**
   * Get time until bucket is empty
   */
  getTimeUntilEmpty(state: LeakyBucketState): number {
    if (state.volume === 0) {
      return 0;
    }
    return Math.ceil(state.volume / this.leakRate);
  }

  /**
   * Check if bucket is overflowing
   */
  isOverflowing(state: LeakyBucketState, additionalVolume: number = 0): boolean {
    const now = Date.now();
    const timePassed = now - state.lastLeak;
    const leakedVolume = Math.floor(timePassed * this.leakRate);
    const currentVolume = Math.max(0, state.volume - leakedVolume);

    return currentVolume + additionalVolume > this.capacity;
  }
}
