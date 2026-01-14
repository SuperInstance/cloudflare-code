/**
 * Cache Analytics
 * Track and analyze cache performance patterns
 */

import {
  AnalyticsData,
  AccessPattern,
  HotKeyEntry,
  ColdKeyEntry,
  TierMovementEntry,
  PredictionAccuracy,
  CacheTier,
  CacheStats,
} from '../types';

// ============================================================================
// Analytics Types
// ============================================================================

interface KeyAnalytics {
  key: string;
  accesses: number[];
  tier: CacheTier;
  firstSeen: number;
  lastSeen: number;
  size: number;
  hits: number;
  misses: number;
}

interface TimeWindow {
  start: number;
  end: number;
  accesses: number;
  hits: number;
  misses: number;
}

// ============================================================================
// Analytics Collector
// ============================================================================

export class AnalyticsCollector {
  private keyAnalytics = new Map<string, KeyAnalytics>();
  private tierMovements: TierMovementEntry[] = [];
  private timeWindows: TimeWindow[] = [];
  private currentWindowStart: number;
  private windowDuration = 3600000; // 1 hour
  private maxEntries = 10000;
  private maxMovements = 1000;

  constructor() {
    this.currentWindowStart = Date.now();
    this.startNewWindow();
  }

  /**
   * Record cache access
   */
  recordAccess(
    key: string,
    tier: CacheTier,
    hit: boolean,
    size: number
  ): void {
    const now = Date.now();
    let analytics = this.keyAnalytics.get(key);

    if (!analytics) {
      analytics = {
        key,
        accesses: [],
        tier,
        firstSeen: now,
        lastSeen: now,
        size,
        hits: 0,
        misses: 0,
      };
      this.keyAnalytics.set(key, analytics);

      // Trim if too many entries
      if (this.keyAnalytics.size > this.maxEntries) {
        this.trimEntries();
      }
    }

    analytics.accesses.push(now);
    analytics.lastSeen = now;
    analytics.tier = tier;

    if (hit) {
      analytics.hits++;
    } else {
      analytics.misses++;
    }

    // Keep only last 1000 accesses
    if (analytics.accesses.length > 1000) {
      analytics.accesses.shift();
    }

    // Update time window
    this.updateCurrentWindow(hit);
  }

  /**
   * Record tier movement
   */
  recordTierMovement(
    key: string,
    from: CacheTier,
    to: CacheTier,
    reason: string
  ): void {
    const movement: TierMovementEntry = {
      key,
      from,
      to,
      timestamp: Date.now(),
      reason,
    };

    this.tierMovements.push(movement);

    // Keep only recent movements
    if (this.tierMovements.length > this.maxMovements) {
      this.tierMovements.shift();
    }
  }

  /**
   * Get access pattern for a key
   */
  getAccessPattern(key: string): AccessPattern | null {
    const analytics = this.keyAnalytics.get(key);
    if (!analytics) {
      return null;
    }

    const accesses = analytics.accesses;
    if (accesses.length < 2) {
      return null;
    }

    // Calculate frequency
    const timeSpan = accesses[accesses.length - 1] - accesses[0];
    const frequency = timeSpan > 0 ? (accesses.length / timeSpan) * 1000 : 0;

    // Determine pattern type
    let pattern: AccessPattern['pattern'] = 'random';
    if (this.isPeriodic(accesses)) {
      pattern = 'periodic';
    } else if (this.isSequential(accesses)) {
      pattern = 'sequential';
    } else if (this.isBursty(accesses)) {
      pattern = 'burst';
    }

    return {
      key,
      accessCount: accesses.length,
      lastAccess: accesses[accesses.length - 1],
      firstAccess: accesses[0],
      frequency,
      pattern,
    };
  }

  /**
   * Get hot keys
   */
  getHotKeys(limit = 100): HotKeyEntry[] {
    const now = Date.now();
    const hourAgo = now - 3600000;

    const hotKeys: HotKeyEntry[] = [];

    for (const analytics of this.keyAnalytics.values()) {
      if (analytics.lastSeen < hourAgo) {
        continue;
      }

      // Calculate score based on recent activity
      const recentAccesses = analytics.accesses.filter(a => a > hourAgo);
      const score = recentAccesses.length * (analytics.hits / (analytics.hits + analytics.misses));

      // Determine trend
      const olderAccesses = analytics.accesses.filter(a => a < hourAgo && a > hourAgo - 3600000);
      let trend: 'rising' | 'stable' | 'falling' = 'stable';

      if (recentAccesses.length > olderAccesses.length * 1.5) {
        trend = 'rising';
      } else if (recentAccesses.length < olderAccesses.length * 0.5) {
        trend = 'falling';
      }

      // Recommend tier based on access frequency
      const frequency = recentAccesses.length / 3600; // per second
      let recommendedTier = CacheTier.L3;
      if (frequency > 0.1) {
        recommendedTier = CacheTier.L1;
      } else if (frequency > 0.01) {
        recommendedTier = CacheTier.L2;
      }

      hotKeys.push({
        key: analytics.key,
        score,
        trend,
        currentTier: analytics.tier,
        recommendedTier,
      });
    }

    return hotKeys
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get cold keys
   */
  getColdKeys(limit = 100): ColdKeyEntry[] {
    const now = Date.now();
    const dayAgo = now - 86400000;

    const coldKeys: ColdKeyEntry[] = [];

    for (const analytics of this.keyAnalytics.values()) {
      if (analytics.lastSeen < dayAgo) {
        coldKeys.push({
          key: analytics.key,
          lastAccess: analytics.lastSeen,
          size: analytics.size,
          tier: analytics.tier,
        });
      }
    }

    return coldKeys
      .sort((a, b) => a.lastAccess - b.lastAccess)
      .slice(0, limit);
  }

  /**
   * Get tier movements
   */
  getTierMovements(limit = 100): TierMovementEntry[] {
    return this.tierMovements.slice(-limit);
  }

  /**
   * Get time series data
   */
  getTimeSeries(): Array<{
    timestamp: number;
    accesses: number;
    hits: number;
    misses: number;
    hitRate: number;
  }> {
    return this.timeWindows.map(window => ({
      timestamp: window.start,
      accesses: window.accesses,
      hits: window.hits,
      misses: window.misses,
      hitRate: window.accesses > 0 ? window.hits / window.accesses : 0,
    }));
  }

  /**
   * Get prediction accuracy
   */
  getPredictionAccuracy(): PredictionAccuracy {
    // This would be populated by the prefetcher and warmer
    return {
      prefetch: { correct: 0, total: 0, accuracy: 0 },
      warmup: { correct: 0, total: 0, accuracy: 0 },
      eviction: { correct: 0, total: 0, accuracy: 0 },
    };
  }

  /**
   * Get complete analytics data
   */
  getAnalyticsData(): AnalyticsData {
    return {
      accessPatterns: this.getAllAccessPatterns(),
      hotKeys: this.getHotKeys(100),
      coldKeys: this.getColdKeys(100),
      tierMovements: this.getTierMovements(100),
      predictions: this.getPredictionAccuracy(),
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalKeys: number;
    totalAccesses: number;
    totalHits: number;
    totalMisses: number;
    avgHitRate: number;
    totalMovements: number;
  } {
    let totalAccesses = 0;
    let totalHits = 0;
    let totalMisses = 0;

    for (const analytics of this.keyAnalytics.values()) {
      totalAccesses += analytics.accesses.length;
      totalHits += analytics.hits;
      totalMisses += analytics.misses;
    }

    return {
      totalKeys: this.keyAnalytics.size,
      totalAccesses,
      totalHits,
      totalMisses,
      avgHitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0,
      totalMovements: this.tierMovements.length,
    };
  }

  /**
   * Clear old data
   */
  clearOld(maxAge = 604800000): void { // 7 days
    const now = Date.now();
    const threshold = now - maxAge;

    for (const [key, analytics] of this.keyAnalytics.entries()) {
      if (analytics.lastSeen < threshold) {
        this.keyAnalytics.delete(key);
      }
    }

    // Clear old time windows
    this.timeWindows = this.timeWindows.filter(w => w.start > threshold);
  }

  /**
   * Clear all analytics
   */
  clear(): void {
    this.keyAnalytics.clear();
    this.tierMovements = [];
    this.timeWindows = [];
    this.currentWindowStart = Date.now();
    this.startNewWindow();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startNewWindow(): void {
    this.timeWindows.push({
      start: this.currentWindowStart,
      end: this.currentWindowStart + this.windowDuration,
      accesses: 0,
      hits: 0,
      misses: 0,
    });

    // Keep only last 24 windows (24 hours)
    if (this.timeWindows.length > 24) {
      this.timeWindows.shift();
    }
  }

  private updateCurrentWindow(hit: boolean): void {
    const now = Date.now();

    // Check if we need a new window
    if (now > this.currentWindowStart + this.windowDuration) {
      this.currentWindowStart = now;
      this.startNewWindow();
    }

    const currentWindow = this.timeWindows[this.timeWindows.length - 1];
    currentWindow.accesses++;

    if (hit) {
      currentWindow.hits++;
    } else {
      currentWindow.misses++;
    }
  }

  private getAllAccessPatterns(): AccessPattern[] {
    const patterns: AccessPattern[] = [];

    for (const [key, analytics] of this.keyAnalytics.entries()) {
      const pattern = this.getAccessPattern(key);
      if (pattern) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private isPeriodic(accesses: number[]): boolean {
    if (accesses.length < 3) return false;

    const intervals: number[] = [];
    for (let i = 1; i < accesses.length; i++) {
      intervals.push(accesses[i] - accesses[i - 1]);
    }

    // Check if intervals are consistent
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avg, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avg;

    return cv < 0.3; // Coefficient of variation < 0.3
  }

  private isSequential(accesses: number[]): boolean {
    if (accesses.length < 3) return false;

    // Check if accesses are evenly spaced in a short time window
    let maxGap = 0;
    for (let i = 1; i < accesses.length; i++) {
      const gap = accesses[i] - accesses[i - 1];
      maxGap = Math.max(maxGap, gap);
    }

    return maxGap < 10000; // All within 10 seconds
  }

  private isBursty(accesses: number[]): boolean {
    if (accesses.length < 5) return false;

    // Look for clusters of accesses
    const clusters: number[] = [];
    let clusterStart = accesses[0];
    let clusterCount = 1;

    for (let i = 1; i < accesses.length; i++) {
      const gap = accesses[i] - accesses[i - 1];

      if (gap < 5000) { // Within 5 seconds
        clusterCount++;
      } else {
        clusters.push(clusterCount);
        clusterStart = accesses[i];
        clusterCount = 1;
      }
    }

    clusters.push(clusterCount);

    // Check if we have distinct clusters
    const avgClusterSize = clusters.reduce((a, b) => a + b, 0) / clusters.length;

    return avgClusterSize > 2; // Average cluster has more than 2 accesses
  }

  private trimEntries(): void {
    // Remove entries with oldest lastSeen
    const entries = Array.from(this.keyAnalytics.entries())
      .sort((a, b) => a[1].lastSeen - b[1].lastSeen);

    const toRemove = entries.slice(0, Math.floor(this.maxEntries * 0.1));

    for (const [key] of toRemove) {
      this.keyAnalytics.delete(key);
    }
  }
}

// ============================================================================
// Analytics Reporter
// ============================================================================

export class AnalyticsReporter {
  private analytics: AnalyticsCollector;

  constructor(analytics: AnalyticsCollector) {
    this.analytics = analytics;
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    summary: ReturnType<AnalyticsCollector['getStats']>;
    hotKeys: HotKeyEntry[];
    coldKeys: ColdKeyEntry[];
    recommendations: string[];
  } {
    const stats = this.analytics.getStats();
    const hotKeys = this.analytics.getHotKeys(20);
    const coldKeys = this.analytics.getColdKeys(20);
    const recommendations: string[] = [];

    // Generate recommendations
    if (stats.avgHitRate < 0.8) {
      recommendations.push('Hit rate is below 80%. Consider increasing cache size or adjusting TTL.');
    }

    const misplacedHotKeys = hotKeys.filter(k => k.currentTier !== k.recommendedTier);
    if (misplacedHotKeys.length > 10) {
      recommendations.push(`${misplacedHotKeys.length} hot keys are in suboptimal tiers. Consider promoting them.`);
    }

    const staleColdKeys = coldKeys.filter(k => k.tier !== CacheTier.L3);
    if (staleColdKeys.length > 10) {
      recommendations.push(`${staleColdKeys.length} cold keys are in higher tiers. Consider demoting them to L3.`);
    }

    return {
      summary: stats,
      hotKeys,
      coldKeys,
      recommendations,
    };
  }

  /**
   * Export analytics as JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.analytics.getAnalyticsData(), null, 2);
  }

  /**
   * Export analytics as CSV
   */
  exportCSV(type: 'access' | 'movements'): string {
    const data = this.analytics.getAnalyticsData();

    if (type === 'access') {
      const headers = ['key', 'accessCount', 'frequency', 'pattern', 'lastAccess'];
      const rows = data.accessPatterns.map(p => [
        p.key,
        p.accessCount,
        p.frequency.toFixed(4),
        p.pattern,
        new Date(p.lastAccess).toISOString(),
      ]);

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    } else {
      const headers = ['key', 'from', 'to', 'timestamp', 'reason'];
      const rows = data.tierMovements.map(m => [
        m.key,
        m.from,
        m.to,
        new Date(m.timestamp).toISOString(),
        m.reason,
      ]);

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createAnalyticsCollector(): AnalyticsCollector {
  return new AnalyticsCollector();
}

export function createAnalyticsReporter(
  analytics: AnalyticsCollector
): AnalyticsReporter {
  return new AnalyticsReporter(analytics);
}
