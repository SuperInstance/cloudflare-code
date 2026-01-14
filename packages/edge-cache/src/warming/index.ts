/**
 * Cache Warming Module
 *
 * Orchestrates various cache warming strategies including:
 * - Popular content warming
 * - Time-based warming
 * - Geographic warming
 * - User-based warming
 * - API endpoint warming
 */

export { PopularContentWarmer, createPopularContentWarmer } from './popular-content';
export { TimeBasedWarmer, createTimeBasedWarmer, createDailySchedule, createHourlySchedule } from './time-based';
export { GeographicWarmer, createGeographicWarmer, COMMON_REGIONS } from './geographic';

import type {
  WarmingStrategy,
  WarmingTask,
  WarmingResult,
  CacheTier,
  EdgeCacheEnv,
} from '../types';
import { PopularContentWarmer } from './popular-content';
import { TimeBasedWarmer } from './time-based';
import { GeographicWarmer } from './geographic';

/**
 * Unified Cache Warming Manager
 *
 * Coordinates multiple warming strategies and provides
 * a single interface for cache warming operations.
 */
export class CacheWarmingManager {
  private env: EdgeCacheEnv;
  private popularWarmer: PopularContentWarmer;
  private timeWarmer: TimeBasedWarmer;
  private geoWarmer: GeographicWarmer;
  private enabledStrategies: Set<string>;

  constructor(env: EdgeCacheEnv) {
    this.env = env;
    this.popularWarmer = new PopularContentWarmer(env.CACHE_KV);
    this.timeWarmer = new TimeBasedWarmer(env.CACHE_KV);
    this.geoWarmer = new GeographicWarmer(env.CACHE_KV);
    this.enabledStrategies = new Set(['popular', 'time-based', 'geographic']);
  }

  /**
   * Initialize the warming manager
   */
  async initialize(): Promise<void> {
    // Load state from KV
    await this.popularWarmer.loadTracker();

    // Start time-based warmer
    if (this.enabledStrategies.has('time-based')) {
      await this.timeWarmer.start();
    }

    console.log('Cache warming manager initialized');
  }

  /**
   * Warm cache using all enabled strategies
   */
  async warmAll(limit: number = 50): Promise<{
    popular: WarmingResult[];
    timeBased: Map<string, WarmingResult[]>;
    geographic: Map<string, WarmingResult[]>;
  }> {
    const results = {
      popular: [] as WarmingResult[],
      timeBased: new Map<string, WarmingResult[]>(),
      geographic: new Map<string, WarmingResult[]>(),
    };

    // Popular content warming
    if (this.enabledStrategies.has('popular')) {
      try {
        results.popular = await this.popularWarmer.warmCache(limit);
      } catch (error) {
        console.error('Popular content warming failed:', error);
      }
    }

    // Time-based warming runs automatically, just get history
    if (this.enabledStrategies.has('time-based')) {
      const history = this.timeWarmer.getExecutionHistory();
      for (const execution of history) {
        results.timeBased.set(execution.scheduleId, execution.results);
      }
    }

    // Geographic warming
    if (this.enabledStrategies.has('geographic')) {
      try {
        results.geographic = await this.geoWarmer.warmAllRegions();
      } catch (error) {
        console.error('Geographic warming failed:', error);
      }
    }

    return results;
  }

  /**
   * Get warming statistics
   */
  getStats() {
    return {
      popular: this.popularWarmer.getStats(),
      timeBased: this.timeWarmer.getStats(),
      geographic: this.geoWarmer.getStats(),
      enabledStrategies: Array.from(this.enabledStrategies),
    };
  }

  /**
   * Enable a warming strategy
   */
  enableStrategy(strategy: string): void {
    this.enabledStrategies.add(strategy);
    if (strategy === 'time-based') {
      this.timeWarmer.start();
    }
  }

  /**
   * Disable a warming strategy
   */
  disableStrategy(strategy: string): void {
    this.enabledStrategies.delete(strategy);
    if (strategy === 'time-based') {
      this.timeWarmer.stop();
    }
  }

  /**
   * Shutdown the warming manager
   */
  async shutdown(): Promise<void> {
    this.timeWarmer.stop();
    console.log('Cache warming manager shutdown');
  }
}

/**
 * Create a cache warming manager
 */
export function createCacheWarmingManager(env: EdgeCacheEnv): CacheWarmingManager {
  return new CacheWarmingManager(env);
}
