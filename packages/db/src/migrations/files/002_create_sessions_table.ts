/**
 * Migration 002: Create sessions table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateSessionsTableMigration extends Migration {
  readonly version = 2;
  readonly name = 'create_sessions_table';
  readonly description = 'Create user sessions table for authentication';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        last_activity INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        remember_token INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS sessions;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_sessions_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_sessions_token_hash;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_sessions_expires_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_sessions_last_activity;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const tableExists = await this.tableExists(context, 'sessions');
    return tableExists && (await this.columnExists(context, 'sessions', 'user_id'));
  }
}
