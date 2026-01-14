/**
 * Migration 012: Create metrics table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateMetricsTableMigration extends Migration {
  readonly version = 12;
  readonly name = 'create_metrics_table';
  readonly description = 'Create metrics table for monitoring and analytics';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('counter', 'gauge', 'histogram', 'summary')),
        value REAL NOT NULL,
        labels JSON DEFAULT '{}',
        tags TEXT DEFAULT '[]',
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        user_id INTEGER,
        organization_id INTEGER,
        metadata JSON DEFAULT '{}',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(name);
      CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(type);
      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_metrics_user_id ON metrics(user_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_organization_id ON metrics(organization_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp ON metrics(name, timestamp);

      CREATE TABLE IF NOT EXISTS metric_aggregations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        aggregation_type TEXT NOT NULL CHECK(aggregation_type IN ('sum', 'avg', 'min', 'max', 'count', 'p50', 'p95', 'p99')),
        window_seconds INTEGER NOT NULL,
        aggregated_value REAL NOT NULL,
        label_filters JSON DEFAULT '{}',
        window_start INTEGER NOT NULL,
        window_end INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_metric_aggs_name ON metric_aggregations(metric_name);
      CREATE INDEX IF NOT EXISTS idx_metric_aggs_window ON metric_aggregations(window_start, window_end);
      CREATE INDEX IF NOT EXISTS idx_metric_aggs_type ON metric_aggregations(aggregation_type);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS metric_aggregations;`);
    await this.execute(context, `DROP TABLE IF EXISTS metrics;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_metrics_name;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_metrics_type;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_metrics_timestamp;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_metrics_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_metrics_organization_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_metrics_name_timestamp;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_metric_aggs_name;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_metric_aggs_window;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_metric_aggs_type;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const metricsExists = await this.tableExists(context, 'metrics');
    const aggsExists = await this.tableExists(context, 'metric_aggregations');
    return metricsExists && aggsExists;
  }
}
