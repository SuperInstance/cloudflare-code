/**
 * Query Builder
 * Fluent interface for building database queries
 */

import { DatabaseAdapter } from '../adapters/adapter';
import {
  QueryCondition,
  QueryOptions,
  JoinClause,
  CTEClause,
  QueryResult,
  QueryValue,
} from '../types';

// ============================================================================
// Query Builder Class
// ============================================================================

export class QueryBuilder {
  private adapter: DatabaseAdapter;
  private table: string;
  private options: QueryOptions;
  private alias?: string;

  constructor(adapter: DatabaseAdapter, table: string) {
    this.adapter = adapter;
    this.table = table;
    this.options = {};
  }

  // ========================================================================
  // SELECT Operations
  // ========================================================================

  select(...columns: string[]): QueryBuilder {
    this.options.select = columns;
    return this;
  }

  selectDistinct(...columns: string[]): QueryBuilder {
    this.options.select = columns;
    this.options.distinct = true;
    return this;
  }

  // ========================================================================
  // WHERE Operations
  // ========================================================================

  where(field: string, operator: string, value?: QueryValue): QueryBuilder {
    if (!this.options.where) {
      this.options.where = [];
    }

    if (value === undefined && operator !== 'IS NULL' && operator !== 'IS NOT NULL') {
      // Simplified where syntax: where(field, value)
      value = operator;
      operator = '=';
    }

    this.options.where.push({
      field,
      operator: operator as any,
      value,
      logic: this.options.where.length > 0 ? 'AND' : undefined,
    });

    return this;
  }

  orWhere(field: string, operator: string, value?: QueryValue): QueryBuilder {
    if (!this.options.where) {
      this.options.where = [];
    }

    if (value === undefined && operator !== 'IS NULL' && operator !== 'IS NOT NULL') {
      value = operator;
      operator = '=';
    }

    this.options.where.push({
      field,
      operator: operator as any,
      value,
      logic: 'OR',
    });

    return this;
  }

  whereIn(field: string, values: QueryValue[]): QueryBuilder {
    this.options.where = this.options.where || [];
    this.options.where.push({
      field,
      operator: 'IN',
      value: values,
      logic: this.options.where.length > 0 ? 'AND' : undefined,
    });

    return this;
  }

  orWhereIn(field: string, values: QueryValue[]): QueryBuilder {
    this.options.where = this.options.where || [];
    this.options.where.push({
      field,
      operator: 'IN',
      value: values,
      logic: 'OR',
    });

    return this;
  }

  whereNotIn(field: string, values: QueryValue[]): QueryBuilder {
    this.options.where = this.options.where || [];
    this.options.where.push({
      field,
      operator: 'NOT IN',
      value: values,
      logic: this.options.where.length > 0 ? 'AND' : undefined,
    });

    return this;
  }

  orWhereNotIn(field: string, values: QueryValue[]): QueryBuilder {
    this.options.where = this.options.where || [];
    this.options.where.push({
      field,
      operator: 'NOT IN',
      value: values,
      logic: 'OR',
    });

    return this;
  }

  whereBetween(field: string, min: QueryValue, max: QueryValue): QueryBuilder {
    this.options.where = this.options.where || [];
    this.options.where.push({
      field,
      operator: 'BETWEEN',
      value: [min, max],
      logic: this.options.where.length > 0 ? 'AND' : undefined,
    });

    return this;
  }

  orWhereBetween(field: string, min: QueryValue, max: QueryValue): QueryBuilder {
    this.options.where = this.options.where || [];
    this.options.where.push({
      field,
      operator: 'BETWEEN',
      value: [min, max],
      logic: 'OR',
    });

    return this;
  }

  whereNull(field: string): QueryBuilder {
    this.options.where = this.options.where || [];
    this.options.where.push({
      field,
      operator: 'IS NULL',
      logic: this.options.where.length > 0 ? 'AND' : undefined,
    });

    return this;
  }

  orWhereNull(field: string): QueryBuilder {
    this.options.where = this.options.where || [];
    this.options.where.push({
      field,
      operator: 'IS NULL',
      logic: 'OR',
    });

    return this;
  }

  whereNotNull(field: string): QueryBuilder {
    this.options.where = this.options.where || [];
    this.options.where.push({
      field,
      operator: 'IS NOT NULL',
      logic: this.options.where.length > 0 ? 'AND' : undefined,
    });

    return this;
  }

  orWhereNotNull(field: string): QueryBuilder {
    this.options.where = this.options.where || [];
    this.options.where.push({
      field,
      operator: 'IS NOT NULL',
      logic: 'OR',
    });

    return this;
  }

  whereLike(field: string, pattern: string): QueryBuilder {
    this.options.where = this.options.where || [];
    this.options.where.push({
      field,
      operator: 'LIKE',
      value: pattern,
      logic: this.options.where.length > 0 ? 'AND' : undefined,
    });

    return this;
  }

  orWhereLike(field: string, pattern: string): QueryBuilder {
    this.options.where = this.options.where || [];
    this.options.where.push({
      field,
      operator: 'LIKE',
      value: pattern,
      logic: 'OR',
    });

    return this;
  }

  whereRaw(sql: string, params?: any[]): QueryBuilder {
    // For complex where clauses, you can use raw SQL
    this.options.where = this.options.where || [];
    this.options.where.push({
      field: sql,
      operator: 'RAW',
      value: params,
      logic: this.options.where.length > 0 ? 'AND' : undefined,
    } as any);

    return this;
  }

  // ========================================================================
  // JOIN Operations
  // ========================================================================

  join(
    table: string,
    first: string,
    operator: string,
    second: string,
    type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS' = 'INNER'
  ): QueryBuilder {
    this.options.joins = this.options.joins || [];
    this.options.joins.push({
      type,
      table,
      on: [
        {
          field: first,
          operator: operator as any,
          value: second,
        },
      ],
    });

    return this;
  }

  innerJoin(table: string, first: string, operator: string, second: string): QueryBuilder {
    return this.join(table, first, operator, second, 'INNER');
  }

  leftJoin(table: string, first: string, operator: string, second: string): QueryBuilder {
    return this.join(table, first, operator, second, 'LEFT');
  }

  rightJoin(table: string, first: string, operator: string, second: string): QueryBuilder {
    return this.join(table, first, operator, second, 'RIGHT');
  }

  fullJoin(table: string, first: string, operator: string, second: string): QueryBuilder {
    return this.join(table, first, operator, second, 'FULL');
  }

  crossJoin(table: string): QueryBuilder {
    return this.join(table, '', '', '', 'CROSS');
  }

  joinRaw(sql: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' = 'INNER'): QueryBuilder {
    this.options.joins = this.options.joins || [];
    this.options.joins.push({
      type,
      table: sql,
      on: [],
    } as any);

    return this;
  }

  // ========================================================================
  // GROUP BY and HAVING
  // ========================================================================

  groupBy(...columns: string[]): QueryBuilder {
    this.options.groupBy = columns;
    return this;
  }

  having(field: string, operator: string, value?: QueryValue): QueryBuilder {
    if (!this.options.having) {
      this.options.having = [];
    }

    if (value === undefined) {
      value = operator;
      operator = '=';
    }

    this.options.having.push({
      field,
      operator: operator as any,
      value,
      logic: this.options.having.length > 0 ? 'AND' : undefined,
    });

    return this;
  }

  orHaving(field: string, operator: string, value?: QueryValue): QueryBuilder {
    if (!this.options.having) {
      this.options.having = [];
    }

    if (value === undefined) {
      value = operator;
      operator = '=';
    }

    this.options.having.push({
      field,
      operator: operator as any,
      value,
      logic: 'OR',
    });

    return this;
  }

  // ========================================================================
  // ORDER BY
  // ========================================================================

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
    this.options.orderBy = this.options.orderBy || [];
    this.options.orderBy.push({ field, direction });
    return this;
  }

  orderByAsc(field: string): QueryBuilder {
    return this.orderBy(field, 'ASC');
  }

  orderByDesc(field: string): QueryBuilder {
    return this.orderBy(field, 'DESC');
  }

  orderByRaw(sql: string): QueryBuilder {
    this.options.orderBy = this.options.orderBy || [];
    this.options.orderBy.push({ field: sql, direction: 'ASC' } as any);
    return this;
  }

  // ========================================================================
  // LIMIT and OFFSET
  // ========================================================================

  limit(count: number): QueryBuilder {
    this.options.limit = count;
    return this;
  }

  offset(count: number): QueryBuilder {
    this.options.offset = count;
    return this;
  }

  take(count: number): QueryBuilder {
    return this.limit(count);
  }

  skip(count: number): QueryBuilder {
    return this.offset(count);
  }

  // ========================================================================
  // CTE (Common Table Expressions)
  // ========================================================================

  with(name: string, query: QueryBuilder | string, recursive = false): QueryBuilder {
    this.options.with = this.options.with || [];
    this.options.with.push({
      name,
      query: query instanceof QueryBuilder ? query : query,
      recursive,
    });

    return this;
  }

  withRecursive(name: string, query: QueryBuilder | string): QueryBuilder {
    return this.with(name, query, true);
  }

  // ========================================================================
  // Aggregation
  // ========================================================================

  async count(field = '*'): Promise<number> {
    const originalSelect = this.options.select;
    this.options.select = [`COUNT(${field}) as count`];

    const result = await this.adapter.select(this.table, this.options);
    this.options.select = originalSelect;

    return result.rows[0]?.count || 0;
  }

  async sum(field: string): Promise<number> {
    const originalSelect = this.options.select;
    this.options.select = [`SUM(${field}) as sum`];

    const result = await this.adapter.select(this.table, this.options);
    this.options.select = originalSelect;

    return result.rows[0]?.sum || 0;
  }

  async avg(field: string): Promise<number> {
    const originalSelect = this.options.select;
    this.options.select = [`AVG(${field}) as avg`];

    const result = await this.adapter.select(this.table, this.options);
    this.options.select = originalSelect;

    return result.rows[0]?.avg || 0;
  }

  async min(field: string): Promise<any> {
    const originalSelect = this.options.select;
    this.options.select = [`MIN(${field}) as min`];

    const result = await this.adapter.select(this.table, this.options);
    this.options.select = originalSelect;

    return result.rows[0]?.min;
  }

  async max(field: string): Promise<any> {
    const originalSelect = this.options.select;
    this.options.select = [`MAX(${field}) as max`];

    const result = await this.adapter.select(this.table, this.options);
    this.options.select = originalSelect;

    return result.rows[0]?.max;
  }

  // ========================================================================
  // Query Execution
  // ========================================================================

  async get<T = any>(): Promise<T[]> {
    const result = await this.adapter.select<T>(this.table, this.options);
    return result.rows;
  }

  async first<T = any>(): Promise<T | null> {
    const originalLimit = this.options.limit;
    this.options.limit = 1;

    const result = await this.adapter.select<T>(this.table, this.options);
    this.options.limit = originalLimit;

    return result.rows[0] || null;
  }

  async find<T = any>(id: any): Promise<T | null> {
    this.options.where = this.options.where || [];
    this.options.where.push({
      field: 'id',
      operator: '=',
      value: id,
    });

    return this.first<T>();
  }

  async value(field: string): Promise<any> {
    const originalSelect = this.options.select;
    this.options.select = [field];
    this.options.limit = 1;

    const result = await this.adapter.select(this.table, this.options);
    this.options.select = originalSelect;
    delete this.options.limit;

    return result.rows[0]?.[field];
  }

  async pluck(field: string): Promise<any[]> {
    const originalSelect = this.options.select;
    this.options.select = [field];

    const result = await this.adapter.select(this.table, this.options);
    this.options.select = originalSelect;

    return result.rows.map(row => row[field]);
  }

  async exists(): Promise<boolean> {
    const originalSelect = this.options.select;
    this.options.select = ['1'];
    this.options.limit = 1;

    const result = await this.adapter.select(this.table, this.options);
    this.options.select = originalSelect;
    delete this.options.limit;

    return result.rowCount > 0;
  }

  async chunk(count: number, callback: (rows: any[]) => void | Promise<void>): Promise<void> {
    let offset = 0;
    const originalLimit = this.options.limit;
    const originalOffset = this.options.offset;

    while (true) {
      this.options.limit = count;
      this.options.offset = offset;

      const rows = await this.get();

      if (rows.length === 0) {
        break;
      }

      await callback(rows);

      if (rows.length < count) {
        break;
      }

      offset += count;
    }

    this.options.limit = originalLimit;
    this.options.offset = originalOffset;
  }

  // ========================================================================
  // Pagination
  // ========================================================================

  async paginate(page: number = 1, perPage: number = 15): Promise<{
    data: any[];
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
    from: number;
    to: number;
  }> {
    const total = await this.count();
    const lastPage = Math.ceil(total / perPage);
    const from = (page - 1) * perPage + 1;
    const to = Math.min(page * perPage, total);

    this.options.limit = perPage;
    this.options.offset = (page - 1) * perPage;

    const data = await this.get();

    return {
      data,
      total,
      perPage,
      currentPage: page,
      lastPage,
      from: from > total ? 0 : from,
      to,
    };
  }

  async simplePaginate(page: number = 1, perPage: number = 15): Promise<{
    data: any[];
    perPage: number;
    currentPage: number;
    hasMorePages: boolean;
  }> {
    this.options.limit = perPage + 1;
    this.options.offset = (page - 1) * perPage;

    const data = await this.get();
    const hasMorePages = data.length > perPage;
    const paginatedData = data.slice(0, perPage);

    return {
      data: paginatedData,
      perPage,
      currentPage: page,
      hasMorePages,
    };
  }

  // ========================================================================
  // Subqueries
  // ========================================================================

  static sub(adapter: DatabaseAdapter, table: string): QueryBuilder {
    return new QueryBuilder(adapter, table);
  }

  toSQL(): string {
    return this.adapter['buildSelectQuery'](this.table, this.options);
  }

  clone(): QueryBuilder {
    const cloned = new QueryBuilder(this.adapter, this.table);
    cloned.options = JSON.parse(JSON.stringify(this.options));
    cloned.alias = this.alias;
    return cloned;
  }

  // ========================================================================
  // Debugging
  // ========================================================================

  dd(): void {
    console.log(this.toSQL());
    process.exit(0);
  }

  dump(): QueryBuilder {
    console.log(this.toSQL());
    return this;
  }

  explain(): Promise<any> {
    return this.adapter.query(`EXPLAIN ${this.toSQL()}`);
  }
}

// ============================================================================
// Insert Query Builder
// ============================================================================

export class InsertBuilder {
  private adapter: DatabaseAdapter;
  private table: string;
  private data: Record<string, any>;
  private ignore = false;

  constructor(adapter: DatabaseAdapter, table: string) {
    this.adapter = adapter;
    this.table = table;
    this.data = {};
  }

  set(data: Record<string, any>): InsertBuilder {
    this.data = data;
    return this;
  }

  ignore(): InsertBuilder {
    this.ignore = true;
    return this;
  }

  async execute(): Promise<QueryResult> {
    return this.adapter.insert(this.table, this.data);
  }

  async returnId(): Promise<string | number | undefined> {
    const result = await this.execute();
    return result.insertId;
  }
}

// ============================================================================
// Update Query Builder
// ============================================================================

export class UpdateBuilder {
  private adapter: DatabaseAdapter;
  private table: string;
  private data: Record<string, any>;
  private where: QueryCondition[] = [];

  constructor(adapter: DatabaseAdapter, table: string) {
    this.adapter = adapter;
    this.table = table;
    this.data = {};
  }

  set(data: Record<string, any>): UpdateBuilder {
    this.data = data;
    return this;
  }

  where(field: string, operator: string, value: QueryValue): UpdateBuilder {
    this.where.push({
      field,
      operator: operator as any,
      value,
    });
    return this;
  }

  async execute(): Promise<QueryResult> {
    return this.adapter.update(this.table, this.data, this.where);
  }

  async returnCount(): Promise<number> {
    const result = await this.execute();
    return result.affectedRows || 0;
  }
}

// ============================================================================
// Delete Query Builder
// ============================================================================

export class DeleteBuilder {
  private adapter: DatabaseAdapter;
  private table: string;
  private where: QueryCondition[] = [];

  constructor(adapter: DatabaseAdapter, table: string) {
    this.adapter = adapter;
    this.table = table;
  }

  where(field: string, operator: string, value: QueryValue): DeleteBuilder {
    this.where.push({
      field,
      operator: operator as any,
      value,
    });
    return this;
  }

  async execute(): Promise<QueryResult> {
    return this.adapter.delete(this.table, this.where);
  }

  async returnCount(): Promise<number> {
    const result = await this.execute();
    return result.affectedRows || 0;
  }
}
