/**
 * Edge Optimizer - Edge computing and optimization for Cloudflare Workers
 *
 * Features:
 * - Edge function integration and deployment
 * - Edge caching strategies
 * - Request routing to nearest edge
 * - Response optimization
 * - Sub-millisecond latency targeting
 */

import {
  EdgeFunction,
  EdgeFunctionConfig,
  EdgeCacheConfig,
  CacheKeyConfig,
  GatewayError,
  ServiceDefinition,
  GatewayRequest,
  GatewayResponse,
} from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface EdgeOptimizerConfig {
  enabled: boolean;
  defaultRegion: string;
  cache: EdgeCacheConfig;
  routing: EdgeRoutingConfig;
  functions: EdgeFunction[];
  metrics: {
    enabled: boolean;
  };
}

export interface EdgeRoutingConfig {
  strategy: 'latency' | 'geo' | 'round-robin' | 'weighted';
  regions: RegionInfo[];
  healthCheck: boolean;
  healthCheckInterval: number;
}

export interface RegionInfo {
  name: string;
  code: string;
  endpoint: string;
  latitude: number;
  longitude: number;
  weight?: number;
  latency?: number;
  healthy: boolean;
}

export interface EdgeRequestContext {
  region: string;
  datacenter?: string;
  latitude?: number;
  longitude?: string;
  latency?: number;
}

export interface EdgeCacheEntry {
  key: string;
  value: unknown;
  metadata: CacheMetadata;
  expiresAt: number;
  size: number;
  tags: string[];
}

export interface CacheMetadata {
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  edgeLocation: string;
  compressed: boolean;
  etag?: string;
}

export interface EdgeMetrics {
  totalRequests: number;
  edgeHits: number;
  edgeMisses: number;
  cacheHitRate: number;
  averageLatency: number;
  regionDistribution: Map<string, number>;
  functionExecutions: Map<string, number>;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CACHE_TTL = 3600000; // 1 hour
const DEFAULT_MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
const COMPRESS_THRESHOLD = 1024; // 1KB

// ============================================================================
// Edge Optimizer
// ============================================================================

export class EdgeOptimizer {
  private config: EdgeOptimizerConfig;
  private cache: Map<string, EdgeCacheEntry>;
  private cacheSize: number;
  private maxCacheSize: number;
  private functions: Map<string, EdgeFunction>;
  private metrics: EdgeMetrics;
  private regionSelector: RegionSelector;
  private healthChecker?: EdgeHealthChecker;

  constructor(config: Partial<EdgeOptimizerConfig> = {}) {
    this.config = {
      enabled: true,
      defaultRegion: 'us-east-1',
      cache: {
        enabled: true,
        ttl: DEFAULT_CACHE_TTL,
        purgeKeys: [],
        cacheKeys: [],
      },
      routing: {
        strategy: 'latency',
        regions: [],
        healthCheck: true,
        healthCheckInterval: 30000,
      },
      functions: [],
      metrics: {
        enabled: true,
      },
      ...config,
    };

    this.cache = new Map();
    this.cacheSize = 0;
    this.maxCacheSize = DEFAULT_MAX_CACHE_SIZE;
    this.functions = new Map();
    this.metrics = {
      totalRequests: 0,
      edgeHits: 0,
      edgeMisses: 0,
      cacheHitRate: 0,
      averageLatency: 0,
      regionDistribution: new Map(),
      functionExecutions: new Map(),
    };

    this.regionSelector = new RegionSelector(this.config.routing);

    if (this.config.routing.healthCheck) {
      this.healthChecker = new EdgeHealthChecker(this.config.routing);
    }

    // Register functions
    for (const fn of this.config.functions) {
      this.functions.set(fn.id, fn);
    }
  }

  /**
   * Optimize request for edge execution
   */
  async optimizeRequest(
    request: GatewayRequest,
    context: EdgeRequestContext
  ): Promise<OptimizedRequest> {
    const startTime = performance.now();

    try {
      // Select optimal region
      const region = await this.selectRegion(request, context);

      // Check cache
      const cacheKey = this.generateCacheKey(request, context);
      const cached = await this.get(cacheKey);

      if (cached) {
        this.metrics.edgeHits++;
        this.updateMetrics(performance.now() - startTime, region.name);

        return {
          request,
          region: region.name,
          cached: true,
          data: cached.value,
          metadata: cached.metadata,
        };
      }

      this.metrics.edgeMisses++;
      this.updateMetrics(performance.now() - startTime, region.name);

      return {
        request,
        region: region.name,
        cached: false,
      };
    } catch (error) {
      throw new GatewayError(
        `Edge optimization failed: ${(error as Error).message}`,
        'EDGE_OPTIMIZATION_FAILED'
      );
    }
  }

  /**
   * Optimize response for edge caching
   */
  async optimizeResponse(
    response: GatewayResponse,
    cacheConfig?: EdgeCacheConfig
  ): Promise<GatewayResponse> {
    if (!this.config.cache.enabled) {
      return response;
    }

    const config = cacheConfig || this.config.cache;

    // Check if response is cacheable
    if (!this.isCacheable(response)) {
      return response;
    }

    // Compress if beneficial
    const compressed = await this.compressResponse(response);

    // Add cache headers
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', `max-age=${config.ttl / 1000}`);
    headers.set('X-Edge-Cache', 'HIT');

    return {
      ...response,
      headers,
      body: compressed.body,
    };
  }

  /**
   * Execute edge function
   */
  async executeFunction(
    functionId: string,
    input: unknown,
    context: EdgeRequestContext
  ): Promise<unknown> {
    const fn = this.functions.get(functionId);
    if (!fn) {
      throw new GatewayError(
        `Edge function not found: ${functionId}`,
        'FUNCTION_NOT_FOUND',
        404
      );
    }

    // Check if function is available in region
    if (!fn.regions.includes(context.region) && !fn.regions.includes('*')) {
      throw new GatewayError(
        `Function ${functionId} not available in region ${context.region}`,
        'FUNCTION_NOT_AVAILABLE',
        400
      );
    }

    const startTime = performance.now();

    try {
      // Execute function with timeout
      const result = await this.executeWithTimeout(fn, input, context);

      const duration = performance.now() - startTime;

      // Track metrics
      if (this.config.metrics.enabled) {
        const executions = this.metrics.functionExecutions.get(functionId) || 0;
        this.metrics.functionExecutions.set(functionId, executions + 1);
      }

      return result;
    } catch (error) {
      throw new GatewayError(
        `Edge function execution failed: ${(error as Error).message}`,
        'FUNCTION_EXECUTION_FAILED'
      );
    }
  }

  /**
   * Cache response at edge
   */
  async set(
    key: string,
    value: unknown,
    options?: CacheOptions
  ): Promise<void> {
    if (!this.config.cache.enabled) {
      return;
    }

    const ttl = options?.ttl || this.config.cache.ttl;
    const tags = options?.tags || [];
    const region = options?.region || this.config.defaultRegion;

    const size = this.calculateSize(value);

    // Evict if necessary
    await this.ensureCapacity(size);

    const metadata: CacheMetadata = {
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
      edgeLocation: region,
      compressed: options?.compress || false,
      etag: options?.etag,
    };

    const entry: EdgeCacheEntry = {
      key,
      value,
      metadata,
      expiresAt: Date.now() + ttl,
      size,
      tags,
    };

    this.cache.set(key, entry);
    this.cacheSize += size;
  }

  /**
   * Get from edge cache
   */
  async get(key: string): Promise<EdgeCacheEntry | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.cacheSize -= entry.size;
      return null;
    }

    // Update metadata
    entry.metadata.accessedAt = Date.now();
    entry.metadata.accessCount++;

    return entry;
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(pattern?: string, tags?: string[]): Promise<number> {
    let invalidated = 0;

    if (pattern) {
      const regex = new RegExp(pattern);
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          const entry = this.cache.get(key)!;
          this.cache.delete(key);
          this.cacheSize -= entry.size;
          invalidated++;
        }
      }
    }

    if (tags) {
      for (const [key, entry] of this.cache) {
        if (tags.some((tag) => entry.tags.includes(tag))) {
          this.cache.delete(key);
          this.cacheSize -= entry.size;
          invalidated++;
        }
      }
    }

    return invalidated;
  }

  /**
   * Purge all cache
   */
  async purge(): Promise<void> {
    this.cache.clear();
    this.cacheSize = 0;
  }

  /**
   * Get metrics
   */
  getMetrics(): EdgeMetrics {
    const hitRate =
      this.metrics.totalRequests > 0
        ? this.metrics.edgeHits / this.metrics.totalRequests
        : 0;

    return {
      ...this.metrics,
      cacheHitRate: hitRate,
      regionDistribution: new Map(this.metrics.regionDistribution),
      functionExecutions: new Map(this.metrics.functionExecutions),
    };
  }

  /**
   * Add edge function
   */
  addFunction(fn: EdgeFunction): void {
    this.functions.set(fn.id, fn);
  }

  /**
   * Remove edge function
   */
  removeFunction(functionId: string): boolean {
    return this.functions.delete(functionId);
  }

  /**
   * Warm up cache
   */
  async warmup(keys: string[], fetcher: (key: string) => Promise<unknown>): Promise<void> {
    const promises = keys.map(async (key) => {
      try {
        const value = await fetcher(key);
        await this.set(key, value);
      } catch (error) {
        // Log error but continue with other keys
        console.error(`Cache warmup failed for key ${key}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async selectRegion(
    request: GatewayRequest,
    context: EdgeRequestContext
  ): Promise<RegionInfo> {
    return this.regionSelector.select(request, context);
  }

  private generateCacheKey(
    request: GatewayRequest,
    context: EdgeRequestContext
  ): string {
    const parts = [
      request.method,
      request.url,
      context.region,
      // Add headers, query params, etc. based on cache key config
    ];

    return parts.join(':');
  }

  private isCacheable(response: GatewayResponse): boolean {
    // Check status code
    if (response.status !== 200) {
      return false;
    }

    // Check cache-control header
    const cacheControl = response.headers.get('Cache-Control');
    if (cacheControl?.includes('no-store') || cacheControl?.includes('private')) {
      return false;
    }

    // Check authorization
    if (response.headers.has('Authorization')) {
      return false;
    }

    return true;
  }

  private async compressResponse(
    response: GatewayResponse
  ): Promise<GatewayResponse> {
    if (!response.body || typeof response.body === 'string') {
      return response;
    }

    // In a real implementation, would use CompressionStream
    // For now, just return the response as-is
    return response;
  }

  private calculateSize(value: unknown): number {
    return JSON.stringify(value).length * 2; // Rough estimation for UTF-16
  }

  private async ensureCapacity(requiredSize: number): Promise<void> {
    if (this.cacheSize + requiredSize <= this.maxCacheSize) {
      return;
    }

    // Evict entries using LRU
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].metadata.accessedAt - b[1].metadata.accessedAt);

    let freed = 0;
    for (const [key, entry] of entries) {
      this.cache.delete(key);
      this.cacheSize -= entry.size;
      freed += entry.size;

      if (this.cacheSize + requiredSize <= this.maxCacheSize) {
        break;
      }
    }
  }

  private async executeWithTimeout(
    fn: EdgeFunction,
    input: unknown,
    context: EdgeRequestContext
  ): Promise<unknown> {
    const timeout = fn.timeout || 10000;

    return Promise.race([
      this.executeFunctionInternal(fn, input, context),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Function execution timeout')), timeout)
      ),
    ]);
  }

  private async executeFunctionInternal(
    fn: EdgeFunction,
    input: unknown,
    context: EdgeRequestContext
  ): Promise<unknown> {
    // In a real implementation, this would execute the edge function
    // For now, return a placeholder
    return { executed: fn.id, input, region: context.region };
  }

  private updateMetrics(latency: number, region: string): void {
    if (!this.config.metrics.enabled) {
      return;
    }

    this.metrics.totalRequests++;

    // Update average latency
    const currentAvg = this.metrics.averageLatency;
    const count = this.metrics.totalRequests;
    this.metrics.averageLatency = (currentAvg * (count - 1) + latency) / count;

    // Update region distribution
    const regionCount = this.metrics.regionDistribution.get(region) || 0;
    this.metrics.regionDistribution.set(region, regionCount + 1);
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface OptimizedRequest {
  request: GatewayRequest;
  region: string;
  cached: boolean;
  data?: unknown;
  metadata?: CacheMetadata;
}

interface CacheOptions {
  ttl?: number;
  tags?: string[];
  region?: string;
  compress?: boolean;
  etag?: string;
}

// ============================================================================
// Region Selector
// ============================================================================

class RegionSelector {
  private config: EdgeRoutingConfig;
  private roundRobinIndex: number = 0;

  constructor(config: EdgeRoutingConfig) {
    this.config = config;
  }

  async select(
    request: GatewayRequest,
    context: EdgeRequestContext
  ): Promise<RegionInfo> {
    const healthyRegions = this.config.regions.filter((r) => r.healthy);

    if (healthyRegions.length === 0) {
      // Fallback to default region
      return this.config.regions[0];
    }

    switch (this.config.strategy) {
      case 'latency':
        return this.selectByLatency(healthyRegions, context);

      case 'geo':
        return this.selectByGeo(healthyRegions, context);

      case 'weighted':
        return this.selectByWeight(healthyRegions);

      case 'round-robin':
        return this.selectByRoundRobin(healthyRegions);

      default:
        return healthyRegions[0];
    }
  }

  private selectByLatency(regions: RegionInfo[], context: EdgeRequestContext): RegionInfo {
    // Select region with lowest latency
    return regions.reduce((best, current) => {
      if (!best.latency || (current.latency && current.latency < best.latency)) {
        return current;
      }
      return best;
    });
  }

  private selectByGeo(regions: RegionInfo[], context: EdgeRequestContext): RegionInfo {
    if (!context.latitude || !context.longitude) {
      return regions[0];
    }

    // Calculate distance and select nearest region
    let nearest = regions[0];
    let minDistance = Infinity;

    for (const region of regions) {
      const distance = this.calculateDistance(
        context.latitude,
        parseFloat(context.longitude as string),
        region.latitude,
        region.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = region;
      }
    }

    return nearest;
  }

  private selectByWeight(regions: RegionInfo[]): RegionInfo {
    const totalWeight = regions.reduce((sum, r) => sum + (r.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const region of regions) {
      random -= region.weight || 1;
      if (random <= 0) {
        return region;
      }
    }

    return regions[0];
  }

  private selectByRoundRobin(regions: RegionInfo[]): RegionInfo {
    const region = regions[this.roundRobinIndex % regions.length];
    this.roundRobinIndex++;
    return region;
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

// ============================================================================
// Edge Health Checker
// ============================================================================

class EdgeHealthChecker {
  private config: EdgeRoutingConfig;
  private timer?: number;

  constructor(config: EdgeRoutingConfig) {
    this.config = config;
    this.start();
  }

  private start(): void {
    this.timer = window.setInterval(() => {
      this.checkHealth();
    }, this.config.healthCheckInterval) as unknown as number;
  }

  private async checkHealth(): Promise<void> {
    const checks = this.config.regions.map(async (region) => {
      try {
        const start = performance.now();
        const response = await fetch(region.endpoint, {
          method: 'HEAD',
          cache: 'no-cache',
        });
        const latency = performance.now() - start;

        region.healthy = response.ok;
        region.latency = latency;
      } catch {
        region.healthy = false;
      }
    });

    await Promise.allSettled(checks);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}

// ============================================================================
// Edge Function Runtime
// ============================================================================

export class EdgeFunctionRuntime {
  private functions: Map<string, EdgeFunction>;

  constructor() {
    this.functions = new Map();
  }

  /**
   * Register edge function
   */
  register(fn: EdgeFunction): void {
    this.functions.set(fn.id, fn);
  }

  /**
   * Unregister edge function
   */
  unregister(functionId: string): boolean {
    return this.functions.delete(functionId);
  }

  /**
   * Execute function
   */
  async execute(
    functionId: string,
    input: unknown,
    context: EdgeRequestContext
  ): Promise<unknown> {
    const fn = this.functions.get(functionId);
    if (!fn) {
      throw new GatewayError(
        `Function not found: ${functionId}`,
        'FUNCTION_NOT_FOUND',
        404
      );
    }

    // In a real implementation, this would:
    // 1. Load the function code
    // 2. Create a sandboxed environment
    // 3. Execute the function with the input
    // 4. Return the result

    return {
      functionId,
      input,
      region: context.region,
      timestamp: Date.now(),
    };
  }

  /**
   * Get function info
   */
  getFunction(functionId: string): EdgeFunction | undefined {
    return this.functions.get(functionId);
  }

  /**
   * List all functions
   */
  listFunctions(): EdgeFunction[] {
    return Array.from(this.functions.values());
  }
}

// ============================================================================
// Edge Cache Manager
// ============================================================================

export class EdgeCacheManager {
  private optimizer: EdgeOptimizer;

  constructor(optimizer: EdgeOptimizer) {
    this.optimizer = optimizer;
  }

  /**
   * Create cache key from request
   */
  createKey(request: GatewayRequest, config: EdgeCacheConfig): string {
    const parts = [request.method, request.url];

    if (config.cacheKeys) {
      for (const keyConfig of config.cacheKeys) {
        const key = this.applyKeyConfig(request, keyConfig);
        if (key) {
          parts.push(key);
        }
      }
    }

    return parts.join(':');
  }

  /**
   * Apply cache key configuration
   */
  private applyKeyConfig(
    request: GatewayRequest,
    config: CacheKeyConfig
  ): string | null {
    let value: string | null = null;

    // Apply include rules
    for (const spec of config.include) {
      switch (spec.type) {
        case 'header':
          value = request.headers.get(spec.name) || null;
          break;
        case 'cookie':
          // Extract cookie value
          break;
        case 'query':
          value = request.query.get(spec.name) || null;
          break;
        case 'custom':
          // Apply custom expression
          break;
      }

      if (value) {
        break;
      }
    }

    // Apply exclude rules
    for (const spec of config.exclude) {
      let excludeValue = false;
      switch (spec.type) {
        case 'header':
          excludeValue = request.headers.has(spec.name);
          break;
        case 'cookie':
          // Check cookie
          break;
        case 'query':
          excludeValue = request.query.has(spec.name);
          break;
        case 'custom':
          // Apply custom expression
          break;
      }

      if (excludeValue) {
        return null;
      }
    }

    return value;
  }

  /**
   * Generate cache tags from response
   */
  generateTags(response: GatewayResponse): string[] {
    const tags: string[] = [];

    // Add status code tag
    tags.push(`status:${response.status}`);

    // Add content type tag
    const contentType = response.headers.get('Content-Type');
    if (contentType) {
      tags.push(`content-type:${contentType.split(';')[0]}`);
    }

    return tags;
  }
}
