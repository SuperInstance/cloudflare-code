/**
 * Migration 016: Create cache entries table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateCacheEntriesTableMigration extends Migration {
  readonly version = 16;
  readonly name = 'create_cache_entries_table';
  readonly description = 'Create cache entries table for caching';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS cache_entries (
        key TEXT PRIMARY KEY,
        value BLOB NOT NULL,
        value_type TEXT DEFAULT 'json' CHECK(value_type IN ('json', 'string', 'binary')),
        compressed INTEGER DEFAULT 0,
        ttl_seconds INTEGER,
        expires_at INTEGER,
        hit_count INTEGER DEFAULT 0,
        last_accessed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        tags TEXT DEFAULT '[]',
        metadata JSON DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries(expires_at) WHERE expires_at IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cache_entries_last_accessed ON cache_entries(last_accessed_at);
      CREATE INDEX IF NOT EXISTS idx_cache_entries_created_at ON cache_entries(created_at);
      CREATE INDEX IF NOT EXISTS idx_cache_entries_tags ON cache_entries(tags);

      CREATE TABLE IF NOT EXISTS cache_stats (
        date TEXT NOT NULL PRIMARY KEY,
        total_hits INTEGER DEFAULT 0,
        total_misses INTEGER DEFAULT 0,
        total_sets INTEGER DEFAULT 0,
        total_deletes INTEGER DEFAULT 0,
        total_evictions INTEGER DEFAULT 0,
        avg_hit_latency_ms REAL,
        avg_miss_latency_ms REAL,
        cache_size_bytes INTEGER DEFAULT 0,
        entry_count INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_cache_stats_date ON cache_stats(date);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS cache_stats;`);
    await this.execute(context, `DROP TABLE IF EXISTS cache_entries;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_cache_entries_expires_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_cache_entries_last_accessed;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_cache_entries_created_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_cache_entries_tags;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_cache_stats_date;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const entriesExists = await this.tableExists(context, 'cache_entries');
    const statsExists = await this.tableExists(context, 'cache_stats');
    return entriesExists && statsExists;
  }
}
