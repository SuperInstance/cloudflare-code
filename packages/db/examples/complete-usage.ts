/**
 * Complete usage example for ClaudeFlare Database package
 *
 * This example demonstrates all major features of the database migration system.
 */

import {
  MigrationRunner,
  MigrationStore,
  SeedRunner,
  SchemaSnapshotManager,
  SchemaDiffer,
  SchemaBuilder,
  createMigrationContext,
  createSeedContext,
  ALL_MIGRATIONS,
  getSeedersForEnvironment
} from '@claudeflare/db';

interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
}

// ============================================================
// Example 1: Running Migrations
// ============================================================

export async function example1_RunMigrations(env: Env) {
  const context = createMigrationContext(env.DB, env.ENVIRONMENT || 'development');
  const store = new MigrationStore(env.DB);

  // Initialize migrations table
  await store.initialize();

  // Create migration runner
  const runner = new MigrationRunner({
    context,
    store,
    migrations: ALL_MIGRATIONS
  });

  // Check current status
  console.log('Current migration status:');
  const status = await runner.getStatus();
  console.log(`  Version: ${status.current}`);
  console.log(`  Applied: ${status.applied.length}`);
  console.log(`  Pending: ${status.pending.length}`);

  // Run pending migrations
  if (status.pending.length > 0) {
    console.log('\nRunning migrations...');
    const results = await runner.up();

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(`  Success: ${successful.length}`);
    console.log(`  Failed: ${failed.length}`);
  }

  // Validate state
  const validation = await runner.validateState();
  if (!validation.valid) {
    console.error('Migration state has errors:', validation.errors);
  }
}

// ============================================================
// Example 2: Rolling Back Migrations
// ============================================================

export async function example2_RollbackMigrations(env: Env) {
  const context = createMigrationContext(env.DB, env.ENVIRONMENT || 'development');
  const store = new MigrationStore(env.DB);
  await store.initialize();

  const runner = new MigrationRunner({
    context,
    store,
    migrations: ALL_MIGRATIONS
  });

  // Rollback last migration
  console.log('Rolling back last migration...');
  const results = await runner.down({ steps: 1 });

  for (const result of results) {
    if (result.success) {
      console.log(`  Rolled back: v${result.version} - ${result.name}`);
    } else {
      console.error(`  Failed: ${result.error}`);
    }
  }
}

// ============================================================
// Example 3: Seeding Data
// ============================================================

export async function example3_SeedData(env: Env) {
  const context = createSeedContext(env.DB, env.ENVIRONMENT || 'development');
  const seeders = getSeedersForEnvironment(env.ENVIRONMENT || 'development');

  const runner = new SeedRunner({
    context,
    seeders
  });

  console.log('Running seeders...');
  const results = await runner.run();

  for (const result of results) {
    if (result.success) {
      console.log(`  Seeded ${result.tableName}: ${result.rowsInserted} rows`);
    } else {
      console.error(`  Failed: ${result.error}`);
    }
  }
}

// ============================================================
// Example 4: Schema Builder
// ============================================================

export async function example4_SchemaBuilder(env: Env) {
  const builder = new SchemaBuilder();

  // Build a table programmatically
  builder
    .table('products')
    .id()
    .text('name')
    .text('description')
    .real('price')
    .integer('stock')
    .text('category')
    .timestamps()
    .softDeletes()
    .index('idx_products_category', ['category'])
    .index('idx_products_name', ['name']);

  // Generate SQL
  const sql = builder.toSQL();
  console.log('Generated SQL:\n', sql);

  // Execute the SQL
  for (const statement of builder.toSQL().split('\n\n')) {
    if (statement.trim()) {
      await env.DB.exec(statement);
    }
  }
}

// ============================================================
// Example 5: Schema Snapshots
// ============================================================

export async function example5_SchemaSnapshots(env: Env) {
  const manager = new SchemaSnapshotManager(env.DB);

  // Capture current schema
  const snapshot = await manager.capture(1);
  console.log(`Captured schema v${snapshot.version} with ${snapshot.tables.length} tables`);

  // List all snapshots
  const snapshots = await manager.listSnapshots();
  console.log('Available snapshots:', snapshots);

  // Load a specific snapshot
  const loaded = await manager.loadSnapshot(1);
  if (loaded) {
    console.log(`Loaded snapshot v${loaded.version}`);
  }
}

// ============================================================
// Example 6: Schema Diff
// ============================================================

export async function example6_SchemaDiff(env: Env) {
  const manager = new SchemaSnapshotManager(env.DB);
  const differ = new SchemaDiffer();

  // Get two schemas to compare
  const fromSnapshot = await manager.loadSnapshot(1);
  const toSnapshot = await manager.loadSnapshot(5);

  if (fromSnapshot && toSnapshot) {
    const fromSchema = { tables: fromSnapshot.tables };
    const toSchema = { tables: toSnapshot.tables };

    // Generate diff
    const diff = differ.compare(fromSchema, toSchema);

    // Print report
    console.log('\nSchema Diff Report:');
    console.log(differ.generateReport(diff));

    // Generate migration SQL
    const sql = differ.generateMigrationSQL(diff);
    console.log('\nGenerated SQL:\n', sql.join('\n'));
  }
}

// ============================================================
// Example 7: Creating Custom Migration
// ============================================================

import { Migration, MigrationContext } from '@claudeflare/db';

export class AddUserProfileMigration extends Migration {
  readonly version = 25;
  readonly name = 'add_user_profile';
  readonly description = 'Add user profile table';
  readonly dependencies = [1]; // Depends on users table (v1)

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        bio TEXT,
        avatar_url TEXT,
        website TEXT,
        location TEXT,
        timezone TEXT DEFAULT 'UTC',
        preferences JSON DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS user_profiles;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_user_profiles_user_id;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const tableExists = await this.tableExists(context, 'user_profiles');
    const hasUserId = await this.columnExists(context, 'user_profiles', 'user_id');
    return tableExists && hasUserId;
  }
}

// ============================================================
// Example 8: Testing Migrations
// ============================================================

import { testMigration, MigrationAssertions } from '@claudeflare/db';

export async function example8_TestMigration(env: Env) {
  const migration = new AddUserProfileMigration();
  const { assertions, up, down } = await testMigration(env.DB, migration);

  // Test up migration
  await up();

  // Verify table exists
  await assertions.assertTableExists('user_profiles');
  await assertions.assertColumnExists('user_profiles', 'user_id');
  await assertions.assertForeignKeyExists('user_profiles', 'user_id', 'users', 'id');

  // Test down migration
  await down();

  // Verify table is gone
  await assertions.assertTableNotExists('user_profiles');
}

// ============================================================
// Example 9: Cloudflare Worker Integration
// ============================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check endpoint
      if (path === '/health') {
        return Response.json({ status: 'healthy', database: 'connected' });
      }

      // Migration status endpoint
      if (path === '/api/migrations/status') {
        const store = new MigrationStore(env.DB);
        await store.initialize();
        const currentVersion = await store.getCurrentVersion();
        const applied = await store.getAppliedMigrations();

        return Response.json({
          version: currentVersion,
          applied: applied.length,
          migrations: applied
        });
      }

      // Run migrations endpoint (admin only)
      if (path === '/api/migrations/run' && request.method === 'POST') {
        const context = createMigrationContext(env.DB, env.ENVIRONMENT || 'production');
        const store = new MigrationStore(env.DB);
        await store.initialize();

        const runner = new MigrationRunner({
          context,
          store,
          migrations: ALL_MIGRATIONS
        });

        const results = await runner.up();
        const successful = results.filter((r) => r.success).length;

        return Response.json({
          success: true,
          applied: successful
        });
      }

      return Response.json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
      return Response.json(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
  }
};
