/**
 * Migration testing helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { MigrationContext } from '../migrations/migration';
import type { MigrationAssertions } from './types';

/**
 * Create test database helper
 */
export class TestDatabaseHelper {
  constructor(private readonly db: D1Database) {}

  /**
   * Get all table names
   */
  async getTables(): Promise<string[]> {
    const result = await this.db
      .prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)
      .all();

    return (result.results || []).map((r: any) => r.name as string);
  }

  /**
   * Get table schema
   */
  async getTableSchema(tableName: string): Promise<any[]> {
    const result = await this.db.prepare(`PRAGMA table_info(${tableName})`).all();
    return result.results || [];
  }

  /**
   * Get all indexes
   */
  async getIndexes(): Promise<Array<{ name: string; table: string }>> {
    const result = await this.db
      .prepare(`
        SELECT name, tbl_name as table FROM sqlite_master
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)
      .all();

    return (result.results || []).map((r: any) => ({
      name: r.name,
      table: r.table
    }));
  }

  /**
   * Get row count for all tables
   */
  async getTableRowCounts(): Promise<Record<string, number>> {
    const tables = await this.getTables();
    const counts: Record<string, number> = {};

    for (const table of tables) {
      const result = await this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).first();
      counts[table] = (result as any)?.count || 0;
    }

    return counts;
  }

  /**
   * Truncate all tables (for cleanup)
   */
  async truncateAllTables(): Promise<void> {
    const tables = await this.getTables();

    for (const table of tables) {
      await this.db.prepare(`DELETE FROM ${table}`).run();
    }
  }

  /**
   * Drop all tables (for cleanup)
   */
  async dropAllTables(): Promise<void> {
    const tables = await this.getTables();

    for (const table of tables) {
      await this.db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
    }
  }

  /**
   * Execute SQL file
   */
  async executeSQL(sql: string): Promise<void> {
    await this.db.exec(sql);
  }

  /**
   * Dump database schema
   */
  async dumpSchema(): Promise<string> {
    const tables = await this.getTables();
    const lines: string[] = [];

    for (const table of tables) {
      const schema = await this.getTableSchema(table);
      lines.push(`-- Table: ${table}`);
      for (const col of schema) {
        lines.push(
          `  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`
        );
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

/**
 * Test migration with rollback
 */
export async function testMigrationWithRollback(
  db: D1Database,
  migration: any,
  assertions: MigrationAssertions
): Promise<boolean> {
  const context: MigrationContext = { db, env: 'test' };

  try {
    // Test up migration
    await migration.up(context);

    // Validate up migration
    if (migration.validate) {
      const isValid = await migration.validate(context);
      if (!isValid) {
        throw new Error('Migration validation failed after up');
      }
    }

    // Test down migration
    await migration.down(context);

    return true;
  } catch (error) {
    console.error(`Migration test failed for ${migration.name}:`, error);
    return false;
  }
}

/**
 * Test all migrations in sequence
 */
export async function testAllMigrations(
  db: D1Database,
  migrations: any[]
): Promise<{ passed: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  for (const migration of migrations) {
    try {
      const context: MigrationContext = { db, env: 'test' };

      // Run up
      await migration.up(context);

      // Validate
      if (migration.validate) {
        const isValid = await migration.validate(context);
        if (!isValid) {
          throw new Error('Validation failed');
        }
      }

      // Run down
      await migration.down(context);

      passed++;
    } catch (error) {
      failed++;
      errors.push(`${migration.name}: ${error}`);
    }
  }

  return { passed, failed, errors };
}

/**
 * Benchmark migration performance
 */
export async function benchmarkMigration(
  db: D1Database,
  migration: any,
  iterations: number = 10
): Promise<{ avgDuration: number; minDuration: number; maxDuration: number; durations: number[] }> {
  const durations: number[] = [];
  const context: MigrationContext = { db, env: 'test' };

  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();

    await migration.up(context);
    await migration.down(context);

    durations.push(Date.now() - startTime);
  }

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  return {
    avgDuration,
    minDuration,
    maxDuration,
    durations
  };
}
