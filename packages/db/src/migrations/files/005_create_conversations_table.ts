/**
 * Migration 005: Create conversations table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateConversationsTableMigration extends Migration {
  readonly version = 5;
  readonly name = 'create_conversations_table';
  readonly description = 'Create conversations table for AI interactions';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT,
        model TEXT NOT NULL DEFAULT 'claude-3-5-sonnet',
        agent_config JSON DEFAULT '{}',
        system_prompt TEXT,
        temperature REAL DEFAULT 0.7,
        max_tokens INTEGER DEFAULT 4096,
        metadata JSON DEFAULT '{}',
        message_count INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        last_message_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        archived_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_model ON conversations(model);
      CREATE INDEX IF NOT EXISTS idx_conversations_archived_at ON conversations(archived_at) WHERE archived_at IS NOT NULL;
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS conversations;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_conversations_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_conversations_created_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_conversations_last_message_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_conversations_model;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_conversations_archived_at;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const tableExists = await this.tableExists(context, 'conversations');
    return tableExists && (await this.columnExists(context, 'conversations', 'user_id'));
  }
}
