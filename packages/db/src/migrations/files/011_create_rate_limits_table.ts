/**
 * Migration 011: Create rate limits table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateRateLimitsTableMigration extends Migration {
  readonly version = 11;
  readonly name = 'create_rate_limits_table';
  readonly description = 'Create rate limits table for API throttling';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS rate_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL,
        identifier_type TEXT NOT NULL CHECK(identifier_type IN ('user_id', 'api_key', 'ip_address', 'organization_id')),
        endpoint TEXT NOT NULL,
        limit_type TEXT NOT NULL DEFAULT 'sliding_window' CHECK(limit_type IN ('sliding_window', 'fixed_window', 'token_bucket')),
        max_requests INTEGER NOT NULL,
        window_seconds INTEGER NOT NULL,
        current_count INTEGER DEFAULT 0,
        window_start INTEGER,
        blocked_until INTEGER,
        metadata JSON DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier, identifier_type);
      CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits(endpoint);
      CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked_until ON rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;

      CREATE TABLE IF NOT EXISTS rate_limit_hits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rate_limit_id INTEGER NOT NULL,
        hit_time INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        success INTEGER DEFAULT 1,
        blocked INTEGER DEFAULT 0,
        request_metadata JSON,
        FOREIGN KEY (rate_limit_id) REFERENCES rate_limits(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_limit_id ON rate_limit_hits(rate_limit_id);
      CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_hit_time ON rate_limit_hits(hit_time);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS rate_limit_hits;`);
    await this.execute(context, `DROP TABLE IF EXISTS rate_limits;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_rate_limits_identifier;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_rate_limits_endpoint;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_rate_limits_blocked_until;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_rate_limit_hits_limit_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_rate_limit_hits_hit_time;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const limitsExists = await this.tableExists(context, 'rate_limits');
    const hitsExists = await this.tableExists(context, 'rate_limit_hits');
    return limitsExists && hitsExists;
  }
}
