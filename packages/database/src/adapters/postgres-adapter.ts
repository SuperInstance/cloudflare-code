/**
 * PostgreSQL Adapter
 * Full-featured PostgreSQL driver with advanced features
 */

import { DatabaseAdapter } from './adapter';
import { PostgreSQLConfig, QueryResult, FieldInfo } from '../types';

// ============================================================================
// PostgreSQL Adapter Implementation
// ============================================================================

export class PostgreSQLAdapter extends DatabaseAdapter {
  protected declare config: PostgreSQLConfig;
  private pool: any = null;
  private client: any = null;

  constructor(config: PostgreSQLConfig) {
    super(config);
  }

  // ========================================================================
  // Connection Management
  // ========================================================================

  async connect(): Promise<void> {
    if (this.isConnectedFlag) {
      return;
    }

    try {
      // Dynamic import of pg module
      const { Pool } = await import('pg');

      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl,
        max: this.config.maxConnections || 20,
        min: this.config.minConnections || 2,
        idleTimeoutMillis: this.config.idleTimeout || 30000,
        connectionTimeoutMillis: this.config.connectionTimeout || 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      client.release();

      this.isConnectedFlag = true;
    } catch (error) {
      throw new Error(`PostgreSQL connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    if (this.client) {
      this.client.release();
      this.client = null;
    }
    this.isConnectedFlag = false;
  }

  isConnected(): boolean {
    return this.isConnectedFlag && this.pool !== null;
  }

  private async getClient(): Promise<any> {
    if (!this.isConnected()) {
      await this.connect();
    }

    if (!this.client) {
      this.client = await this.pool.connect();
    }

    return this.client;
  }

  private releaseClient(): void {
    if (this.client) {
      this.client.release();
      this.client = null;
    }
  }

  // ========================================================================
  // Query Execution
  // ========================================================================

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const startTime = Date.now();

    try {
      const client = await this.getClient();

      // Transform parameters for PostgreSQL ($1, $2, etc.)
      const transformedSql = this.transformPlaceholders(sql);
      const result = await client.query(transformedSql, params || []);

      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        affectedRows: result.rowCount,
        insertId: result.rows[0]?.id,
        fields: result.fields?.map((f: any) => ({
          name: f.name,
          type: this.postgresTypeToType(f.dataTypeID),
          nullable: !f.dataTypeID,
        })),
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`PostgreSQL query failed: ${error}`);
    } finally {
      this.releaseClient();
    }
  }

  async execute(sql: string, params?: any[]): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      const client = await this.getClient();

      const transformedSql = this.transformPlaceholders(sql);
      const result = await client.query(transformedSql, params || []);

      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        affectedRows: result.rowCount,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`PostgreSQL execute failed: ${error}`);
    } finally {
      this.releaseClient();
    }
  }

  private transformPlaceholders(sql: string): string {
    // Transform ? placeholders to $1, $2, etc. for PostgreSQL
    let count = 0;
    return sql.replace(/\?/g, () => `$${++count}`);
  }

  private postgresTypeToType(oid: number): string {
    const typeMap: Record<number, string> = {
      20: 'number',     // int8
      21: 'number',     // int2
      23: 'number',     // int4
      700: 'number',    // float4
      701: 'number',    // float8
      16: 'boolean',    // bool
      1043: 'string',   // varchar
      25: 'string',     // text
      1082: 'date',     // date
      1114: 'date',     // timestamp
      1184: 'date',     // timestamptz
      114: 'json',      // json
      3802: 'json',     // jsonb
      17: 'binary',     // bytea
    };

    return typeMap[oid] || 'string';
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  quoteIdentifier(identifier: string): string {
    // PostgreSQL uses double quotes for identifiers
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  getPlaceholder(): string {
    // Placeholder is handled by transformPlaceholders
    return '?';
  }

  // ========================================================================
  // Schema Operations
  // ========================================================================

  async getTableInfo(table: string): Promise<FieldInfo[]> {
    const schema = this.config.schema || 'public';
    const sql = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `;

    const result = await this.query(sql, [schema, table]);

    return result.rows.map((row: any) => ({
      name: row.column_name,
      type: this.mapPostgresType(row.data_type),
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default,
    }));
  }

  private mapPostgresType(postgresType: string): string {
    const typeMap: Record<string, string> = {
      'integer': 'number',
      'bigint': 'number',
      'smallint': 'number',
      'decimal': 'number',
      'numeric': 'number',
      'real': 'number',
      'double precision': 'number',
      'boolean': 'boolean',
      'character varying': 'string',
      'varchar': 'string',
      'text': 'string',
      'date': 'date',
      'timestamp': 'date',
      'timestamp with time zone': 'date',
      'timestamp without time zone': 'date',
      'json': 'json',
      'jsonb': 'json',
      'bytea': 'binary',
    };

    return typeMap[postgresType.toLowerCase()] || postgresType;
  }

  async tableExists(table: string): Promise<boolean> {
    const schema = this.config.schema || 'public';
    const sql = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2
    `;

    const result = await this.query(sql, [schema, table]);
    return result.rowCount > 0;
  }

  async createTable(table: string, schema: Record<string, any>): Promise<void> {
    const columns = Object.entries(schema).map(([name, definition]) => {
      let columnDef = this.quoteIdentifier(name);
      columnDef += ' ' + this.mapTypeToPostgres(definition.type);

      if (definition.primaryKey) {
        columnDef += ' PRIMARY KEY';
      }
      if (definition.serial) {
        columnDef += ' SERIAL';
      }
      if (definition.bigserial) {
        columnDef += ' BIGSERIAL';
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
      if (definition.references) {
        columnDef += ` REFERENCES ${this.quoteIdentifier(definition.references.table)}(${this.quoteIdentifier(definition.references.column)})`;
        if (definition.references.onDelete) {
          columnDef += ` ON DELETE ${definition.references.onDelete}`;
        }
        if (definition.references.onUpdate) {
          columnDef += ` ON UPDATE ${definition.references.onUpdate}`;
        }
      }

      return columnDef;
    }).join(', ');

    const sql = `CREATE TABLE ${this.quoteIdentifier(table)} (${columns})`;
    await this.execute(sql);
  }

  private mapTypeToPostgres(type: string): string {
    const typeMap: Record<string, string> = {
      'string': 'VARCHAR(255)',
      'text': 'TEXT',
      'number': 'INTEGER',
      'bigint': 'BIGINT',
      'boolean': 'BOOLEAN',
      'date': 'TIMESTAMP',
      'json': 'JSONB',
      'binary': 'BYTEA',
    };

    return typeMap[type] || type.toUpperCase();
  }

  async dropTable(table: string, cascade = false): Promise<void> {
    const sql = `DROP TABLE${cascade ? ' IF EXISTS' : ''} ${this.quoteIdentifier(table)}${cascade ? ' CASCADE' : ''}`;
    await this.execute(sql);
  }

  async alterTable(table: string, changes: Record<string, any>): Promise<void> {
    for (const [column, definition] of Object.entries(changes)) {
      if (definition.action === 'drop') {
        await this.dropColumn(table, column);
      } else if (definition.action === 'rename') {
        await this.renameColumn(table, column, definition.newName);
      } else if (definition.action === 'alter') {
        await this.changeColumn(table, column, definition);
      } else {
        await this.addColumn(table, column, definition);
      }
    }
  }

  async truncateTable(table: string): Promise<void> {
    const sql = `TRUNCATE TABLE ${this.quoteIdentifier(table)}`;
    await this.execute(sql);
  }

  async addColumn(table: string, column: string, definition: any): Promise<void> {
    let columnDef = this.quoteIdentifier(column);
    columnDef += ' ' + this.mapTypeToPostgres(definition.type);

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
    if (definition.references) {
      columnDef += ` REFERENCES ${this.quoteIdentifier(definition.references.table)}(${this.quoteIdentifier(definition.references.column)})`;
    }

    const sql = `ALTER TABLE ${this.quoteIdentifier(table)} ADD COLUMN ${columnDef}`;
    await this.execute(sql);
  }

  async dropColumn(table: string, column: string): Promise<void> {
    const sql = `ALTER TABLE ${this.quoteIdentifier(table)} DROP COLUMN ${this.quoteIdentifier(column)}`;
    await this.execute(sql);
  }

  async renameColumn(table: string, oldName: string, newName: string): Promise<void> {
    const sql = `ALTER TABLE ${this.quoteIdentifier(table)} RENAME COLUMN ${this.quoteIdentifier(oldName)} TO ${this.quoteIdentifier(newName)}`;
    await this.execute(sql);
  }

  async changeColumn(table: string, column: string, definition: any): Promise<void> {
    // PostgreSQL requires multiple ALTER COLUMN statements
    const operations: string[] = [];

    if (definition.type) {
      operations.push(`ALTER COLUMN ${this.quoteIdentifier(column)} TYPE ${this.mapTypeToPostgres(definition.type)}`);
    }
    if (definition.notNull !== undefined) {
      operations.push(`ALTER COLUMN ${this.quoteIdentifier(column)} ${definition.notNull ? 'SET' : 'DROP'} NOT NULL`);
    }
    if (definition.defaultValue !== undefined) {
      operations.push(`ALTER COLUMN ${this.quoteIdentifier(column)} SET DEFAULT ${definition.defaultValue}`);
    }
    if (definition.dropDefault) {
      operations.push(`ALTER COLUMN ${this.quoteIdentifier(column)} DROP DEFAULT`);
    }

    for (const operation of operations) {
      const sql = `ALTER TABLE ${this.quoteIdentifier(table)} ${operation}`;
      await this.execute(sql);
    }
  }

  async addIndex(
    table: string,
    columns: string[],
    options: { unique?: boolean; name?: string; type?: string } = {}
  ): Promise<void> {
    const indexName = options.name || `idx_${table}_${columns.join('_')}`;
    const unique = options.unique ? 'UNIQUE ' : '';
    const indexType = options.type ? ` USING ${options.type}` : '';
    const columnList = columns.map(c => this.quoteIdentifier(c)).join(', ');

    const sql = `CREATE ${unique}INDEX ${this.quoteIdentifier(indexName)} ON ${this.quoteIdentifier(table)}${indexType} (${columnList})`;
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
    await this.execute('BEGIN');
    return this.createTransaction();
  }

  async commitTransaction(transaction: any): Promise<void> {
    await this.execute('COMMIT');
  }

  async rollbackTransaction(transaction: any): Promise<void> {
    await this.execute('ROLLBACK');
  }

  // ========================================================================
  // PostgreSQL Specific Features
  // ========================================================================

  async explainQuery(sql: string, params?: any[]): Promise<QueryResult> {
    const explainSql = `EXPLAIN (ANALYZE, BUFFERS, VERBOSE) ${sql}`;
    return this.query(explainSql, params);
  }

  async analyzeTable(table: string): Promise<void> {
    const sql = `ANALYZE ${this.quoteIdentifier(table)}`;
    await this.execute(sql);
  }

  async vacuumTable(table: string): Promise<void> {
    const sql = `VACUUM ANALYZE ${this.quoteIdentifier(table)}`;
    await this.execute(sql);
  }

  async reindexTable(table: string): Promise<void> {
    const sql = `REINDEX TABLE ${this.quoteIdentifier(table)}`;
    await this.execute(sql);
  }

  async createFunction(
    name: string,
    params: string,
    returnType: string,
    body: string,
    language = 'plpgsql'
  ): Promise<void> {
    const sql = `
      CREATE OR REPLACE FUNCTION ${this.quoteIdentifier(name)}(${params})
      RETURNS ${returnType} AS $$
      ${body}
      $$ LANGUAGE ${language}
    `;
    await this.execute(sql);
  }

  async dropFunction(name: string, params: string): Promise<void> {
    const sql = `DROP FUNCTION IF EXISTS ${this.quoteIdentifier(name)}(${params})`;
    await this.execute(sql);
  }

  async createTrigger(
    name: string,
    table: string,
    when: 'BEFORE' | 'AFTER' | 'INSTEAD OF',
    event: 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE',
    functionName: string
  ): Promise<void> {
    const sql = `
      CREATE TRIGGER ${this.quoteIdentifier(name)}
      ${when} ${event} ON ${this.quoteIdentifier(table)}
      FOR EACH ROW EXECUTE FUNCTION ${functionName}()
    `;
    await this.execute(sql);
  }

  async dropTrigger(name: string, table: string): Promise<void> {
    const sql = `DROP TRIGGER IF EXISTS ${this.quoteIdentifier(name)} ON ${this.quoteIdentifier(table)}`;
    await this.execute(sql);
  }

  async listen(channel: string, callback: (payload: string) => void): Promise<void> {
    const client = await this.getClient();
    client.query(`LISTEN ${this.quoteIdentifier(channel)}`);

    client.on('notification', (msg: any) => {
      if (msg.channel === channel) {
        callback(msg.payload);
      }
    });
  }

  async notify(channel: string, payload?: string): Promise<void> {
    const sql = payload
      ? `NOTIFY ${this.quoteIdentifier(channel)}, '${payload}'`
      : `NOTIFY ${this.quoteIdentifier(channel)}`;
    await this.execute(sql);
  }

  async unlisten(channel: string): Promise<void> {
    const sql = `UNLISTEN ${this.quoteIdentifier(channel)}`;
    await this.execute(sql);
  }

  // ========================================================================
  // Full-Text Search
  // ========================================================================

  async createFullTextIndex(
    table: string,
    indexName: string,
    columns: string[]
  ): Promise<void> {
    const columnList = columns.map(c => `coalesce(${this.quoteIdentifier(c)}, '')`).join(" || ' ' || ");
    const sql = `
      CREATE INDEX ${this.quoteIdentifier(indexName)}
      ON ${this.quoteIdentifier(table)}
      USING gin(to_tsvector('english', ${columnList}))
    `;
    await this.execute(sql);
  }

  async searchFullText(
    table: string,
    columns: string[],
    query: string
  ): Promise<QueryResult> {
    const columnList = columns.map(c => `coalesce(${this.quoteIdentifier(c)}, '')`).join(" || ' ' || ");
    const sql = `
      SELECT *
      FROM ${this.quoteIdentifier(table)}
      WHERE to_tsvector('english', ${columnList}) @@ to_tsquery('english', $1)
    `;
    return this.query(sql, [query]);
  }
}
