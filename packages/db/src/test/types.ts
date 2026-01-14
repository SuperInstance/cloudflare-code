/**
 * Migration testing types and interfaces
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Migration } from '../migrations/migration';

export interface TestContext {
  db: D1Database;
  migration: Migration;
}

export interface TestCase {
  name: string;
  fn: (context: TestContext) => Promise<void>;
}

export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

export interface TestSuite {
  name: string;
  tests: TestCase[];
  setup?: (context: TestContext) => Promise<void>;
  teardown?: (context: TestContext) => Promise<void>;
}

export interface AssertionContext {
  db: D1Database;
}

/**
 * Assertion helpers for migration testing
 */
export class MigrationAssertions {
  constructor(private readonly context: AssertionContext) {}

  /**
   * Assert table exists
   */
  async assertTableExists(tableName: string): Promise<void> {
    const result = await this.context.db
      .prepare(
        `
        SELECT name FROM sqlite_master
        WHERE type='table' AND name=?
      `
      )
      .bind(tableName)
      .first();

    if (!result) {
      throw new Error(`Table '${tableName}' does not exist`);
    }
  }

  /**
   * Assert table does not exist
   */
  async assertTableNotExists(tableName: string): Promise<void> {
    const result = await this.context.db
      .prepare(
        `
        SELECT name FROM sqlite_master
        WHERE type='table' AND name=?
      `
      )
      .bind(tableName)
      .first();

    if (result) {
      throw new Error(`Table '${tableName}' exists but should not`);
    }
  }

  /**
   * Assert column exists
   */
  async assertColumnExists(tableName: string, columnName: string): Promise<void> {
    const result = await this.context.db
      .prepare(
        `
        SELECT COUNT(*) as count FROM pragma_table_info(?)
        WHERE name=?
      `
      )
      .bind(tableName, columnName)
      .first();

    const count = (result as any)?.count || 0;

    if (count === 0) {
      throw new Error(`Column '${columnName}' does not exist in table '${tableName}'`);
    }
  }

  /**
   * Assert column has type
   */
  async assertColumnType(
    tableName: string,
    columnName: string,
    expectedType: string
  ): Promise<void> {
    const result = await this.context.db
      .prepare(
        `
        SELECT type FROM pragma_table_info(?)
        WHERE name=?
      `
      )
      .bind(tableName, columnName)
      .first();

    const actualType = (result as any)?.type;

    if (!actualType) {
      throw new Error(`Column '${columnName}' not found in table '${tableName}'`);
    }

    if (!actualType.toUpperCase().includes(expectedType.toUpperCase())) {
      throw new Error(
        `Column '${columnName}' has type '${actualType}' but expected '${expectedType}'`
      );
    }
  }

  /**
   * Assert column is nullable
   */
  async assertColumnNullable(tableName: string, columnName: string): Promise<void> {
    const result = await this.context.db
      .prepare(
        `
        SELECT "notnull" FROM pragma_table_info(?)
        WHERE name=?
      `
      )
      .bind(tableName, columnName)
      .first();

    const notNull = (result as any)?.notnull;

    if (notNull === 1) {
      throw new Error(`Column '${columnName}' is NOT NULL but should be nullable`);
    }
  }

  /**
   * Assert column is not nullable
   */
  async assertColumnNotNull(tableName: string, columnName: string): Promise<void> {
    const result = await this.context.db
      .prepare(
        `
        SELECT "notnull" FROM pragma_table_info(?)
        WHERE name=?
      `
      )
      .bind(tableName, columnName)
      .first();

    const notNull = (result as any)?.notnull;

    if (notNull !== 1) {
      throw new Error(`Column '${columnName}' is nullable but should be NOT NULL`);
    }
  }

  /**
   * Assert index exists
   */
  async assertIndexExists(indexName: string): Promise<void> {
    const result = await this.context.db
      .prepare(
        `
        SELECT name FROM sqlite_master
        WHERE type='index' AND name=?
      `
      )
      .bind(indexName)
      .first();

    if (!result) {
      throw new Error(`Index '${indexName}' does not exist`);
    }
  }

  /**
   * Assert foreign key exists
   */
  async assertForeignKeyExists(
    tableName: string,
    columnName: string,
    refTable: string,
    refColumn: string
  ): Promise<void> {
    const result = await this.context.db
      .prepare(`PRAGMA foreign_key_list(${tableName})`)
      .all();

    const fks = (result.results || []) as any[];

    const found = fks.some(
      (fk) =>
        fk.from === columnName && fk.table === refTable && fk.to === refColumn
    );

    if (!found) {
      throw new Error(
        `Foreign key from '${tableName}.${columnName}' to '${refTable}.${refColumn}' does not exist`
      );
    }
  }

  /**
   * Assert row count in table
   */
  async assertRowCount(tableName: string, expectedCount: number): Promise<void> {
    const result = await this.context.db
      .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
      .first();

    const actualCount = (result as any)?.count || 0;

    if (actualCount !== expectedCount) {
      throw new Error(
        `Table '${tableName}' has ${actualCount} rows but expected ${expectedCount}`
      );
    }
  }

  /**
   * Assert value exists in table
   */
  async assertValueExists(
    tableName: string,
    column: string,
    value: any
  ): Promise<void> {
    const result = await this.context.db
      .prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE ${column} = ?`)
      .bind(value)
      .first();

    const count = (result as any)?.count || 0;

    if (count === 0) {
      throw new Error(
        `No row found in '${tableName}' where ${column} = ${JSON.stringify(value)}`
      );
    }
  }

  /**
   * Assert unique constraint
   */
  async assertUnique(tableName: string, columns: string[]): Promise<void> {
    // This would require checking indexes or trying to insert duplicates
    // For now, just check if a unique index exists
    const indexName = `${tableName}_${columns.join('_')}_unique`;

    try {
      await this.assertIndexExists(indexName);
    } catch {
      throw new Error(`Unique constraint not found for ${tableName}.${columns.join(', ')}`);
    }
  }
}

/**
 * Create test case
 */
export function test(name: string, fn: (context: TestContext) => Promise<void>): TestCase {
  return { name, fn };
}

/**
 * Create test suite
 */
export function describe(name: string, tests: TestCase[]): TestSuite {
  return { name, tests };
}

/**
 * Create test suite with hooks
 */
export function describeWithHooks(
  name: string,
  tests: TestCase[],
  hooks: {
    setup?: (context: TestContext) => Promise<void>;
    teardown?: (context: TestContext) => Promise<void>;
  }
): TestSuite {
  return { name, tests, setup: hooks.setup, teardown: hooks.teardown };
}
