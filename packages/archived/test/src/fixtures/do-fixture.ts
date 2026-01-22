/**
 * Durable Object Test Fixture
 *
 * Provides isolated DO instances for testing with lifecycle management
 */

import { beforeEach, afterEach } from 'vitest';
import { generateTestId } from '../e2e/setup';

export interface DOInstance {
  id: string;
  state: DurableObjectState;
  stub: DurableObjectStub;
  cleanup: () => Promise<void>;
}

export class DOFixture {
  private instances: Map<string, DOInstance> = new Map();
  private nextId = 1;
  private testId: string;

  constructor(testId?: string) {
    this.testId = testId || generateTestId();
  }

  /**
   * Create DO namespace
   */
  createNamespace(name: string): DurableObjectNamespace {
    const fixture = this;

    return {
      idFromName(id: string): DurableObjectId {
        return {
          toString() {
            return `${fixture.testId}-${name}-${id}`;
          },
        } as DurableObjectId;
      },

      idFromString(id: string): DurableObjectId {
        return {
          toString() {
            return id;
          },
        } as DurableObjectId;
      },

      newUniqueId(): DurableObjectId {
        const id = `${fixture.testId}-${name}-${fixture.nextId++}`;
        return {
          toString() {
            return id;
          },
        } as DurableObjectId;
      },

      get(id: DurableObjectId): DurableObjectStub {
        const idString = id.toString();
        let instance = fixture.instances.get(idString);

        if (!instance) {
          instance = fixture.createInstance(idString, name);
          fixture.instances.set(idString, instance);
        }

        return instance.stub;
      },

      async getExisting(id: DurableObjectId): Promise<DurableObjectStub | null> {
        const idString = id.toString();
        const instance = fixture.instances.get(idString);
        return instance ? instance.stub : null;
      },
    } as DurableObjectNamespace;
  }

  /**
   * Create DO instance
   */
  private createInstance(id: string, name: string): DOInstance {
    // Create mock state
    const state: DurableObjectState = {
      storage: this.createStorage(),
      id: {
        toString: () => id,
      } as DurableObjectId,
      waitUntil: (promise: Promise<any>) => {
        // Store promise for later cleanup
        promise.catch((error) => console.error('waitUntil error:', error));
      },
      get existing(): boolean {
        return this.instances.has(id);
      },
    };

    // Create mock stub
    const stub: DurableObjectStub = {
      id: state.id,
      get fetch(): typeof DurableObjectStub.prototype.fetch {
        return async (init) => {
          // Mock fetch implementation
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        };
      },
    };

    const instance: DOInstance = {
      id,
      state,
      stub,
      cleanup: async () => {
        await this.clearStorage(state.storage);
      },
    };

    return instance;
  }

  /**
   * Create DO storage
   */
  private createStorage(): DurableObjectStorage {
    const data: Map<string, any> = new Map();
    const alarms: Map<string, number> = new Map();

    return {
      async get(key: string): Promise<any> {
        return data.get(key);
      },

      async get(keys: string[]): Promise<any[]> {
        return keys.map((k) => data.get(k));
      },

      async put(key: string, value: any, options?: DurableObjectStoragePutOptions): Promise<void> {
        data.set(key, value);
      },

      async delete(key: string): Promise<boolean> {
        return data.delete(key);
      },

      async delete(keys: string[]): Promise<number> {
        let count = 0;
        keys.forEach((k) => {
          if (data.delete(k)) count++;
        });
        return count;
      },

      async list(options?: DurableObjectStorageListOptions): Promise<any[]> {
        let keys = Array.from(data.keys());

        if (options?.start) {
          keys = keys.filter((k) => k >= options.start);
        }

        if (options?.end) {
          keys = keys.filter((k) => k <= options.end);
        }

        if (options?.prefix) {
          keys = keys.filter((k) => k.startsWith(options.prefix));
        }

        if (options?.limit) {
          keys = keys.slice(0, options.limit);
        }

        if (options?.reverse) {
          keys.reverse();
        }

        return keys.map((k) => ({ key: k, value: data.get(k) }));
      },

      async getAlarm(): Promise<number | null> {
        return alarms.get('alarm') || null;
      },

      async setAlarm(scheduledTime: number | Date): Promise<void> {
        const time = scheduledTime instanceof Date ? scheduledTime.getTime() : scheduledTime;
        alarms.set('alarm', time);
      },

      async deleteAlarm(): Promise<void> {
        alarms.delete('alarm');
      },

      async transaction<T>(callback: (txn: DurableObjectTransaction) => Promise<T>): Promise<T> {
        const txn: DurableObjectTransaction = {
          rollback: () => {
            // Mock rollback
          },
        };
        return callback(txn);
      },

      sql: async (query: string, ...params: any[]): Promise<any> => {
        // Mock SQL execution
        return [];
      },

      sync: async () => {
        // Mock sync
      },
    } as DurableObjectStorage;
  }

  /**
   * Clear storage
   */
  private async clearStorage(storage: DurableObjectStorage): Promise<void> {
    const keys = await storage.list();
    await storage.delete(keys.map((k) => k.key));
  }

  /**
   * Get all instances
   */
  getInstances(): Map<string, DOInstance> {
    return new Map(this.instances);
  }

  /**
   * Get instance by ID
   */
  getInstance(id: string): DOInstance | undefined {
    return this.instances.get(id);
  }

  /**
   * Clear all instances
   */
  async clearAll(): Promise<void> {
    const cleanupPromises = Array.from(this.instances.values()).map((instance) =>
      instance.cleanup()
    );
    await Promise.all(cleanupPromises);
    this.instances.clear();
  }

  /**
   * Get instance count
   */
  size(): number {
    return this.instances.size;
  }
}

/**
 * Create DO fixture for tests
 */
export function createDOFixture(): DOFixture {
  return new DOFixture();
}

/**
 * Setup DO fixture in test
 */
export function setupDOFixture(): DOFixture {
  const fixture = new DOFixture();

  beforeEach(async () => {
    // Clean up any existing instances
    await fixture.clearAll();
  });

  afterEach(async () => {
    // Clean up all instances
    await fixture.clearAll();
  });

  return fixture;
}

/**
 * DO lifecycle test helper
 */
export class DOLifecycleTester {
  private fixture: DOFixture;
  private namespace: DurableObjectNamespace;

  constructor(fixture: DOFixture, namespaceName: string) {
    this.fixture = fixture;
    this.namespace = fixture.createNamespace(namespaceName);
  }

  /**
   * Test instance creation
   */
  async testCreate(id: string): Promise<DOInstance> {
    const doId = this.namespace.idFromName(id);
    const stub = this.namespace.get(doId);

    const instance = this.fixture.getInstance(doId.toString());
    expect(instance).toBeDefined();
    expect(instance?.id).toBe(doId.toString());

    return instance!;
  }

  /**
   * Test instance retrieval
   */
  async testGet(id: string): Promise<DOInstance | null> {
    const doId = this.namespace.idFromName(id);
    const stub = await this.namespace.getExisting(doId);

    if (!stub) {
      return null;
    }

    const instance = this.fixture.getInstance(doId.toString());
    return instance || null;
  }

  /**
   * Test instance cleanup
   */
  async testCleanup(id: string): Promise<void> {
    const instance = await this.testCreate(id);
    await instance.cleanup();

    const retrieved = await this.testGet(id);
    expect(retrieved).toBeNull();
  }

  /**
   * Test storage operations
   */
  async testStorage(id: string, operations: {
    write?: Record<string, any>;
    read?: string[];
    delete?: string[];
  }): Promise<void> {
    const instance = await this.testCreate(id);
    const storage = instance.state.storage;

    if (operations.write) {
      for (const [key, value] of Object.entries(operations.write)) {
        await storage.put(key, value);
      }
    }

    if (operations.read) {
      const values = await storage.get(operations.read);
      expect(values).toBeDefined();
    }

    if (operations.delete) {
      await storage.delete(operations.delete);
    }
  }

  /**
   * Test concurrent access
   */
  async testConcurrent(ids: string[]): Promise<DOInstance[]> {
    const promises = ids.map((id) => this.testCreate(id));
    return Promise.all(promises);
  }

  /**
   * Get namespace
   */
  getNamespace(): DurableObjectNamespace {
    return this.namespace;
  }
}

/**
 * Create DO lifecycle tester
 */
export function createDOLifecycleTester(fixture: DOFixture, namespaceName: string): DOLifecycleTester {
  return new DOLifecycleTester(fixture, namespaceName);
}
