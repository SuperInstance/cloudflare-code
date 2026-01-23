/**
 * Edge Cache Service
 * High-performance caching for Cloudflare Workers using Cache API
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  varyOn?: string[]; // Vary cache on these headers
}

export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  tags: string[];
}

export class EdgeCacheService {
  private cache: Cache;
  private defaultTTL = 3600; // 1 hour

  constructor(cache?: Cache) {
    this.cache = cache || caches.default;
  }

  /**
   * Get cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.cache.match(key);
      if (!cached) return null;

      const entry: CacheEntry<T> = await cached.json();

      // Check expiration
      if (Date.now() > entry.expiresAt) {
        await this.cache.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached value
   */
  async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || this.defaultTTL;
      const entry: CacheEntry<T> = {
        data,
        cachedAt: Date.now(),
        expiresAt: Date.now() + ttl * 1000,
        tags: options?.tags || []
      };

      const response = new Response(JSON.stringify(entry), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${ttl}`,
          'Cache-Tags': options?.tags?.join(',') || ''
        }
      });

      await this.cache.put(key, response);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<boolean> {
    try {
      return await this.cache.delete(key);
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTag(tag: string): Promise<number> {
    let count = 0;
    try {
      // Note: This requires iterating through cache keys
      // In production, use a more efficient approach
      for (const key of await this.keys()) {
        const cached = await this.cache.match(key);
        if (cached) {
          const tags = cached.headers.get('Cache-Tags')?.split(',') || [];
          if (tags.includes(tag)) {
            await this.cache.delete(key);
            count++;
          }
        }
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
    return count;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.keys();
      await Promise.all(keys.map(key => this.cache.delete(key)));
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    size: number;
    keys: string[];
  }> {
    try {
      const keys = await this.keys();
      return {
        size: keys.length,
        keys
      };
    } catch (error) {
      return { size: 0, keys: [] };
    }
  }

  /**
   * Cache helper methods
   */
  private async keys(): Promise<string[]> {
    // Note: Cache API doesn't support direct key listing
    // This is a placeholder implementation
    // In production, maintain a separate key index
    return [];
  }

  /**
   * Generate cache key from request
   */
  static generateKey(request: Request): string {
    const url = new URL(request.url);
    const method = request.method;
    const varyParams = [
      url.pathname + url.search,
      method,
      // Add vary headers here if needed
    ];
    return `cache:${btoa(varyParams.join(':'))}`;
  }

  /**
   * Generate cache key for code generation
   */
  static generateCodeKey(prompt: string, template?: string): string {
    const key = `code:${prompt}:${template || 'default'}`;
    // Create a simple hash
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash = hash & hash;
    }
    return `code:${Math.abs(hash)}`;
  }
}

// Singleton instance
let cacheInstance: EdgeCacheService | null = null;

export function getCacheService(): EdgeCacheService {
  if (!cacheInstance) {
    cacheInstance = new EdgeCacheService();
  }
  return cacheInstance;
}
