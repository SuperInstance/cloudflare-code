/**
 * Migration 015: Create traces table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateTracesTableMigration extends Migration {
  readonly version = 15;
  readonly name = 'create_traces_table';
  readonly description = 'Create traces table for distributed tracing';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS traces (
        id TEXT PRIMARY KEY,
        trace_id TEXT NOT NULL,
        parent_span_id TEXT,
        operation_name TEXT NOT NULL,
        service TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        duration_ms REAL NOT NULL,
        tags JSON DEFAULT '{}',
        logs JSON DEFAULT '[]',
        status TEXT DEFAULT 'ok' CHECK(status IN ('ok', 'error', 'cancelled')),
        error_message TEXT,
        error_kind TEXT,
        user_id INTEGER,
        metadata JSON DEFAULT '{}',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON traces(trace_id);
      CREATE INDEX IF NOT EXISTS idx_traces_parent_span_id ON traces(parent_span_id) WHERE parent_span_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_traces_service ON traces(service);
      CREATE INDEX IF NOT EXISTS idx_traces_operation_name ON traces(operation_name);
      CREATE INDEX IF NOT EXISTS idx_traces_start_time ON traces(start_time);
      CREATE INDEX IF NOT EXISTS idx_traces_status ON traces(status);
      CREATE INDEX IF NOT EXISTS idx_traces_user_id ON traces(user_id);

      CREATE TABLE IF NOT EXISTS trace_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trace_id TEXT NOT NULL,
        linked_trace_id TEXT NOT NULL,
        link_type TEXT NOT NULL CHECK(link_type IN ('parent', 'child', 'related', 'causes')),
        metadata JSON DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (trace_id) REFERENCES traces(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_trace_links_trace_id ON trace_links(trace_id);
      CREATE INDEX IF NOT EXISTS idx_trace_links_linked_trace_id ON trace_links(linked_trace_id);
      CREATE INDEX IF NOT EXISTS idx_trace_links_type ON trace_links(link_type);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS trace_links;`);
    await this.execute(context, `DROP TABLE IF EXISTS traces;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_traces_trace_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_traces_parent_span_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_traces_service;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_traces_operation_name;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_traces_start_time;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_traces_status;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_traces_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_trace_links_trace_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_trace_links_linked_trace_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_trace_links_type;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const tracesExists = await this.tableExists(context, 'traces');
    const linksExists = await this.tableExists(context, 'trace_links');
    return tracesExists && linksExists;
  }
}
