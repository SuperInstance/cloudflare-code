/**
 * Unit Tests for Database Adapters
 */

import { D1Adapter } from '../../src/adapters/d1-adapter';
import { PostgreSQLAdapter } from '../../src/adapters/postgres-adapter';
import { MySQLAdapter } from '../../src/adapters/mysql-adapter';
import { MongoDBAdapter } from '../../src/adapters/mongodb-adapter';
import { RedisAdapter } from '../../src/adapters/redis-adapter';
import { DatabaseType } from '../../src/types';

describe('Database Adapters', () => {
  describe('D1Adapter', () => {
    let adapter: D1Adapter;

    beforeEach(() => {
      adapter = new D1Adapter({
        type: DatabaseType.D1,
        binding: 'DB',
        database: 'test',
      });
    });

    test('should create adapter instance', () => {
      expect(adapter).toBeInstanceOf(D1Adapter);
      expect(adapter.getType()).toBe(DatabaseType.D1);
    });

    test('should quote identifiers correctly', () => {
      expect(adapter['quoteIdentifier']('table_name')).toBe('`table_name`');
      expect(adapter['quoteIdentifier']('table`name')).toBe('`table``name`');
    });

    test('should return correct placeholder', () => {
      expect(adapter['getPlaceholder']()).toBe('?');
    });

    test('should build SELECT query', () => {
      const query = adapter['buildSelectQuery']('users', {
        select: ['id', 'name'],
        where: [{ field: 'status', operator: '=', value: 'active', logic: undefined }],
        limit: 10,
      });

      expect(query).toContain('SELECT');
      expect(query).toContain('id, name');
      expect(query).toContain('FROM `users`');
      expect(query).toContain('WHERE');
      expect(query).toContain('LIMIT 10');
    });

    test('should build INSERT query', () => {
      const data = { name: 'John', email: 'john@example.com' };
      const query = adapter['buildInsertQuery']('users', data);

      expect(query).toContain('INSERT INTO `users`');
      expect(query).toContain('(`name`, `email`)');
      expect(query).toContain('VALUES (?, ?)');
    });

    test('should build UPDATE query', () => {
      const data = { name: 'Jane' };
      const where = [{ field: 'id', operator: '=', value: 1 } as any];
      const query = adapter['buildUpdateQuery']('users', data, where);

      expect(query).toContain('UPDATE `users`');
      expect(query).toContain('SET `name` = ?');
      expect(query).toContain('WHERE `id` = ?');
    });

    test('should build DELETE query', () => {
      const where = [{ field: 'id', operator: '=', value: 1 } as any];
      const query = adapter['buildDeleteQuery']('users', where);

      expect(query).toContain('DELETE FROM `users`');
      expect(query).toContain('WHERE `id` = ?');
    });

    test('should build condition clause', () => {
      const conditions = [
        { field: 'status', operator: '=', value: 'active', logic: undefined },
        { field: 'role', operator: 'IN', value: ['admin', 'user'], logic: 'AND' },
        { field: 'deleted_at', operator: 'IS NULL', value: undefined, logic: 'AND' },
      ] as any;

      const clause = adapter['buildConditionClause'](conditions);

      expect(clause).toContain('`status` = ?');
      expect(clause).toContain('AND `role` IN (?)');
      expect(clause).toContain('AND `deleted_at` IS NULL');
    });
  });

  describe('PostgreSQLAdapter', () => {
    let adapter: PostgreSQLAdapter;

    beforeEach(() => {
      adapter = new PostgreSQLAdapter({
        type: DatabaseType.POSTGRESQL,
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'user',
        password: 'pass',
      });
    });

    test('should create adapter instance', () => {
      expect(adapter).toBeInstanceOf(PostgreSQLAdapter);
      expect(adapter.getType()).toBe(DatabaseType.POSTGRESQL);
    });

    test('should quote identifiers correctly', () => {
      expect(adapter['quoteIdentifier']('table_name')).toBe('"table_name"');
      expect(adapter['quoteIdentifier']('table"name"')).toBe('"table""name""');
    });

    test('should transform placeholders for PostgreSQL', () => {
      const sql = 'SELECT * FROM users WHERE id = ? AND name = ?';
      const transformed = adapter['transformPlaceholders'](sql);

      expect(transformed).toBe('SELECT * FROM users WHERE id = $1 AND name = $2');
    });

    test('should map PostgreSQL types to JavaScript types', () => {
      expect(adapter['postgresTypeToType'](23)).toBe('number');   // int4
      expect(adapter['postgresTypeToType'](1043)).toBe('string'); // varchar
      expect(adapter['postgresTypeToType'](16)).toBe('boolean');  // bool
      expect(adapter['postgresTypeToType'](1114)).toBe('date');   // timestamp
    });
  });

  describe('MySQLAdapter', () => {
    let adapter: MySQLAdapter;

    beforeEach(() => {
      adapter = new MySQLAdapter({
        type: DatabaseType.MYSQL,
        host: 'localhost',
        port: 3306,
        database: 'test',
        username: 'user',
        password: 'pass',
      });
    });

    test('should create adapter instance', () => {
      expect(adapter).toBeInstanceOf(MySQLAdapter);
      expect(adapter.getType()).toBe(DatabaseType.MYSQL);
    });

    test('should quote identifiers correctly', () => {
      expect(adapter['quoteIdentifier']('table_name')).toBe('`table_name`');
      expect(adapter['quoteIdentifier']('table`name`')).toBe('`table``name``');
    });

    test('should map MySQL types to JavaScript types', () => {
      expect(adapter['mysqlTypeToType'](3)).toBe('number');   // INT
      expect(adapter['mysqlTypeToType'](253)).toBe('string'); // VARCHAR
      expect(adapter['mysqlTypeToType'](1)).toBe('number');   // TINYINT (boolean)
      expect(adapter['mysqlTypeToType'](10)).toBe('date');    // DATE
    });
  });

  describe('MongoDBAdapter', () => {
    let adapter: MongoDBAdapter;

    beforeEach(() => {
      adapter = new MongoDBAdapter({
        type: DatabaseType.MONGODB,
        url: 'mongodb://localhost:27017',
        database: 'test',
      });
    });

    test('should create adapter instance', () => {
      expect(adapter).toBeInstanceOf(MongoDBAdapter);
      expect(adapter.getType()).toBe(DatabaseType.MONGODB);
    });

    test('should build MongoDB filter', () => {
      const conditions = [
        { field: 'status', operator: '=', value: 'active', logic: undefined },
        { field: 'age', operator: '>', value: 18, logic: 'AND' },
        { field: 'tags', operator: 'IN', value: ['tag1', 'tag2'], logic: 'AND' },
      ] as any;

      const filter = adapter['buildMongoFilter'](conditions);

      expect(filter.status).toBe('active');
      expect(filter.age).toEqual({ $gt: 18 });
      expect(filter.tags).toEqual({ $in: ['tag1', 'tag2'] });
    });

    test('should infer field types', () => {
      expect(adapter['inferType']('string')).toBe('string');
      expect(adapter['inferType'](123)).toBe('number');
      expect(adapter['inferType'](true)).toBe('boolean');
      expect(adapter['inferType'](new Date())).toBe('date');
      expect(adapter['inferType']([1, 2, 3])).toBe('array');
      expect(adapter['inferType']({ key: 'value' })).toBe('object');
    });
  });

  describe('RedisAdapter', () => {
    let adapter: RedisAdapter;

    beforeEach(() => {
      adapter = new RedisAdapter({
        type: DatabaseType.REDIS,
        host: 'localhost',
        port: 6379,
        database: 0,
      });
    });

    test('should create adapter instance', () => {
      expect(adapter).toBeInstanceOf(RedisAdapter);
      expect(adapter.getType()).toBe(DatabaseType.REDIS);
    });

    test('should quote identifiers correctly', () => {
      expect(adapter['quoteIdentifier']('key:name')).toBe('key:name');
    });
  });

  describe('DatabaseFactory', () => {
    const { DatabaseFactory } = require('../../src/database');

    test('should create D1 adapter', () => {
      const adapter = DatabaseFactory.createAdapter({
        type: DatabaseType.D1,
        binding: 'DB',
        database: 'test',
      });

      expect(adapter).toBeInstanceOf(D1Adapter);
    });

    test('should create PostgreSQL adapter', () => {
      const adapter = DatabaseFactory.createAdapter({
        type: DatabaseType.POSTGRESQL,
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'user',
        password: 'pass',
      });

      expect(adapter).toBeInstanceOf(PostgreSQLAdapter);
    });

    test('should create MySQL adapter', () => {
      const adapter = DatabaseFactory.createAdapter({
        type: DatabaseType.MYSQL,
        host: 'localhost',
        port: 3306,
        database: 'test',
        username: 'user',
        password: 'pass',
      });

      expect(adapter).toBeInstanceOf(MySQLAdapter);
    });

    test('should throw error for unsupported database type', () => {
      expect(() => {
        DatabaseFactory.createAdapter({
          type: 'unknown' as any,
          database: 'test',
        } as any);
      }).toThrow('Unsupported database type');
    });
  });
});

describe('Connection Pool', () => {
  const { ConnectionPool } = require('../../src/pool/pool');
  const { D1Adapter } = require('../../src/adapters/d1-adapter');

  test('should create connection pool', async () => {
    const pool = new ConnectionPool(D1Adapter, {
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    }, {
      max: 10,
      min: 2,
    });

    const stats = pool.getStats();

    expect(stats.max).toBe(10);
    expect(stats.min).toBe(2);
    expect(stats.total).toBe(0);
  });

  test('should track pool statistics', () => {
    const pool = new ConnectionPool(D1Adapter, {
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    });

    const metrics = pool.getMetrics();

    expect(metrics).toHaveProperty('totalAcquires');
    expect(metrics).toHaveProperty('totalReleases');
    expect(metrics).toHaveProperty('totalCreates');
  });
});

describe('Transaction Manager', () => {
  const { TransactionManager } = require('../../src/transaction/manager');
  const { D1Adapter } = require('../../src/adapters/d1-adapter');

  test('should create transaction manager', () => {
    const adapter = new D1Adapter({
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    });

    const manager = new TransactionManager(adapter);

    expect(manager.getTransactionCount()).toBe(0);
    expect(manager.hasActiveTransactions()).toBe(false);
  });

  test('should generate unique transaction IDs', () => {
    const adapter = new D1Adapter({
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    });

    const manager = new TransactionManager(adapter);

    const id1 = manager['generateTransactionId']();
    const id2 = manager['generateTransactionId']();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^tx_/);
  });
});
