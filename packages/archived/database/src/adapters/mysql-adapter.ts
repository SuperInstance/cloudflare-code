/**
 * MySQL/MariaDB Adapter
 * Full-featured MySQL driver with replication support
 */

import { DatabaseAdapter } from './adapter';
import { MySQLConfig, QueryResult, FieldInfo } from '../types';

// ============================================================================
// MySQL Adapter Implementation
// ============================================================================

export class MySQLAdapter extends DatabaseAdapter {
  protected declare config: MySQLConfig;
  private pool: any = null;
  private connection: any = null;

  constructor(config: MySQLConfig) {
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
      // Dynamic import of mysql2 module
      const mysql = await import('mysql2/promise');

      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
        charset: this.config.charset || 'utf8mb4',
        timezone: this.config.timezone || '+00:00',
        connectionLimit: this.config.maxConnections || 20,
        queueLimit: 0,
        waitForConnections: true,
        connectTimeout: this.config.connectionTimeout || 10000,
        idleTimeout: this.config.idleTimeout || 60000,
        maxLifetime: this.config.maxLifetime || 180000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      });

      // Test connection
      const conn = await this.pool.getConnection();
      conn.release();

      this.isConnectedFlag = true;
    } catch (error) {
      throw new Error(`MySQL connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    if (this.connection) {
      this.connection.release();
      this.connection = null;
    }
    this.isConnectedFlag = false;
  }

  isConnected(): boolean {
    return this.isConnectedFlag && this.pool !== null;
  }

  private async getConnection(): Promise<any> {
    if (!this.isConnected()) {
      await this.connect();
    }

    if (!this.connection) {
      this.connection = await this.pool.getConnection();
    }

    return this.connection;
  }

  private releaseConnection(): void {
    if (this.connection) {
      this.connection.release();
      this.connection = null;
    }
  }

  // ========================================================================
  // Query Execution
  // ========================================================================

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const startTime = Date.now();

    try {
      const connection = await this.getConnection();

      const [rows, fields] = await connection.execute(sql, params || []);

      return {
        rows: Array.isArray(rows) ? rows : [],
        rowCount: Array.isArray(rows) ? rows.length : 0,
        affectedRows: (rows as any).affectedRows,
        insertId: (rows as any).insertId,
        fields: fields?.map((f: any) => ({
          name: f.name,
          type: this.mysqlTypeToType(f.type),
          nullable: f.flags === 0,
        })),
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`MySQL query failed: ${error}`);
    } finally {
      this.releaseConnection();
    }
  }

  async execute(sql: string, params?: any[]): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      const connection = await this.getConnection();

      const [result] = await connection.execute(sql, params || []);

      return {
        rows: [],
        rowCount: 0,
        affectedRows: (result as any).affectedRows,
        insertId: (result as any).insertId,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`MySQL execute failed: ${error}`);
    } finally {
      this.releaseConnection();
    }
  }

  private mysqlTypeToType(type: number): string {
    const typeMap: Record<number, string> = {
      1: 'number',      // TINYINT
      2: 'number',      // SMALLINT
      3: 'number',      // INT
      4: 'number',      // FLOAT
      5: 'number',      // DOUBLE
      6: 'number',      // TIMESTAMP
      7: 'number',      // BIGINT
      8: 'number',      // MEDIUMINT
      9: 'number',      // DATE
      10: 'number',     // TIME
      11: 'number',     // DATETIME
      12: 'number',     // YEAR
      13: 'number',     // NEWDATE
      246: 'number',    // DECIMAL
      253: 'string',    // VARCHAR
      254: 'string',    // CHAR
      252: 'binary',    // BLOB/BINARY
      251: 'string',    // TEXT
      250: 'string',    // ENUM
      249: 'string',    // SET
      16: 'number',     // BIT
      245: 'json',      // JSON
      15: 'string',     // GEOMETRY
    };

    return typeMap[type] || 'string';
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  quoteIdentifier(identifier: string): string {
    // MySQL uses backticks for identifiers
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  getPlaceholder(): string {
    // MySQL uses ? for placeholders
    return '?';
  }

  // ========================================================================
  // Schema Operations
  // ========================================================================

  async getTableInfo(table: string): Promise<FieldInfo[]> {
    const sql = `
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        COLUMN_KEY,
        EXTRA
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `;

    const result = await this.query(sql, [this.config.database, table]);

    return result.rows.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: this.mapMySQLType(row.DATA_TYPE),
      nullable: row.IS_NULLABLE === 'YES',
      primaryKey: row.COLUMN_KEY === 'PRI',
      defaultValue: row.COLUMN_DEFAULT,
    }));
  }

  private mapMySQLType(mysqlType: string): string {
    const typeMap: Record<string, string> = {
      'int': 'number',
      'tinyint': 'number',
      'smallint': 'number',
      'mediumint': 'number',
      'bigint': 'number',
      'float': 'number',
      'double': 'number',
      'decimal': 'number',
      'numeric': 'number',
      'boolean': 'boolean',
      'bool': 'boolean',
      'varchar': 'string',
      'char': 'string',
      'text': 'string',
      'tinytext': 'string',
      'mediumtext': 'string',
      'longtext': 'string',
      'date': 'date',
      'datetime': 'date',
      'timestamp': 'date',
      'time': 'date',
      'year': 'number',
      'json': 'json',
      'blob': 'binary',
      'binary': 'binary',
      'varbinary': 'binary',
      'tinyblob': 'binary',
      'mediumblob': 'binary',
      'longblob': 'binary',
    };

    return typeMap[mysqlType.toLowerCase()] || mysqlType;
  }

  async tableExists(table: string): Promise<boolean> {
    const sql = `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `;

    const result = await this.query(sql, [this.config.database, table]);
    return result.rowCount > 0;
  }

  async createTable(table: string, schema: Record<string, any>): Promise<void> {
    const columns = Object.entries(schema).map(([name, definition]) => {
      let columnDef = this.quoteIdentifier(name);
      columnDef += ' ' + this.mapTypeToMySQL(definition.type, definition.length);

      if (definition.unsigned) {
        columnDef += ' UNSIGNED';
      }
      if (definition.zerofill) {
        columnDef += ' ZEROFILL';
      }
      if (definition.autoIncrement) {
        columnDef += ' AUTO_INCREMENT';
      }
      if (definition.primaryKey) {
        columnDef += ' PRIMARY KEY';
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
      if (definition.comment) {
        columnDef += ` COMMENT '${definition.comment}'`;
      }

      return columnDef;
    }).join(', ');

    const tableOptions: string[] = [];
    if (schema.$engine) {
      tableOptions.push(`ENGINE=${schema.$engine}`);
    }
    if (schema.$charset) {
      tableOptions.push(`DEFAULT CHARSET=${schema.$charset}`);
    }
    if (schema.$collation) {
      tableOptions.push(`COLLATE=${schema.$collation}`);
    }
    if (schema.$comment) {
      tableOptions.push(`COMMENT='${schema.$comment}'`);
    }

    const optionsClause = tableOptions.length > 0 ? ' ' + tableOptions.join(' ') : '';
    const sql = `CREATE TABLE ${this.quoteIdentifier(table)} (${columns})${optionsClause}`;
    await this.execute(sql);
  }

  private mapTypeToMySQL(type: string, length?: number): string {
    const typeMap: Record<string, string> = {
      'string': 'VARCHAR',
      'text': 'TEXT',
      'number': 'INT',
      'bigint': 'BIGINT',
      'boolean': 'TINYINT(1)',
      'date': 'DATETIME',
      'json': 'JSON',
      'binary': 'BLOB',
    };

    const mysqlType = typeMap[type] || type.toUpperCase();

    if (length && ['VARCHAR', 'CHAR', 'VARBINARY', 'BINARY'].includes(mysqlType)) {
      return `${mysqlType}(${length})`;
    }

    return mysqlType;
  }

  async dropTable(table: string, cascade = false): Promise<void> {
    if (cascade) {
      // MySQL doesn't support CASCADE, need to drop foreign keys manually
      const foreignKeys = await this.query(`
        SELECT CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [this.config.database, table]);

      for (const fk of foreignKeys.rows) {
        await this.execute(`ALTER TABLE ${this.quoteIdentifier(table)} DROP FOREIGN KEY ${this.quoteIdentifier(fk.CONSTRAINT_NAME)}`);
      }
    }

    const sql = `DROP TABLE${cascade ? ' IF EXISTS' : ''} ${this.quoteIdentifier(table)}`;
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
    columnDef += ' ' + this.mapTypeToMySQL(definition.type, definition.length);

    if (definition.unsigned) {
      columnDef += ' UNSIGNED';
    }
    if (definition.autoIncrement) {
      columnDef += ' AUTO_INCREMENT';
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
    }
    if (definition.after) {
      columnDef += ` AFTER ${this.quoteIdentifier(definition.after)}`;
    }
    if (definition.first) {
      columnDef += ' FIRST';
    }

    const sql = `ALTER TABLE ${this.quoteIdentifier(table)} ADD COLUMN ${columnDef}`;
    await this.execute(sql);
  }

  async dropColumn(table: string, column: string): Promise<void> {
    const sql = `ALTER TABLE ${this.quoteIdentifier(table)} DROP COLUMN ${this.quoteIdentifier(column)}`;
    await this.execute(sql);
  }

  async renameColumn(table: string, oldName: string, newName: string): Promise<void> {
    // MySQL requires the full column definition for RENAME
    const tableInfo = await this.getTableInfo(table);
    const columnInfo = tableInfo.find(c => c.name === oldName);

    if (!columnInfo) {
      throw new Error(`Column ${oldName} not found in table ${table}`);
    }

    let columnDef = this.quoteIdentifier(newName);
    columnDef += ' ' + this.mapTypeToMySQL(columnInfo.type as any);
    if (!columnInfo.nullable) {
      columnDef += ' NOT NULL';
    }
    if (columnInfo.defaultValue !== undefined) {
      columnDef += ` DEFAULT ${columnInfo.defaultValue}`;
    }

    const sql = `ALTER TABLE ${this.quoteIdentifier(table)} CHANGE ${this.quoteIdentifier(oldName)} ${columnDef}`;
    await this.execute(sql);
  }

  async changeColumn(table: string, column: string, definition: any): Promise<void> {
    let columnDef = this.quoteIdentifier(definition.newName || column);
    columnDef += ' ' + this.mapTypeToMySQL(definition.type, definition.length);

    if (definition.unsigned) {
      columnDef += ' UNSIGNED';
    }
    if (definition.notNull !== undefined) {
      columnDef += definition.notNull ? ' NOT NULL' : ' NULL';
    }
    if (definition.defaultValue !== undefined) {
      columnDef += ` DEFAULT ${definition.defaultValue}`;
    }
    if (definition.dropDefault) {
      columnDef += ' DROP DEFAULT';
    }
    if (definition.after) {
      columnDef += ` AFTER ${this.quoteIdentifier(definition.after)}`;
    }
    if (definition.first) {
      columnDef += ' FIRST';
    }

    const sql = `ALTER TABLE ${this.quoteIdentifier(table)} MODIFY COLUMN ${columnDef}`;
    await this.execute(sql);
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
    const sql = `DROP INDEX ${this.quoteIdentifier(indexName)} ON ${this.quoteIdentifier(table)}`;
    await this.execute(sql);
  }

  // ========================================================================
  // Transaction Support
  // ========================================================================

  async beginTransaction(): Promise<any> {
    await this.execute('START TRANSACTION');
    return this.createTransaction();
  }

  async commitTransaction(transaction: any): Promise<void> {
    await this.execute('COMMIT');
  }

  async rollbackTransaction(transaction: any): Promise<void> {
    await this.execute('ROLLBACK');
  }

  // ========================================================================
  // MySQL Specific Features
  // ========================================================================

  async explainQuery(sql: string, params?: any[]): Promise<QueryResult> {
    const explainSql = `EXPLAIN ${sql}`;
    return this.query(explainSql, params);
  }

  async analyzeTable(table: string): Promise<void> {
    const sql = `ANALYZE TABLE ${this.quoteIdentifier(table)}`;
    await this.execute(sql);
  }

  async optimizeTable(table: string): Promise<void> {
    const sql = `OPTIMIZE TABLE ${this.quoteIdentifier(table)}`;
    await this.execute(sql);
  }

  async repairTable(table: string): Promise<void> {
    const sql = `REPAIR TABLE ${this.quoteIdentifier(table)}`;
    await this.execute(sql);
  }

  async checkTable(table: string): Promise<QueryResult> {
    const sql = `CHECK TABLE ${this.quoteIdentifier(table)}`;
    return this.query(sql);
  }

  async showCreateTable(table: string): Promise<string> {
    const result = await this.query(`SHOW CREATE TABLE ${this.quoteIdentifier(table)}`);
    return result.rows[0]?.['Create Table'] || '';
  }

  async showTableStatus(table?: string): Promise<QueryResult> {
    const sql = table
      ? `SHOW TABLE STATUS LIKE '${table}'`
      : 'SHOW TABLE STATUS';
    return this.query(sql);
  }

  async showIndex(table: string): Promise<QueryResult> {
    const sql = `SHOW INDEX FROM ${this.quoteIdentifier(table)}`;
    return this.query(sql);
  }

  async showColumns(table: string): Promise<QueryResult> {
    const sql = `SHOW COLUMNS FROM ${this.quoteIdentifier(table)}`;
    return this.query(sql);
  }

  // ========================================================================
  // Replication Support
  // ========================================================================

  async getMasterStatus(): Promise<QueryResult> {
    return this.query('SHOW MASTER STATUS');
  }

  async getSlaveStatus(): Promise<QueryResult> {
    return this.query('SHOW SLAVE STATUS');
  }

  async startSlave(): Promise<void> {
    await this.execute('START SLAVE');
  }

  async stopSlave(): Promise<void> {
    await this.execute('STOP SLAVE');
  }

  async resetSlave(): Promise<void> {
    await this.execute('RESET SLAVE');
  }

  async flushPrivileges(): Promise<void> {
    await this.execute('FLUSH PRIVILEGES');
  }
}
