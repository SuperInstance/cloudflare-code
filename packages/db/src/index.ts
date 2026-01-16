/**
 * ClaudeFlare Database - Migration and Schema Management System
 *
 * A comprehensive database migration and schema management system for Cloudflare D1.
 * Provides versioned migrations, rollback support, data seeding, testing utilities,
 * and schema diff tools.
 *
 * @example
 * ```typescript
 * import { MigrationRunner, MigrationStore, ALL_MIGRATIONS } from '@claudeflare/db';
 *
 * const context = { db, env: 'production' };
 * const store = new MigrationStore(db);
 * const runner = new MigrationRunner({ context, store, migrations: ALL_MIGRATIONS });
 *
 * // Run migrations
 * await runner.up();
 *
 * // Check status
 * const status = await runner.getStatus();
 * ```
 */

// Cloudflare D1 type declarations
export interface D1Result {
  success: boolean;
  meta?: {
    duration?: number;
    last_row_id?: number;
    changes?: number;
    served_by?: string;
  };
  error?: Error;
}

export interface D1Database {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1Result[]>;
  exec(query: string): Promise<D1Result>;
  dump(): Promise<ArrayBuffer>;
  withSession<T>(callback: (session: D1Database) => T | Promise<T>): Promise<T>;
}

export interface D1Statement {
  bind(...params: any[]): D1Statement;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results: T[]; success: boolean; meta?: any }>;
  run(): Promise<D1Result>;
}

// Core migration system
export * from './migrations';

// Schema management
export * from './schema';

// Seed data management
export * from './seeds';

// Testing utilities
export * from './test';

// CLI scripts
export * from './scripts';

/**
 * Version of the database package
 */
export const VERSION = '1.0.0';

/**
 * Default D1 database configuration
 */
export const DEFAULT_D1_CONFIG = {
  // Default batch size for bulk operations
  batchSize: 100,

  // Default timeout for migrations (ms)
  migrationTimeout: 300000,

  // Default retry count for failed operations
  retryCount: 3,

  // Default retry delay (ms)
  retryDelay: 1000
} as const;

/**
 * Create a migration context
 */
export function createMigrationContext(
  db: D1Database,
  env: string = 'development',
  options: { dryRun?: boolean } = {}
): import('./migrations/migration').MigrationContext {
  return {
    db,
    env,
    dryRun: options.dryRun
  };
}

/**
 * Create a seed context
 */
export function createSeedContext(
  db: D1Database,
  env: string = 'development',
  options: { dryRun?: boolean } = {}
): import('./seeds/types').SeedContext {
  return {
    db,
    env,
    dryRun: options.dryRun
  };
}
