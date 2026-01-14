/**
 * Migration 020: Create deployments table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateDeploymentsTableMigration extends Migration {
  readonly version = 20;
  readonly name = 'create_deployments_table';
  readonly description = 'Create deployments table for project deployments';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS deployments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'building', 'deploying', 'success', 'failed', 'rolled_back')),
        environment TEXT NOT NULL DEFAULT 'production' CHECK(environment IN ('development', 'staging', 'production')),
        deployment_url TEXT,
        build_log TEXT,
        error_message TEXT,
        deployed_by INTEGER,
        started_at INTEGER,
        completed_at INTEGER,
        duration_ms INTEGER,
        rollback_from_id TEXT,
        metadata JSON DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (deployed_by) REFERENCES users(id),
        FOREIGN KEY (rollback_from_id) REFERENCES deployments(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);
      CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
      CREATE INDEX IF NOT EXISTS idx_deployments_environment ON deployments(environment);
      CREATE INDEX IF NOT EXISTS idx_deployments_created_at ON deployments(created_at);
      CREATE INDEX IF NOT EXISTS idx_deployments_version ON deployments(version);

      CREATE TABLE IF NOT EXISTS deployment_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deployment_id TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,
        collected_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (deployment_id) REFERENCES deployments(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_deployment_metrics_deployment_id ON deployment_metrics(deployment_id);
      CREATE INDEX IF NOT EXISTS idx_deployment_metrics_name ON deployment_metrics(metric_name);
      CREATE INDEX IF NOT EXISTS idx_deployment_metrics_collected_at ON deployment_metrics(collected_at);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS deployment_metrics;`);
    await this.execute(context, `DROP TABLE IF EXISTS deployments;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_deployments_project_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_deployments_status;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_deployments_environment;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_deployments_created_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_deployments_version;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_deployment_metrics_deployment_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_deployment_metrics_name;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_deployment_metrics_collected_at;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const deploymentsExists = await this.tableExists(context, 'deployments');
    const metricsExists = await this.tableExists(context, 'deployment_metrics');
    return deploymentsExists && metricsExists;
  }
}
