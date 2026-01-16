/**
 * Schema snapshot management for D1 databases
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  DatabaseSchema,
  SchemaSnapshot,
  TableDefinition,
  ColumnDefinition,
  IndexDefinition
} from './types';

export class SchemaSnapshotManager {
  constructor(private readonly db: D1Database) {}

  /**
   * Capture current database schema snapshot
   */
  async capture(version: number): Promise<SchemaSnapshot> {
    const tables = await this.extractTables();
    const schema: DatabaseSchema = { tables };

    const snapshot: SchemaSnapshot = {
      version,
      timestamp: Date.now(),
      tables: schema.tables
    };

    await this.saveSnapshot(snapshot);

    return snapshot;
  }

  /**
   * Extract all table definitions from database
   */
  private async extractTables(): Promise<TableDefinition[]> {
    const tablesResult = await this.db
      .prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)
      .all();

    const tableNames = (tablesResult.results || []).map((r: any) => r.name as string);
    const tables: TableDefinition[] = [];

    for (const name of tableNames) {
      const table = await this.extractTableDefinition(name);
      if (table) {
        tables.push(table);
      }
    }

    return tables;
  }

  /**
   * Extract definition for a single table
   */
  private async extractTableDefinition(tableName: string): Promise<TableDefinition | null> {
    // Get column information
    const columnsResult = await this.db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all();

    const columns = (columnsResult.results || []).map((row: any): ColumnDefinition => {
      const col: ColumnDefinition = {
        name: row.name,
        type: this.normalizeType(row.type),
        nullable: !row.notnull,
        defaultValue: row.dflt_value,
        primaryKey: row.pk > 0
      };

      return col;
    });

    // Get index information
    const indexesResult = await this.db
      .prepare(`PRAGMA index_list(${tableName})`)
      .all();

    const indexes: IndexDefinition[] = [];

    for (const idxRow of indexesResult.results || []) {
      const indexInfo = await this.db
        .prepare(`PRAGMA index_info(${idxRow.name})`)
        .all();

      const columns = (indexInfo.results || []).map((r: any) => r.name as string);

      indexes.push({
        name: idxRow.name as string,
        columns,
        unique: !!idxRow.unique
      });
    }

    // Get foreign key information
    const fkResult = await this.db
      .prepare(`PRAGMA foreign_key_list(${tableName})`)
      .all();

    for (const fkRow of fkResult.results || []) {
      const column = columns.find((c) => c.name === fkRow.from);
      if (column) {
        column.references = {
          table: fkRow.table as string,
          column: fkRow.to as string,
          onDelete: fkRow.on_delete as any,
          onUpdate: fkRow.on_update as any
        };
      }
    }

    return {
      name: tableName,
      columns,
      indexes
    };
  }

  /**
   * Normalize column type
   */
  private normalizeType(type: string): ColumnDefinition['type'] {
    const upperType = type.toUpperCase();

    if (upperType.includes('INT')) return 'INTEGER';
    if (upperType.includes('REAL') || upperType.includes('FLOAT') || upperType.includes('DOUBLE')) {
      return 'REAL';
    }
    if (upperType.includes('TEXT') || upperType.includes('CHAR') || upperType.includes('CLOB')) {
      return 'TEXT';
    }
    if (upperType.includes('BLOB')) return 'BLOB';
    if (upperType.includes('NUMERIC')) return 'NUMERIC';

    return 'TEXT';
  }

  /**
   * Save snapshot to database
   */
  private async saveSnapshot(snapshot: SchemaSnapshot): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS _schema_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL UNIQUE,
        timestamp INTEGER NOT NULL,
        schema_json TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);

    await this.db
      .prepare(
        `
        INSERT OR REPLACE INTO _schema_snapshots (version, timestamp, schema_json)
        VALUES (?, ?, ?)
      `
      )
      .bind(snapshot.version, snapshot.timestamp, JSON.stringify(snapshot))
      .run();
  }

  /**
   * Load snapshot by version
   */
  async loadSnapshot(version: number): Promise<SchemaSnapshot | null> {
    const result = await this.db
      .prepare(
        `
        SELECT schema_json FROM _schema_snapshots
        WHERE version = ?
      `
      )
      .bind(version)
      .first();

    if (!result) {
      return null;
    }

    return JSON.parse((result as any).schema_json) as SchemaSnapshot;
  }

  /**
   * Load latest snapshot
   */
  async loadLatestSnapshot(): Promise<SchemaSnapshot | null> {
    const result = await this.db
      .prepare(
        `
        SELECT schema_json FROM _schema_snapshots
        ORDER BY version DESC LIMIT 1
      `
      )
      .first();

    if (!result) {
      return null;
    }

    return JSON.parse((result as any).schema_json) as SchemaSnapshot;
  }

  /**
   * List all snapshots
   */
  async listSnapshots(): Promise<Array<{ version: number; timestamp: number }>> {
    const result = await this.db
      .prepare(
        `
        SELECT version, timestamp FROM _schema_snapshots
        ORDER BY version ASC
      `
      )
      .all();

    return (result.results || []).map((r: any) => ({
      version: r.version,
      timestamp: r.timestamp
    }));
  }

  /**
   * Delete snapshot
   */
  async deleteSnapshot(version: number): Promise<boolean> {
    const result = await this.db
      .prepare(
        `
        DELETE FROM _schema_snapshots WHERE version = ?
      `
      )
      .bind(version)
      .run();

    return (result.meta?.changes || 0) > 0;
  }

  /**
   * Get schema version from snapshot
   */
  async getSchemaVersion(): Promise<number> {
    const result = await this.db
      .prepare(
        `
        SELECT MAX(version) as version FROM _schema_snapshots
      `
      )
      .first();

    return ((result as any)?.version as number) || 0;
  }
}
