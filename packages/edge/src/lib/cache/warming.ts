/**
 * Cache Warming Strategies
 *
 * Preloads cache with frequently accessed data based on:
 * - Historical access patterns
 * - Time-of-day patterns
 * - User session patterns
 * - Query frequency analysis
 *
 * Goals:
 * - Reduce cold start latency
 * - Improve hit rate from 60% to 80%+
 * - Minimize unnecessary preloads
 * - Adapt to changing access patterns
 *
 * Architecture:
 * 1. Pattern Detection: Analyze access logs for patterns
 * 2. Prediction: Predict likely next queries
 * 3. Preloading: Load predicted queries into cache
 * 4. Evaluation: Measure effectiveness and adjust
 */

import type { ChatResponse } from '@claudeflare/shared';
import type { SemanticCache } from './semantic';
import type { KVCache } from '../kv';

export interface AccessPattern {
  query: string;
  frequency: number;
  lastAccess: number;
  avgLatency: number;
  metadata: {
    model?: string;
    language?: string;
    framework?: string;
  };
}

export interface TimePattern {
  hour: number;
  dayOfWeek: number;
  queries: string[];
  frequency: number;
}

export interface SessionPattern {
  sessionId: string;
  querySequence: string[];
  commonQueries: string[];
  avgQueriesPerSession: number;
}

export interface CacheWarmingOptions {
  /**
   * Enable pattern-based warming
   * @default true
   */
  enablePatternWarming?: boolean;

  /**
   * Enable time-based warming
   * @default true
   */
  enableTimeBasedWarming?: boolean;

  /**
   * Enable session-based warming
   * @default true
   */
  enableSessionWarming?: boolean;

  /**
   * Minimum frequency for pattern warming
   * @default 5
   */
  minFrequency?: number;

  /**
   * Maximum number of entries to warm
   * @default 100
   */
  maxWarmEntries?: number;

  /**
   * Time window for pattern analysis (ms)
   * @default 7 * 24 * 60 * 60 * 1000 (7 days)
   */
  patternTimeWindow?: number;

  /**
   * Update interval for patterns (ms)
   * @default 60 * 60 * 1000 (1 hour)
   */
  patternUpdateInterval?: number;

  /**
   * KV cache for persisting patterns
   */
  kvCache?: KVCache;

  /**
   * Semantic cache to warm
   */
  semanticCache?: SemanticCache;

  /**
   * Provider function for generating responses
   */
  provider?: (query: string, metadata: Record<string, unknown>) => Promise<ChatResponse>;
}

export interface WarmStats {
  patternsDetected: number;
  entriesWarmed: number;
  warmHits: number;
  warmMisses: number;
  warmHitRate: number;
  lastWarmTime: number;
  patternsUpdated: number;
}

/**
 * Cache Warming Manager
 *
 * Implements intelligent cache warming based on access patterns.
 */
export class CacheWarmingManager {
  private options: Required<CacheWarmingOptions>;
  private accessPatterns: Map<string, AccessPattern>;
  private timePatterns: Map<string, TimePattern>;
  private sessionPatterns: Map<string, SessionPattern>;
  private stats: WarmStats;
  private lastPatternUpdate: number;
  private isWarming: boolean;

  constructor(options: CacheWarmingOptions = {}) {
    this.options = {
      enablePatternWarming: options.enablePatternWarming ?? true,
      enableTimeBasedWarming: options.enableTimeBasedWarming ?? true,
      enableSessionWarming: options.enableSessionWarming ?? true,
      minFrequency: options.minFrequency ?? 5,
      maxWarmEntries: options.maxWarmEntries ?? 100,
      patternTimeWindow: options.patternTimeWindow ?? 7 * 24 * 60 * 60 * 1000, // 7 days
      patternUpdateInterval: options.patternUpdateInterval ?? 60 * 60 * 1000, // 1 hour
      kvCache: options.kvCache!,
      semanticCache: options.semanticCache!,
      provider: options.provider!,
    };

    this.accessPatterns = new Map();
    this.timePatterns = new Map();
    this.sessionPatterns = new Map();

    this.stats = {
      patternsDetected: 0,
      entriesWarmed: 0,
      warmHits: 0,
      warmMisses: 0,
      warmHitRate: 0,
      lastWarmTime: 0,
      patternsUpdated: 0,
    };

    this.lastPatternUpdate = 0;
    this.isWarming = false;

    // Load patterns from storage
    this.loadPatterns();
  }

  /**
   * Record access for pattern detection
   *
   * @param query - Query that was accessed
   * @param metadata - Query metadata
   * @param hit - Whether it was a cache hit
   */
  recordAccess(query: string, metadata: Record<string, unknown>, hit: boolean): void {
    const now = Date.now();
    const normalizedQuery = this.normalizeQuery(query);

    // Update access pattern
    let pattern = this.accessPatterns.get(normalizedQuery);
    if (!pattern) {
      pattern = {
        query: normalizedQuery,
        frequency: 0,
        lastAccess: now,
        avgLatency: 0,
        metadata: {
          model: metadata.model as string,
          language: metadata.language as string,
          framework: metadata.framework as string,
        },
      };
      this.accessPatterns.set(normalizedQuery, pattern);
    }

    pattern.frequency++;
    pattern.lastAccess = now;

    // Update time pattern
    if (this.options.enableTimeBasedWarming) {
      const date = new Date(now);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const timeKey = `${hour}-${dayOfWeek}`;

      let timePattern = this.timePatterns.get(timeKey);
      if (!timePattern) {
        timePattern = {
          hour,
          dayOfWeek,
          queries: [],
          frequency: 0,
        };
        this.timePatterns.set(timeKey, timePattern);
      }

      timePattern.queries.push(normalizedQuery);
      timePattern.frequency++;
    }

    // Update session pattern
    if (this.options.enableSessionWarming && metadata.sessionId) {
      const sessionId = metadata.sessionId as string;
      let sessionPattern = this.sessionPatterns.get(sessionId);
      if (!sessionPattern) {
        sessionPattern = {
          sessionId,
          querySequence: [],
          commonQueries: [],
          avgQueriesPerSession: 0,
        };
        this.sessionPatterns.set(sessionId, sessionPattern);
      }

      sessionPattern.querySequence.push(normalizedQuery);

      // Update common queries (top 5)
      const queryCounts = new Map<string, number>();
      for (const q of sessionPattern.querySequence) {
        queryCounts.set(q, (queryCounts.get(q) ?? 0) + 1);
      }

      sessionPattern.commonQueries = Array.from(queryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([q]) => q);
    }

    // Track warm hits/misses
    if (this.isWarming) {
      if (hit) {
        this.stats.warmHits++;
      } else {
        this.stats.warmMisses++;
      }
      this.updateWarmHitRate();
    }
  }

  /**
   * Warm cache based on detected patterns
   *
   * @returns Number of entries warmed
   */
  async warmCache(): Promise<number> {
    if (!this.options.provider || !this.options.semanticCache) {
      console.warn('Cache warming requires provider and semanticCache');
      return 0;
    }

    this.isWarming = true;

    try {
      // Update patterns if needed
      await this.updatePatternsIfNeeded();

      // Collect queries to warm
      const queriesToWarm = this.collectQueriesToWarm();

      // Warm each query
      let warmed = 0;
      for (const { query, metadata } of queriesToWarm) {
        if (warmed >= this.options.maxWarmEntries) {
          break;
        }

        try {
          // Check if already in cache
          const cacheResult = await this.options.semanticCache.check(query, metadata);
          if (!cacheResult.hit) {
            // Generate and cache response
            const response = await this.options.provider(query, metadata);
            await this.options.semanticCache.store(query, response, metadata);
            warmed++;
          }
        } catch (error) {
          console.error(`Failed to warm cache for query: ${query}`, error);
        }
      }

      this.stats.entriesWarmed = warmed;
      this.stats.lastWarmTime = Date.now();

      console.log(`Cache warmed with ${warmed} entries`);

      return warmed;
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Predict next queries based on session history
   *
   * @param sessionId - Session ID
   * @param recentQueries - Recent queries in session
   * @returns Predicted next queries
   */
  predictNextQueries(sessionId: string, recentQueries: string[]): string[] {
    const sessionPattern = this.sessionPatterns.get(sessionId);
    if (!sessionPattern || sessionPattern.querySequence.length < 2) {
      return [];
    }

    const predictions: string[] = [];

    // Find similar sequences in session history
    for (let i = 0; i < sessionPattern.querySequence.length - recentQueries.length; i++) {
      const sequence = sessionPattern.querySequence.slice(i, i + recentQueries.length);

      // Check if sequence matches recent queries
      let matches = true;
      for (let j = 0; j < recentQueries.length; j++) {
        if (this.normalizeQuery(sequence[j]) !== this.normalizeQuery(recentQueries[j])) {
          matches = false;
          break;
        }
      }

      // If match, predict next query
      if (matches && i + recentQueries.length < sessionPattern.querySequence.length) {
        const nextQuery = sessionPattern.querySequence[i + recentQueries.length];
        if (!predictions.includes(nextQuery)) {
          predictions.push(nextQuery);
        }
      }
    }

    // Also include common queries for this session
    for (const query of sessionPattern.commonQueries) {
      if (!predictions.includes(query)) {
        predictions.push(query);
      }
    }

    return predictions.slice(0, 5); // Top 5 predictions
  }

  /**
   * Warm cache for specific session
   *
   * @param sessionId - Session ID
   * @returns Number of entries warmed
   */
  async warmSession(sessionId: string): Promise<number> {
    if (!this.options.provider || !this.options.semanticCache) {
      return 0;
    }

    const sessionPattern = this.sessionPatterns.get(sessionId);
    if (!sessionPattern) {
      return 0;
    }

    let warmed = 0;

    // Warm common queries for this session
    for (const query of sessionPattern.commonQueries) {
      if (warmed >= 10) {
        break; // Max 10 entries per session
      }

      try {
        const cacheResult = await this.options.semanticCache.check(query, {});
        if (!cacheResult.hit) {
          const response = await this.options.provider(query, {});
          await this.options.semanticCache.store(query, response, {});
          warmed++;
        }
      } catch (error) {
        console.error(`Failed to warm session query: ${query}`, error);
      }
    }

    return warmed;
  }

  /**
   * Get warming statistics
   */
  getStats(): WarmStats {
    return {
      ...this.stats,
      patternsDetected: this.accessPatterns.size,
    };
  }

  /**
   * Get top patterns by frequency
   *
   * @param limit - Number of patterns to return
   * @returns Top patterns
   */
  getTopPatterns(limit: number = 10): AccessPattern[] {
    return Array.from(this.accessPatterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  /**
   * Get time-based patterns for current time
   *
   * @returns Patterns for current time
   */
  getCurrentTimePatterns(): string[] {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const timeKey = `${hour}-${dayOfWeek}`;

    const timePattern = this.timePatterns.get(timeKey);
    if (!timePattern) {
      return [];
    }

    // Count query frequencies
    const queryCounts = new Map<string, number>();
    for (const query of timePattern.queries) {
      queryCounts.set(query, (queryCounts.get(query) ?? 0) + 1);
    }

    // Return top queries
    return Array.from(queryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([query]) => query);
  }

  /**
   * Clear all patterns
   */
  clearPatterns(): void {
    this.accessPatterns.clear();
    this.timePatterns.clear();
    this.sessionPatterns.clear();

    this.stats.patternsDetected = 0;
    this.stats.patternsUpdated++;
  }

  /**
   * Normalize query for pattern matching
   *
   * @private
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 200); // Limit length
  }

  /**
   * Update patterns if needed
   *
   * @private
   */
  private async updatePatternsIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastPatternUpdate;

    if (timeSinceLastUpdate >= this.options.patternUpdateInterval) {
      // Remove old patterns
      this.cleanupOldPatterns();

      // Save patterns to KV
      if (this.options.kvCache) {
        await this.savePatterns();
      }

      this.lastPatternUpdate = now;
      this.stats.patternsUpdated++;
    }
  }

  /**
   * Clean up old patterns
   *
   * @private
   */
  private cleanupOldPatterns(): void {
    const now = Date.now();
    const cutoff = now - this.options.patternTimeWindow;

    // Clean up access patterns
    for (const [query, pattern] of this.accessPatterns.entries()) {
      if (pattern.lastAccess < cutoff || pattern.frequency < this.options.minFrequency) {
        this.accessPatterns.delete(query);
      }
    }

    // Clean up time patterns
    for (const [key, timePattern] of this.timePatterns.entries()) {
      if (timePattern.frequency < this.options.minFrequency) {
        this.timePatterns.delete(key);
      }
    }

    // Clean up session patterns (remove old sessions)
    for (const [sessionId, sessionPattern] of this.sessionPatterns.entries()) {
      const lastAccess = sessionPattern.querySequence.length > 0 ? now : 0;
      // Assume old sessions if no recent activity
      if (lastAccess < cutoff) {
        this.sessionPatterns.delete(sessionId);
      }
    }
  }

  /**
   * Collect queries to warm
   *
   * @private
   */
  private collectQueriesToWarm(): Array<{ query: string; metadata: Record<string, unknown> }> {
    const queries: Array<{ query: string; metadata: Record<string, unknown> }> = [];

    // Add pattern-based queries
    if (this.options.enablePatternWarming) {
      const topPatterns = this.getTopPatterns(this.options.maxWarmEntries);
      for (const pattern of topPatterns) {
        queries.push({
          query: pattern.query,
          metadata: pattern.metadata as Record<string, unknown>,
        });
      }
    }

    // Add time-based queries
    if (this.options.enableTimeBasedWarming) {
      const timePatterns = this.getCurrentTimePatterns();
      for (const query of timePatterns) {
        if (!queries.find(q => q.query === query)) {
          queries.push({ query, metadata: {} });
        }
      }
    }

    // Prioritize by frequency
    const queryScores = new Map<string, number>();
    for (const { query } of queries) {
      const pattern = this.accessPatterns.get(query);
      if (pattern) {
        queryScores.set(query, pattern.frequency);
      }
    }

    // Sort by score
    queries.sort((a, b) => {
      const scoreA = queryScores.get(a.query) ?? 0;
      const scoreB = queryScores.get(b.query) ?? 0;
      return scoreB - scoreA;
    });

    return queries.slice(0, this.options.maxWarmEntries);
  }

  /**
   * Update warm hit rate
   *
   * @private
   */
  private updateWarmHitRate(): void {
    const total = this.stats.warmHits + this.stats.warmMisses;
    this.stats.warmHitRate = total > 0 ? (this.stats.warmHits / total) * 100 : 0;
  }

  /**
   * Save patterns to KV
   *
   * @private
   */
  private async savePatterns(): Promise<void> {
    if (!this.options.kvCache) {
      return;
    }

    try {
      await this.options.kvCache.set('cache-warming:patterns', {
        accessPatterns: Array.from(this.accessPatterns.entries()),
        timePatterns: Array.from(this.timePatterns.entries()),
        sessionPatterns: Array.from(this.sessionPatterns.entries()),
        lastUpdate: Date.now(),
      }, 60 * 60 * 24 * 7); // 7 days
    } catch (error) {
      console.error('Failed to save patterns:', error);
    }
  }

  /**
   * Load patterns from KV
   *
   * @private
   */
  private async loadPatterns(): Promise<void> {
    if (!this.options.kvCache) {
      return;
    }

    try {
      const data = await this.options.kvCache.get<{
        accessPatterns: Array<[string, AccessPattern]>;
        timePatterns: Array<[string, TimePattern]>;
        sessionPatterns: Array<[string, SessionPattern]>;
        lastUpdate: number;
      }>('cache-warming:patterns');

      if (data) {
        this.accessPatterns = new Map(data.accessPatterns);
        this.timePatterns = new Map(data.timePatterns);
        this.sessionPatterns = new Map(data.sessionPatterns);
        this.lastPatternUpdate = data.lastUpdate;
        this.stats.patternsDetected = this.accessPatterns.size;
      }
    } catch (error) {
      console.error('Failed to load patterns:', error);
    }
  }
}

/**
 * Create a cache warming manager
 */
export function createCacheWarmingManager(
  options?: CacheWarmingOptions
): CacheWarmingManager {
  return new CacheWarmingManager(options);
}

/**
 * Default cache warming manager
 */
export const defaultCacheWarmingManager = new CacheWarmingManager();
