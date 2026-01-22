/**
 * R2 Test Fixture
 *
 * Provides isolated R2 bucket for testing with automatic cleanup
 */

import { beforeEach, afterEach } from 'vitest';
import { generateTestId } from '../e2e/setup';

export interface R2FixtureObject {
  key: string;
  value: Uint8Array | ReadableStream;
  metadata?: any;
  httpMetadata?: R2HTTPMetadata;
  checksum?: string;
}

export class R2Fixture {
  private objects: Map<string, R2FixtureObject> = new Map();
  private testId: string;

  constructor(testId?: string) {
    this.testId = testId || generateTestId();
  }

  /**
   * Create mock R2 bucket
   */
  createBucket(): R2Bucket {
    const fixture = this;

    return {
      async get(key: string): Promise<R2Object | null> {
        const obj = fixture.objects.get(key);
        if (!obj) return null;

        return {
          key: obj.key,
          size: obj.value instanceof Uint8Array ? obj.value.length : 0,
          uploaded: Date.now(),
          httpMetadata: obj.httpMetadata,
          customMetadata: obj.metadata,
          checksum: obj.checksum,
          writeHttpMetadata: () => ({}),
        } as R2Object;
      },

      async put(
        key: string,
        value: ReadableStream | Uint8Array,
        options?: R2PutOptions
      ): Promise<R2Object> {
        const obj: R2FixtureObject = {
          key,
          value,
          metadata: options?.customMetadata,
          httpMetadata: options?.httpMetadata,
        };

        fixture.objects.set(key, obj);

        return {
          key,
          size: value instanceof Uint8Array ? value.length : 0,
          uploaded: Date.now(),
          httpMetadata: options?.httpMetadata,
          customMetadata: options?.customMetadata,
          writeHttpMetadata: () => ({}),
        } as R2Object;
      },

      async delete(keys: string | string[]): Promise<void> {
        const keysToDelete = Array.isArray(keys) ? keys : [keys];
        keysToDelete.forEach((k) => fixture.objects.delete(k));
      },

      async list(options?: R2ListOptions): Promise<R2Objects> {
        let objectKeys = Array.from(fixture.objects.keys());

        if (options?.prefix) {
          objectKeys = objectKeys.filter((k) => k.startsWith(options.prefix));
        }

        if (options?.limit) {
          objectKeys = objectKeys.slice(0, options.limit);
        }

        if (options?.cursor) {
          const index = objectKeys.findIndex((k) => k === options.cursor);
          if (index >= 0) {
            objectKeys = objectKeys.slice(index + 1);
          }
        }

        const objects = objectKeys.map((key) => {
          const obj = fixture.objects.get(key)!;
          return {
            key: obj.key,
            size: obj.value instanceof Uint8Array ? obj.value.length : 0,
            uploaded: Date.now(),
            httpMetadata: obj.httpMetadata,
            customMetadata: obj.metadata,
          };
        });

        return {
          objects,
          truncated: false,
          cursor: objectKeys.length > 0 ? objectKeys[objectKeys.length - 1] : undefined,
        } as R2Objects;
      },

      async head(key: string): Promise<R2Object | null> {
        const obj = fixture.objects.get(key);
        if (!obj) return null;

        return {
          key: obj.key,
          size: obj.value instanceof Uint8Array ? obj.value.length : 0,
          uploaded: Date.now(),
          httpMetadata: obj.httpMetadata,
          customMetadata: obj.metadata,
        } as R2Object;
      },
    } as R2Bucket;
  }

  /**
   * Seed with initial objects
   */
  seed(objects: R2FixtureObject[]): void {
    objects.forEach((obj) => {
      this.objects.set(obj.key, obj);
    });
  }

  /**
   * Get all objects
   */
  getAll(): Map<string, R2FixtureObject> {
    return new Map(this.objects);
  }

  /**
   * Clear all objects
   */
  clear(): void {
    this.objects.clear();
  }

  /**
   * Get size
   */
  size(): number {
    return this.objects.size;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.objects.has(key);
  }

  /**
   * Create test object
   */
  createTestObject(key: string, content: string, metadata?: any): R2FixtureObject {
    return {
      key,
      value: new TextEncoder().encode(content),
      metadata,
    };
  }
}

/**
 * Create R2 fixture for tests
 */
export function createR2Fixture(objects?: R2FixtureObject[]): R2Fixture {
  const fixture = new R2Fixture();
  if (objects) {
    fixture.seed(objects);
  }
  return fixture;
}

/**
 * Common test objects
 */
export function createCommonR2Objects(): R2FixtureObject[] {
  return [
    {
      key: 'test/document.txt',
      value: new TextEncoder().encode('Hello, World!'),
      metadata: { type: 'text/plain', size: 13 },
    },
    {
      key: 'test/data.json',
      value: new TextEncoder().encode(JSON.stringify({ message: 'test' })),
      metadata: { type: 'application/json', size: 20 },
    },
    {
      key: 'codebase/index.ts',
      value: new TextEncoder().encode('export function hello() { console.log("Hello!"); }'),
      metadata: { type: 'text/typescript', language: 'typescript' },
    },
  ];
}

/**
 * Setup R2 fixture in test
 */
export function setupR2Fixture(name: string, initialObjects?: R2FixtureObject[]): R2Fixture {
  const fixture = new R2Fixture();

  beforeEach(() => {
    if (initialObjects) {
      fixture.seed(initialObjects);
    }
  });

  afterEach(() => {
    fixture.clear();
  });

  return fixture;
}
