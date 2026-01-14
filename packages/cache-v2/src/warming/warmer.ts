/**
 * Cache Warmer
 * Predictive and scheduled cache warming for optimal performance
 */

import {
  CacheTier,
  WarmupStrategy,
  WarmupConfig,
  WarmupPrediction,
  WarmupResult,
  ScheduleConfig,
  AccessPattern,
  CacheContext,
  MultiTierCache,
} from '../types';

// ============================================================================
// Warmup Types
// ============================================================================

interface WarmupTask {
  key: string;
  priority: number;
  predictedAccess: number;
  confidence: number;
  reason: string;
}

interface WarmupSchedule {
  id: string;
  config: ScheduleConfig;
  lastRun: number;
  nextRun: number;
  keys: string[];
}

// ============================================================================
// Access Pattern Analyzer
// ============================================================================

class AccessPatternAnalyzer {
  private accessHistory = new Map<string, number[]>();
  private patterns = new Map<string, AccessPattern>();

  /**
   * Record access to a key
   */
  recordAccess(key: string): void {
    const accesses = this.accessHistory.get(key) || [];
    accesses.push(Date.now());

    // Keep only last 1000 accesses
    if (accesses.length > 1000) {
      accesses.shift();
    }

    this.accessHistory.set(key, accesses);
    this.analyzePattern(key);
  }

  /**
   * Analyze access pattern for a key
   */
  private analyzePattern(key: string): void {
    const accesses = this.accessHistory.get(key);
    if (!accesses || accesses.length < 2) {
      return;
    }

    const now = Date.now();
    const recentAccesses = accesses.filter(a => now - a < 3600000); // Last hour

    if (recentAccesses.length < 2) {
      return;
    }

    // Calculate intervals
    const intervals: number[] = [];
    for (let i = 1; i < recentAccesses.length; i++) {
      intervals.push(recentAccesses[i] - recentAccesses[i - 1]);
    }

    // Determine pattern type
    let pattern: AccessPattern['pattern'] = 'random';
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avgInterval; // Coefficient of variation

    if (cv < 0.2) {
      pattern = 'periodic';
    } else if (cv > 0.8) {
      pattern = 'burst';
    } else if (this.isSequential(recentAccesses)) {
      pattern = 'sequential';
    }

    const frequency = recentAccesses.length / ((now - recentAccesses[0]) / 1000);

    this.patterns.set(key, {
      key,
      accessCount: accesses.length,
      lastAccess: accesses[accesses.length - 1],
      firstAccess: accesses[0],
      frequency,
      pattern,
    });
  }

  /**
   * Check if accesses are sequential
   */
  private isSequential(accesses: number[]): boolean {
    if (accesses.length < 3) return false;

    let sequential = true;
    for (let i = 1; i < accesses.length; i++) {
      const gap = accesses[i] - accesses[i - 1];
      if (gap > 10000) { // More than 10 seconds gap
        sequential = false;
        break;
      }
    }

    return sequential;
  }

  /**
   * Get access pattern for a key
   */
  getPattern(key: string): AccessPattern | null {
    return this.patterns.get(key) || null;
  }

  /**
   * Get all patterns
   */
  getAllPatterns(): AccessPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Predict next access time for a key
   */
  predictNextAccess(key: string): number | null {
    const pattern = this.patterns.get(key);
    const accesses = this.accessHistory.get(key);

    if (!pattern || !accesses || accesses.length < 2) {
      return null;
    }

    const recentAccesses = accesses.slice(-10);
    const now = Date.now();

    switch (pattern.pattern) {
      case 'periodic':
        // Predict based on average interval
        const intervals: number[] = [];
        for (let i = 1; i < recentAccesses.length; i++) {
          intervals.push(recentAccesses[i] - recentAccesses[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        return recentAccesses[recentAccesses.length - 1] + avgInterval;

      case 'sequential':
        // Predict immediate next access
        return now + 1000; // 1 second

      case 'burst':
        // Predict within burst window
        return now + 5000; // 5 seconds

      default:
        return null;
    }
  }

  /**
   * Get hot keys (high frequency access)
   */
  getHotKeys(limit = 100): Array<{ key: string; score: number }> {
    const now = Date.now();
    const hourAgo = now - 3600000;

    return Array.from(this.patterns.values())
      .filter(p => p.lastAccess > hourAgo)
      .map(p => ({
        key: p.key,
        score: p.frequency * (1 + (p.pattern === 'periodic' ? 0.5 : 0)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

// ============================================================================
// Predictive Warmer
// ============================================================================

class PredictiveWarmer {
  private analyzer: AccessPatternAnalyzer;

  constructor() {
    this.analyzer = new AccessPatternAnalyzer();
  }

  /**
   * Record access for learning
   */
  recordAccess(key: string): void {
    this.analyzer.recordAccess(key);
  }

  /**
   * Generate warmup predictions
   */
  predictWarmup(
    limit: number,
    threshold: number = 0.7
  ): WarmupPrediction[] {
    const hotKeys = this.analyzer.getHotKeys(limit * 2);
    const predictions: WarmupPrediction[] = [];

    for (const { key, score } of hotKeys) {
      const pattern = this.analyzer.getPattern(key);
      if (!pattern) continue;

      // Calculate confidence based on pattern stability
      let confidence = 0.5;
      if (pattern.pattern === 'periodic') confidence = 0.9;
      else if (pattern.pattern === 'sequential') confidence = 0.8;
      else if (pattern.pattern === 'burst') confidence = 0.7;

      // Calculate probability
      const probability = Math.min(score / 10, 1);

      if (probability >= threshold) {
        const predictedAccess = this.analyzer.predictNextAccess(key) || Date.now() + 60000;

        predictions.push({
          key,
          probability,
          reason: `Pattern: ${pattern.pattern}, frequency: ${pattern.frequency.toFixed(2)}/s`,
          predictedAccess,
          confidence,
        });
      }

      if (predictions.length >= limit) {
        break;
      }
    }

    return predictions.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Get access pattern analyzer
   */
  getAnalyzer(): AccessPatternAnalyzer {
    return this.analyzer;
  }
}

// ============================================================================
// Scheduled Warmer
// ============================================================================

class ScheduledWarmer {
  private schedules = new Map<string, WarmupSchedule>();

  /**
   * Add a scheduled warmup
   */
  addSchedule(
    id: string,
    config: ScheduleConfig,
    keys: string[]
  ): void {
    const now = Date.now();
    const nextRun = this.calculateNextRun(config, now);

    this.schedules.set(id, {
      id,
      config,
      lastRun: 0,
      nextRun,
      keys,
    });
  }

  /**
   * Remove a scheduled warmup
   */
  removeSchedule(id: string): void {
    this.schedules.delete(id);
  }

  /**
   * Get due schedules
   */
  getDueSchedules(): WarmupSchedule[] {
    const now = Date.now();
    return Array.from(this.schedules.values()).filter(s => s.nextRun <= now);
  }

  /**
   * Mark schedule as run
   */
  markRun(id: string): void {
    const schedule = this.schedules.get(id);
    if (!schedule) return;

    schedule.lastRun = Date.now();
    schedule.nextRun = this.calculateNextRun(schedule.config, schedule.lastRun);
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(config: ScheduleConfig, from: number): number {
    switch (config.type) {
      case 'interval':
        return from + (config.interval || 60000);

      case 'cron':
        // Simple cron implementation (would need a full cron parser in production)
        // For now, assume hourly
        return from + 3600000;

      case 'event':
        // Event-based warmups are triggered externally
        return Number.MAX_SAFE_INTEGER;

      default:
        return from + 60000;
    }
  }

  /**
   * Get all schedules
   */
  getSchedules(): WarmupSchedule[] {
    return Array.from(this.schedules.values());
  }
}

// ============================================================================
// Cache Warmer
// ============================================================================

export class CacheWarmer {
  private cache: MultiTierCache;
  private config: WarmupConfig;
  private predictive: PredictiveWarmer;
  private scheduled: ScheduledWarmer;
  private activeWarming = new Map<string, boolean>();

  constructor(cache: MultiTierCache, config: WarmupConfig) {
    this.cache = cache;
    this.config = config;
    this.predictive = new PredictiveWarmer();
    this.scheduled = new ScheduledWarmer();
  }

  /**
   * Record access for learning
   */
  recordAccess(key: string): void {
    if (this.config.enabled) {
      this.predictive.recordAccess(key);
    }
  }

  /**
   * Run predictive warmup
   */
  async runPredictiveWarmup(): Promise<WarmupResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        warmedKeys: [],
        failedKeys: [],
        duration: 0,
        bytesTransferred: 0,
      };
    }

    const startTime = Date.now();
    const predictions = this.predictive.predictWarmup(
      this.config.maxEntries,
      0.7
    );

    const result: WarmupResult = {
      success: true,
      warmedKeys: [],
      failedKeys: [],
      duration: 0,
      bytesTransferred: 0,
    };

    // Process predictions in batches
    const batchSize = this.config.batchSize;
    for (let i = 0; i < predictions.length; i += batchSize) {
      const batch = predictions.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(p => this.warmKey(p.key))
      );

      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          result.warmedKeys.push(batch[j].key);
        } else {
          result.failedKeys.push(batch[j].key);
        }
      }
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Run scheduled warmup
   */
  async runScheduledWarmup(): Promise<WarmupResult> {
    const startTime = Date.now();
    const schedules = this.scheduled.getDueSchedules();

    const result: WarmupResult = {
      success: true,
      warmedKeys: [],
      failedKeys: [],
      duration: 0,
      bytesTransferred: 0,
    };

    for (const schedule of schedules) {
      const keys = schedule.keys;

      for (const key of keys) {
        try {
          await this.warmKey(key);
          result.warmedKeys.push(key);
        } catch {
          result.failedKeys.push(key);
        }
      }

      this.scheduled.markRun(schedule.id);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Warm a specific key
   */
  private async warmKey(key: string): Promise<void> {
    // Check if already warming
    if (this.activeWarming.get(key)) {
      return;
    }

    this.activeWarming.set(key, true);

    try {
      // Try to get from lower tier and promote to higher tier
      const result = await this.cache.get(key);

      if (!result.hit) {
        // Key doesn't exist, skip
        return;
      }

      // Key is now warmed by virtue of being accessed
      // The cache system will handle promotion
    } finally {
      this.activeWarming.set(key, false);
    }
  }

  /**
   * Add a scheduled warmup
   */
  addSchedule(id: string, config: ScheduleConfig, keys: string[]): void {
    this.scheduled.addSchedule(id, config, keys);
  }

  /**
   * Remove a scheduled warmup
   */
  removeSchedule(id: string): void {
    this.scheduled.removeSchedule(id);
  }

  /**
   * Get warmup recommendations
   */
  getRecommendations(limit = 100): WarmupPrediction[] {
    return this.predictive.predictWarmup(limit, 0.7);
  }

  /**
   * Get access patterns
   */
  getAccessPatterns(): AccessPattern[] {
    return this.predictive.getAnalyzer().getAllPatterns();
  }

  /**
   * Get hot keys
   */
  getHotKeys(limit = 100): Array<{ key: string; score: number }> {
    return this.predictive.getAnalyzer().getHotKeys(limit);
  }

  /**
   * Run event-driven warmup
   */
  async runEventDrivenWarmup(event: string, keys: string[]): Promise<WarmupResult> {
    const startTime = Date.now();

    const result: WarmupResult = {
      success: true,
      warmedKeys: [],
      failedKeys: [],
      duration: 0,
      bytesTransferred: 0,
    };

    for (const key of keys) {
      try {
        await this.warmKey(key);
        result.warmedKeys.push(key);
      } catch {
        result.failedKeys.push(key);
      }
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Get warmer statistics
   */
  getStats(): {
    schedules: number;
    activeWarming: number;
    patternsTracked: number;
  } {
    return {
      schedules: this.scheduled.getSchedules().length,
      activeWarming: this.activeWarming.size,
      patternsTracked: this.predictive.getAnalyzer().getAllPatterns().length,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCacheWarmer(
  cache: MultiTierCache,
  config: WarmupConfig
): CacheWarmer {
  return new CacheWarmer(cache, config);
}
