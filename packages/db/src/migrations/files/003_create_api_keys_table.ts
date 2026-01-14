/**
 * Migration 003: Create API keys table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateApiKeysTableMigration extends Migration {
  readonly version = 3;
  readonly name = 'create_api_keys_table';
  readonly description = 'Create API keys table for authentication';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        key_id TEXT NOT NULL UNIQUE,
        key_hash TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        name TEXT NOT NULL,
        scopes TEXT NOT NULL DEFAULT '[]',
        rate_limit INTEGER,
        expires_at INTEGER,
        last_used_at INTEGER,
        last_used_ip TEXT,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
      CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
      CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS api_keys;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_api_keys_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_api_keys_key_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_api_keys_key_hash;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_api_keys_key_prefix;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_api_keys_is_active;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_api_keys_expires_at;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const tableExists = await this.tableExists(context, 'api_keys');
    return tableExists && (await this.columnExists(context, 'api_keys', 'key_hash'));
  }
}
