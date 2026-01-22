// @ts-nocheck
/**
 * Caching layer for SaaS platform
 */

import { LRUCache } from 'lru-cache';

export class CacheManager {
  private cache: LRUCache<string, any>;
  private stores = new Map<string, LRUCache<string, any>>();

  constructor() {
    this.cache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 5, // 5 minutes default TTL
    });

    // Initialize store-specific caches
    this.initializeStores();
  }

  private initializeStores() {
    // Tenant cache
    this.stores.set('tenant', new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 30, // 30 minutes
    }));

    // User cache
    this.stores.set('user', new LRUCache({
      max: 5000,
      ttl: 1000 * 60 * 15, // 15 minutes
    }));

    // Project cache
    this.stores.set('project', new LRUCache({
      max: 10000,
      ttl: 1000 * 60 * 10, // 10 minutes
    }));

    // Session cache
    this.stores.set('session', new LRUCache({
      max: 10000,
      ttl: 1000 * 60 * 60, // 1 hour
    }));

    // Rate limit cache
    this.stores.set('rate-limit', new LRUCache({
      max: 100000,
      ttl: 1000 * 60, // 1 minute
    }));
  }

  // Generic cache operations
  async get<T>(key: string): Promise<T | null> {
    return this.cache.get(key) as T || null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.cache.set(key, value, { ttl });
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  // Store-specific operations
  async getStore(store: string): Promise<LRUCache<string, any> | null> {
    return this.stores.get(store) || null;
  }

  async tenantGet(id: string): Promise<any | null> {
    const store = this.stores.get('tenant');
    return store?.get(id) || null;
  }

  async tenantSet(id: string, value: any, ttl?: number): Promise<void> {
    const store = this.stores.get('tenant');
    if (store) {
      store.set(id, value, { ttl });
    }
  }

  async userGet(id: string): Promise<any | null> {
    const store = this.stores.get('user');
    return store?.get(id) || null;
  }

  async userSet(id: string, value: any, ttl?: number): Promise<void> {
    const store = this.stores.get('user');
    if (store) {
      store.set(id, value, { ttl });
    }
  }

  async projectGet(id: string): Promise<any | null> {
    const store = this.stores.get('project');
    return store?.get(id) || null;
  }

  async projectSet(id: string, value: any, ttl?: number): Promise<void> {
    const store = this.stores.get('project');
    if (store) {
      store.set(id, value, { ttl });
    }
  }

  // Rate limiting
  async checkRateLimit(key: string, limit: number, windowMs: number): Promise<{
    allowed: boolean;
    remaining: number;
    reset: number;
  }> {
    const store = this.stores.get('rate-limit');
    if (!store) {
      return { allowed: true, remaining: limit, reset: 0 };
    }

    const now = Date.now();
    const windowStart = now - windowMs;

    const current = (store.get(key) as { count: number; reset: number }) || { count: 0, reset: now + windowMs };

    if (current.reset < now) {
      // Reset window
      store.set(key, { count: 1, reset: now + windowMs });
      return { allowed: true, remaining: limit - 1, reset: current.reset };
    }

    if (current.count >= limit) {
      return { allowed: false, remaining: 0, reset: current.reset };
    }

    current.count++;
    store.set(key, current);
    return { allowed: true, remaining: limit - current.count, reset: current.reset };
  }

  // Cache warming
  async warmTenantCache(tenants: any[]): Promise<void> {
    for (const tenant of tenants) {
      await this.tenantSet(tenant.id, tenant, 1000 * 60 * 30); // 30 minutes
    }
  }

  async warmUserCache(users: any[]): Promise<void> {
    for (const user of users) {
      await this.userSet(user.id, user, 1000 * 60 * 15); // 15 minutes
    }
  }

  async warmProjectCache(projects: any[]): Promise<void> {
    for (const project of projects) {
      await this.projectSet(project.id, project, 1000 * 60 * 10); // 10 minutes
    }
  }

  // Cache statistics
  getStats() {
    return {
      global: {
        size: this.cache.size,
        max: this.cache.max,
        ttl: this.cache.ttl,
      },
      stores: Object.fromEntries(
        Array.from(this.stores.entries()).map(([name, store]) => [
          name,
          {
            size: store.size,
            max: store.max,
            ttl: store.ttl,
          }
        ])
      ),
    };
  }

  // Cache cleanup
  async cleanup(): Promise<void> {
    const now = Date.now();

    // Clean up expired entries
    for (const [storeName, store] of this.stores.entries()) {
      for (const [key] of store.entries()) {
        const value = store.get(key);
        if (value && typeof value === 'object' && 'createdAt' in value) {
          if (now - (value as any).createdAt > (store.ttl || 0)) {
            store.delete(key);
          }
        }
      }
    }

    // Clean global cache
    this.cache.purgeStale();
  }
}

export const cacheManager = new CacheManager();