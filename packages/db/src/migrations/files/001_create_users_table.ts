/**
 * Migration 001: Create users table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateUsersTableMigration extends Migration {
  readonly version = 1;
  readonly name = 'create_users_table';
  readonly description = 'Create users table with authentication fields';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        username TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        avatar_url TEXT,
        bio TEXT,
        timezone TEXT DEFAULT 'UTC',
        locale TEXT DEFAULT 'en',
        email_verified INTEGER DEFAULT 0,
        email_verified_at INTEGER,
        two_factor_enabled INTEGER DEFAULT 0,
        two_factor_secret TEXT,
        last_login_at INTEGER,
        last_login_ip TEXT,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until INTEGER,
        metadata JSON,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        deleted_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE deleted_at IS NULL;
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS users;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_users_email;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_users_username;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_users_email_verified;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_users_email_unique;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const tableExists = await this.tableExists(context, 'users');
    if (!tableExists) return false;

    const hasEmail = await this.columnExists(context, 'users', 'email');
    const hasPassword = await this.columnExists(context, 'users', 'password_hash');
    const hasCreatedAt = await this.columnExists(context, 'users', 'created_at');

    return hasEmail && hasPassword && hasCreatedAt;
  }
}
