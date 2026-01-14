/**
 * Migration 007: Create agent tasks table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateAgentTasksTableMigration extends Migration {
  readonly version = 7;
  readonly name = 'create_agent_tasks_table';
  readonly description = 'Create agent tasks table for async AI operations';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        conversation_id TEXT,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        input JSON NOT NULL,
        output JSON,
        error TEXT,
        progress REAL DEFAULT 0,
        started_at INTEGER,
        completed_at INTEGER,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        priority INTEGER DEFAULT 0,
        metadata JSON DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_id ON agent_tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_agent_tasks_conversation_id ON agent_tasks(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_agent_tasks_type ON agent_tasks(type);
      CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_at ON agent_tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON agent_tasks(priority) WHERE status IN ('pending', 'running');
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS agent_tasks;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_agent_tasks_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_agent_tasks_conversation_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_agent_tasks_status;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_agent_tasks_type;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_agent_tasks_created_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_agent_tasks_priority;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const tableExists = await this.tableExists(context, 'agent_tasks');
    return tableExists && (await this.columnExists(context, 'agent_tasks', 'status'));
  }
}
