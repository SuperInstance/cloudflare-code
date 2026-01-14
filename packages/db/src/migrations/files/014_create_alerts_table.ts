/**
 * Migration 014: Create alerts table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateAlertsTableMigration extends Migration {
  readonly version = 14;
  readonly name = 'create_alerts_table';
  readonly description = 'Create alerts table for monitoring alerts';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS alert_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL CHECK(type IN ('threshold', 'anomaly', 'composite', 'external')),
        metric_name TEXT NOT NULL,
        condition TEXT NOT NULL,
        threshold_value REAL,
        time_window_seconds INTEGER,
        severity TEXT NOT NULL DEFAULT 'info' CHECK(severity IN ('info', 'warning', 'error', 'critical')),
        enabled INTEGER DEFAULT 1,
        notification_channels JSON DEFAULT '[]',
        evaluation_delay_seconds INTEGER DEFAULT 60,
        cooldown_seconds INTEGER DEFAULT 300,
        created_by INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert_rules(type);
      CREATE INDEX IF NOT EXISTS idx_alert_rules_metric_name ON alert_rules(metric_name);
      CREATE INDEX IF NOT EXISTS idx_alert_rules_severity ON alert_rules(severity);
      CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        rule_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'acknowledged', 'resolved', 'suppressed')),
        severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'error', 'critical')),
        title TEXT NOT NULL,
        description TEXT,
        value REAL,
        context JSON DEFAULT '{}',
        triggered_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        acknowledged_at INTEGER,
        acknowledged_by INTEGER,
        resolved_at INTEGER,
        resolved_by INTEGER,
        suppressed_until INTEGER,
        notification_sent INTEGER DEFAULT 0,
        FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
        FOREIGN KEY (acknowledged_by) REFERENCES users(id),
        FOREIGN KEY (resolved_by) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_alerts_rule_id ON alerts(rule_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
      CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at);
      CREATE INDEX IF NOT EXISTS idx_alerts_suppressed_until ON alerts(suppressed_until) WHERE suppressed_until IS NOT NULL;
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS alerts;`);
    await this.execute(context, `DROP TABLE IF EXISTS alert_rules;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_alert_rules_type;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_alert_rules_metric_name;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_alert_rules_severity;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_alert_rules_enabled;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_alerts_rule_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_alerts_status;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_alerts_severity;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_alerts_triggered_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_alerts_suppressed_until;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const rulesExists = await this.tableExists(context, 'alert_rules');
    const alertsExists = await this.tableExists(context, 'alerts');
    return rulesExists && alertsExists;
  }
}
