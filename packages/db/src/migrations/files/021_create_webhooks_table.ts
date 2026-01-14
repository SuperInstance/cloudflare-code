/**
 * Migration 021: Create webhooks table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateWebhooksTableMigration extends Migration {
  readonly version = 21;
  readonly name = 'create_webhooks_table';
  readonly description = 'Create webhooks table for event notifications';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS webhooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        organization_id INTEGER,
        project_id TEXT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        secret TEXT,
        events TEXT DEFAULT '[]',
        headers JSON DEFAULT '{}',
        active INTEGER DEFAULT 1,
        rate_limit INTEGER DEFAULT 100,
        retry_config JSON DEFAULT '{"max_retries":3,"retry_delay":5000}',
        metadata JSON DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
      CREATE INDEX IF NOT EXISTS idx_webhooks_organization_id ON webhooks(organization_id);
      CREATE INDEX IF NOT EXISTS idx_webhooks_project_id ON webhooks(project_id);
      CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active);

      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id TEXT PRIMARY KEY,
        webhook_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        payload JSON NOT NULL,
        response_status INTEGER,
        response_body TEXT,
        response_headers JSON,
        attempted_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        delivered_at INTEGER,
        failed_at INTEGER,
        retry_count INTEGER DEFAULT 0,
        success INTEGER DEFAULT 0,
        error_message TEXT,
        duration_ms INTEGER,
        FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_type ON webhook_deliveries(event_type);
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_attempted_at ON webhook_deliveries(attempted_at);
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_success ON webhook_deliveries(success);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS webhook_deliveries;`);
    await this.execute(context, `DROP TABLE IF EXISTS webhooks;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_webhooks_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_webhooks_organization_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_webhooks_project_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_webhooks_active;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_webhook_deliveries_webhook_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_webhook_deliveries_event_type;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_webhook_deliveries_attempted_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_webhook_deliveries_success;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const webhooksExists = await this.tableExists(context, 'webhooks');
    const deliveriesExists = await this.tableExists(context, 'webhook_deliveries');
    return webhooksExists && deliveriesExists;
  }
}
