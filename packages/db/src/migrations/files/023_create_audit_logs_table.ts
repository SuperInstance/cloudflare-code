/**
 * Migration 023: Create audit logs table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateAuditLogsTableMigration extends Migration {
  readonly version = 23;
  readonly name = 'create_audit_logs_table';
  readonly description = 'Create audit logs table for compliance and security';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor_id INTEGER,
        actor_type TEXT CHECK(actor_type IN ('user', 'system', 'api_key')),
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        old_values JSON,
        new_values JSON,
        ip_address TEXT,
        user_agent TEXT,
        request_id TEXT,
        metadata JSON DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id);

      CREATE TABLE IF NOT EXISTS audit_log_retention (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_type TEXT NOT NULL UNIQUE,
        retention_days INTEGER NOT NULL DEFAULT 90,
        archive_after_days INTEGER DEFAULT 30,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_audit_retention_resource_type ON audit_log_retention(resource_type);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS audit_log_retention;`);
    await this.execute(context, `DROP TABLE IF EXISTS audit_logs;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_audit_logs_actor_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_audit_logs_action;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_audit_logs_resource;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_audit_logs_created_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_audit_logs_request_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_audit_retention_resource_type;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const auditLogsExists = await this.tableExists(context, 'audit_logs');
    const retentionExists = await this.tableExists(context, 'audit_log_retention');
    return auditLogsExists && retentionExists;
  }
}
