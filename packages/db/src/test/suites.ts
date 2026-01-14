/**
 * Predefined test suites for migrations
 */

import { test, describe, describeWithHooks } from './types';
import type { Migration } from '../migrations/migration';

/**
 * Create basic table test suite
 */
export function createTableTestSuite(migration: Migration, tableName: string) {
  return describe(`Table: ${tableName}`, [
    test(`table ${tableName} should exist`, async ({ assertions }) => {
      await assertions.assertTableExists(tableName);
    }),

    test(`table ${tableName} should have created_at column`, async ({ assertions }) => {
      await assertions.assertColumnExists(tableName, 'created_at');
    }),

    test(`table ${tableName} should have updated_at column`, async ({ assertions }) => {
      await assertions.assertColumnExists(tableName, 'updated_at');
    })
  ]);
}

/**
 * Create foreign key test suite
 */
export function createForeignKeyTestSuite(
  migration: Migration,
  table: string,
  column: string,
  refTable: string,
  refColumn: string
) {
  return describe(
    `Foreign Key: ${table}.${column} -> ${refTable}.${refColumn}`,
    [
      test(`foreign key should exist`, async ({ assertions }) => {
        await assertions.assertForeignKeyExists(table, column, refTable, refColumn);
      })
    ]
  );
}

/**
 * Create index test suite
 */
export function createIndexTestSuite(migration: Migration, indexName: string) {
  return describe(`Index: ${indexName}`, [
    test(`index ${indexName} should exist`, async ({ assertions }) => {
      await assertions.assertIndexExists(indexName);
    })
  ]);
}

/**
 * Create complete migration test suite
 */
export function createMigrationTestSuite(migration: Migration) {
  return describeWithHooks(
    `Migration: ${migration.name}`,
    [
      test('should apply up migration without errors', async ({ db, migration: m }) => {
        const context = { db, env: 'test' };
        await m.up(context);
      }),

      test('should pass validation after up migration', async ({ db, migration: m }) => {
        const context = { db, env: 'test' };

        if (m.validate) {
          const isValid = await m.validate(context);
          if (!isValid) {
            throw new Error('Migration validation failed');
          }
        }
      }),

      test('should apply down migration without errors', async ({ db, migration: m }) => {
        const context = { db, env: 'test' };
        await m.down(context);
      }),

      test('should be idempotent - up twice should work', async ({ db, migration: m }) => {
        const context = { db, env: 'test' };
        await m.up(context);
        await m.up(context); // Should not fail
      }),

      test('should be reversible - up then down then up', async ({ db, migration: m }) => {
        const context = { db, env: 'test' };
        await m.up(context);
        await m.down(context);
        await m.up(context);
      })
    ],
    {
      setup: async ({ db, migration: m }) => {
        // Ensure clean state
        const context = { db, env: 'test' };
        try {
          await m.down(context);
        } catch {
          // Ignore if migration was never applied
        }
      },
      teardown: async ({ db, migration: m }) => {
        // Clean up after test
        const context = { db, env: 'test' };
        try {
          await m.down(context);
        } catch {
          // Ignore errors during cleanup
        }
      }
    }
  );
}

/**
 * Create data integrity test suite
 */
export function createDataIntegrityTestSuite(migration: Migration, tableName: string) {
  return describe(`Data Integrity: ${tableName}`, [
    test(`should be able to insert data into ${tableName}`, async ({ db }) => {
      try {
        const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all();
        const cols = (columns.results || [])
          .filter((c: any) => c.name !== 'id' && !c.pk)
          .map((c: any) => c.name)
          .slice(0, 3);

        if (cols.length === 0) {
          return; // Skip if no columns to test
        }

        const placeholders = cols.map(() => '?').join(', ');
        const values = cols.map(() => 'test_value');

        await db
          .prepare(`INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`)
          .bind(...values)
          .run();
      } catch (error) {
        throw new Error(`Failed to insert test data: ${error}`);
      }
    }),

    test(`should be able to query data from ${tableName}`, async ({ db }) => {
      const result = await db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).first();
      const count = (result as any)?.count || 0;
      if (count < 0) {
        throw new Error('Invalid row count');
      }
    })
  ]);
}

/**
 * Create performance test suite
 */
export function createPerformanceTestSuite(migration: Migration, maxDuration: number = 5000) {
  return describe(`Performance: ${migration.name}`, [
    test(`up migration should complete within ${maxDuration}ms`, async ({ db, migration: m }) => {
      const context = { db, env: 'test' };
      const startTime = Date.now();

      await m.up(context);

      const duration = Date.now() - startTime;
      if (duration > maxDuration) {
        throw new Error(`Migration took ${duration}ms, expected < ${maxDuration}ms`);
      }
    }),

    test(`down migration should complete within ${maxDuration}ms`, async ({ db, migration: m }) => {
      const context = { db, env: 'test' };
      const startTime = Date.now();

      await m.down(context);

      const duration = Date.now() - startTime;
      if (duration > maxDuration) {
        throw new Error(`Rollback took ${duration}ms, expected < ${maxDuration}ms`);
      }
    })
  ]);
}
