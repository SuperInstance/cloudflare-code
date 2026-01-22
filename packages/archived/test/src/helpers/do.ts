/**
 * DO Test Helpers
 *
 * Helper functions for testing Durable Objects with lifecycle management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDOFixture, createDOLifecycleTester } from '../fixtures/do-fixture';

/**
 * DO test configuration
 */
export interface DOTestConfig {
  namespace: string;
  instanceCount?: number;
  testOperations?: DOOperation[];
  cleanup?: boolean;
}

export type DOOperation =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'list'
  | 'transaction'
  | 'alarm';

/**
 * DO test result
 */
export interface DOTestResult {
  operation: DOOperation;
  success: boolean;
  duration: number;
  error?: string;
}

/**
 * DO test suite builder
 */
export function buildDOTestSuite(config: DOTestConfig) {
  const { namespace, instanceCount = 1, testOperations = [], cleanup = true } = config;

  describe(`DO: ${namespace}`, () => {
    let fixture: ReturnType<typeof createDOFixture>;
    let tester: ReturnType<typeof createDOLifecycleTester>;

    beforeEach(() => {
      fixture = createDOFixture();
      tester = createDOLifecycleTester(fixture, namespace);
    });

    afterEach(async () => {
      if (cleanup) {
        await fixture.clearAll();
      }
    });

    it('should create DO namespace', () => {
      const ns = tester.getNamespace();
      expect(ns).toBeDefined();
      expect(ns.idFromName).toBeDefined();
      expect(ns.idFromString).toBeDefined();
      expect(ns.newUniqueId).toBeDefined();
      expect(ns.get).toBeDefined();
    });

    it('should create DO instance', async () => {
      const instance = await tester.testCreate('test-instance');
      expect(instance).toBeDefined();
      expect(instance.id).toContain('test-instance');
    });

    it('should retrieve existing DO instance', async () => {
      await tester.testCreate('test-instance');
      const instance = await tester.testGet('test-instance');
      expect(instance).toBeDefined();
    });

    it('should return null for non-existing instance', async () => {
      const instance = await tester.testGet('non-existing');
      expect(instance).toBeNull();
    });

    if (testOperations.includes('create')) {
      it('should create multiple instances', async () => {
        const instances = await tester.testConcurrent(
          Array.from({ length: instanceCount }, (_, i) => `instance-${i}`)
        );
        expect(instances).toHaveLength(instanceCount);
      });
    }

    if (testOperations.includes('read')) {
      it('should read from storage', async () => {
        await tester.testStorage('test-read', {
          write: { key1: 'value1', key2: 'value2' },
          read: ['key1', 'key2'],
        });
      });
    }

    if (testOperations.includes('update')) {
      it('should update storage', async () => {
        await tester.testStorage('test-update', {
          write: { key1: 'value1' },
        });
        await tester.testStorage('test-update', {
          write: { key1: 'value2' },
        });
      });
    }

    if (testOperations.includes('delete')) {
      it('should delete from storage', async () => {
        await tester.testStorage('test-delete', {
          write: { key1: 'value1' },
          delete: ['key1'],
        });
      });
    }

    if (testOperations.includes('list')) {
      it('should list storage keys', async () => {
        const instance = await tester.testCreate('test-list');
        const storage = instance.state.storage;

        await storage.put('key1', 'value1');
        await storage.put('key2', 'value2');
        await storage.put('key3', 'value3');

        const items = await storage.list();
        expect(items).toHaveLength(3);
      });
    }

    if (testOperations.includes('transaction')) {
      it('should execute transaction', async () => {
        const instance = await tester.testCreate('test-transaction');
        const storage = instance.state.storage;

        await storage.transaction(async (txn) => {
          await storage.put('key1', 'value1');
          await storage.put('key2', 'value2');
        });

        const value1 = await storage.get('key1');
        const value2 = await storage.get('key2');

        expect(value1).toBe('value1');
        expect(value2).toBe('value2');
      });
    }

    if (testOperations.includes('alarm')) {
      it('should set and get alarm', async () => {
        const instance = await tester.testCreate('test-alarm');
        const storage = instance.state.storage;

        const scheduledTime = Date.now() + 60000;
        await storage.setAlarm(scheduledTime);

        const alarm = await storage.getAlarm();
        expect(alarm).toBe(scheduledTime);

        await storage.deleteAlarm();
        const deletedAlarm = await storage.getAlarm();
        expect(deletedAlarm).toBeNull();
      });
    }

    it('should cleanup instances', async () => {
      await tester.testCreate('test-cleanup');
      const instances = await tester.testConcurrent(
        Array.from({ length: instanceCount }, (_, i) => `cleanup-${i}`)
      );

      await fixture.clearAll();

      expect(fixture.size()).toBe(0);
    });
  });
}

/**
 * DO storage test helper
 */
export class DOStorageTester {
  private storage: DurableObjectStorage;

  constructor(storage: DurableObjectStorage) {
    this.storage = storage;
  }

  /**
   * Test basic CRUD operations
   */
  async testCRUD(): Promise<void> {
    // Create
    await this.storage.put('test-key', 'test-value');

    // Read
    const value = await this.storage.get('test-key');
    expect(value).toBe('test-value');

    // Update
    await this.storage.put('test-key', 'updated-value');
    const updated = await this.storage.get('test-key');
    expect(updated).toBe('updated-value');

    // Delete
    await this.storage.delete('test-key');
    const deleted = await this.storage.get('test-key');
    expect(deleted).toBeNull();
  }

  /**
   * Test batch operations
   */
  async testBatchOperations(): Promise<void> {
    const data = {
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    };

    // Batch write
    await Promise.all(
      Object.entries(data).map(([key, value]) => this.storage.put(key, value))
    );

    // Batch read
    const values = await this.storage.get(Object.keys(data));
    expect(values).toEqual(Object.values(data));

    // Batch delete
    await this.storage.delete(Object.keys(data));
    const deleted = await this.storage.get(Object.keys(data));
    expect(deleted).toEqual([null, null, null]);
  }

  /**
   * Test list operations
   */
  async testListOperations(): Promise<void> {
    // Seed data
    const keys = ['a', 'b', 'c', 'd', 'e'];
    await Promise.all(keys.map((key) => this.storage.put(key, key)));

    // List all
    const all = await this.storage.list();
    expect(all).toHaveLength(5);

    // List with prefix
    const prefixed = await this.storage.list({ start: 'b', end: 'd' });
    expect(prefixed.length).toBeGreaterThan(0);

    // List with limit
    const limited = await this.storage.list({ limit: 2 });
    expect(limited).toHaveLength(2);

    // List reversed
    const reversed = await this.storage.list({ reverse: true });
    expect(reversed).toBeDefined();
  }

  /**
   * Test transaction
   */
  async testTransaction(): Promise<void> {
    await this.storage.transaction(async (txn) => {
      await this.storage.put('tx1', 'value1');
      await this.storage.put('tx2', 'value2');
    });

    const value1 = await this.storage.get('tx1');
    const value2 = await this.storage.get('tx2');

    expect(value1).toBe('value1');
    expect(value2).toBe('value2');
  }

  /**
   * Test alarm
   */
  async testAlarm(): Promise<void> {
    const scheduledTime = Date.now() + 60000;
    await this.storage.setAlarm(scheduledTime);

    const alarm = await this.storage.getAlarm();
    expect(alarm).toBe(scheduledTime);

    await this.storage.deleteAlarm();
    const deleted = await this.storage.getAlarm();
    expect(deleted).toBeNull();
  }

  /**
   * Test concurrent access
   */
  async testConcurrentAccess(): Promise<void> {
    const promises = Array.from({ length: 100 }, (_, i) =>
      this.storage.put(`key-${i}`, `value-${i}`)
    );

    await Promise.all(promises);

    const values = await this.storage.get(
      Array.from({ length: 100 }, (_, i) => `key-${i}`)
    );

    expect(values).toHaveLength(100);
  }

  /**
   * Run all storage tests
   */
  async runAllTests(): Promise<void> {
    await this.testCRUD();
    await this.testBatchOperations();
    await this.testListOperations();
    await this.testTransaction();
    await this.testAlarm();
    await this.testConcurrentAccess();
  }
}

/**
 * Create DO storage tester
 */
export function createDOStorageTester(storage: DurableObjectStorage): DOStorageTester {
  return new DOStorageTester(storage);
}

/**
 * DO stress test helper
 */
export async function stressTestDO(
  namespace: DurableObjectNamespace,
  options: {
    instanceCount?: number;
    operationsPerInstance?: number;
    operationTypes?: DOOperation[];
    duration?: number;
  } = {}
): Promise<{
  results: DOTestResult[];
  summary: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageDuration: number;
  };
}> {
  const {
    instanceCount = 10,
    operationsPerInstance = 100,
    operationTypes = ['create', 'read', 'update', 'delete'],
    duration = 30000,
  } = options;

  const results: DOTestResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < instanceCount; i++) {
    const instanceId = `stress-${i}`;
    const doId = namespace.idFromName(instanceId);
    const stub = namespace.get(doId);

    for (let j = 0; j < operationsPerInstance; j++) {
      if (Date.now() - startTime > duration) break;

      const operation = operationTypes[Math.floor(Math.random() * operationTypes.length)];
      const opStartTime = Date.now();

      try {
        // Simulate operation
        await stub.fetch(
          new Request('https://test.internal/stress', {
            method: 'POST',
            body: JSON.stringify({ operation, index: j }),
          })
        );

        results.push({
          operation,
          success: true,
          duration: Date.now() - opStartTime,
        });
      } catch (error) {
        results.push({
          operation,
          success: false,
          duration: Date.now() - opStartTime,
          error: (error as Error).message,
        });
      }
    }
  }

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  return {
    results,
    summary: {
      totalOperations: results.length,
      successfulOperations: successful.length,
      failedOperations: failed.length,
      averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
    },
  };
}
