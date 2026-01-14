/**
 * Migration 006: Create messages table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateMessagesTableMigration extends Migration {
  readonly version = 6;
  readonly name = 'create_messages_table';
  readonly description = 'Create messages table for conversation history';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
        content TEXT NOT NULL,
        tool_calls JSON,
        tool_call_id TEXT,
        tokens INTEGER,
        finish_reason TEXT,
        metadata JSON DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_tool_call_id ON messages(tool_call_id) WHERE tool_call_id IS NOT NULL;
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS messages;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_messages_conversation_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_messages_role;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_messages_created_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_messages_tool_call_id;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const tableExists = await this.tableExists(context, 'messages');
    return tableExists && (await this.columnExists(context, 'messages', 'conversation_id'));
  }
}
