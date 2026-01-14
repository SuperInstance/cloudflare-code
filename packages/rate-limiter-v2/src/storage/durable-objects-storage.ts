/**
 * Durable Objects storage backend for distributed rate limiting
 *
 * This implementation provides a Durable Object-based storage backend
 * for Cloudflare Workers with strong consistency and low latency.
 */

import type {
  RateLimitState,
  StorageConfig
} from '../types/index.js';

/**
 * Durable Object state interface
 */
export interface DurableObjectState {
  [key: string]: RateLimitState;
}

/**
 * Durable Object for rate limiting
 */
export class RateLimiterDurableObject {
  private state: DurableObjectState = {};
  private env: any;
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  /**
   * Fetch handler for incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.split('/').pop();

    try {
      switch (action) {
        case 'get':
          return this.handleGet(request);
        case 'set':
          return this.handleSet(request);
        case 'delete':
          return this.handleDelete(request);
        case 'increment':
          return this.handleIncrement(request);
        case 'getMultiple':
          return this.handleGetMultiple(request);
        case 'setMultiple':
          return this.handleSetMultiple(request);
        case 'deleteMultiple':
          return this.handleDeleteMultiple(request);
        case 'clear':
          return this.handleClear();
        case 'sync':
          return this.handleSync(request);
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      return new Response(
        JSON.stringify({ error: (error as Error).message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Handle GET request
   */
  private async handleGet(request: Request): Promise<Response> {
    const { key } = await request.json();
    const value = await this.storage.get(key);

    return new Response(
      JSON.stringify({ value }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle SET request
   */
  private async handleSet(request: Request): Promise<Response> {
    const { key, value, ttl } = await request.json();

    if (ttl) {
      await this.storage.put(key, value, {
        expirationTtl: ttl / 1000
      });
    } else {
      await this.storage.put(key, value);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle DELETE request
   */
  private async handleDelete(request: Request): Promise<Response> {
    const { key } = await request.json();
    await this.storage.delete(key);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle INCREMENT request
   */
  private async handleIncrement(request: Request): Promise<Response> {
    const { key, amount } = await request.json();
    const currentValue = await this.storage.get(key);
    const newValue = (currentValue?.count || 0) + (amount || 1);

    await this.storage.put(key, { count: newValue, lastUpdate: Date.now() });

    return new Response(
      JSON.stringify({ value: newValue }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle GETMULTIPLE request
   */
  private async handleGetMultiple(request: Request): Promise<Response> {
    const { keys } = await request.json();
    const values = await this.storage.get(keys);

    return new Response(
      JSON.stringify({ values }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle SETMULTIPLE request
   */
  private async handleSetMultiple(request: Request): Promise<Response> {
    const { entries, ttl } = await request.json();

    const transaction = this.storage.transaction();
    for (const [key, value] of Object.entries(entries)) {
      if (ttl) {
        await transaction.put(key, value, { expirationTtl: ttl / 1000 });
      } else {
        await transaction.put(key, value);
      }
    }
    await transaction.commit();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle DELETEMULTIPLE request
   */
  private async handleDeleteMultiple(request: Request): Promise<Response> {
    const { keys } = await request.json();
    await this.storage.delete(keys);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle CLEAR request
   */
  private async handleClear(): Promise<Response> {
    await this.storage.deleteAll();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle SYNC request for distributed coordination
   */
  private async handleSync(request: Request): Promise<Response> {
    const { version, nodeId } = await request.json();

    const currentVersion = await this.storage.get('version');
    const currentState = await this.storage.get('state');

    return new Response(
      JSON.stringify({
        version: currentVersion || 0,
        state: currentState || {},
        nodeId
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Alarm handler for cleanup and maintenance
   */
  async alarm(): Promise<void> {
    // Cleanup expired entries
    const now = Date.now();
    const keys = await this.storage.list();

    for (const [key, value] of keys) {
      const state = value as RateLimitState;
      if (now - state.lastUpdate > 86400000) { // 24 hours
        await this.storage.delete(key);
      }
    }
  }
}

/**
 * Durable Objects storage client
 */
export class DurableObjectsStorage {
  private durableObjectId: string;
  private prefix: string;
  private defaultTTL: number;
  private binding: any;

  constructor(config: StorageConfig, binding: any) {
    if (config.type !== 'durable_objects') {
      throw new Error('Durable Objects configuration required');
    }

    this.durableObjectId = config.durableObjectId || 'rate-limiter';
    this.prefix = config.prefix || 'ratelimit';
    this.defaultTTL = config.ttl || 3600000;
    this.binding = binding;
  }

  /**
   * Get a value from Durable Objects
   */
  async get(key: string): Promise<RateLimitState | null> {
    try {
      const fullKey = this.getFullKey(key);
      const response = await this.binding.fetch(
        new Request(`https://durable-object/get`, {
          method: 'POST',
          body: JSON.stringify({ key: fullKey })
        })
      );

      const data = await response.json();
      return data.value || null;
    } catch (error) {
      console.error('Durable Objects get error:', error);
      return null;
    }
  }

  /**
   * Set a value in Durable Objects
   */
  async set(key: string, value: RateLimitState, ttl?: number): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await this.binding.fetch(
        new Request(`https://durable-object/set`, {
          method: 'POST',
          body: JSON.stringify({
            key: fullKey,
            value,
            ttl: ttl || this.defaultTTL
          })
        })
      );
    } catch (error) {
      console.error('Durable Objects set error:', error);
      throw error;
    }
  }

  /**
   * Delete a value from Durable Objects
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await this.binding.fetch(
        new Request(`https://durable-object/delete`, {
          method: 'POST',
          body: JSON.stringify({ key: fullKey })
        })
      );
    } catch (error) {
      console.error('Durable Objects delete error:', error);
    }
  }

  /**
   * Increment a counter value
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const response = await this.binding.fetch(
        new Request(`https://durable-object/increment`, {
          method: 'POST',
          body: JSON.stringify({ key: fullKey, amount })
        })
      );

      const data = await response.json();
      return data.value;
    } catch (error) {
      console.error('Durable Objects increment error:', error);
      throw error;
    }
  }

  /**
   * Set expiration time
   */
  async expire(key: string, ttl: number): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.get(key);

      if (value) {
        await this.set(key, value, ttl);
      }
    } catch (error) {
      console.error('Durable Objects expire error:', error);
    }
  }

  /**
   * Get multiple values
   */
  async getMultiple(keys: string[]): Promise<Map<string, RateLimitState>> {
    try {
      const fullKeys = keys.map((k) => this.getFullKey(k));
      const response = await this.binding.fetch(
        new Request(`https://durable-object/getMultiple`, {
          method: 'POST',
          body: JSON.stringify({ keys: fullKeys })
        })
      );

      const data = await response.json();
      const results = new Map<string, RateLimitState>();

      keys.forEach((key, index) => {
        if (data.values[index]) {
          results.set(key, data.values[index]);
        }
      });

      return results;
    } catch (error) {
      console.error('Durable Objects getMultiple error:', error);
      return new Map();
    }
  }

  /**
   * Set multiple values
   */
  async setMultiple(entries: Map<string, RateLimitState>, ttl?: number): Promise<void> {
    try {
      const entriesObj: Record<string, RateLimitState> = {};
      for (const [key, value] of entries.entries()) {
        entriesObj[this.getFullKey(key)] = value;
      }

      await this.binding.fetch(
        new Request(`https://durable-object/setMultiple`, {
          method: 'POST',
          body: JSON.stringify({
            entries: entriesObj,
            ttl: ttl || this.defaultTTL
          })
        })
      );
    } catch (error) {
      console.error('Durable Objects setMultiple error:', error);
      throw error;
    }
  }

  /**
   * Delete multiple values
   */
  async deleteMultiple(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    try {
      const fullKeys = keys.map((k) => this.getFullKey(k));
      await this.binding.fetch(
        new Request(`https://durable-object/deleteMultiple`, {
          method: 'POST',
          body: JSON.stringify({ keys: fullKeys })
        })
      );
    } catch (error) {
      console.error('Durable Objects deleteMultiple error:', error);
    }
  }

  /**
   * Clear all values
   */
  async clear(): Promise<void> {
    try {
      await this.binding.fetch(
        new Request(`https://durable-object/clear`, {
          method: 'POST'
        })
      );
    } catch (error) {
      console.error('Durable Objects clear error:', error);
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    try {
      const searchPattern = pattern
        ? `${this.prefix}:${pattern}`
        : `${this.prefix}:*`;

      const response = await this.binding.fetch(
        new Request(`https://durable-object/keys`, {
          method: 'POST',
          body: JSON.stringify({ pattern: searchPattern })
        })
      );

      const data = await response.json();

      // Remove prefix from keys
      return data.keys.map((key: string) =>
        key.substring(this.prefix.length + 1)
      );
    } catch (error) {
      console.error('Durable Objects keys error:', error);
      return [];
    }
  }

  /**
   * Get full key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * Sync state for distributed coordination
   */
  async sync(version: number, nodeId: string): Promise<{
    version: number;
    state: Record<string, RateLimitState>;
  }> {
    try {
      const response = await this.binding.fetch(
        new Request(`https://durable-object/sync`, {
          method: 'POST',
          body: JSON.stringify({ version, nodeId })
        })
      );

      return await response.json();
    } catch (error) {
      console.error('Durable Objects sync error:', error);
      return { version: 0, state: {} };
    }
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    durableObjectId: string;
    prefix: string;
    defaultTTL: number;
  } {
    return {
      durableObjectId: this.durableObjectId,
      prefix: this.prefix,
      defaultTTL: this.defaultTTL
    };
  }
}
