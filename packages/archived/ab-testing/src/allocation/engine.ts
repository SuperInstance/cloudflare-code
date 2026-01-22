// @ts-nocheck
/**
 * Allocation Engine - Handles user assignment to experiment variants
 * with sub-1ms latency using consistent hashing and Durable Objects
 */

import type {
  ExperimentConfig,
  Assignment,
  UserId,
  ExperimentId,
  VariantId,
  VariantDefinition
} from '../types/experiment.js';
import { AllocationError, DuplicateAssignmentError } from '../types/errors.js';

/**
 * Allocation result
 */
export interface AllocationResult {
  /** Assigned variant */
  variant: VariantDefinition;
  /** Assignment record */
  assignment: Assignment;
  /** Whether this is a new assignment */
  isNewAssignment: boolean;
  /** Allocation metadata */
  metadata: {
    /** Time taken for allocation (microseconds) */
    duration: number;
    /** Allocation strategy used */
    strategy: string;
    /** Consistency hash (for debugging) */
    hash?: string;
  };
}

/**
 * Cohort balance information
 */
export interface CohortBalance {
  /** Current allocations per variant */
  currentAllocations: Map<VariantId, number>;
  /** Target allocations per variant */
  targetAllocations: Map<VariantId, number>;
  /** Balance score (0-1, 1 is perfectly balanced) */
  balanceScore: number;
  /** Whether rebalancing is needed */
  needsRebalancing: boolean;
}

/**
 * Allocation bucket for consistent hashing
 */
interface AllocationBucket {
  variantId: VariantId;
  range: [number, number];
  count: number;
}

/**
 * Assignment cache entry
 */
interface CacheEntry {
  assignment: Assignment;
  timestamp: number;
  expiresAt: number;
}

/**
 * Allocation Engine configuration
 */
export interface AllocationEngineConfig {
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Maximum cache size */
  maxCacheSize?: number;
  /** Enable consistent hashing */
  enableConsistentHashing?: boolean;
  /** Hash function to use */
  hashFunction?: 'murmur3' | 'fnv1a' | 'djb2';
  /** Number of buckets for consistent hashing */
  bucketCount?: number;
}

/**
 * Allocation Engine class
 * Provides ultra-fast user assignment to experiment variants
 */
export class AllocationEngine {
  private config: Required<AllocationEngineConfig>;
  private cache: Map<string, CacheEntry>;
  private buckets: Map<ExperimentId, AllocationBucket[]>;

  constructor(config: AllocationEngineConfig = {}) {
    this.config = {
      cacheTTL: config.cacheTTL ?? 60 * 60 * 1000, // 1 hour
      maxCacheSize: config.maxCacheSize ?? 100000,
      enableConsistentHashing: config.enableConsistentHashing ?? true,
      hashFunction: config.hashFunction ?? 'murmur3',
      bucketCount: config.bucketCount ?? 10000
    };
    this.cache = new Map();
    this.buckets = new Map();
  }

  /**
   * Allocate a user to a variant for an experiment
   * Target latency: < 1ms
   */
  async allocate(
    userId: UserId,
    experiment: ExperimentConfig,
    metadata?: Record<string, unknown>
  ): Promise<AllocationResult> {
    const startTime = performance.now();

    // Check cache first
    const cacheKey = `${experiment.id}:${userId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      const variant = experiment.variants.find(v => v.id === cached.assignment.variantId);
      if (variant) {
        return {
          variant,
          assignment: cached.assignment,
          isNewAssignment: false,
          metadata: {
            duration: Math.round((performance.now() - startTime) * 1000), // microseconds
            strategy: experiment.allocationStrategy,
            hash: this.getHash(userId)
          }
        };
      }
    }

    // Check if user has existing assignment (from persistent storage in real implementation)
    // For now, we'll allocate new

    // Allocate based on strategy
    const variantId = this.allocateVariant(userId, experiment);
    const variant = experiment.variants.find(v => v.id === variantId);

    if (!variant) {
      throw new AllocationError(userId, experiment.id, 'Variant not found');
    }

    // Create assignment record
    const assignment: Assignment = {
      experimentId: experiment.id,
      variantId: variant.id,
      userId,
      assignedAt: Date.now(),
      metadata
    };

    // Cache the assignment
    this.cache.set(cacheKey, {
      assignment,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.config.cacheTTL
    });

    // Clean up old cache entries if needed
    this.cleanupCache();

    const duration = Math.round((performance.now() - startTime) * 1000); // microseconds

    return {
      variant,
      assignment,
      isNewAssignment: true,
      metadata: {
        duration,
        strategy: experiment.allocationStrategy,
        hash: this.getHash(userId)
      }
    };
  }

  /**
   * Allocate a variant based on the configured strategy
   */
  private allocateVariant(userId: UserId, experiment: ExperimentConfig): VariantId {
    switch (experiment.allocationStrategy) {
      case 'equal':
        return this.allocateEqual(userId, experiment);
      case 'weighted':
        return this.allocateWeighted(userId, experiment);
      case 'thompson_sampling':
      case 'ucb':
      case 'epsilon_greedy':
        // These are handled by the bandit algorithm
        return this.allocateBandit(userId, experiment);
      default:
        return this.allocateEqual(userId, experiment);
    }
  }

  /**
   * Equal allocation using consistent hashing
   */
  private allocateEqual(userId: UserId, experiment: ExperimentConfig): VariantId {
    if (this.config.enableConsistentHashing) {
      return this.allocateByConsistentHash(userId, experiment);
    }

    // Fallback to simple modulo
    const hash = this.hashString(userId);
    const variantIndex = hash % experiment.variants.length;
    return experiment.variants[variantIndex].id;
  }

  /**
   * Weighted allocation
   */
  private allocateWeighted(userId: UserId, experiment: ExperimentConfig): VariantId {
    const hash = this.hashString(userId) / 0xFFFFFFFF; // Normalize to 0-1
    let cumulativeWeight = 0;

    for (const variant of experiment.variants) {
      cumulativeWeight += variant.weight;
      if (hash <= cumulativeWeight) {
        return variant.id;
      }
    }

    // Fallback to last variant
    return experiment.variants[experiment.variants.length - 1].id;
  }

  /**
   * Bandit allocation (placeholder - handled by bandit module)
   */
  private allocateBandit(userId: UserId, experiment: ExperimentConfig): VariantId {
    // For now, use weighted allocation
    return this.allocateWeighted(userId, experiment);
  }

  /**
   * Consistent hash allocation
   */
  private allocateByConsistentHash(userId: UserId, experiment: ExperimentConfig): VariantId {
    const hash = this.hashString(userId);
    const bucket = hash % this.config.bucketCount;
    const normalizedHash = hash / 0xFFFFFFFF;

    // Create buckets if not exists
    if (!this.buckets.has(experiment.id)) {
      this.buckets.set(experiment.id, this.createBuckets(experiment));
    }

    const buckets = this.buckets.get(experiment.id)!;
    const bucketIndex = Math.floor(normalizedHash * buckets.length);
    const selectedBucket = buckets[bucketIndex];

    return selectedBucket.variantId;
  }

  /**
   * Create allocation buckets for consistent hashing
   */
  private createBuckets(experiment: ExperimentConfig): AllocationBucket[] {
    const buckets: AllocationBucket[] = [];
    const bucketSize = 1 / experiment.variants.length;

    experiment.variants.forEach((variant, index) => {
      buckets.push({
        variantId: variant.id,
        range: [index * bucketSize, (index + 1) * bucketSize],
        count: 0
      });
    });

    return buckets;
  }

  /**
   * Hash a string using the configured hash function
   */
  private hashString(str: string): number {
    switch (this.config.hashFunction) {
      case 'murmur3':
        return this.murmur3Hash(str);
      case 'fnv1a':
        return this.fnv1aHash(str);
      case 'djb2':
        return this.djb2Hash(str);
      default:
        return this.murmur3Hash(str);
    }
  }

  /**
   * Murmur3 hash implementation (simplified)
   */
  private murmur3Hash(key: string): number {
    let h = 0xdeadbeef;
    for (let i = 0; i < key.length; i++) {
      const k = key.charCodeAt(i);
      h = Math.imul(h ^ k, 2654435761);
    }
    h = Math.imul(h ^ (h >>> 16), 2654435761);
    h ^= h >>> 13;
    h = Math.imul(h, 2654435761);
    return h >>> 0;
  }

  /**
   * FNV-1a hash implementation
   */
  private fnv1aHash(key: string): number {
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /**
   * DJB2 hash implementation
   */
  private djb2Hash(key: string): number {
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 33) ^ key.charCodeAt(i);
    }
    return hash >>> 0;
  }

  /**
   * Get hash string for debugging
   */
  private getHash(userId: UserId): string {
    const hash = this.hashString(userId);
    return hash.toString(16);
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    if (this.cache.size <= this.config.maxCacheSize) {
      return;
    }

    // Remove expired entries
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }

    // If still over limit, remove oldest entries
    if (this.cache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(0, this.cache.size - this.config.maxCacheSize);
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get current cohort balance
   */
  getCohortBalance(experiment: ExperimentConfig): CohortBalance {
    const currentAllocations = new Map<VariantId, number>();
    const targetAllocations = new Map<VariantId, number>();

    // Initialize maps
    experiment.variants.forEach(variant => {
      currentAllocations.set(variant.id, 0);
      targetAllocations.set(variant.id, Math.round(experiment.targetSampleSize * variant.weight));
    });

    // Count current allocations from cache
    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(`${experiment.id}:`)) {
        const count = currentAllocations.get(entry.assignment.variantId) ?? 0;
        currentAllocations.set(entry.assignment.variantId, count + 1);
      }
    }

    // Calculate balance score
    let totalDeviation = 0;
    for (const [variantId, current] of currentAllocations.entries()) {
      const target = targetAllocations.get(variantId) ?? 0;
      const deviation = Math.abs(current - target) / (target || 1);
      totalDeviation += deviation;
    }

    const balanceScore = 1 - (totalDeviation / experiment.variants.length);
    const needsRebalancing = balanceScore < 0.9;

    return {
      currentAllocations,
      targetAllocations,
      balanceScore: Math.max(0, balanceScore),
      needsRebalancing
    };
  }

  /**
   * Rebalance cohorts if needed
   */
  rebalance(experiment: ExperimentConfig): boolean {
    const balance = this.getCohortBalance(experiment);

    if (!balance.needsRebalancing) {
      return false;
    }

    // Clear and recreate buckets with updated weights
    this.buckets.delete(experiment.id);

    return true;
  }

  /**
   * Bulk allocate multiple users
   */
  async bulkAllocate(
    allocations: Array<{ userId: UserId; experiment: ExperimentConfig; metadata?: Record<string, unknown> }>
  ): Promise<Map<UserId, AllocationResult>> {
    const results = new Map<UserId, AllocationResult>();

    // Process in parallel for speed
    const promises = allocations.map(async ({ userId, experiment, metadata }) => {
      const result = await this.allocate(userId, experiment, metadata);
      return { userId, result };
    });

    const resolved = await Promise.all(promises);

    for (const { userId, result } of resolved) {
      results.set(userId, result);
    }

    return results;
  }

  /**
   * Get assignment for a user
   */
  getAssignment(userId: UserId, experimentId: ExperimentId): Assignment | null {
    const cacheKey = `${experimentId}:${userId}`;
    const entry = this.cache.get(cacheKey);

    if (entry && entry.expiresAt > Date.now()) {
      return entry.assignment;
    }

    return null;
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache.clear();
    this.buckets.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    expiredCount: number;
  } {
    let expiredCount = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      if (entry.expiresAt < now) {
        expiredCount++;
      }
    }

    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
      expiredCount
    };
  }

  /**
   * Warm up the cache with pre-existing assignments
   */
  warmUpCache(assignments: Assignment[]): void {
    for (const assignment of assignments) {
      const cacheKey = `${assignment.experimentId}:${assignment.userId}`;
      this.cache.set(cacheKey, {
        assignment,
        timestamp: assignment.assignedAt,
        expiresAt: Date.now() + this.config.cacheTTL
      });
    }
  }

  /**
   * Validate assignment consistency
   */
  validateConsistency(userId: UserId, experiment: ExperimentConfig): boolean {
    const expectedVariantId = this.allocateVariant(userId, experiment);
    const assignment = this.getAssignment(userId, experiment.id);

    if (!assignment) {
      return true; // No assignment yet, can't be inconsistent
    }

    return assignment.variantId === expectedVariantId;
  }
}
