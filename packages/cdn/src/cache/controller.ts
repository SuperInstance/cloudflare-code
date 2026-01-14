/**
 * Cache Controller
 *
 * Advanced cache policy management with hierarchical caching,
 * stale-while-revalidate, and intelligent bypass rules.
 */

import { LRUCache } from 'lru-cache';
import { etag } from 'etag';
import fresh from 'fresh';
import mime from 'mime-types';
import { nanoid } from 'nanoid';
import type {
  ICachePolicy,
  ICacheRule,
  ICacheCondition,
  ICacheEntry,
  ICacheStats,
  ICacheHierarchy,
  ICacheHierarchyLevel,
  IBypassRule,
  CacheLevel,
  CacheStatus,
  IRequestContext
} from '../types/index.js';

export class CacheController {
  private policies: Map<string, ICachePolicy>;
  private rules: Map<string, ICacheRule>;
  private hierarchy: ICacheHierarchy;
  private bypassRules: Map<string, IBypassRule>;
  private cacheLevels: Map<string, LRUCache<string, ICacheEntry>>;
  private stats: ICacheStats;
  private readonly maxCacheSize: number;
  private readonly defaultTTL: number;

  constructor(config?: {
    maxCacheSize?: number;
    defaultTTL?: number;
    enableHierarchy?: boolean;
    hierarchyLevels?: number;
  }) {
    this.maxCacheSize = config?.maxCacheSize ?? 10000;
    this.defaultTTL = config?.defaultTTL ?? 3600;
    this.policies = new Map();
    this.rules = new Map();
    this.bypassRules = new Map();

    // Initialize cache hierarchy
    this.hierarchy = {
      levels: config?.enableHierarchy
        ? this.createDefaultHierarchy(config.hierarchyLevels ?? 3)
        : [this.createSingleLevel()],
      enabled: config?.enableHierarchy ?? true,
      cascade: true
    };

    // Initialize cache levels
    this.cacheLevels = new Map();
    this.initializeCacheLevels();

    // Initialize statistics
    this.stats = {
      hits: 0,
      misses: 0,
      staleHits: 0,
      bypasses: 0,
      hitRate: 0,
      missRate: 0,
      avgResponseTime: 0,
      totalBandwidth: 0,
      savedBandwidth: 0,
      compressionRatio: 0
    };
  }

  /**
   * Register a cache policy
   */
  public registerPolicy(policy: ICachePolicy): void {
    this.policies.set(policy.name, policy);
  }

  /**
   * Register a cache rule
   */
  public registerRule(rule: ICacheRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Register a bypass rule
   */
  public registerBypassRule(rule: IBypassRule): void {
    this.bypassRules.set(rule.id, rule);
  }

  /**
   * Get cache policy for a request
   */
  public getPolicyForRequest(context: IRequestContext): ICachePolicy | null {
    // Sort rules by priority (higher first)
    const sortedRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (this.matchesRule(context, rule)) {
        return rule.policy;
      }
    }

    // Return default policy if no rules match
    return this.policies.get('default') ?? null;
  }

  /**
   * Check if request should bypass cache
   */
  public shouldBypass(context: IRequestContext): boolean {
    const sortedRules = Array.from(this.bypassRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (this.matchesBypassRule(context, rule)) {
        this.stats.bypasses++;
        return true;
      }
    }

    return false;
  }

  /**
   * Generate cache key for request
   */
  public generateCacheKey(
    url: string,
    headers: Record<string, string>,
    vary?: string[]
  ): string {
    let key = url;

    // Include Vary headers in cache key
    if (vary && vary.length > 0) {
      const varyValues = vary
        .map(header => headers[header.toLowerCase()])
        .filter(Boolean)
        .join('|');

      if (varyValues) {
        key = `${key}:${varyValues}`;
      }
    }

    return key;
  }

  /**
   * Get cache entry
   */
  public async get(
    key: string,
    level: string = 'edge'
  ): Promise<ICacheEntry | null> {
    const startTime = Date.now();

    // Check each cache level in hierarchy
    for (const cacheLevel of this.hierarchy.levels) {
      const cache = this.cacheLevels.get(cacheLevel.name);
      if (!cache) continue;

      const entry = cache.get(key);

      if (entry) {
        // Check if entry is expired
        if (this.isEntryExpired(entry)) {
          // Check if stale-while-revalidate is enabled
          if (entry.ttl > 0) {
            this.stats.staleHits++;
            return entry;
          }

          cache.delete(key);
          this.stats.misses++;
          return null;
        }

        this.stats.hits++;
        entry.lastAccessed = new Date();

        return entry;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set cache entry
   */
  public async set(
    key: string,
    value: Omit<ICacheEntry, 'key' | 'createdAt' | 'lastAccessed'>,
    level: string = 'edge'
  ): Promise<void> {
    const entry: ICacheEntry = {
      key,
      ...value,
      createdAt: new Date(),
      lastAccessed: new Date()
    };

    const targetLevel = this.hierarchy.levels.find(l => l.name === level);
    if (!targetLevel) {
      throw new Error(`Cache level '${level}' not found`);
    }

    const cache = this.cacheLevels.get(level);
    if (!cache) {
      throw new Error(`Cache '${level}' not initialized`);
    }

    // Apply eviction policy if cache is full
    if (cache.size >= this.maxCacheSize) {
      this.applyEvictionPolicy(cache, targetLevel);
    }

    cache.set(key, entry);
  }

  /**
   * Delete cache entry
   */
  public async delete(key: string): Promise<void> {
    for (const cache of this.cacheLevels.values()) {
      cache.delete(key);
    }
  }

  /**
   * Clear all cache entries
   */
  public async clear(): Promise<void> {
    for (const cache of this.cacheLevels.values()) {
      cache.clear();
    }

    this.stats = {
      hits: 0,
      misses: 0,
      staleHits: 0,
      bypasses: 0,
      hitRate: 0,
      missRate: 0,
      avgResponseTime: 0,
      totalBandwidth: 0,
      savedBandwidth: 0,
      compressionRatio: 0
    };
  }

  /**
   * Delete entries by tag
   */
  public async deleteByTag(tag: string): Promise<number> {
    let deleted = 0;

    for (const cache of this.cacheLevels.values()) {
      for (const [key, entry] of cache.entries()) {
        if (entry.tags.includes(tag)) {
          cache.delete(key);
          deleted++;
        }
      }
    }

    return deleted;
  }

  /**
   * Delete entries by pattern
   */
  public async deleteByPattern(pattern: RegExp): Promise<number> {
    let deleted = 0;

    for (const cache of this.cacheLevels.values()) {
      for (const [key, entry] of cache.entries()) {
        if (pattern.test(key)) {
          cache.delete(key);
          deleted++;
        }
      }
    }

    return deleted;
  }

  /**
   * Get cache statistics
   */
  public getStats(): ICacheStats {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    this.stats.missRate = total > 0 ? (this.stats.misses / total) * 100 : 0;

    return { ...this.stats };
  }

  /**
   * Get all cache entries
   */
  public getAllEntries(level?: string): ICacheEntry[] {
    const entries: ICacheEntry[] = [];

    if (level) {
      const cache = this.cacheLevels.get(level);
      if (cache) {
        return Array.from(cache.values());
      }
    } else {
      for (const cache of this.cacheLevels.values()) {
        entries.push(...Array.from(cache.values()));
      }
    }

    return entries;
  }

  /**
   * Get cache size
   */
  public getSize(level?: string): number {
    if (level) {
      const cache = this.cacheLevels.get(level);
      return cache?.size ?? 0;
    }

    let total = 0;
    for (const cache of this.cacheLevels.values()) {
      total += cache.size;
    }

    return total;
  }

  /**
   * Generate cache headers
   */
  public generateCacheHeaders(
    policy: ICachePolicy,
    customETag?: string
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    // Cache-Control header
    const directives: string[] = [policy.policy];

    if (policy.policy !== 'no-store' && policy.policy !== 'no-cache') {
      directives.push(`max-age=${policy.ttl}`);
    }

    if (policy.staleWhileRevalidate) {
      directives.push(`stale-while-revalidate=${policy.staleWhileRevalidate}`);
    }

    if (policy.staleIfError) {
      directives.push(`stale-if-error=${policy.staleIfError}`);
    }

    if (policy.mustRevalidate) {
      directives.push('must-revalidate');
    }

    if (policy.noTransform) {
      directives.push('no-transform');
    }

    headers['Cache-Control'] = directives.join(', ');

    // ETag header
    if (customETag) {
      headers['ETag'] = customETag;
    }

    // Vary header
    if (policy.vary && policy.vary.length > 0) {
      headers['Vary'] = policy.vary.join(', ');
    }

    // Expires header (for HTTP/1.0 clients)
    if (policy.policy === 'public' || policy.policy === 'private') {
      const expires = new Date(Date.now() + policy.ttl * 1000);
      headers['Expires'] = expires.toUTCString();
    }

    return headers;
  }

  /**
   * Validate cache entry with request headers
   */
  public validateCache(
    entry: ICacheEntry,
    headers: Record<string, string>
  ): { valid: boolean; status?: number } {
    // Check If-None-Match header
    const ifNoneMatch = headers['if-none-match'];
    if (ifNoneMatch) {
      const etags = ifNoneMatch.split(',').map(t => t.trim());
      // Assume ETag is stored in metadata
      const entryETag = entry.metadata.etag;
      if (entryETag && etags.includes(entryETag)) {
        return { valid: true, status: 304 };
      }
    }

    // Check If-Modified-Since header
    const ifModifiedSince = headers['if-modified-since'];
    if (ifModifiedSince) {
      const modifiedSince = new Date(ifModifiedSince);
      if (entry.createdAt <= modifiedSince) {
        return { valid: true, status: 304 };
      }
    }

    return { valid: false };
  }

  /**
   * Create default cache hierarchy
   */
  private createDefaultHierarchy(levels: number): ICacheHierarchyLevel[] {
    const hierarchy: ICacheHierarchyLevel[] = [];
    const ttls = [3600, 86400, 604800]; // 1h, 1d, 1w
    const priorities = [3, 2, 1];
    const sizes = [1000, 5000, 10000];

    for (let i = 0; i < levels; i++) {
      hierarchy.push({
        name: `level_${i}`,
        priority: priorities[i] ?? 1,
        ttl: ttls[i] ?? 3600,
        maxSize: sizes[i] ?? 1000,
        evictionPolicy: 'lru'
      });
    }

    return hierarchy;
  }

  /**
   * Create single cache level
   */
  private createSingleLevel(): ICacheHierarchyLevel {
    return {
      name: 'edge',
      priority: 1,
      ttl: this.defaultTTL,
      maxSize: this.maxCacheSize,
      evictionPolicy: 'lru'
    };
  }

  /**
   * Initialize cache levels
   */
  private initializeCacheLevels(): void {
    for (const level of this.hierarchy.levels) {
      this.cacheLevels.set(
        level.name,
        new LRUCache<string, ICacheEntry>({
          max: level.maxSize,
          ttl: level.ttl * 1000,
          updateAgeOnGet: true,
          updateAgeOnHas: false
        })
      );
    }
  }

  /**
   * Check if cache entry matches rule
   */
  private matchesRule(
    context: IRequestContext,
    rule: ICacheRule
  ): boolean {
    // Check URL pattern
    const urlPattern = rule.pattern instanceof RegExp
      ? rule.pattern
      : new RegExp(rule.pattern);

    if (!urlPattern.test(context.url)) {
      return false;
    }

    // Check conditions
    if (rule.conditions) {
      for (const condition of rule.conditions) {
        if (!this.matchesCondition(context, condition)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if request matches condition
   */
  private matchesCondition(
    context: IRequestContext,
    condition: ICacheCondition
  ): boolean {
    const fieldValue = this.getFieldValue(context, condition.field);
    const conditionValue = condition.value;
    const operator = condition.operator;
    const caseSensitive = condition.caseSensitive ?? false;

    if (fieldValue === undefined) {
      return operator === 'exists' ? false : true;
    }

    const field = caseSensitive ? fieldValue : fieldValue.toLowerCase();
    const value = conditionValue
      ? caseSensitive
        ? conditionValue.toString()
        : conditionValue.toString().toLowerCase()
      : '';

    switch (operator) {
      case 'equals':
        return field === value;
      case 'contains':
        return field.includes(value);
      case 'matches':
        const pattern = conditionValue instanceof RegExp
          ? conditionValue
          : new RegExp(value);
        return pattern.test(field);
      case 'startsWith':
        return field.startsWith(value);
      case 'endsWith':
        return field.endsWith(value);
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
      default:
        return false;
    }
  }

  /**
   * Check if request matches bypass rule
   */
  private matchesBypassRule(
    context: IRequestContext,
    rule: IBypassRule
  ): boolean {
    const pattern = rule.pattern instanceof RegExp
      ? rule.pattern
      : new RegExp(rule.pattern);

    return pattern.test(context.url);
  }

  /**
   * Get field value from context
   */
  private getFieldValue(context: IRequestContext, field: string): string | undefined {
    const parts = field.split('.');

    let value: any = context;
    for (const part of parts) {
      value = value?.[part];
    }

    return value?.toString();
  }

  /**
   * Check if cache entry is expired
   */
  private isEntryExpired(entry: ICacheEntry): boolean {
    return entry.expiresAt < new Date();
  }

  /**
   * Apply eviction policy to cache
   */
  private applyEvictionPolicy(
    cache: LRUCache<string, ICacheEntry>,
    level: ICacheHierarchyLevel
  ): void {
    // LRU is handled automatically by the LRUCache
    // For other policies, we would need custom logic
    switch (level.evictionPolicy) {
      case 'lfu':
        // LFU would require tracking access frequency
        // This is a simplified version
        break;
      case 'fifo':
        // FIFO would require tracking insertion order
        break;
      case 'random':
        // Random eviction
        const keys = Array.from(cache.keys());
        if (keys.length > 0) {
          const randomKey = keys[Math.floor(Math.random() * keys.length)];
          cache.delete(randomKey);
        }
        break;
      case 'lru':
      default:
        // LRU is handled automatically
        break;
    }
  }

  /**
   * Update statistics
   */
  private updateStats(hit: boolean, responseTime: number, size: number): void {
    if (hit) {
      this.stats.hits++;
      this.stats.savedBandwidth += size;
    } else {
      this.stats.misses++;
      this.stats.totalBandwidth += size;
    }

    // Update average response time
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.avgResponseTime =
      (this.stats.avgResponseTime * (totalRequests - 1) + responseTime) /
      totalRequests;
  }

  /**
   * Generate ETag for content
   */
  public generateETag(content: string | Buffer): string {
    return etag(content);
  }

  /**
   * Check if response is fresh
   */
  public isFresh(
    reqHeaders: Record<string, string>,
    resHeaders: Record<string, string>
  ): boolean {
    return fresh(reqHeaders, resHeaders);
  }

  /**
   * Get content type from path
   */
  public getContentType(path: string): string {
    return mime.lookup(path) || 'application/octet-stream';
  }

  /**
   * Create cache entry from response
   */
  public createCacheEntry(
    url: string,
    status: number,
    headers: Record<string, string>,
    body: string | Buffer,
    policy: ICachePolicy
  ): Omit<ICacheEntry, 'key' | 'createdAt' | 'lastAccessed'> {
    const now = Date.now();
    const bodyStr = typeof body === 'string' ? body : body.toString('utf-8');
    const size = Buffer.byteLength(bodyStr, 'utf-8');

    return {
      url,
      status,
      size,
      contentType: headers['content-type'] || this.getContentType(url),
      tags: policy.tags ?? [],
      ttl: policy.ttl * 1000,
      age: 0,
      lastAccessed: new Date(now),
      createdAt: new Date(now),
      expiresAt: new Date(now + policy.ttl * 1000),
      metadata: {
        etag: this.generateETag(body),
        headers,
        policy: policy.name
      }
    };
  }

  /**
   * Warm up cache with predefined URLs
   */
  public async warmup(urls: string[]): Promise<void> {
    const results = await Promise.allSettled(
      urls.map(async url => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const body = await response.text();
            const key = this.generateCacheKey(url, {});

            await this.set(key, {
              url,
              status: response.status,
              size: body.length,
              contentType: response.headers.get('content-type') || 'text/plain',
              tags: ['warmup'],
              ttl: this.defaultTTL * 1000,
              age: 0,
              lastAccessed: new Date(),
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + this.defaultTTL * 1000),
              metadata: {
                headers: Object.fromEntries(response.headers.entries())
              }
            });
          }
        } catch (error) {
          console.error(`Failed to warm up cache for ${url}:`, error);
        }
      })
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      console.warn(`Cache warmup completed with ${failed} failures`);
    }
  }

  /**
   * Export cache state
   */
  public exportState(): Map<string, ICacheEntry[]> {
    const state = new Map<string, ICacheEntry[]>();

    for (const [level, cache] of this.cacheLevels.entries()) {
      state.set(level, Array.from(cache.values()));
    }

    return state;
  }

  /**
   * Import cache state
   */
  public async importState(state: Map<string, ICacheEntry[]>): Promise<void> {
    for (const [level, entries] of state.entries()) {
      const cache = this.cacheLevels.get(level);
      if (!cache) continue;

      for (const entry of entries) {
        cache.set(entry.key, entry);
      }
    }
  }

  /**
   * Health check
   */
  public healthCheck(): {
    healthy: boolean;
    levels: Array<{ name: string; size: number; healthy: boolean }>;
  } {
    const levels = this.hierarchy.levels.map(level => {
      const cache = this.cacheLevels.get(level.name);
      return {
        name: level.name,
        size: cache?.size ?? 0,
        healthy: cache !== undefined
      };
    });

    return {
      healthy: levels.every(l => l.healthy),
      levels
    };
  }
}

export default CacheController;
