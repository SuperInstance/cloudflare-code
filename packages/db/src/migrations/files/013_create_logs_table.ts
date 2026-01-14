/**
 * Migration 013: Create logs table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateLogsTableMigration extends Migration {
  readonly version = 13;
  readonly name = 'create_logs_table';
  readonly description = 'Create logs table for application logging';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL CHECK(level IN ('debug', 'info', 'warn', 'error', 'fatal')),
        message TEXT NOT NULL,
        context JSON DEFAULT '{}',
        user_id INTEGER,
        organization_id INTEGER,
        request_id TEXT,
        trace_id TEXT,
        span_id TEXT,
        service TEXT NOT NULL DEFAULT 'claudeflare',
        environment TEXT NOT NULL,
        metadata JSON DEFAULT '{}',
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_logs_organization_id ON logs(organization_id);
      CREATE INDEX IF NOT EXISTS idx_logs_request_id ON logs(request_id);
      CREATE INDEX IF NOT EXISTS idx_logs_trace_id ON logs(trace_id);
      CREATE INDEX IF NOT EXISTS idx_logs_service ON logs(service);
      CREATE INDEX IF NOT EXISTS idx_logs_environment ON logs(environment);
      CREATE INDEX IF NOT EXISTS idx_logs_level_timestamp ON logs(level, timestamp);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS logs;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_logs_level;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_logs_timestamp;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_logs_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_logs_organization_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_logs_request_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_logs_trace_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_logs_service;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_logs_environment;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_logs_level_timestamp;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const tableExists = await this.tableExists(context, 'logs');
    return tableExists && (await this.columnExists(context, 'logs', 'level'));
  }
}
