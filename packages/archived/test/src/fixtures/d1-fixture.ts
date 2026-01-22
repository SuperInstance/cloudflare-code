/**
 * D1 Test Fixture
 *
 * Provides isolated D1 database for testing with automatic cleanup
 */

import { beforeEach, afterEach } from 'vitest';
import { generateTestId } from '../e2e/setup';

export interface D1FixtureRow {
  [column: string]: any;
}

export interface D1FixtureTable {
  name: string;
  rows: D1FixtureRow[];
  schema?: string;
}

export class D1Fixture {
  private tables: Map<string, D1FixtureTable> = new Map();
  private testId: string;

  constructor(testId?: string) {
    this.testId = testId || generateTestId();
  }

  /**
   * Create mock D1 database
   */
  createDatabase(): D1Database {
    const fixture = this;

    return {
      prepare(statement: string): D1PreparedStatement {
        return new MockPreparedStatement(fixture, statement);
      },

      async batch(statements: D1Statement[]): Promise<D1Result[]> {
        return statements.map((stmt) => {
          const mockStmt = new MockPreparedStatement(fixture, stmt.sql);
          return mockStmt.run(...stmt.params?.map((p) => p.value) || []) as any;
        }) as any;
      },

      async exec(statement: string): Promise<D1ExecResult> {
        // Simple parse for table creation
        const createMatch = statement.match(/CREATE\s+TABLE\s+(\w+)/i);
        if (createMatch) {
          const tableName = createMatch[1];
          if (!fixture.tables.has(tableName)) {
            fixture.tables.set(tableName, {
              name: tableName,
              rows: [],
            });
          }
        }

        return { success: true, meta: {} };
      },

      async dump(): Promise<Uint8Array> {
        return new Uint8Array();
      },
    } as D1Database;
  }

  /**
   * Create table
   */
  createTable(name: string, schema?: string): D1FixtureTable {
    const table: D1FixtureTable = {
      name,
      rows: [],
      schema,
    };
    this.tables.set(name, table);
    return table;
  }

  /**
   * Insert rows
   */
  insert(tableName: string, rows: D1FixtureRow[]): void {
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} does not exist`);
    }
    table.rows.push(...rows);
  }

  /**
   * Query rows
   */
  query(tableName: string, filter?: (row: D1FixtureRow) => boolean): D1FixtureRow[] {
    const table = this.tables.get(tableName);
    if (!table) {
      return [];
    }
    return filter ? table.rows.filter(filter) : [...table.rows];
  }

  /**
   * Get all tables
   */
  getTables(): Map<string, D1FixtureTable> {
    return new Map(this.tables);
  }

  /**
   * Clear all tables
   */
  clear(): void {
    this.tables.clear();
  }

  /**
   * Get table
   */
  getTable(tableName: string): D1FixtureTable | undefined {
    return this.tables.get(tableName);
  }
}

/**
 * Mock prepared statement
 */
class MockPreparedStatement implements D1PreparedStatement {
  private fixture: D1Fixture;
  private statement: string;
  private boundParams: any[] = [];

  constructor(fixture: D1Fixture, statement: string) {
    this.fixture = fixture;
    this.statement = statement;
  }

  bind(...values: any[]): D1PreparedStatement {
    this.boundParams = values;
    return this;
  }

  async first<T = any>(col?: string): Promise<T | null> {
    const results = await this.all();
    if (results.results.length === 0) return null;
    return col ? results.results[0][col] : results.results[0];
  }

  async all<T = any>(): Promise<D1Result<T>> {
    // Parse simple SELECT statement
    const selectMatch = this.statement.match(/SELECT\s+.*\s+FROM\s+(\w+)/i);
    if (!selectMatch) {
      return { results: [], success: true, meta: {} } as any;
    }

    const tableName = selectMatch[1];
    const table = this.fixture.getTable(tableName);
    if (!table) {
      return { results: [], success: true, meta: {} } as any;
    }

    // Apply WHERE clause if present
    let rows = [...table.rows];
    const whereMatch = this.statement.match(/WHERE\s+(\w+)\s*=\s*\?/i);
    if (whereMatch && this.boundParams.length > 0) {
      const column = whereMatch[1];
      const value = this.boundParams[0];
      rows = rows.filter((row) => row[column] === value);
    }

    return {
      results: rows as any,
      success: true,
      meta: {},
    } as any;
  }

  async run(): Promise<D1Result> {
    // Parse INSERT statement
    const insertMatch = this.statement.match(/INSERT\s+INTO\s+(\w+)/i);
    if (insertMatch) {
      const tableName = insertMatch[1];
      const table = this.fixture.getTable(tableName);
      if (table) {
        // Simple column extraction
        const columnsMatch = this.statement.match(/\(([^)]+)\)/);
        if (columnsMatch) {
          const columns = columnsMatch[1].split(',').map((c) => c.trim());
          const row: D1FixtureRow = {};
          columns.forEach((col, i) => {
            row[col] = this.boundParams[i];
          });
          table.rows.push(row);
        }
      }
    }

    return {
      success: true,
      meta: {
        duration: 0,
        last_row_id: this.fixture.getTables().size + 1,
        changes: 1,
        served_by: 'test',
      },
    } as any;
  }
}

/**
 * Create D1 fixture for tests
 */
export function createD1Fixture(tables?: D1FixtureTable[]): D1Fixture {
  const fixture = new D1Fixture();
  if (tables) {
    tables.forEach((table) => {
      fixture.createTable(table.name, table.schema);
      if (table.rows.length > 0) {
        fixture.insert(table.name, table.rows);
      }
    });
  }
  return fixture;
}

/**
 * Common test tables
 */
export function createCommonD1Tables(): D1FixtureTable[] {
  return [
    {
      name: 'users',
      rows: [
        { id: 1, name: 'John Doe', email: 'john@example.com', created_at: Date.now() },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: Date.now() },
      ],
    },
    {
      name: 'sessions',
      rows: [
        { id: 1, user_id: 1, token: 'abc123', expires_at: Date.now() + 3600000 },
        { id: 2, user_id: 2, token: 'def456', expires_at: Date.now() + 3600000 },
      ],
    },
    {
      name: 'cache_entries',
      rows: [
        { id: 1, key: 'test:key', value: '{"test": true}', expires_at: Date.now() + 3600000 },
      ],
    },
  ];
}

/**
 * Setup D1 fixture in test
 */
export function setupD1Fixture(name: string, initialTables?: D1FixtureTable[]): D1Fixture {
  const fixture = new D1Fixture();

  beforeEach(() => {
    if (initialTables) {
      initialTables.forEach((table) => {
        fixture.createTable(table.name, table.schema);
        if (table.rows.length > 0) {
          fixture.insert(table.name, table.rows);
        }
      });
    }
  });

  afterEach(() => {
    fixture.clear();
  });

  return fixture;
}
