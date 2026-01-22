/**
 * KV Test Fixture
 *
 * Provides isolated KV namespace for testing with automatic cleanup
 */

import { beforeEach, afterEach } from 'vitest';
import { generateTestId } from '../e2e/setup';

export interface KVFixtureData {
  [key: string]: {
    value: string;
    metadata?: any;
    expiration?: number;
  };
}

export class KVFixture {
  private data: Map<string, KVFixtureData[string]> = new Map();
  private testId: string;

  constructor(testId?: string) {
    this.testId = testId || generateTestId();
  }

  /**
   * Create mock KV namespace
   */
  createNamespace(): KVNamespace {
    const fixture = this;

    return {
      async get(key: string): Promise<string | null> {
        const entry = fixture.data.get(key);
        return entry?.value || null;
      },

      async getWithMetadata<MT = any>(key: string): Promise<{ value: string | null; metadata: MT | null }> {
        const entry = fixture.data.get(key);
        return {
          value: entry?.value || null,
          metadata: entry?.metadata || null,
        };
      },

      async put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void> {
        fixture.data.set(key, {
          value,
          metadata: options?.metadata,
          expiration: options?.expirationTtl
            ? Date.now() / 1000 + options.expirationTtl
            : undefined,
        });
      },

      async delete(key: string): Promise<void> {
        fixture.data.delete(key);
      },

      async list(options?: KVNamespaceListOptions): Promise<KVListResult<any, any>> {
        let keys = Array.from(fixture.data.keys());

        if (options?.prefix) {
          keys = keys.filter((k) => k.startsWith(options.prefix));
        }

        if (options?.limit) {
          keys = keys.slice(0, options.limit);
        }

        if (options?.cursor) {
          const index = keys.findIndex((k) => k === options.cursor);
          if (index >= 0) {
            keys = keys.slice(index + 1);
          }
        }

        const keysWithMetadata = keys.map((key) => ({
          name: key,
          metadata: fixture.data.get(key)?.metadata,
        }));

        return {
          keys: keysWithMetadata,
          list_complete: true,
          cursor: keys.length > 0 ? keys[keys.length - 1] : undefined,
        };
      },
    } as KVNamespace;
  }

  /**
   * Seed with initial data
   */
  seed(data: KVFixtureData): void {
    Object.entries(data).forEach(([key, value]) => {
      this.data.set(key, value);
    });
  }

  /**
   * Get all data
   */
  getAll(): Map<string, KVFixtureData[string]> {
    return new Map(this.data);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.data.clear();
  }

  /**
   * Get size
   */
  size(): number {
    return this.data.size;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.data.has(key);
  }

  /**
   * Get specific entry
   */
  get(key: string): KVFixtureData[string] | undefined {
    return this.data.get(key);
  }
}

/**
 * Create KV fixture for tests
 */
export function createKVFixture(data?: KVFixtureData): KVFixture {
  const fixture = new KVFixture();
  if (data) {
    fixture.seed(data);
  }
  return fixture;
}

/**
 * Common test data fixtures
 */
export const KV_FIXTURE_DATA = {
  config: {
    'api:version': { value: 'v1', metadata: { updated: Date.now() } },
    'feature:semantic-cache': { value: 'true', metadata: { enabled: true } },
    'feature:rate-limit': { value: 'true', metadata: { enabled: true } },
  },

  cache: {
    'cache:user:123': { value: JSON.stringify({ name: 'John', email: 'john@example.com' }) },
    'cache:session:abc': { value: JSON.stringify({ userId: '123', createdAt: Date.now() }) },
  },

  tokens: {
    'token:valid': { value: 'valid-token-123' },
    'token:expired': { value: 'expired-token-456' },
  },

  rateLimits: {
    'ratelimit:user:123': { value: '10', metadata: { limit: 100, window: 60 } },
    'ratelimit:ip:1.2.3.4': { value: '5', metadata: { limit: 20, window: 60 } },
  },
};

/**
 * Setup KV fixture in test
 */
export function setupKVFixture(name: string, initialData?: KVFixtureData): KVFixture {
  const fixture = new KVFixture();

  beforeEach(() => {
    if (initialData) {
      fixture.seed(initialData);
    }
  });

  afterEach(() => {
    fixture.clear();
  });

  return fixture;
}
