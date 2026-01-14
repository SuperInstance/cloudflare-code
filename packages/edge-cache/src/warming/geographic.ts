/**
 * Geographic Cache Warming Strategy
 *
 * Warms caches based on geographic regions to ensure
 * content is available close to users worldwide.
 */

import type {
  GeographicRegion,
  WarmingTask,
  WarmingResult,
  CacheTier,
} from '../types';

export interface GeographicConfig {
  regions: GeographicRegion[];
  maxConcurrent: number;
  retryAttempts: number;
  backoffMultiplier: number;
  defaultRegion: string;
}

export interface RegionWarmingStatus {
  region: string;
  datacenter: string;
  totalUrls: number;
  completedUrls: number;
  failedUrls: number;
  lastUpdate: number;
}

/**
 * Geographic Cache Warmer
 *
 * Distributes cache warming across geographic regions
 * to ensure low latency access worldwide.
 */
export class GeographicWarmer {
  private kv: KVNamespace;
  private config: GeographicConfig;
  private regionStatus: Map<string, RegionWarmingStatus>;
  private activeTasks: Map<string, WarmingTask>;

  constructor(kv: KVNamespace, config: Partial<GeographicConfig> = {}) {
    this.kv = kv;
    this.config = {
      regions: [],
      maxConcurrent: 5,
      retryAttempts: 3,
      backoffMultiplier: 2,
      defaultRegion: 'us-east',
      ...config,
    };

    this.regionStatus = new Map();
    this.activeTasks = new Map();

    // Initialize region status
    for (const region of this.config.regions) {
      this.regionStatus.set(region.country, {
        region: region.country,
        datacenter: region.datacenter,
        totalUrls: region.warmUrls.length,
        completedUrls: 0,
        failedUrls: 0,
        lastUpdate: Date.now(),
      });
    }
  }

  /**
   * Warm caches for a specific region
   */
  async warmRegion(countryCode: string): Promise<WarmingResult[]> {
    const region = this.config.regions.find((r) => r.country === countryCode);
    if (!region) {
      throw new Error(`Region ${countryCode} not found`);
    }

    const results: WarmingResult[] = [];
    const status = this.regionStatus.get(countryCode)!;

    // Reset counters
    status.completedUrls = 0;
    status.failedUrls = 0;

    // Create tasks
    const tasks: WarmingTask[] = region.warmUrls.map((url) => ({
      id: crypto.randomUUID(),
      type: 'geographic',
      url,
      method: 'GET',
      priority: region.priority,
      status: 'pending',
      attempts: 0,
    }));

    // Execute tasks with concurrency control
    for (let i = 0; i < tasks.length; i += this.config.maxConcurrent) {
      const batch = tasks.slice(i, i + this.config.maxConcurrent);
      const batchResults = await Promise.all(
        batch.map((task) => this.executeTask(task, region))
      );
      results.push(...batchResults);

      // Update status
      for (const result of batchResults) {
        if (result.success) {
          status.completedUrls++;
        } else {
          status.failedUrls++;
        }
      }
      status.lastUpdate = Date.now();
    }

    return results;
  }

  /**
   * Warm caches for all regions
   */
  async warmAllRegions(): Promise<Map<string, WarmingResult[]>> {
    const allResults = new Map<string, WarmingResult[]>();

    // Warm each region
    for (const region of this.config.regions) {
      try {
        const results = await this.warmRegion(region.country);
        allResults.set(region.country, results);
      } catch (error) {
        console.error(`Error warming region ${region.country}:`, error);
        allResults.set(region.country, []);
      }
    }

    return allResults;
  }

  /**
   * Execute a single warming task for a region
   */
  private async executeTask(
    task: WarmingTask,
    region: GeographicRegion
  ): Promise<WarmingResult> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: string | undefined;

    while (attempts < this.config.retryAttempts) {
      try {
        const cacheKey = `geo-warm:${region.country}:${task.url}`;

        // Fetch content targeting the region's datacenter
        const response = await fetch(task.url, {
          method: task.method,
          headers: {
            'User-Agent': 'ClaudeFlare-Geographic-Warmer/1.0',
            'X-Cache-Warm': 'true',
            'X-Target-Region': region.country,
            'X-Target-Datacenter': region.datacenter,
            'CF-IPCountry': region.country,
          },
          cf: {
            resolveOverride: region.datacenter,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const content = await response.arrayBuffer();
        const size = content.byteLength;

        // Cache with region-specific metadata
        const metadata = {
          cachedAt: Date.now(),
          url: task.url,
          method: task.method,
          statusCode: response.status,
          size,
          region: region.country,
          datacenter: region.datacenter,
          servedFrom: response.headers.get('CF-Cache-Status') || 'UNKNOWN',
        };

        await this.kv.put(cacheKey, content, {
          metadata,
          expirationTtl: 3600,
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

    return {
      taskId: task.id,
      success: false,
      duration: Date.now() - startTime,
      cached: false,
      cacheKey: '',
      tier: 'warm',
      size: 0,
      metadata: { error: lastError },
    };
  }

  /**
   * Get status for all regions
   */
  getRegionStatus(): RegionWarmingStatus[] {
    return Array.from(this.regionStatus.values());
  }

  /**
   * Get status for a specific region
   */
  getRegionStatus(countryCode: string): RegionWarmingStatus | undefined {
    return this.regionStatus.get(countryCode);
  }

  /**
   * Add a new region
   */
  async addRegion(region: GeographicRegion): Promise<void> {
    this.config.regions.push(region);
    this.regionStatus.set(region.country, {
      region: region.country,
      datacenter: region.datacenter,
      totalUrls: region.warmUrls.length,
      completedUrls: 0,
      failedUrls: 0,
      lastUpdate: Date.now(),
    });
    await this.persistConfig();
  }

  /**
   * Remove a region
   */
  async removeRegion(countryCode: string): Promise<void> {
    this.config.regions = this.config.regions.filter((r) => r.country !== countryCode);
    this.regionStatus.delete(countryCode);
    await this.persistConfig();
  }

  /**
   * Update a region
   */
  async updateRegion(region: GeographicRegion): Promise<void> {
    const index = this.config.regions.findIndex((r) => r.country === region.country);
    if (index === -1) {
      throw new Error(`Region ${region.country} not found`);
    }
    this.config.regions[index] = region;
    this.regionStatus.set(region.country, {
      region: region.country,
      datacenter: region.datacenter,
      totalUrls: region.warmUrls.length,
      completedUrls: 0,
      failedUrls: 0,
      lastUpdate: Date.now(),
    });
    await this.persistConfig();
  }

  /**
   * Get closest region for a geography
   */
  getClosestRegion(countryCode: string): GeographicRegion | undefined {
    // First try exact match
    let region = this.config.regions.find((r) => r.country === countryCode);
    if (region) {
      return region;
    }

    // Fallback to default region
    return this.config.regions.find((r) => r.country === this.config.defaultRegion);
  }

  /**
   * Persist configuration to KV
   */
  private async persistConfig(): Promise<void> {
    await this.kv.put('geographic:config', JSON.stringify(this.config), {
      expirationTtl: 86400 * 7, // 7 days
    });
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalRegions: this.config.regions.length,
      regionStatus: Array.from(this.regionStatus.values()),
      activeTasks: this.activeTasks.size,
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
 * Create a geographic warmer instance
 */
export function createGeographicWarmer(
  kv: KVNamespace,
  config?: Partial<GeographicConfig>
): GeographicWarmer {
  return new GeographicWarmer(kv, config);
}

/**
 * Common geographic regions
 */
export const COMMON_REGIONS: GeographicRegion[] = [
  {
    country: 'US',
    region: 'North America',
    city: 'New York',
    datacenter: 'ewr',
    warmUrls: [],
    priority: 100,
  },
  {
    country: 'GB',
    region: 'Europe',
    city: 'London',
    datacenter: 'lhr',
    warmUrls: [],
    priority: 90,
  },
  {
    country: 'DE',
    region: 'Europe',
    city: 'Frankfurt',
    datacenter: 'fra',
    warmUrls: [],
    priority: 85,
  },
  {
    country: 'JP',
    region: 'Asia',
    city: 'Tokyo',
    datacenter: 'nrt',
    warmUrls: [],
    priority: 80,
  },
  {
    country: 'SG',
    region: 'Asia',
    city: 'Singapore',
    datacenter: 'sin',
    warmUrls: [],
    priority: 75,
  },
  {
    country: 'AU',
    region: 'Oceania',
    city: 'Sydney',
    datacenter: 'syd',
    warmUrls: [],
    priority: 70,
  },
  {
    country: 'IN',
    region: 'Asia',
    city: 'Mumbai',
    datacenter: 'bom',
    warmUrls: [],
    priority: 65,
  },
  {
    country: 'BR',
    region: 'South America',
    city: 'São Paulo',
    datacenter: 'gru',
    warmUrls: [],
    priority: 60,
  },
];
