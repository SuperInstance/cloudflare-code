/**
 * Unit Tests for Query Builder
 */

import { QueryBuilder } from '../../src/query/builder';
import { D1Adapter } from '../../src/adapters/d1-adapter';
import { DatabaseType } from '../../src/types';

describe('QueryBuilder', () => {
  let adapter: D1Adapter;
  let query: QueryBuilder;

  beforeEach(() => {
    adapter = new D1Adapter({
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    });

    // Mock the query method
    adapter.query = jest.fn().mockResolvedValue({
      rows: [
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' },
      ],
      rowCount: 2,
      executionTime: 10,
    });

    query = new QueryBuilder(adapter, 'users');
  });

  describe('SELECT operations', () => {
    test('should build basic SELECT query', () => {
      query.select('id', 'name');
      const sql = query.toSQL();

      expect(sql).toContain('SELECT id, name');
      expect(sql).toContain('FROM `users`');
    });

    test('should build SELECT DISTINCT query', () => {
      query.selectDistinct('name');
      const sql = query.toSQL();

      expect(sql).toContain('SELECT DISTINCT name');
    });

    test('should build SELECT with all columns', () => {
      const sql = query.toSQL();

      expect(sql).toContain('SELECT *');
    });
  });

  describe('WHERE operations', () => {
    test('should build WHERE with equals', () => {
      query.where('status', 'active');
      const sql = query.toSQL();

      expect(sql).toContain('WHERE `status` = ?');
    });

    test('should build WHERE with multiple conditions', () => {
      query
        .where('status', 'active')
        .where('role', 'admin');

      const sql = query.toSQL();

      expect(sql).toContain('WHERE `status` = ? AND `role` = ?');
    });

    test('should build WHERE with OR', () => {
      query
        .where('status', 'active')
        .orWhere('status', 'pending');

      const sql = query.toSQL();

      expect(sql).toContain('WHERE `status` = ? OR `status` = ?');
    });

    test('should build WHERE with IN', () => {
      query.whereIn('role', ['admin', 'user', 'guest']);
      const sql = query.toSQL();

      expect(sql).toContain('WHERE `role` IN (?)');
    });

    test('should build WHERE with NOT IN', () => {
      query.whereNotIn('status', ['deleted', 'banned']);
      const sql = query.toSQL();

      expect(sql).toContain('WHERE `status` NOT IN (?)');
    });

    test('should build WHERE with BETWEEN', () => {
      query.whereBetween('age', 18, 65);
      const sql = query.toSQL();

      expect(sql).toContain('WHERE `age` BETWEEN ? AND ?');
    });

    test('should build WHERE with NULL check', () => {
      query.whereNull('deleted_at');
      const sql = query.toSQL();

      expect(sql).toContain('WHERE `deleted_at` IS NULL');
    });

    test('should build WHERE with NOT NULL check', () => {
      query.whereNotNull('email');
      const sql = query.toSQL();

      expect(sql).toContain('WHERE `email` IS NOT NULL');
    });

    test('should build WHERE with LIKE', () => {
      query.whereLike('name', 'John%');
      const sql = query.toSQL();

      expect(sql).toContain('WHERE `name` LIKE ?');
    });
  });

  describe('JOIN operations', () => {
    test('should build INNER JOIN', () => {
      query.innerJoin('posts', 'users.id', '=', 'posts.user_id');
      const sql = query.toSQL();

      expect(sql).toContain('INNER JOIN `posts` ON `users.id` = `posts.user_id`');
    });

    test('should build LEFT JOIN', () => {
      query.leftJoin('posts', 'users.id', '=', 'posts.user_id');
      const sql = query.toSQL();

      expect(sql).toContain('LEFT JOIN `posts` ON `users.id` = `posts.user_id`');
    });

    test('should build RIGHT JOIN', () => {
      query.rightJoin('posts', 'users.id', '=', 'posts.user_id');
      const sql = query.toSQL();

      expect(sql).toContain('RIGHT JOIN `posts` ON `users.id` = `posts.user_id`');
    });

    test('should build CROSS JOIN', () => {
      query.crossJoin('posts');
      const sql = query.toSQL();

      expect(sql).toContain('CROSS JOIN `posts`');
    });
  });

  describe('GROUP BY and HAVING', () => {
    test('should build GROUP BY', () => {
      query.groupBy('role', 'status');
      const sql = query.toSQL();

      expect(sql).toContain('GROUP BY `role`, `status`');
    });

    test('should build HAVING', () => {
      query.groupBy('role').having('COUNT(*)', '>', 5);
      const sql = query.toSQL();

      expect(sql).toContain('GROUP BY `role`');
      expect(sql).toContain('HAVING `COUNT(*)` > ?');
    });
  });

  describe('ORDER BY', () => {
    test('should build ORDER BY ASC', () => {
      query.orderBy('name', 'ASC');
      const sql = query.toSQL();

      expect(sql).toContain('ORDER BY `name` ASC');
    });

    test('should build ORDER BY DESC', () => {
      query.orderByDesc('created_at');
      const sql = query.toSQL();

      expect(sql).toContain('ORDER BY `created_at` DESC');
    });

    test('should build ORDER BY with multiple columns', () => {
      query
        .orderBy('role', 'ASC')
        .orderBy('created_at', 'DESC');

      const sql = query.toSQL();

      expect(sql).toContain('ORDER BY `role` ASC, `created_at` DESC');
    });
  });

  describe('LIMIT and OFFSET', () => {
    test('should build LIMIT', () => {
      query.limit(10);
      const sql = query.toSQL();

      expect(sql).toContain('LIMIT 10');
    });

    test('should build OFFSET', () => {
      query.offset(20);
      const sql = query.toSQL();

      expect(sql).toContain('OFFSET 20');
    });

    test('should build LIMIT with OFFSET', () => {
      query
        .limit(10)
        .offset(20);

      const sql = query.toSQL();

      expect(sql).toContain('LIMIT 10');
      expect(sql).toContain('OFFSET 20');
    });
  });

  describe('Aggregation', () => {
    test('should execute COUNT query', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ count: 100 }],
        rowCount: 1,
      });

      const count = await query.count();

      expect(count).toBe(100);
    });

    test('should execute SUM query', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ sum: 5000 }],
        rowCount: 1,
      });

      const sum = await query.sum('salary');

      expect(sum).toBe(5000);
    });

    test('should execute AVG query', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ avg: 50 }],
        rowCount: 1,
      });

      const avg = await query.avg('age');

      expect(avg).toBe(50);
    });

    test('should execute MIN query', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ min: 18 }],
        rowCount: 1,
      });

      const min = await query.min('age');

      expect(min).toBe(18);
    });

    test('should execute MAX query', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ max: 65 }],
        rowCount: 1,
      });

      const max = await query.max('age');

      expect(max).toBe(65);
    });
  });

  describe('Query execution', () => {
    test('should execute get query', async () => {
      const rows = await query.get();

      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('John');
    });

    test('should execute first query', async () => {
      const first = await query.first();

      expect(first).not.toBeNull();
      expect(first?.name).toBe('John');
    });

    test('should execute find query', async () => {
      const found = await query.find(1);

      expect(found).not.toBeNull();
    });

    test('should execute value query', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ name: 'John' }],
        rowCount: 1,
      });

      const value = await query.value('name');

      expect(value).toBe('John');
    });

    test('should execute pluck query', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [
          { name: 'John' },
          { name: 'Jane' },
        ],
        rowCount: 2,
      });

      const names = await query.pluck('name');

      expect(names).toEqual(['John', 'Jane']);
    });

    test('should execute exists query', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ id: 1 }],
        rowCount: 1,
      });

      const exists = await query.exists();

      expect(exists).toBe(true);
    });

    test('should execute chunk query', async () => {
      const chunks: any[][] = [];
      adapter.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{ id: 1 }, { id: 2 }],
          rowCount: 2,
        })
        .mockResolvedValueOnce({
          rows: [{ id: 3 }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        });

      await query.chunk(2, (rows) => {
        chunks.push(rows);
      });

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toHaveLength(2);
      expect(chunks[1]).toHaveLength(1);
    });
  });

  describe('Pagination', () => {
    test('should execute paginate query', async () => {
      adapter.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{ id: 1 }, { id: 2 }],
          rowCount: 2,
        })
        .mockResolvedValueOnce({
          rows: [{ count: 25 }],
          rowCount: 1,
        });

      const result = await query.paginate(1, 2);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(25);
      expect(result.currentPage).toBe(1);
      expect(result.lastPage).toBe(13);
      expect(result.perPage).toBe(2);
    });

    test('should execute simple paginate query', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
        rowCount: 3,
      });

      const result = await query.simplePaginate(1, 2);

      expect(result.data).toHaveLength(2);
      expect(result.hasMorePages).toBe(true);
    });
  });

  describe('CTE (Common Table Expressions)', () => {
    test('should build CTE', () => {
      const subQuery = new QueryBuilder(adapter, 'posts');
      query.with('user_posts', subQuery);

      const sql = query.toSQL();

      expect(sql).toContain('WITH');
      expect(sql).toContain('AS');
    });

    test('should build recursive CTE', () => {
      query.withRecursive('category_tree', 'SELECT * FROM categories WHERE parent_id IS NULL');

      const sql = query.toSQL();

      expect(sql).toContain('WITH RECURSIVE');
    });
  });

  describe('Query cloning', () => {
    test('should clone query builder', () => {
      query
        .where('status', 'active')
        .orderBy('name');

      const cloned = query.clone();

      expect(cloned).not.toBe(query);
      expect(cloned.toSQL()).toBe(query.toSQL());
    });
  });
});

describe('InsertBuilder', () => {
  const { InsertBuilder } = require('../../src/query/builder');
  const { D1Adapter } = require('../../src/adapters/d1-adapter');

  let adapter: D1Adapter;
  let insert: any;

  beforeEach(() => {
    adapter = new D1Adapter({
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    });

    insert = new InsertBuilder(adapter, 'users');
  });

  test('should build insert query', () => {
    insert.set({ name: 'John', email: 'john@example.com' });

    expect(insert['data']).toEqual({
      name: 'John',
      email: 'john@example.com',
    });
  });
});

describe('UpdateBuilder', () => {
  const { UpdateBuilder } = require('../../src/query/builder');
  const { D1Adapter } = require('../../src/adapters/d1-adapter');

  let adapter: D1Adapter;
  let update: any;

  beforeEach(() => {
    adapter = new D1Adapter({
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    });

    update = new UpdateBuilder(adapter, 'users');
  });

  test('should build update query', () => {
    update
      .set({ name: 'Jane' })
      .where('id', 1);

    expect(update['data']).toEqual({ name: 'Jane' });
    expect(update['where']).toHaveLength(1);
  });
});

describe('DeleteBuilder', () => {
  const { DeleteBuilder } = require('../../src/query/builder');
  const { D1Adapter } = require('../../src/adapters/d1-adapter');

  let adapter: D1Adapter;
  let deleteBuilder: any;

  beforeEach(() => {
    adapter = new D1Adapter({
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    });

    deleteBuilder = new DeleteBuilder(adapter, 'users');
  });

  test('should build delete query', () => {
    deleteBuilder.where('id', 1);

    expect(deleteBuilder['where']).toHaveLength(1);
  });
});
