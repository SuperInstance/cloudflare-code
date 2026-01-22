/**
 * Database Adapter Interface and Base Implementation
 * Provides unified interface for all database types
 */

import {
  DatabaseType,
  AnyDatabaseConfig,
  QueryResult,
  QueryCondition,
  QueryOptions,
  Transaction,
  TransactionOptions,
  IsolationLevel,
  TransactionStatus,
  FieldInfo,
} from '../types';

// ============================================================================
// Base Database Adapter
// ============================================================================

export abstract class DatabaseAdapter {
  protected config: AnyDatabaseConfig;
  protected connection: any;
  protected isConnectedFlag: boolean = false;
  protected transactionCount: number = 0;

  constructor(config: AnyDatabaseConfig) {
    this.config = config;
  }

  // ========================================================================
  // Connection Management
  // ========================================================================

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract isConnected(): boolean;

  protected validateConnection(): void {
    if (!this.isConnectedFlag) {
      throw new Error('Database connection is not established');
    }
  }

  // ========================================================================
  // Query Execution
  // ========================================================================

  abstract query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  abstract execute(sql: string, params?: any[]): Promise<QueryResult>;

  async select<T = any>(table: string, options: QueryOptions = {}): Promise<QueryResult<T>> {
    const sql = this.buildSelectQuery(table, options);
    const params = this.extractParams(options);
    return this.query<T>(sql, params);
  }

  async insert(table: string, data: Record<string, any>): Promise<QueryResult> {
    const sql = this.buildInsertQuery(table, data);
    const params = Object.values(data);
    return this.execute(sql, params);
  }

  async update(
    table: string,
    data: Record<string, any>,
    where: QueryCondition[]
  ): Promise<QueryResult> {
    const sql = this.buildUpdateQuery(table, data, where);
    const params = [...Object.values(data), ...this.extractConditionParams(where)];
    return this.execute(sql, params);
  }

  async delete(table: string, where: QueryCondition[]): Promise<QueryResult> {
    const sql = this.buildDeleteQuery(table, where);
    const params = this.extractConditionParams(where);
    return this.execute(sql, params);
  }

  // ========================================================================
  // Query Builders
  // ========================================================================

  protected buildSelectQuery(table: string, options: QueryOptions): string {
    let query = 'SELECT ';

    if (options.distinct) {
      query += 'DISTINCT ';
    }

    query += options.select && options.select.length > 0
      ? options.select.join(', ')
      : '*';

    query += ` FROM ${this.quoteIdentifier(table)}`;

    // CTEs
    if (options.with && options.with.length > 0) {
      const cte = options.with.map(cte => {
        const cteQuery = typeof cte.query === 'string'
          ? cte.query
          : this.buildSelectQuery(cte.query as any, {}); // Simplified
        return `${cte.name} AS (${cteQuery})`;
      }).join(', ');
      query = `WITH ${cte} ${query}`;
    }

    // JOINs
    if (options.joins && options.joins.length > 0) {
      for (const join of options.joins) {
        const joinTable = this.quoteIdentifier(join.alias || join.table);
        const baseTable = this.quoteIdentifier(join.table);
        const onClause = this.buildConditionClause(join.on);
        query += ` ${join.type} JOIN ${baseTable} AS ${joinTable} ON ${onClause}`;
      }
    }

    // WHERE
    if (options.where && options.where.length > 0) {
      query += ' WHERE ' + this.buildConditionClause(options.where);
    }

    // GROUP BY
    if (options.groupBy && options.groupBy.length > 0) {
      query += ' GROUP BY ' + options.groupBy.map(f => this.quoteIdentifier(f)).join(', ');
    }

    // HAVING
    if (options.having && options.having.length > 0) {
      query += ' HAVING ' + this.buildConditionClause(options.having);
    }

    // ORDER BY
    if (options.orderBy && options.orderBy.length > 0) {
      const orderBy = options.orderBy.map(o =>
        `${this.quoteIdentifier(o.field)} ${o.direction}`
      ).join(', ');
      query += ' ORDER BY ' + orderBy;
    }

    // LIMIT & OFFSET
    if (options.limit !== undefined) {
      query += ` LIMIT ${options.limit}`;
    }
    if (options.offset !== undefined) {
      query += ` OFFSET ${options.offset}`;
    }

    return query;
  }

  protected buildInsertQuery(table: string, data: Record<string, any>): string {
    const fields = Object.keys(data).map(f => this.quoteIdentifier(f)).join(', ');
    const placeholders = Object.keys(data).map(() => this.getPlaceholder()).join(', ');
    return `INSERT INTO ${this.quoteIdentifier(table)} (${fields}) VALUES (${placeholders})`;
  }

  protected buildUpdateQuery(
    table: string,
    data: Record<string, any>,
    where: QueryCondition[]
  ): string {
    const setClause = Object.keys(data)
      .map(f => `${this.quoteIdentifier(f)} = ${this.getPlaceholder()}`)
      .join(', ');
    const whereClause = this.buildConditionClause(where);
    return `UPDATE ${this.quoteIdentifier(table)} SET ${setClause} WHERE ${whereClause}`;
  }

  protected buildDeleteQuery(table: string, where: QueryCondition[]): string {
    const whereClause = this.buildConditionClause(where);
    return `DELETE FROM ${this.quoteIdentifier(table)} WHERE ${whereClause}`;
  }

  protected buildConditionClause(conditions: QueryCondition[]): string {
    return conditions.map((cond, index) => {
      const field = this.quoteIdentifier(cond.field);
      let clause = '';

      if (index > 0 && cond.logic) {
        clause += ` ${cond.logic} `;
      }

      switch (cond.operator) {
        case 'IN':
        case 'NOT IN':
          const placeholders = Array.isArray(cond.value)
            ? cond.value.map(() => this.getPlaceholder()).join(', ')
            : this.getPlaceholder();
          clause += `${field} ${cond.operator} (${placeholders})`;
          break;
        case 'BETWEEN':
          clause += `${field} BETWEEN ${this.getPlaceholder()} AND ${this.getPlaceholder()}`;
          break;
        case 'IS NULL':
          clause += `${field} IS NULL`;
          break;
        case 'IS NOT NULL':
          clause += `${field} IS NOT NULL`;
          break;
        default:
          clause += `${field} ${cond.operator} ${this.getPlaceholder()}`;
      }

      return clause;
    }).join('');
  }

  protected extractParams(options: QueryOptions): any[] {
    const params: any[] = [];

    const extractFromConditions = (conditions: QueryCondition[]) => {
      for (const cond of conditions) {
        if (cond.operator !== 'IS NULL' && cond.operator !== 'IS NOT NULL') {
          if (cond.operator === 'BETWEEN' && Array.isArray(cond.value)) {
            params.push(...cond.value);
          } else if (Array.isArray(cond.value)) {
            params.push(...cond.value);
          } else {
            params.push(cond.value);
          }
        }
      }
    };

    if (options.where) {
      extractFromConditions(options.where);
    }
    if (options.having) {
      extractFromConditions(options.having);
    }

    return params;
  }

  protected extractConditionParams(conditions: QueryCondition[]): any[] {
    const params: any[] = [];

    for (const cond of conditions) {
      if (cond.operator !== 'IS NULL' && cond.operator !== 'IS NOT NULL') {
        if (cond.operator === 'BETWEEN' && Array.isArray(cond.value)) {
          params.push(...cond.value);
        } else if (Array.isArray(cond.value)) {
          params.push(...cond.value);
        } else {
          params.push(cond.value);
        }
      }
    }

    return params;
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  abstract quoteIdentifier(identifier: string): string;
  abstract getPlaceholder(): string;

  abstract getTableInfo(table: string): Promise<FieldInfo[]>;
  abstract tableExists(table: string): Promise<boolean>;

  abstract beginTransaction(options?: TransactionOptions): Promise<Transaction>;
  abstract commitTransaction(transaction: Transaction): Promise<void>;
  abstract rollbackTransaction(transaction: Transaction): Promise<void>;

  // ========================================================================
  // Schema Operations
  // ========================================================================

  abstract createTable(table: string, schema: Record<string, any>): Promise<void>;
  abstract dropTable(table: string, cascade?: boolean): Promise<void>;
  abstract alterTable(table: string, changes: Record<string, any>): Promise<void>;
  abstract truncateTable(table: string): Promise<void>;

  abstract addColumn(table: string, column: string, definition: any): Promise<void>;
  abstract dropColumn(table: string, column: string): Promise<void>;
  abstract renameColumn(table: string, oldName: string, newName: string): Promise<void>;
  abstract changeColumn(table: string, column: string, definition: any): Promise<void>;

  abstract addIndex(
    table: string,
    columns: string[],
    options?: { unique?: boolean; name?: string }
  ): Promise<void>;
  abstract dropIndex(table: string, indexName: string): Promise<void>;

  // ========================================================================
  // Transaction Implementation
  // ========================================================================

  protected async createTransaction(
    options: TransactionOptions = {}
  ): Promise<Transaction> {
    const transactionId = this.generateTransactionId();
    const isolationLevel = options.isolationLevel || IsolationLevel.READ_COMMITTED;

    await this.query(
      `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`
    );
    await this.query('BEGIN');

    return {
      id: transactionId,
      status: TransactionStatus.ACTIVE,
      isolationLevel,
      beginTime: new Date(),

      commit: async (query: string, params?: any[]) => {
        return this.query(query, params);
      },

      rollback: async () => {
        await this.query('ROLLBACK');
        this.transactionCount--;
      },

      createSavepoint: async (name?: string) => {
        const savepointName = name || `sp_${Date.now()}`;
        await this.query(`SAVEPOINT ${this.quoteIdentifier(savepointName)}`);
        return { name: savepointName, createdAt: new Date() };
      },

      releaseSavepoint: async (name: string) => {
        await this.query(`RELEASE SAVEPOINT ${this.quoteIdentifier(name)}`);
      },

      rollbackToSavepoint: async (name: string) => {
        await this.query(`ROLLBACK TO SAVEPOINT ${this.quoteIdentifier(name)}`);
      },
    };
  }

  protected generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========================================================================
  // Getters
  // ========================================================================

  getType(): DatabaseType {
    return this.config.type;
  }

  getConfig(): AnyDatabaseConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Connection Pool Interface
// ============================================================================

export interface ConnectionPool {
  acquire(): Promise<any>;
  release(connection: any): void;
  destroy(connection: any): Promise<void>;
  getStats(): {
    total: number;
    idle: number;
    active: number;
    waiting: number;
  };
  drain(): Promise<void>;
  clear(): void;
}

// ============================================================================
// Batch Operations
// ============================================================================

export interface BatchOperation {
  type: 'insert' | 'update' | 'delete';
  table: string;
  data?: Record<string, any>;
  where?: QueryCondition[];
}

export interface BatchResult {
  success: boolean;
  results: QueryResult[];
  errors: Array<{ operation: BatchOperation; error: Error }>;
  executionTime: number;
}

export abstract class BatchOperationsMixin {
  protected adapter: DatabaseAdapter;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
  }

  async batch(operations: BatchOperation[], transactional = true): Promise<BatchResult> {
    const startTime = Date.now();
    const results: QueryResult[] = [];
    const errors: Array<{ operation: BatchOperation; error: Error }> = [];

    if (transactional) {
      const transaction = await this.adapter.beginTransaction();

      try {
        for (const operation of operations) {
          try {
            let result: QueryResult;

            switch (operation.type) {
              case 'insert':
                result = await this.adapter.insert(operation.table, operation.data!);
                break;
              case 'update':
                result = await this.adapter.update(
                  operation.table,
                  operation.data!,
                  operation.where!
                );
                break;
              case 'delete':
                result = await this.adapter.delete(operation.table, operation.where!);
                break;
              default:
                throw new Error(`Unknown operation type: ${operation.type}`);
            }

            results.push(result);
          } catch (error) {
            errors.push({ operation, error: error as Error });
          }
        }

        if (errors.length > 0) {
          await this.adapter.rollbackTransaction(transaction);
          return { success: false, results, errors, executionTime: Date.now() - startTime };
        }

        await this.adapter.commitTransaction(transaction);
        return { success: true, results, errors, executionTime: Date.now() - startTime };
      } catch (error) {
        await this.adapter.rollbackTransaction(transaction);
        throw error;
      }
    } else {
      for (const operation of operations) {
        try {
          let result: QueryResult;

          switch (operation.type) {
            case 'insert':
              result = await this.adapter.insert(operation.table, operation.data!);
              break;
            case 'update':
              result = await this.adapter.update(
                operation.table,
                operation.data!,
                operation.where!
              );
              break;
            case 'delete':
              result = await this.adapter.delete(operation.table, operation.where!);
              break;
            default:
              throw new Error(`Unknown operation type: ${operation.type}`);
          }

          results.push(result);
        } catch (error) {
          errors.push({ operation, error: error as Error });
        }
      }

      return {
        success: errors.length === 0,
        results,
        errors,
        executionTime: Date.now() - startTime,
      };
    }
  }
}
