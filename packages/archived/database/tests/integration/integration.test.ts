/**
 * Integration Tests for Database Package
 */

import { DatabaseFactory, QuickDB } from '../../src/database';
import { DatabaseType, D1Config } from '../../src/types';

describe('Database Integration Tests', () => {
  describe('QuickDB', () => {
    let db: QuickDB;

    beforeEach(() => {
      db = new QuickDB({
        type: DatabaseType.D1,
        binding: 'DB',
        database: 'test',
      } as D1Config);
    });

    test('should create QuickDB instance', () => {
      expect(db).toBeInstanceOf(QuickDB);
    });

    test('should execute raw query', async () => {
      const adapter = db['adapter'];
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1,
      });

      const result = await db.query('SELECT * FROM users');

      expect(result.rowCount).toBe(1);
    });

    test('should create table query builder', () => {
      const query = db.table('users');

      expect(query).toBeDefined();
    });

    test('should execute transaction', async () => {
      const adapter = db['adapter'];
      adapter.query = jest.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      await db.transaction(async (trx) => {
        await trx.commit('INSERT INTO users (name) VALUES (?)', ['John']);
      });
    });
  });

  describe('withConnection helper', () => {
    test('should execute callback with connection', async () => {
      const { withConnection } = require('../../src/database');

      const mockAdapter = {
        connect: jest.fn(),
        disconnect: jest.fn(),
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      };

      const result = await withConnection(
        { type: DatabaseType.D1, binding: 'DB', database: 'test' } as D1Config,
        async (adapter) => {
          return await adapter.query('SELECT 1');
        }
      );

      expect(result).toBeDefined();
    });
  });

  describe('End-to-end workflow', () => {
    test('should complete full CRUD workflow', async () => {
      const db = new QuickDB({
        type: DatabaseType.D1,
        binding: 'DB',
        database: 'test',
      } as D1Config);

      const adapter = db['adapter'];

      // Setup
      adapter.query = jest.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [], rowCount: 0, affectedRows: 1, insertId: 1 }) // INSERT
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'John' }], rowCount: 1 }) // SELECT
        .mockResolvedValueOnce({ rows: [], rowCount: 0, affectedRows: 1 }) // UPDATE
        .mockResolvedValueOnce({ rows: [], rowCount: 0, affectedRows: 1 }); // DELETE

      // Create
      await db.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
      await db.query('INSERT INTO users (name) VALUES (?)', ['John']);

      // Read
      const user = await db.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(user.rows[0].name).toBe('John');

      // Update
      await db.query('UPDATE users SET name = ? WHERE id = ?', ['Jane', 1]);

      // Delete
      await db.query('DELETE FROM users WHERE id = ?', [1]);
    });
  });
});

describe('Migration Integration Tests', () => {
  const { MigrationManager, SchemaBuilder } = require('../../src/migrations/migrator');
  const { D1Adapter } = require('../../src/adapters/d1-adapter');

  test('should create and run migrations', async () => {
    const adapter = new D1Adapter({
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    });

    adapter.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    adapter.tableExists = jest.fn().mockResolvedValue(false);
    adapter.createTable = jest.fn().mockResolvedValue(undefined);

    const manager = new MigrationManager(adapter);
    await manager.initialize();

    expect(adapter.createTable).toHaveBeenCalled();
  });

  test('should build schema', async () => {
    const adapter = new D1Adapter({
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    });

    adapter.createTable = jest.fn().mockResolvedValue(undefined);
    adapter.addIndex = jest.fn().mockResolvedValue(undefined);

    const builder = new SchemaBuilder(adapter, 'users');
    builder
      .id()
      .string('name')
      .string('email')
      .timestamps();

    await builder.execute();

    expect(adapter.createTable).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({
        id: expect.objectContaining({ primaryKey: true }),
        name: expect.objectContaining({ type: 'string' }),
        email: expect.objectContaining({ type: 'string' }),
      })
    );
  });
});

describe('Transaction Integration Tests', () => {
  const { TransactionManager } = require('../../src/transaction/manager');
  const { D1Adapter } = require('../../src/adapters/d1-adapter');

  test('should execute transaction', async () => {
    const adapter = new D1Adapter({
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    });

    adapter.query = jest.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // INSERT
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

    const manager = new TransactionManager(adapter);

    const result = await manager.transaction(async (trx) => {
      await trx.commit('INSERT INTO users (name) VALUES (?)', ['John']);
      return 'success';
    });

    expect(result).toBe('success');
  });

  test('should rollback on error', async () => {
    const adapter = new D1Adapter({
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    });

    adapter.query = jest.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
      .mockRejectedValueOnce(new Error('DB Error')) // Error
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

    const manager = new TransactionManager(adapter);

    await expect(
      manager.transaction(async (trx) => {
        await trx.commit('INSERT INTO users (name) VALUES (?)', ['John']);
        throw new Error('DB Error');
      })
    ).rejects.toThrow('DB Error');
  });

  test('should handle nested transactions', async () => {
    const adapter = new D1Adapter({
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    });

    adapter.query = jest.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SAVEPOINT
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // INSERT
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // RELEASE SAVEPOINT
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT

    const manager = new TransactionManager(adapter);

    const result = await manager.transaction(async (trx) => {
      const nestedTrx = await manager.begin();

      await nestedTrx.commit('INSERT INTO users (name) VALUES (?)', ['John']);
      await manager.commit(nestedTrx);

      return 'success';
    });

    expect(result).toBe('success');
  });
});

describe('Pool Integration Tests', () => {
  const { ConnectionPool } = require('../../src/pool/pool');
  const { D1Adapter } = require('../../src/adapters/d1-adapter');

  test('should create and initialize pool', async () => {
    const pool = new ConnectionPool(D1Adapter, {
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    }, {
      max: 5,
      min: 2,
    });

    // Mock connection creation
    D1Adapter.prototype.connect = jest.fn().mockResolvedValue(undefined);

    await pool.initialize();

    const stats = pool.getStats();

    expect(stats.total).toBeGreaterThanOrEqual(0);
    expect(stats.max).toBe(5);
    expect(stats.min).toBe(2);
  });

  test('should acquire and release connections', async () => {
    const pool = new ConnectionPool(D1Adapter, {
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    });

    D1Adapter.prototype.connect = jest.fn().mockResolvedValue(undefined);

    await pool.initialize();

    const adapter = await pool.acquire();
    expect(adapter).toBeDefined();

    pool.release(adapter);

    const stats = pool.getStats();
    expect(stats.active).toBe(0);
  });
});

describe('Sharding Integration Tests', () => {
  const { ShardManager, ShardingStrategyFactory } = require('../../src/sharding/manager');

  test('should create hash-based sharding strategy', () => {
    const strategy = ShardingStrategyFactory.createHashStrategy(
      'user_id',
      [
        { id: 'shard1', database: 'db1', host: 'host1', port: 5432 },
        { id: 'shard2', database: 'db2', host: 'host2', port: 5432 },
      ]
    );

    expect(strategy.type).toBe('hash');
    expect(strategy.shardKey[0].field).toBe('user_id');
  });

  test('should create range-based sharding strategy', () => {
    const strategy = ShardingStrategyFactory.createRangeStrategy(
      'user_id',
      [
        { id: 'shard1', minValue: 0, maxValue: 1000 },
        { id: 'shard2', minValue: 1000, maxValue: 2000 },
      ],
      [
        { id: 'shard1', database: 'db1', host: 'host1', port: 5432 },
        { id: 'shard2', database: 'db2', host: 'host2', port: 5432 },
      ]
    );

    expect(strategy.type).toBe('range');
  });

  test('should create consistent hash sharding strategy', () => {
    const strategy = ShardingStrategyFactory.createConsistentHashStrategy(
      'user_id',
      [
        { id: 'shard1', database: 'db1', host: 'host1', port: 5432 },
        { id: 'shard2', database: 'db2', host: 'host2', port: 5432 },
      ]
    );

    expect(strategy.type).toBe('consistent_hash');
  });
});
