/**
 * Popular Content Cache Warming Strategy
 *
 * Identifies and preloads popular content based on access patterns,
 * trends, and user behavior metrics.
 */

import type {
  PopularContentPattern,
  WarmingTask,
  WarmingResult,
  CacheTier,
  EdgeCacheEnv,
} from '../types';

export interface PopularContentConfig {
  minAccessCount: number;
  timeWindow: number; // milliseconds
  trendThreshold: number;
  maxConcurrent: number;
  batchSize: number;
  retryAttempts: number;
  backoffMultiplier: number;
}

export interface PopularContentTracker {
  patterns: Map<string, PopularContentPattern>;
  accessHistory: AccessEntry[];
  totalAccesses: number;
  lastCleanup: number;
}

interface AccessEntry {
  url: string;
  method: string;
  timestamp: number;
  userId?: string;
  geography: string;
  statusCode: number;
  duration: number;
}

/**
 * Popular Content Cache Warmer
 *
 * Analyzes access patterns to identify popular content and
 * proactively warm the cache with frequently accessed resources.
 */
export class PopularContentWarmer {
  private kv: KVNamespace;
  private config: PopularContentConfig;
  private tracker: PopularContentTracker;
  private activeTasks: Map<string, WarmingTask>;
  private taskQueue: WarmingTask[];
  private processing: boolean = false;

  constructor(kv: KVNamespace, config: Partial<PopularContentConfig> = {}) {
    this.kv = kv;
    this.config = {
      minAccessCount: 10,
      timeWindow: 3600000, // 1 hour
      trendThreshold: 0.1, // 10% increase
      maxConcurrent: 5,
      batchSize: 10,
      retryAttempts: 3,
      backoffMultiplier: 2,
      ...config,
    };

    this.tracker = {
      patterns: new Map(),
      accessHistory: [],
      totalAccesses: 0,
      lastCleanup: Date.now(),
    };

    this.activeTasks = new Map();
    this.taskQueue = [];
  }

  /**
   * Record an access event for tracking popularity
   */
  async recordAccess(entry: AccessEntry): Promise<void> {
    const key = this.getAccessKey(entry.url, entry.method);

    // Update pattern
    let pattern = this.tracker.patterns.get(key);
    if (!pattern) {
      pattern = {
        url: entry.url,
        method: entry.method,
        accessCount: 0,
        lastAccess: entry.timestamp,
        trend: 'stable',
        score: 0,
      };
      this.tracker.patterns.set(key, pattern);
    }

    pattern.accessCount++;
    pattern.lastAccess = entry.timestamp;
    pattern.score = this.calculateScore(pattern);

    // Update trend
    const oldScore = pattern.score;
    pattern.score = this.calculateScore(pattern);
    const scoreChange = (pattern.score - oldScore) / oldScore;

    if (scoreChange > this.config.trendThreshold) {
      pattern.trend = 'rising';
    } else if (scoreChange < -this.config.trendThreshold) {
      pattern.trend = 'falling';
    } else {
      pattern.trend = 'stable';
    }

    // Add to history
    this.tracker.accessHistory.push(entry);
    this.tracker.totalAccesses++;

    // Cleanup old entries periodically
    if (Date.now() - this.tracker.lastCleanup > 60000) {
      await this.cleanup();
    }

    // Persist to KV
    await this.persistTracker();
  }

  /**
   * Get popular content patterns that should be warmed
   */
  async getPopularContent(limit: number = 50): Promise<PopularContentPattern[]> {
    const now = Date.now();
    const threshold = now - this.config.timeWindow;

    // Filter patterns by minimum access count and time window
    const popularPatterns = Array.from(this.tracker.patterns.values())
      .filter((p) => p.accessCount >= this.config.minAccessCount && p.lastAccess > threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return popularPatterns;
  }

  /**
   * Warm the cache with popular content
   */
  async warmCache(limit: number = 50): Promise<WarmingResult[]> {
    if (this.processing) {
      throw new Error('Warming already in progress');
    }

    this.processing = true;
    const results: WarmingResult[] = [];

    try {
      const popularContent = await this.getPopularContent(limit);
      console.log(`Found ${popularContent.length} popular content items to warm`);

      // Create tasks
      for (const content of popularContent) {
        const task: WarmingTask = {
          id: crypto.randomUUID(),
          type: 'popular-content',
          url: content.url,
          method: content.method,
          priority: Math.round(content.score * 100),
          status: 'pending',
          attempts: 0,
        };
        this.taskQueue.push(task);
      }

      // Sort by priority
      this.taskQueue.sort((a, b) => b.priority - a.priority);

      // Process tasks in batches
      while (this.taskQueue.length > 0) {
        const batch = this.taskQueue.splice(0, this.config.batchSize);
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);
      }

      console.log(`Completed warming ${results.length} items`);
      return results;
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a batch of warming tasks
   */
  private async processBatch(tasks: WarmingTask[]): Promise<WarmingResult[]> {
    const results: WarmingResult[] = [];

    // Process tasks concurrently
    const concurrency = Math.min(tasks.length, this.config.maxConcurrent);
    const batches: WarmingTask[][] = [];

    for (let i = 0; i < tasks.length; i += concurrency) {
      batches.push(tasks.slice(i, i + concurrency));
    }

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map((task) => this.processTask(task))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Process a single warming task
   */
  private async processTask(task: WarmingTask): Promise<WarmingResult> {
    this.activeTasks.set(task.id, { ...task, status: 'in-progress', startedAt: Date.now() });

    const startTime = Date.now();
    let attempts = 0;
    let lastError: string | undefined;

    while (attempts < this.config.retryAttempts) {
      try {
        const result = await this.fetchAndCache(task);

        this.activeTasks.set(task.id, {
          ...task,
          status: 'completed',
          completedAt: Date.now(),
          attempts: attempts + 1,
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        attempts++;

        if (attempts < this.config.retryAttempts) {
          const delay = Math.min(
            1000 * Math.pow(this.config.backoffMultiplier, attempts),
            30000
          );
          await this.sleep(delay);
        }
      }
    }

    this.activeTasks.set(task.id, {
      ...task,
      status: 'failed',
      attempts,
      error: lastError,
    });

    return {
      taskId: task.id,
      success: false,
      duration: Date.now() - startTime,
      cached: false,
      cacheKey: '',
      tier: 'warm',
      size: 0,
      metadata: {},
    };
  }

  /**
   * Fetch content and cache it
   */
  private async fetchAndCache(task: WarmingTask): Promise<WarmingResult> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(task.url, task.method);

    try {
      // Fetch the content
      const response = await fetch(task.url, {
        method: task.method,
        headers: {
          'User-Agent': 'ClaudeFlare-Cache-Warmer/1.0',
          'X-Cache-Warm': 'true',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get content
      const content = await response.arrayBuffer();
      const size = content.byteLength;

      // Store in KV cache
      const metadata = {
        cachedAt: Date.now(),
        url: task.url,
        method: task.method,
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        size,
      };

      await this.kv.put(cacheKey, content, {
        metadata,
        expirationTtl: 3600, // 1 hour
      });

      return {
        taskId: task.id,
        success: true,
        duration: Date.now() - startTime,
        cached: true,
        cacheKey,
        tier: 'warm',
        size,
        metadata,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Calculate popularity score for a pattern
   */
  private calculateScore(pattern: PopularContentPattern): number {
    const now = Date.now();
    const age = now - pattern.lastAccess;
    const ageFactor = Math.max(0, 1 - age / this.config.timeWindow);

    // Score = accessCount * ageFactor * trendMultiplier
    let trendMultiplier = 1;
    if (pattern.trend === 'rising') {
      trendMultiplier = 1.5;
    } else if (pattern.trend === 'falling') {
      trendMultiplier = 0.5;
    }

    return pattern.accessCount * ageFactor * trendMultiplier;
  }

  /**
   * Get cache key for a URL and method
   */
  private getCacheKey(url: string, method: string): string {
    return `warm:${method}:${url}`;
  }

  /**
   * Get access tracking key
   */
  private getAccessKey(url: string, method: string): string {
    return `${method}:${url}`;
  }

  /**
   * Cleanup old access entries
   */
  private async cleanup(): Promise<void> {
    const now = Date.now();
    const threshold = now - this.config.timeWindow * 2; // Keep 2x window

    this.tracker.accessHistory = this.tracker.accessHistory.filter(
      (entry) => entry.timestamp > threshold
    );

    // Remove old patterns
    for (const [key, pattern] of this.tracker.patterns.entries()) {
      if (pattern.lastAccess < threshold) {
        this.tracker.patterns.delete(key);
      }
    }

    this.tracker.lastCleanup = now;
  }

  /**
   * Persist tracker state to KV
   */
  private async persistTracker(): Promise<void> {
    const data = {
      patterns: Array.from(this.tracker.patterns.entries()),
      totalAccesses: this.tracker.totalAccesses,
      lastCleanup: this.tracker.lastCleanup,
    };

    await this.kv.put('popular-content:tracker', JSON.stringify(data), {
      expirationTtl: 86400, // 24 hours
    });
  }

  /**
   * Load tracker state from KV
   */
  async loadTracker(): Promise<void> {
    const data = await this.kv.get('popular-content:tracker', 'json');
    if (data && typeof data === 'object') {
      const trackerData = data as {
        patterns: [string, PopularContentPattern][];
        totalAccesses: number;
        lastCleanup: number;
      };

      this.tracker.patterns = new Map(trackerData.patterns);
      this.tracker.totalAccesses = trackerData.totalAccesses;
      this.tracker.lastCleanup = trackerData.lastCleanup;
    }
  }

  /**
   * Get warming statistics
   */
  getStats() {
    return {
      totalPatterns: this.tracker.patterns.size,
      totalAccesses: this.tracker.totalAccesses,
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
      isProcessing: this.processing,
      lastCleanup: this.tracker.lastCleanup,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a popular content warmer instance
 */
export function createPopularContentWarmer(
  kv: KVNamespace,
  config?: Partial<PopularContentConfig>
): PopularContentWarmer {
  return new PopularContentWarmer(kv, config);
}
