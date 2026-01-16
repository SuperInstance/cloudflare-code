// @ts-nocheck
/**
 * HTTP and Storage client implementations
 */

import type { HttpClient, StorageClient } from '../types';

/**
 * HTTP client implementation
 */
export class HttpClientImpl implements HttpClient {
  private defaultHeaders: Record<string, string> = {};
  private defaultTimeout = 30000;

  async get(url: string, options?: RequestInit): Promise<Response> {
    return this.request(url, {
      ...options,
      method: 'GET',
    });
  }

  async post(url: string, body?: unknown, options?: RequestInit): Promise<Response> {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  async put(url: string, body?: unknown, options?: RequestInit): Promise<Response> {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  async patch(url: string, body?: unknown, options?: RequestInit): Promise<Response> {
    return this.request(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  async delete(url: string, options?: RequestInit): Promise<Response> {
    return this.request(url, {
      ...options,
      method: 'DELETE',
    });
  }

  async request(url: string, options?: RequestInit): Promise<Response> {
    const timeout = options?.signal || AbortSignal.timeout(this.defaultTimeout);

    return fetch(url, {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options?.headers,
      },
      signal: timeout,
    });
  }

  /**
   * Set default header
   */
  setDefaultHeader(name: string, value: string): void {
    this.defaultHeaders[name] = value;
  }

  /**
   * Set default timeout
   */
  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * Set authorization header
   */
  setAuth(token: string, type: 'Bearer' | 'Basic' | 'Token' = 'Bearer'): void {
    this.defaultHeaders['Authorization'] = `${type} ${token}`;
  }

  /**
   * Clear authorization header
   */
  clearAuth(): void {
    delete this.defaultHeaders['Authorization'];
  }
}

/**
 * KV-based storage client implementation
 */
export class KVStorageClient implements StorageClient {
  constructor(private kv: KVNamespace, private prefix = 'plugin') {}

  async get(key: string): Promise<unknown | null> {
    const fullKey = this.getFullKey(key);
    const value = await this.kv.get(fullKey, 'json');
    return value;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const options: KVNamespacePutOptions = {};

    if (ttl) {
      options.expirationTtl = ttl;
    }

    await this.kv.put(fullKey, JSON.stringify(value), options);
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    await this.kv.delete(fullKey);
  }

  async list(prefix?: string): Promise<string[]> {
    const searchPrefix = prefix
      ? `${this.prefix}:${prefix}`
      : `${this.prefix}:`;

    const list = await this.kv.list({ prefix: searchPrefix });
    return list.keys.map((k) => k.name.substring(searchPrefix.length));
  }

  async clear(prefix?: string): Promise<void> {
    const keys = await this.list(prefix);

    await Promise.all(keys.map((key) => this.delete(key)));
  }

  /**
   * Get full key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.prefix}:${key}`;
  }
}

/**
 * D1-based storage client implementation
 */
export class D1StorageClient implements StorageClient {
  constructor(private db: D1Database) {}

  async get(key: string): Promise<unknown | null> {
    const result = await this.db
      .prepare('SELECT value FROM storage WHERE key = ?')
      .bind(key)
      .first<{ value: string }>();

    if (!result) {
      return null;
    }

    return JSON.parse(result.value);
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const valueStr = JSON.stringify(value);
    const expiration = ttl ? Math.floor(Date.now() / 1000) + ttl : null;

    await this.db
      .prepare(
        'INSERT OR REPLACE INTO storage (key, value, expiration) VALUES (?, ?, ?)'
      )
      .bind(key, valueStr, expiration)
      .run();
  }

  async delete(key: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM storage WHERE key = ?')
      .bind(key)
      .run();
  }

  async list(prefix?: string): Promise<string[]> {
    const query = prefix
      ? 'SELECT key FROM storage WHERE key LIKE ? ORDER BY key'
      : 'SELECT key FROM storage ORDER BY key';

    const stmt = this.db.prepare(query);
    const results = prefix
      ? await stmt.bind(`${prefix}%`).all<{ key: string }>()
      : await stmt.all<{ key: string }>();

    return results.results.map((r) => r.key);
  }

  async clear(prefix?: string): Promise<void> {
    if (prefix) {
      await this.db
        .prepare('DELETE FROM storage WHERE key LIKE ?')
        .bind(`${prefix}%`)
        .run();
    } else {
      await this.db.prepare('DELETE FROM storage').run();
    }
  }

  /**
   * Initialize storage table
   */
  async initialize(): Promise<void> {
    await this.db
      .prepare(`
        CREATE TABLE IF NOT EXISTS storage (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          expiration INTEGER
        )
      `)
      .run();

    await this.db
      .prepare(`
        CREATE INDEX IF NOT EXISTS idx_storage_expiration
        ON storage(expiration)
      `)
      .run();
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<void> {
    await this.db
      .prepare('DELETE FROM storage WHERE expiration IS NOT NULL AND expiration < ?')
      .bind(Math.floor(Date.now() / 1000))
      .run();
  }
}

/**
 * In-memory storage client (for testing)
 */
export class MemoryStorageClient implements StorageClient {
  private storage: Map<string, { value: unknown; expiration?: number }> = new Map();

  async get(key: string): Promise<unknown | null> {
    const entry = this.storage.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiration && Date.now() > entry.expiration) {
      this.storage.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const expiration = ttl ? Date.now() + ttl * 1000 : undefined;
    this.storage.set(key, { value, expiration });
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.storage.keys());

    if (prefix) {
      return keys.filter((k) => k.startsWith(prefix));
    }

    return keys;
  }

  async clear(prefix?: string): Promise<void> {
    if (prefix) {
      const keys = await this.list(prefix);
      for (const key of keys) {
        this.storage.delete(key);
      }
    } else {
      this.storage.clear();
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.storage) {
      if (entry.expiration && now > entry.expiration) {
        this.storage.delete(key);
      }
    }
  }
}

/**
 * Create HTTP client
 */
export function createHttpClient(): HttpClientImpl {
  return new HttpClientImpl();
}

/**
 * Create KV storage client
 */
export function createKVStorageClient(kv: KVNamespace, prefix?: string): KVStorageClient {
  return new KVStorageClient(kv, prefix);
}

/**
 * Create D1 storage client
 */
export function createD1StorageClient(db: D1Database): D1StorageClient {
  return new D1StorageClient(db);
}

/**
 * Create memory storage client
 */
export function createMemoryStorageClient(): MemoryStorageClient {
  return new MemoryStorageClient();
}
