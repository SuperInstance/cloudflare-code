/**
 * Migration 024: Create scheduled tasks table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateScheduledTasksTableMigration extends Migration {
  readonly version = 24;
  readonly name = 'create_scheduled_tasks_table';
  readonly description = 'Create scheduled tasks table for cron jobs and scheduled work';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        task_type TEXT NOT NULL,
        schedule_expression TEXT NOT NULL,
        handler TEXT NOT NULL,
        payload JSON DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'disabled', 'error')),
        timeout_seconds INTEGER DEFAULT 300,
        retry_policy JSON DEFAULT '{"max_attempts":3,"backoff_multiplier":2}',
        next_run_at INTEGER,
        last_run_at INTEGER,
        last_run_status TEXT,
        last_run_error TEXT,
        consecutive_failures INTEGER DEFAULT 0,
        metadata JSON DEFAULT '{}',
        created_by INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_name ON scheduled_tasks(name);
      CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status ON scheduled_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at);
      CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_task_type ON scheduled_tasks(task_type);

      CREATE TABLE IF NOT EXISTS scheduled_task_executions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed', 'timeout')),
        started_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        completed_at INTEGER,
        duration_ms INTEGER,
        result JSON,
        error_message TEXT,
        error_stack TEXT,
        retry_count INTEGER DEFAULT 0,
        metadata JSON DEFAULT '{}',
        FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_task_executions_task_id ON scheduled_task_executions(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_executions_status ON scheduled_task_executions(status);
      CREATE INDEX IF NOT EXISTS idx_task_executions_started_at ON scheduled_task_executions(started_at);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS scheduled_task_executions;`);
    await this.execute(context, `DROP TABLE IF EXISTS scheduled_tasks;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_scheduled_tasks_name;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_scheduled_tasks_status;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_scheduled_tasks_next_run;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_scheduled_tasks_task_type;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_task_executions_task_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_task_executions_status;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_task_executions_started_at;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const tasksExists = await this.tableExists(context, 'scheduled_tasks');
    const executionsExists = await this.tableExists(context, 'scheduled_task_executions');
    return tasksExists && executionsExists;
  }
}
