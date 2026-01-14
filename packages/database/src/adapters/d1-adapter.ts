/**
 * D1 (SQLite) Adapter for Cloudflare Workers
 * Optimized for Cloudflare D1 database
 */

import { DatabaseAdapter, BatchOperationsMixin } from './adapter';
import { D1Config, QueryResult, FieldInfo, QueryCondition } from '../types';

// ============================================================================
// D1 Adapter Implementation
// ============================================================================

export class D1Adapter extends DatabaseAdapter {
  protected declare config: D1Config;
  private db: D1Database | null = null;
  private batchStatements: D1Statement[] = [];
  private batchMode = false;

  constructor(config: D1Config) {
    super(config);
  }

  // ========================================================================
  // Connection Management
  // ========================================================================

  async connect(): Promise<void> {
    if (this.isConnectedFlag) {
      return;
    }

    // D1 uses Cloudflare Workers binding, not traditional connection
    // The binding should be available in the global scope
    try {
      // In Cloudflare Workers environment, D1 binding is available globally
      if (typeof globalThis !== 'undefined') {
        this.db = (globalThis as any)[this.config.binding];
      }

      if (!this.db) {
        throw new Error(`D1 binding '${this.config.binding}' not found`);
      }

      this.isConnectedFlag = true;
    } catch (error) {
      throw new Error(`Failed to connect to D1: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    this.db = null;
    this.isConnectedFlag = false;
    this.batchStatements = [];
    this.batchMode = false;
  }

  isConnected(): boolean {
    return this.isConnectedFlag && this.db !== null;
  }

  // ========================================================================
  // Query Execution
  // ========================================================================

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    this.validateConnection();
    const startTime = Date.now();

    try {
      if (!this.db) {
        throw new Error('D1 connection not established');
      }

      const statement = this.db.prepare(sql);
      const result = params ? await statement.bind(...params).all() : await statement.all();

      return {
        rows: result.results || [],
        rowCount: result.results?.length || 0,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`D1 query failed: ${error}`);
    }
  }

  async execute(sql: string, params?: any[]): Promise<QueryResult> {
    this.validateConnection();
    const startTime = Date.now();

    try {
      if (!this.db) {
        throw new Error('D1 connection not established');
      }

      const statement = this.db.prepare(sql);
      const result = params ? await statement.bind(...params).run() : await statement.run();

      return {
        rows: [],
        rowCount: 0,
        affectedRows: result.meta?.changes,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`D1 execute failed: ${error}`);
    }
  }

  // ========================================================================
  // Batch Operations (D1 Specific)
  // ========================================================================

  beginBatch(): void {
    this.batchMode = true;
    this.batchStatements = [];
  }

  addBatchStatement(sql: string, params?: any[]): void {
    if (!this.batchMode) {
      throw new Error('Batch mode is not enabled. Call beginBatch() first.');
    }

    if (!this.db) {
      throw new Error('D1 connection not established');
    }

    const statement = this.db.prepare(sql);
    this.batchStatements.push(params ? statement.bind(...params) : statement);
  }

  async commitBatch(): Promise<QueryResult[]> {
    const startTime = Date.now();

    try {
      if (!this.db) {
        throw new Error('D1 connection not established');
      }

      const results = await this.db.batch(this.batchStatements);

      return results.map((result: any) => ({
        rows: result.results || [],
        rowCount: result.results?.length || 0,
        affectedRows: result.meta?.changes,
        executionTime: Date.now() - startTime,
      }));
    } catch (error) {
      throw new Error(`D1 batch execution failed: ${error}`);
    } finally {
      this.batchMode = false;
      this.batchStatements = [];
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  quoteIdentifier(identifier: string): string {
    // SQLite uses backticks for identifiers
    return `\`${identifier}\``;
  }

  getPlaceholder(): string {
    // SQLite uses ? for placeholders
    return '?';
  }

  // ========================================================================
  // Schema Operations
  // ========================================================================

  async getTableInfo(table: string): Promise<FieldInfo[]> {
    const sql = `PRAGMA table_info(${this.quoteIdentifier(table)})`;
    const result = await this.query(sql);

    return result.rows.map((row: any) => ({
      name: row.name,
      type: row.type,
      nullable: !row.notnull,
      primaryKey: row.pk > 0,
      defaultValue: row.dflt_value,
    }));
  }

  async tableExists(table: string): Promise<boolean> {
    const sql = `
      SELECT name
      FROM sqlite_master
      WHERE type='table' AND name=?
    `;
    const result = await this.query(sql, [table]);
    return result.rowCount > 0;
  }

  async createTable(table: string, schema: Record<string, any>): Promise<void> {
    const columns = Object.entries(schema).map(([name, definition]) => {
      let columnDef = this.quoteIdentifier(name);
      columnDef += ' ' + definition.type;

      if (definition.primaryKey) {
        columnDef += ' PRIMARY KEY';
      }
      if (definition.autoIncrement) {
        columnDef += ' AUTOINCREMENT';
      }
      if (definition.unique) {
        columnDef += ' UNIQUE';
      }
      if (definition.notNull) {
        columnDef += ' NOT NULL';
      }
      if (definition.defaultValue !== undefined) {
        columnDef += ` DEFAULT ${definition.defaultValue}`;
      }
      if (definition.check) {
        columnDef += ` CHECK (${definition.check})`;
      }

      return columnDef;
    }).join(', ');

    const sql = `CREATE TABLE ${this.quoteIdentifier(table)} (${columns})`;
    await this.execute(sql);
  }

  async dropTable(table: string, cascade = false): Promise<void> {
    const sql = `DROP TABLE${cascade ? ' IF EXISTS' : ''} ${this.quoteIdentifier(table)}`;
    await this.execute(sql);
  }

  async alterTable(table: string, changes: Record<string, any>): Promise<void> {
    for (const [column, definition] of Object.entries(changes)) {
      if (definition.action === 'drop') {
        await this.dropColumn(table, column);
      } else if (definition.action === 'rename') {
        await this.renameColumn(table, column, definition.newName);
      } else {
        await this.addColumn(table, column, definition);
      }
    }
  }

  async truncateTable(table: string): Promise<void> {
    const sql = `DELETE FROM ${this.quoteIdentifier(table)}`;
    await this.execute(sql);
  }

  async addColumn(table: string, column: string, definition: any): Promise<void> {
    let columnDef = this.quoteIdentifier(column);
    columnDef += ' ' + definition.type;

    if (definition.unique) {
      columnDef += ' UNIQUE';
    }
    if (definition.notNull) {
      columnDef += ' NOT NULL';
    }
    if (definition.defaultValue !== undefined) {
      columnDef += ` DEFAULT ${definition.defaultValue}`;
    }

    const sql = `ALTER TABLE ${this.quoteIdentifier(table)} ADD COLUMN ${columnDef}`;
    await this.execute(sql);
  }

  async dropColumn(table: string, column: string): Promise<void> {
    // SQLite doesn't support DROP COLUMN directly
    // Need to recreate table
    const tableInfo = await this.getTableInfo(table);
    const columns = tableInfo
      .filter(f => f.name !== column)
      .map(f => this.quoteIdentifier(f.name))
      .join(', ');

    const tempTable = `${table}_temp_${Date.now()}`;
    await this.execute(`CREATE TABLE ${this.quoteIdentifier(tempTable)} AS SELECT ${columns} FROM ${this.quoteIdentifier(table)}`);
    await this.dropTable(table);
    await this.execute(`ALTER TABLE ${this.quoteIdentifier(tempTable)} RENAME TO ${this.quoteIdentifier(table)}`);
  }

  async renameColumn(table: string, oldName: string, newName: string): Promise<void> {
    // SQLite doesn't support RENAME COLUMN directly
    // Need to recreate table
    const tableInfo = await this.getTableInfo(table);
    const columns = tableInfo
      .map(f => f.name === oldName ? `${this.quoteIdentifier(newName)}` : this.quoteIdentifier(f.name))
      .join(', ');

    const tempTable = `${table}_temp_${Date.now()}`;
    await this.execute(`CREATE TABLE ${this.quoteIdentifier(tempTable)} AS SELECT ${columns} FROM ${this.quoteIdentifier(table)}`);
    await this.dropTable(table);
    await this.execute(`ALTER TABLE ${this.quoteIdentifier(tempTable)} RENAME TO ${this.quoteIdentifier(table)}`);
  }

  async changeColumn(table: string, column: string, definition: any): Promise<void> {
    // SQLite doesn't support CHANGE COLUMN directly
    // Need to recreate table
    await this.dropColumn(table, column);
    await this.addColumn(table, column, definition);
  }

  async addIndex(
    table: string,
    columns: string[],
    options: { unique?: boolean; name?: string } = {}
  ): Promise<void> {
    const indexName = options.name || `idx_${table}_${columns.join('_')}`;
    const unique = options.unique ? 'UNIQUE ' : '';
    const columnList = columns.map(c => this.quoteIdentifier(c)).join(', ');

    const sql = `CREATE ${unique}INDEX ${this.quoteIdentifier(indexName)} ON ${this.quoteIdentifier(table)} (${columnList})`;
    await this.execute(sql);
  }

  async dropIndex(table: string, indexName: string): Promise<void> {
    const sql = `DROP INDEX ${this.quoteIdentifier(indexName)}`;
    await this.execute(sql);
  }

  // ========================================================================
  // Transaction Support
  // ========================================================================

  async beginTransaction(): Promise<any> {
    await this.execute('BEGIN TRANSACTION');
    return this.createTransaction();
  }

  async commitTransaction(transaction: any): Promise<void> {
    await this.execute('COMMIT');
  }

  async rollbackTransaction(transaction: any): Promise<void> {
    await this.execute('ROLLBACK');
  }

  // ========================================================================
  // D1 Specific Features
  // ========================================================================

  async explainQuery(sql: string, params?: any[]): Promise<QueryResult> {
    const explainSql = `EXPLAIN QUERY PLAN ${sql}`;
    return this.query(explainSql, params);
  }

  async analyzeTable(table: string): Promise<QueryResult> {
    const sql = `SELECT * FROM sqlite_master WHERE tbl_name = ?`;
    return this.query(sql, [table]);
  }

  async optimize(): Promise<void> {
    await this.execute('PRAGMA optimize');
  }

  async vacuum(): Promise<void> {
    await this.execute('VACUUM');
  }

  async getDatabaseSize(): Promise<number> {
    const result = await this.query('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()');
    return result.rows[0]?.size || 0;
  }

  // ========================================================================
  // Export/Import
  // ========================================================================

  async exportToSQL(): Promise<string> {
    const result = await this.query('SELECT sql FROM sqlite_master WHERE sql IS NOT NULL');
    return result.rows.map((row: any) => row.sql).join(';\n') + ';';
  }

  async importFromSQL(sql: string): Promise<void> {
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    this.beginBatch();
    for (const statement of statements) {
      this.addBatchStatement(statement);
    }
    await this.commitBatch();
  }
}
