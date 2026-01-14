/**
 * Intelligent Cache Prefetcher
 * ML-based and pattern-based prefetching for optimal cache performance
 */

import {
  PrefetchPrediction,
  PrefetchConfig,
  PrefetchResult,
  PrefetchStrategy,
  CacheContext,
  MultiTierCache,
} from '../types';

// ============================================================================
// Prefetch Types
// ============================================================================

interface AccessSequence {
  key: string;
  nextKeys: Map<string, number>; // key -> frequency
  timestamp: number;
}

interface UserPattern {
  userId: string;
  sequences: AccessSequence[];
  lastAccess: number;
}

interface PrefetchTask {
  key: string;
  priority: number;
  urgency: number;
  reason: string;
}

// ============================================================================
// Pattern-based Prefetcher
// ============================================================================

class PatternBasedPrefetcher {
  private sequences = new Map<string, AccessSequence>();
  private userPatterns = new Map<string, UserPattern>();

  /**
   * Record access for pattern learning
   */
  recordAccess(key: string, userId?: string): void {
    const now = Date.now();

    // Update global sequence
    let sequence = this.sequences.get(key);
    if (!sequence) {
      sequence = {
        key,
        nextKeys: new Map(),
        timestamp: now,
      };
      this.sequences.set(key, sequence);
    }

    // Find previous access and update sequence
    for (const [prevKey, prevSeq] of this.sequences.entries()) {
      if (prevKey === key) continue;

      const timeSincePrevAccess = now - prevSeq.timestamp;
      if (timeSincePrevAccess < 60000) { // Within 1 minute
        const count = prevSeq.nextKeys.get(key) || 0;
        prevSeq.nextKeys.set(key, count + 1);
      }
    }

    sequence.timestamp = now;

    // Update user-specific pattern
    if (userId) {
      let userPattern = this.userPatterns.get(userId);
      if (!userPattern) {
        userPattern = {
          userId,
          sequences: [],
          lastAccess: now,
        };
        this.userPatterns.set(userId, userPattern);
      }

      userPattern.lastAccess = now;

      // Find user's previous access
      const userSeq = userPattern.sequences.find(s => s.key === key);
      if (userSeq) {
        userSeq.timestamp = now;
      } else {
        userPattern.sequences.push({
          key,
          nextKeys: new Map(),
          timestamp: now,
        });
      }
    }
  }

  /**
   * Predict next accesses based on patterns
   */
  predict(key: string, userId?: string): PrefetchPrediction[] {
    const predictions: PrefetchPrediction[] = [];
    const now = Date.now();

    // Global pattern prediction
    const sequence = this.sequences.get(key);
    if (sequence) {
      for (const [nextKey, frequency] of sequence.nextKeys.entries()) {
        predictions.push({
          key: nextKey,
          probability: Math.min(frequency / 10, 1),
          urgency: frequency / 5,
          reason: `Global pattern: ${key} -> ${nextKey}`,
          timestamp: now,
        });
      }
    }

    // User-specific pattern prediction
    if (userId) {
      const userPattern = this.userPatterns.get(userId);
      if (userPattern) {
        const userSeq = userPattern.sequences.find(s => s.key === key);
        if (userSeq) {
          for (const [nextKey, frequency] of userSeq.nextKeys.entries()) {
            const existing = predictions.find(p => p.key === nextKey);
            if (existing) {
              // Boost probability for user-specific pattern
              existing.probability = Math.min(existing.probability + 0.2, 1);
            } else {
              predictions.push({
                key: nextKey,
                probability: Math.min(frequency / 5, 1),
                urgency: frequency / 3,
                reason: `User pattern (${userId}): ${key} -> ${nextKey}`,
                timestamp: now,
              });
            }
          }
        }
      }
    }

    return predictions.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Get all sequences
   */
  getSequences(): AccessSequence[] {
    return Array.from(this.sequences.values());
  }

  /**
   * Clear old sequences
   */
  clearOld(maxAge = 86400000): void { // 24 hours
    const now = Date.now();

    for (const [key, sequence] of this.sequences.entries()) {
      if (now - sequence.timestamp > maxAge) {
        this.sequences.delete(key);
      }
    }

    for (const [userId, pattern] of this.userPatterns.entries()) {
      if (now - pattern.lastAccess > maxAge) {
        this.userPatterns.delete(userId);
      }
    }
  }
}

// ============================================================================
// ML-based Prefetcher (Simplified)
// ============================================================================>

class MLPrefetcher {
  private model: Map<string, number[]>; // key -> feature vector
  private featureCount = 10;

  constructor() {
    this.model = new Map();
  }

  /**
   * Extract features from access pattern
   */
  private extractFeatures(key: string, context: {
    timeOfDay: number;
    dayOfWeek: number;
    accessCount: number;
    lastAccess: number;
  }): number[] {
    return [
      context.timeOfDay / 24, // Normalized time of day
      context.dayOfWeek / 7, // Normalized day of week
      Math.min(context.accessCount / 100, 1), // Normalized access count
      context.lastAccess / 1000, // Time since last access (seconds)
      key.length / 100, // Key length
      this.hashKey(key) / 1000, // Key hash
      0, 0, 0, 0, // Reserved for future features
    ];
  }

  /**
   * Hash a key
   */
  private hashKey(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Train on access data
   */
  train(key: string, features: number[], nextKey: string): void {
    // Simple collaborative filtering approach
    const keyFeatures = this.model.get(key) || new Array(this.featureCount).fill(0);

    // Update feature weights (simplified)
    for (let i = 0; i < this.featureCount; i++) {
      keyFeatures[i] = keyFeatures[i] * 0.9 + features[i] * 0.1;
    }

    this.model.set(key, keyFeatures);
  }

  /**
   * Predict next accesses
   */
  predict(currentKey: string, allKeys: string[]): PrefetchPrediction[] {
    const predictions: PrefetchPrediction[] = [];
    const now = Date.now();

    const currentFeatures = this.model.get(currentKey);
    if (!currentFeatures) {
      return predictions;
    }

    // Find similar keys and their successors
    for (const [key, features] of this.model.entries()) {
      if (key === currentKey) continue;

      // Calculate similarity
      const similarity = this.cosineSimilarity(currentFeatures, features);

      if (similarity > 0.8) {
        // This is a similar access pattern, predict the next key
        predictions.push({
          key: key + '_next', // Placeholder for actual next key
          probability: similarity,
          urgency: similarity,
          reason: `ML-based similarity: ${similarity.toFixed(2)}`,
          timestamp: now,
        });
      }
    }

    return predictions.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// ============================================================================
// Collaborative Prefetcher
// ============================================================================

class CollaborativePrefetcher {
  private userAccess = new Map<string, Set<string>>(); // user -> keys
  private keyUsers = new Map<string, Set<string>>(); // key -> users

  /**
   * Record access
   */
  recordAccess(key: string, userId: string): void {
    const userKeys = this.userAccess.get(userId) || new Set();
    userKeys.add(key);
    this.userAccess.set(userId, userKeys);

    const keyUsersSet = this.keyUsers.get(key) || new Set();
    keyUsersSet.add(userId);
    this.keyUsers.set(key, keyUsersSet);
  }

  /**
   * Find similar users and predict their keys
   */
  predict(userId: string, currentKey: string): PrefetchPrediction[] {
    const predictions: PrefetchPrediction[] = [];
    const now = Date.now();

    const userKeys = this.userAccess.get(userId);
    if (!userKeys) return predictions;

    // Find users who accessed the same key
    const similarUsers = this.keyUsers.get(currentKey) || new Set();

    for (const similarUser of similarUsers) {
      if (similarUser === userId) continue;

      const theirKeys = this.userAccess.get(similarUser);
      if (!theirKeys) continue;

      // Predict keys they accessed that the user hasn't
      for (const key of theirKeys) {
        if (!userKeys.has(key)) {
          const existing = predictions.find(p => p.key === key);
          if (existing) {
            existing.probability = Math.min(existing.probability + 0.1, 1);
          } else {
            predictions.push({
              key,
              probability: 0.5,
              urgency: 0.5,
              reason: `Collaborative: user ${similarUser} also accessed`,
              timestamp: now,
            });
          }
        }
      }
    }

    return predictions.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Clear old data
   */
  clearOld(maxAge = 604800000): void { // 7 days
    // In a real implementation, you'd track timestamps
    // For now, this is a placeholder
  }
}

// ============================================================================
// Cache Prefetcher
// ============================================================================

export class CachePrefetcher {
  private cache: MultiTierCache;
  private config: PrefetchConfig;
  private patternBased: PatternBasedPrefetcher;
  private mlBased: MLPrefetcher;
  private collaborative: CollaborativePrefetcher;
  private activePrefetches = new Map<string, boolean>();

  constructor(cache: MultiTierCache, config: PrefetchConfig) {
    this.cache = cache;
    this.config = config;
    this.patternBased = new PatternBasedPrefetcher();
    this.mlBased = new MLPrefetcher();
    this.collaborative = new CollaborativePrefetcher();
  }

  /**
   * Record access for learning
   */
  recordAccess(key: string, userId?: string): void {
    if (!this.config.learningEnabled) return;

    const now = new Date();
    const context = {
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      accessCount: 0, // Would need to track this
      lastAccess: Date.now(),
    };

    this.patternBased.recordAccess(key, userId);
    if (userId) {
      this.collaborative.recordAccess(key, userId);
    }

    // Train ML model
    const features = this.mlBased['extractFeatures'](key, context);
    this.mlBased.train(key, features, key + '_next');
  }

  /**
   * Generate prefetch predictions
   */
  async predict(currentKey: string, userId?: string): Promise<PrefetchPrediction[]> {
    const predictions: PrefetchPrediction[] = [];

    // Pattern-based predictions
    const patternPredictions = this.patternBased.predict(currentKey, userId);
    predictions.push(...patternPredictions);

    // ML-based predictions
    const mlPredictions = this.mlBased.predict(currentKey, []);
    predictions.push(...mlPredictions);

    // Collaborative predictions
    if (userId) {
      const collabPredictions = this.collaborative.predict(userId, currentKey);
      predictions.push(...collabPredictions);
    }

    // Deduplicate and merge
    const merged = new Map<string, PrefetchPrediction>();
    for (const pred of predictions) {
      const existing = merged.get(pred.key);
      if (existing) {
        existing.probability = Math.min(existing.probability + pred.probability * 0.5, 1);
        existing.urgency = Math.max(existing.urgency, pred.urgency);
      } else {
        merged.set(pred.key, { ...pred });
      }
    }

    // Filter by threshold
    return Array.from(merged.values())
      .filter(p => p.probability >= this.config.threshold)
      .sort((a, b) => b.probability - a.probability);
  }

  /**
   * Run prefetching
   */
  async prefetch(currentKey: string, userId?: string): Promise<PrefetchResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        prefetchedKeys: [],
        skippedKeys: [],
        duration: 0,
        bytesTransferred: 0,
      };
    }

    const startTime = Date.now();
    const predictions = await this.predict(currentKey, userId);

    const result: PrefetchResult = {
      success: true,
      prefetchedKeys: [],
      skippedKeys: [],
      duration: 0,
      bytesTransferred: 0,
    };

    // Prioritize predictions
    const tasks = predictions
      .slice(0, this.config.maxConcurrent)
      .map(p => ({
        key: p.key,
        priority: p.probability,
        urgency: p.urgency,
        reason: p.reason,
      } as PrefetchTask))
      .sort((a, b) => b.priority - a.priority);

    // Execute prefetches
    for (const task of tasks) {
      // Check if already prefetching
      if (this.activePrefetches.get(task.key)) {
        result.skippedKeys.push(task.key);
        continue;
      }

      this.activePrefetches.set(task.key, true);

      try {
        // Try to get the key (will warm the cache if it exists)
        const cacheResult = await this.cache.get(task.key);

        if (cacheResult.hit) {
          result.prefetchedKeys.push(task.key);
        } else {
          result.skippedKeys.push(task.key);
        }
      } catch (error) {
        result.skippedKeys.push(task.key);
      } finally {
        this.activePrefetches.set(task.key, false);
      }
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Prefetch multiple keys
   */
  async prefetchMany(keys: string[]): Promise<PrefetchResult> {
    const startTime = Date.now();

    const result: PrefetchResult = {
      success: true,
      prefetchedKeys: [],
      skippedKeys: [],
      duration: 0,
      bytesTransferred: 0,
    };

    for (const key of keys) {
      try {
        const cacheResult = await this.cache.get(key);

        if (cacheResult.hit) {
          result.prefetchedKeys.push(key);
        } else {
          result.skippedKeys.push(key);
        }
      } catch {
        result.skippedKeys.push(key);
      }
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Get prefetch statistics
   */
  getStats(): {
    activePrefetches: number;
    patternsTracked: number;
    modelSize: number;
    collaborativeUsers: number;
  } {
    return {
      activePrefetches: this.activePrefetches.size,
      patternsTracked: this.patternBased.getSequences().length,
      modelSize: this.mlBased['model'].size,
      collaborativeUsers: this.collaborative['userAccess'].size,
    };
  }

  /**
   * Clear old data
   */
  clearOld(): void {
    this.patternBased.clearOld();
    this.collaborative.clearOld();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCachePrefetcher(
  cache: MultiTierCache,
  config: PrefetchConfig
): CachePrefetcher {
  return new CachePrefetcher(cache, config);
}
