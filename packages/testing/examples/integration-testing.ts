/**
 * Integration Testing Examples
 *
 * Demonstrates integration testing with Cloudflare Workers services
 */

import { describe, it, expect, beforeEach, afterEach } from '@claudeflare/testing';
import {
  createIntegrationTest,
  createAPITester,
  IntegrationTestBuilder,
  APITester,
} from '@claudeflare/testing';

// ============================================================================
// KV Integration Testing
// ============================================================================

describe('KV Integration', () => {
  let environment: Awaited<ReturnType<IntegrationTestBuilder['build']>>;

  beforeEach(async () => {
    const builder = createIntegrationTest('kv-test')
      .addKV('TEST_KV')
      .addSeeds('TEST_KV', [
        {
          tableName: 'users',
          data: [
            { id: '1', name: 'Alice', email: 'alice@example.com' },
            { id: '2', name: 'Bob', email: 'bob@example.com' },
          ],
        },
      ]);

    environment = await builder.build();
  });

  afterEach(async () => {
    await environment.teardown();
  });

  it('should store and retrieve values from KV', async () => {
    const kv = environment.getService('TEST_KV');

    await kv.put('test-key', 'test-value');
    const value = await kv.get('test-key');

    expect(value).toBe('test-value');
  });

  it('should handle JSON values', async () => {
    const kv = environment.getService('TEST_KV');

    const user = { id: '1', name: 'Alice', email: 'alice@example.com' };
    await kv.put('user:1', JSON.stringify(user));

    const value = await kv.get('user:1', 'json');
    expect(value).toEqual(user);
  });

  it('should list keys with prefix', async () => {
    const kv = environment.getService('TEST_KV');

    await kv.put('user:1:name', 'Alice');
    await kv.put('user:1:email', 'alice@example.com');
    await kv.put('user:2:name', 'Bob');
    await kv.put('post:1:title', 'First Post');

    const result = await kv.list({ prefix: 'user:' });

    expect(result.keys).toHaveLength(3);
  });
});

// ============================================================================
// D1 Integration Testing
// ============================================================================

describe('D1 Integration', () => {
  let environment: Awaited<ReturnType<IntegrationTestBuilder['build']>>;

  beforeEach(async () => {
    const schema = `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE
      );
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `;

    const builder = createIntegrationTest('d1-test')
      .addD1('TEST_DB', schema)
      .addSeeds('TEST_DB', [
        {
          tableName: 'users',
          data: [
            { id: 1, name: 'Alice', email: 'alice@example.com' },
            { id: 2, name: 'Bob', email: 'bob@example.com' },
          ],
        },
        {
          tableName: 'posts',
          data: [
            { id: 1, user_id: 1, title: 'First Post', content: 'Hello World' },
            { id: 2, user_id: 1, title: 'Second Post', content: 'More content' },
          ],
        },
      ]);

    environment = await builder.build();
  });

  afterEach(async () => {
    await environment.teardown();
  });

  it('should query users from D1', async () => {
    const db = environment.getService('TEST_DB');

    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const result = await stmt.bind(1).first();

    expect(result).toEqual({
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('should insert new records', async () => {
    const db = environment.getService('TEST_DB');

    const stmt = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
    const result = await stmt.bind('Charlie', 'charlie@example.com').run();

    expect(result.success).toBe(true);
  });

  it('should handle transactions', async () => {
    const db = environment.getService('TEST_DB');

    await db.exec('BEGIN TRANSACTION');

    try {
      await db.prepare('INSERT INTO users (name, email) VALUES (?, ?)')
        .bind('David', 'david@example.com')
        .run();

      await db.prepare('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)')
        .bind(3, 'New Post', 'Content')
        .run();

      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }

    const user = await db.prepare('SELECT * FROM users WHERE name = ?')
      .bind('David')
      .first();

    expect(user).toBeDefined();
  });
});

// ============================================================================
// R2 Integration Testing
// ============================================================================

describe('R2 Integration', () => {
  let environment: Awaited<ReturnType<IntegrationTestBuilder['build']>>;

  beforeEach(async () => {
    const builder = createIntegrationTest('r2-test').addR2('TEST_BUCKET');
    environment = await builder.build();
  });

  afterEach(async () => {
    await environment.teardown();
  });

  it('should upload and download files', async () => {
    const r2 = environment.getService('TEST_BUCKET');

    await r2.put('test.txt', 'Hello, R2!');
    const object = await r2.get('test.txt');

    expect(object).toBeDefined();
    const text = await object?.text();
    expect(text).toBe('Hello, R2!');
  });

  it('should upload binary data', async () => {
    const r2 = environment.getService('TEST_BUCKET');

    const data = new Uint8Array([1, 2, 3, 4, 5]);
    await r2.put('binary.bin', data.buffer);

    const object = await r2.get('binary.bin');
    const downloaded = await object?.arrayBuffer();

    expect(new Uint8Array(downloaded!)).toEqual(data);
  });

  it('should list objects', async () => {
    const r2 = environment.getService('TEST_BUCKET');

    await r2.put('file1.txt', 'content1');
    await r2.put('file2.txt', 'content2');
    await r2.put('data/file3.txt', 'content3');

    const result = await r2.list({ prefix: 'file' });

    expect(result.objects).toHaveLength(2);
  });

  it('should delete objects', async () => {
    const r2 = environment.getService('TEST_BUCKET');

    await r2.put('to-delete.txt', 'content');
    await r2.delete('to-delete.txt');

    const object = await r2.get('to-delete.txt');
    expect(object).toBeNull();
  });
});

// ============================================================================
// Durable Object Integration Testing
// ============================================================================

describe('Durable Object Integration', () => {
  let environment: Awaited<ReturnType<IntegrationTestBuilder['build']>>;

  beforeEach(async () => {
    const builder = createIntegrationTest('do-test').addDurableObject('TEST_DO');
    environment = await builder.build();
  });

  afterEach(async () => {
    await environment.teardown();
  });

  it('should persist state in Durable Object storage', async () => {
    const doMock = environment.getService('TEST_DO');

    await doMock.storage.put('counter', 0);
    await doMock.storage.put('lastUpdated', new Date().toISOString());

    const counter = await doMock.storage.get<number>('counter');
    const lastUpdated = await doMock.storage.get<string>('lastUpdated');

    expect(counter).toBe(0);
    expect(lastUpdated).toBeDefined();
  });

  it('should support storage transactions', async () => {
    const doMock = environment.getService('TEST_DO');

    await doMock.storage.transaction(async (txn) => {
      await txn.put('balance', 100);
      await txn.put('updatedAt', Date.now());
    });

    const balance = await doMock.storage.get<number>('balance');
    expect(balance).toBe(100);
  });

  it('should handle alarms', async () => {
    const doMock = environment.getService('TEST_DO');

    const alarmTime = new Date(Date.now() + 60000); // 1 minute from now
    await doMock.storage.setAlarm(alarmTime);

    const alarm = await doMock.storage.getAlarm();
    expect(alarm).toEqual(alarmTime);
  });

  it('should list stored keys', async () => {
    const doMock = environment.getService('TEST_DO');

    await doMock.storage.put('key1', 'value1');
    await doMock.storage.put('key2', 'value2');
    await doMock.storage.put('key3', 'value3');

    const keys = await doMock.storage.list();
    expect(keys).toHaveLength(3);
  });
});

// ============================================================================
// API Testing
// ============================================================================

describe('API Testing', () => {
  let apiTester: APITester;

  beforeEach(() => {
    apiTester = createAPITester({
      baseURL: 'https://api.example.com',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
    });
  });

  it('should perform GET request', async () => {
    // This would make a real HTTP request
    // For testing, we'd mock this
    const response = await apiTester.get('/users/1');

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
  });

  it('should perform POST request', async () => {
    const userData = {
      name: 'Alice',
      email: 'alice@example.com',
    };

    const response = await apiTester.post('/users', userData);

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
  });

  it('should handle errors', async () => {
    try {
      await apiTester.get('/nonexistent');
    } catch (error: any) {
      expect(error.status).toBeGreaterThanOrEqual(400);
    }
  });
});

// ============================================================================
// Multi-Service Integration
// ============================================================================

describe('Multi-Service Integration', () => {
  let environment: Awaited<ReturnType<IntegrationTestBuilder['build']>>;

  beforeEach(async () => {
    const schema = `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL
      );
    `;

    const builder = createIntegrationTest('multi-service-test')
      .addKV('CACHE')
      .addD1('DATABASE', schema)
      .addR2('STORAGE')
      .addDurableObject('COUNTER');

    environment = await builder.build();
  });

  afterEach(async () => {
    await environment.teardown();
  });

  it('should integrate multiple services', async () => {
    const cache = environment.getService('CACHE');
    const db = environment.getService('DATABASE');
    const storage = environment.getService('STORAGE');

    // Cache user data
    await cache.put('user:1', JSON.stringify({ id: 1, name: 'Alice' }));

    // Store in database
    await db.prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?)')
      .bind(1, 'Alice', 'alice@example.com')
      .run();

    // Store file in R2
    await storage.put('users/1/profile.json', JSON.stringify({ id: 1, name: 'Alice' }));

    // Verify all services
    const cached = await cache.get('user:1', 'json');
    const dbUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(1).first();
    const file = await storage.get('users/1/profile.json');

    expect(cached).toEqual({ id: 1, name: 'Alice' });
    expect(dbUser).toBeDefined();
    expect(file).toBeDefined();
  });
});
