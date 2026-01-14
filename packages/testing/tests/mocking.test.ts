/**
 * Tests for Mock Framework
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockFactory,
  ModuleMockFactory,
  KVNamespaceMockFactory,
  R2BucketMockFactory,
  D1DatabaseMockFactory,
  DurableObjectMockFactory,
  TimerMock,
  HTTPMock,
  mock,
  spyOn,
  mockKV,
  mockR2,
  mockD1,
  mockDurableObject,
  useFakeTimers,
  useRealTimers,
} from '../src/mocking/factory.js';

describe('MockFactory', () => {
  let factory: MockFactory;

  beforeEach(() => {
    factory = new MockFactory();
  });

  describe('fn', () => {
    it('should create a mock function', () => {
      const mockFn = factory.fn();
      expect(mockFn._isMock).toBe(true);
    });

    it('should track calls', () => {
      const mockFn = factory.fn((a: number, b: number) => a + b);
      mockFn(1, 2);
      mockFn(3, 4);

      expect(mockFn._mock.calls).toEqual([[1, 2], [3, 4]]);
      expect(mockFn).toHaveBeenCalled();
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith(1, 2);
    });

    it('should support mockImplementation', () => {
      const mockFn = factory.fn();
      mockFn.mockImplementation((a: number, b: number) => a + b);

      expect(mockFn(1, 2)).toBe(3);
    });

    it('should support mockReturnValue', () => {
      const mockFn = factory.fn();
      mockFn.mockReturnValue(42);

      expect(mockFn()).toBe(42);
    });

    it('should support mockResolvedValue', async () => {
      const mockFn = factory.fn();
      mockFn.mockResolvedValue(42);

      await expect(mockFn()).resolves.toBe(42);
    });

    it('should support mockRejectedValue', async () => {
      const mockFn = factory.fn();
      const error = new Error('test error');
      mockFn.mockRejectedValue(error);

      await expect(mockFn()).rejects.toThrow('test error');
    });

    it('should support clearMock', () => {
      const mockFn = factory.fn((a: number) => a);
      mockFn(1);
      mockFn(2);

      mockFn.clearMock();

      expect(mockFn._mock.calls).toEqual([]);
      expect(mockFn._mock.results).toEqual([]);
    });

    it('should support resetMock', () => {
      const mockFn = factory.fn((a: number) => a);
      mockFn.mockReturnValue(42);
      mockFn(1);

      mockFn.resetMock();

      expect(mockFn._mock.calls).toEqual([]);
      expect(mockFn._mock.results).toEqual([]);
      expect(mockFn(2)).toBeUndefined();
    });
  });

  describe('spyOn', () => {
    it('should spy on object methods', () => {
      const obj = {
        method: (a: number, b: number) => a + b,
      };

      const spy = factory.spyOn(obj, 'method');
      obj.method(1, 2);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(1, 2);
    });

    it('should restore original method', () => {
      const obj = {
        method: (a: number, b: number) => a + b,
      };

      const original = obj.method;
      const spy = factory.spyOn(obj, 'method');

      spy.mockRestore();

      expect(obj.method).toBe(original);
    });
  });

  describe('replace', () => {
    it('should replace object properties', () => {
      const obj: any = { property: 'original' };

      factory.replace(obj, 'property', 'replacement');

      expect(obj.property).toBe('replacement');
      expect((obj as any).__mock_property).toBe('original');
    });

    describe('restore', () => {
      it('should restore original values', () => {
        const obj: any = { property: 'original' };

        factory.replace(obj, 'property', 'replacement');
        factory.restore(obj, 'property');

        expect(obj.property).toBe('original');
      });
    });
  });
});

describe('KVNamespaceMockFactory', () => {
  let factory: KVNamespaceMockFactory;

  beforeEach(() => {
    factory = new KVNamespaceMockFactory();
  });

  it('should create KV mock', () => {
    const kv = factory.create();
    expect(kv).toBeDefined();
  });

  it('should store and retrieve values', async () => {
    const kv = factory.create();

    await kv.put('key1', 'value1');
    const value = await kv.get('key1');

    expect(value).toBe('value1');
  });

  it('should return null for non-existent keys', async () => {
    const kv = factory.create();

    const value = await kv.get('nonexistent');

    expect(value).toBeNull();
  });

  it('should support JSON values', async () => {
    const kv = factory.create();
    const obj = { a: 1, b: 2 };

    await kv.put('key1', obj);
    const value = await kv.get('key1', 'json');

    expect(value).toEqual(obj);
  });

  it('should delete values', async () => {
    const kv = factory.create();

    await kv.put('key1', 'value1');
    await kv.delete('key1');

    const value = await kv.get('key1');
    expect(value).toBeNull();
  });

  it('should list keys with prefix', async () => {
    const kv = factory.create();

    await kv.put('user:1', 'value1');
    await kv.put('user:2', 'value2');
    await kv.put('post:1', 'value3');

    const result = await kv.list({ prefix: 'user:' });

    expect(result.keys).toHaveLength(2);
  });

  it('should get with metadata', async () => {
    const kv = factory.create();

    await kv.put('key1', 'value1', { metadata: { meta: 'data' } });
    const result = await kv.getWithMetadata('key1');

    expect(result.value).toBe('value1');
    expect(result.metadata).toEqual({ meta: 'data' });
  });
});

describe('R2BucketMockFactory', () => {
  let factory: R2BucketMockFactory;

  beforeEach(() => {
    factory = new R2BucketMockFactory();
  });

  it('should create R2 mock', () => {
    const r2 = factory.create();
    expect(r2).toBeDefined();
  });

  it('should put and get objects', async () => {
    const r2 = factory.create();

    await r2.put('key1', 'value1');
    const object = await r2.get('key1');

    expect(object).toBeDefined();
    const text = await object?.text();
    expect(text).toBe('value1');
  });

  it('should return null for non-existent objects', async () => {
    const r2 = factory.create();

    const object = await r2.get('nonexistent');

    expect(object).toBeNull();
  });

  it('should delete objects', async () => {
    const r2 = factory.create();

    await r2.put('key1', 'value1');
    await r2.delete('key1');

    const object = await r2.get('key1');
    expect(object).toBeNull();
  });

  it('should list objects', async () => {
    const r2 = factory.create();

    await r2.put('file1.txt', 'content1');
    await r2.put('file2.txt', 'content2');

    const result = await r2.list();

    expect(result.objects).toHaveLength(2);
  });
});

describe('D1DatabaseMockFactory', () => {
  let factory: D1DatabaseMockFactory;

  beforeEach(() => {
    factory = new D1DatabaseMockFactory();
  });

  it('should create D1 mock', () => {
    const d1 = factory.create();
    expect(d1).toBeDefined();
  });

  it('should prepare statements', () => {
    const d1 = factory.create();

    const stmt = d1.prepare('SELECT * FROM users');

    expect(stmt).toBeDefined();
  });

  it('should batch execute statements', async () => {
    const d1 = factory.create();

    const stmt1 = d1.prepare('SELECT * FROM users');
    const stmt2 = d1.prepare('SELECT * FROM posts');

    const results = await d1.batch([stmt1, stmt2]);

    expect(results).toHaveLength(2);
  });

  it('should execute statements', async () => {
    const d1 = factory.create();

    const result = await d1.exec('CREATE TABLE users (id INTEGER)');

    expect(result.success).toBe(true);
  });
});

describe('DurableObjectMockFactory', () => {
  let factory: DurableObjectMockFactory;

  beforeEach(() => {
    factory = new DurableObjectMockFactory();
  });

  it('should create Durable Object mock', () => {
    const doMock = factory.create('test-id');

    expect(doMock.id).toBeDefined();
    expect(doMock.stub).toBeDefined();
    expect(doMock.storage).toBeDefined();
    expect(doMock.state).toBeDefined();
  });

  it('should storage operations', async () => {
    const doMock = factory.create('test-id');

    await doMock.storage.put('key', 'value');
    const value = await doMock.storage.get('key');

    expect(value).toBe('value');
  });

  it('should support storage transactions', async () => {
    const doMock = factory.create('test-id');

    await doMock.storage.transaction(async (txn) => {
      await txn.put('key1', 'value1');
      await txn.put('key2', 'value2');
    });

    const value1 = await doMock.storage.get('key1');
    const value2 = await doMock.storage.get('key2');

    expect(value1).toBe('value1');
    expect(value2).toBe('value2');
  });

  it('should support alarms', async () => {
    const doMock = factory.create('test-id');

    await doMock.storage.setAlarm(new Date('2024-01-01'));
    const alarm = await doMock.storage.getAlarm();

    expect(alarm).toEqual(new Date('2024-01-01'));
  });
});

describe('TimerMock', () => {
  let timerMock: TimerMock;

  beforeEach(() => {
    timerMock = new TimerMock();
  });

  afterEach(() => {
    timerMock.uninstall();
  });

  it('should mock timers', () => {
    timerMock.install();

    let called = false;
    setTimeout(() => {
      called = true;
    }, 1000);

    timerMock.tick(1000);

    expect(called).toBe(true);
  });

  it('should mock intervals', () => {
    timerMock.install();

    let count = 0;
    setInterval(() => {
      count++;
    }, 100);

    timerMock.tick(500);

    expect(count).toBe(5);
  });

  it('should run all timers', () => {
    timerMock.install();

    let count = 0;
    setTimeout(() => count++, 100);
    setTimeout(() => count++, 200);

    timerMock.runAll();

    expect(count).toBe(2);
  });

  it('should clear all timers', () => {
    timerMock.install();

    setTimeout(() => {}, 100);
    setInterval(() => {}, 100);

    expect(timerMock.getTimerCount()).toBe(2);

    timerMock.clearAllTimers();

    expect(timerMock.getTimerCount()).toBe(0);
  });
});

describe('HTTPMock', () => {
  let httpMock: HTTPMock;

  beforeEach(() => {
    httpMock = new HTTPMock();
  });

  it('should mock HTTP requests', async () => {
    httpMock.mock('https://api.example.com/test', {
      status: 200,
      body: '{"success": true}',
    });

    const response = await httpMock.fetch('https://api.example.com/test');

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ success: true });
  });

  it('should support different methods', async () => {
    httpMock.mock('https://api.example.com/test', {
      method: 'POST',
      status: 201,
      body: '{"created": true}',
    });

    const response = await httpMock.fetch('https://api.example.com/test', {
      method: 'POST',
    });

    expect(response.status).toBe(201);
  });

  it('should clear all mocks', () => {
    httpMock.mock('https://api.example.com/test', {});
    httpMock.mock('https://api.example.com/other', {});

    httpMock.clearAll();

    // Should throw when trying to fetch cleared mock
    expect(httpMock.fetch('https://api.example.com/test')).rejects.toThrow();
  });
});

describe('Convenience Functions', () => {
  it('should create mock function', () => {
    const mockFn = mock((a: number, b: number) => a + b);
    expect(mockFn(1, 2)).toBe(3);
  });

  it('should create KV mock', () => {
    const kv = mockKV();
    expect(kv).toBeDefined();
  });

  it('should create R2 mock', () => {
    const r2 = mockR2();
    expect(r2).toBeDefined();
  });

  it('should create D1 mock', () => {
    const d1 = mockD1();
    expect(d1).toBeDefined();
  });

  it('should create Durable Object mock', () => {
    const doMock = mockDurableObject('test-id');
    expect(doMock).toBeDefined();
  });

  it('should use fake timers', () => {
    useFakeTimers();

    let called = false;
    setTimeout(() => {
      called = true;
    }, 1000);

    (global as any).__timerMock.tick(1000);

    expect(called).toBe(true);

    useRealTimers();
  });
});
