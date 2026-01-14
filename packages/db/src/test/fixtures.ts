/**
 * Test fixtures for migrations
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { MigrationContext } from '../migrations/migration';

/**
 * Create test database fixture
 */
export async function createTestDatabaseFixture(db: D1Database): Promise<void> {
  // Create any required test tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS test_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS test_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES test_users(id)
    );
  `);
}

/**
 * Create sample data fixture
 */
export async function createSampleDataFixture(db: D1Database): Promise<void> {
  await db.exec(`
    INSERT INTO test_users (name, email) VALUES
      ('Test User 1', 'test1@example.com'),
      ('Test User 2', 'test2@example.com'),
      ('Test User 3', 'test3@example.com');

    INSERT INTO test_posts (user_id, title, content) VALUES
      (1, 'First Post', 'This is the first post'),
      (1, 'Second Post', 'This is the second post'),
      (2, 'Third Post', 'This is the third post');
  `);
}

/**
 * Clean test database fixture
 */
export async function cleanTestDatabaseFixture(db: D1Database): Promise<void> {
  await db.exec(`
    DROP TABLE IF EXISTS test_posts;
    DROP TABLE IF EXISTS test_users;
  `);
}

/**
 * Create migration test context
 */
export function createMigrationTestContext(db: D1Database, env: string = 'test'): MigrationContext {
  return {
    db,
    env,
    dryRun: false
  };
}

/**
 * Mock D1 database for testing
 */
export class MockD1Database {
  private data: Map<string, any[]> = new Map();

  constructor(initialData?: Record<string, any[]>) {
    if (initialData) {
      for (const [table, rows] of Object.entries(initialData)) {
        this.data.set(table, rows);
      }
    }
  }

  prepare(sql: string): any {
    return {
      bind: (...params: any[]) => ({
        first: async () => {
          const match = this.extractTable(sql);
          if (!match) return null;

          const rows = this.data.get(match.table) || [];
          return rows[0] || null;
        },
        all: async () => {
          const match = this.extractTable(sql);
          if (!match) return { results: [] };

          return { results: this.data.get(match.table) || [] };
        },
        run: async () => {
          return { meta: { duration: 0, changes: 1 } };
        }
      })
    };
  }

  async exec(sql: string): Promise<void> {
    // Mock execution
  }

  private extractTable(sql: string): { table: string } | null {
    const match = sql.match(/FROM\s+(\w+)/i) || sql.match(/INTO\s+(\w+)/i);
    if (match) {
      return { table: match[1] };
    }
    return null;
  }

  // Helper methods for testing
  setTableData(table: string, rows: any[]): void {
    this.data.set(table, rows);
  }

  getTableData(table: string): any[] {
    return this.data.get(table) || [];
  }

  clear(): void {
    this.data.clear();
  }
}

/**
 * Create mock migration context
 */
export function createMockMigrationContext(): MigrationContext {
  const mockDb = new MockD1Database() as unknown as D1Database;

  return {
    db: mockDb,
    env: 'test',
    dryRun: false
  };
}
