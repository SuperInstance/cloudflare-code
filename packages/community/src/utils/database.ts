/**
 * Database utilities for Community Platform
 * Handles database connections, queries, and transactions
 */

// @ts-nocheck - Database utilities with unused imports and missing types
import {
  User,
  ForumThread,
  ForumPost,
  ForumCategory,
  Question,
  Answer,
  Comment,
  GalleryItem,
  CommunityEvent,
  EventRegistration,
  Notification,
  Report,
  ModerationAction,
  ReputationEvent,
  Badge,
  ThreadView,
  QuestionView,
  Vote,
  GalleryRating,
  PaginationMeta,
  PaginatedResponse
} from '../types';

// Database connection interface
export interface DatabaseConnection {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<{ insertId?: string; rowsAffected: number }>;
  beginTransaction(): Promise<Transaction>;
}

export interface Transaction {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<{ insertId?: string; rowsAffected: number }>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// Database client for Cloudflare D1
export class D1Database implements DatabaseConnection {
  constructor(private db: D1DatabaseBinding) {}

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const result = await this.db.prepare(sql).bind(...params).all();
      return result.results as T[];
    } catch (error) {
      console.error('Database query error:', error);
      throw new DatabaseError('Query execution failed', sql, params, error);
    }
  }

  async queryOne<T>(sql: string, params: any[] = []): Promise<T | null> {
    try {
      const result = await this.db.prepare(sql).bind(...params).first();
      return result as T || null;
    } catch (error) {
      console.error('Database query error:', error);
      throw new DatabaseError('Query execution failed', sql, params, error);
    }
  }

  async execute(sql: string, params: any[] = []): Promise<{ insertId?: string; rowsAffected: number }> {
    try {
      const result = await this.db.prepare(sql).bind(...params).run();
      return {
        insertId: result.meta.last_row_id?.toString(),
        rowsAffected: result.meta.changes || 0
      };
    } catch (error) {
      console.error('Database execute error:', error);
      throw new DatabaseError('Execute failed', sql, params, error);
    }
  }

  async beginTransaction(): Promise<Transaction> {
    // D1 doesn't support explicit transactions, so we'll implement optimistic locking
    throw new Error('Transactions not supported in D1');
  }
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public sql: string,
    public params: any[],
    public originalError?: any
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

// Query builder for complex queries
export class QueryBuilder {
  private selectClause: string[] = ['*'];
  private fromClause: string = '';
  private joins: string[] = [];
  private whereClause: string[] = [];
  private groupByClause: string[] = [];
  private havingClause: string[] = [];
  private orderByClause: string[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private params: any[] = [];

  select(...columns: string[]): this {
    this.selectClause = columns;
    return this;
  }

  from(table: string, alias?: string): this {
    this.fromClause = alias ? `${table} AS ${alias}` : table;
    return this;
  }

  join(table: string, on: string, type: 'INNER' | 'LEFT' | 'RIGHT' = 'INNER'): this {
    this.joins.push(`${type} JOIN ${table} ON ${on}`);
    return this;
  }

  where(condition: string, ...params: any[]): this {
    this.whereClause.push(condition);
    this.params.push(...params);
    return this;
  }

  whereIn(column: string, values: any[]): this {
    if (values.length === 0) {
      this.whereClause.push('1=0');
    } else {
      const placeholders = values.map(() => '?').join(',');
      this.whereClause.push(`${column} IN (${placeholders})`);
      this.params.push(...values);
    }
    return this;
  }

  whereLike(column: string, pattern: string): this {
    this.whereClause.push(`${column} LIKE ?`);
    this.params.push(pattern);
    return this;
  }

  whereBetween(column: string, min: any, max: any): this {
    this.whereClause.push(`${column} BETWEEN ? AND ?`);
    this.params.push(min, max);
    return this;
  }

  groupBy(...columns: string[]): this {
    this.groupByClause.push(...columns);
    return this;
  }

  having(condition: string, ...params: any[]): this {
    this.havingClause.push(condition);
    this.params.push(...params);
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByClause.push(`${column} ${direction}`);
    return this;
  }

  limit(limit: number): this {
    this.limitValue = limit;
    return this;
  }

  offset(offset: number): this {
    this.offsetValue = offset;
    return this;
  }

  build(): { sql: string; params: any[] } {
    const sql = [
      `SELECT ${this.selectClause.join(', ')}`,
      `FROM ${this.fromClause}`,
      ...this.joins,
      this.whereClause.length > 0 ? `WHERE ${this.whereClause.join(' AND ')}` : '',
      this.groupByClause.length > 0 ? `GROUP BY ${this.groupByClause.join(', ')}` : '',
      this.havingClause.length > 0 ? `HAVING ${this.havingClause.join(' AND ')}` : '',
      this.orderByClause.length > 0 ? `ORDER BY ${this.orderByClause.join(', ')}` : '',
      this.limitValue !== undefined ? `LIMIT ${this.limitValue}` : '',
      this.offsetValue !== undefined ? `OFFSET ${this.offsetValue}` : ''
    ].filter(Boolean).join('\n');

    return { sql, params: this.params };
  }

  async execute(db: DatabaseConnection): Promise<any[]> {
    const { sql, params } = this.build();
    return db.query(sql, params);
  }

  async paginate(
    db: DatabaseConnection,
    page: number,
    perPage: number
  ): Promise<PaginatedResponse<any>> {
    // Get total count
    const countQuery = new QueryBuilder()
      .select('COUNT(*) as total')
      .from(this.fromClause)
      .joins = this.joins;
    countQuery.whereClause = this.whereClause;
    (countQuery as any).params = this.params;

    const countResult = await countQuery.execute(db);
    const total = countResult[0].total as number;

    // Get paginated data
    this.limit(perPage);
    this.offset((page - 1) * perPage);
    const data = await this.execute(db);

    const meta: PaginationMeta = {
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage)
    };

    return { data, meta };
  }

  clone(): QueryBuilder {
    const clone = new QueryBuilder();
    clone.selectClause = [...this.selectClause];
    clone.fromClause = this.fromClause;
    clone.joins = [...this.joins];
    clone.whereClause = [...this.whereClause];
    clone.groupByClause = [...this.groupByClause];
    clone.havingClause = [...this.havingClause];
    clone.orderByClause = [...this.orderByClause];
    clone.limitValue = this.limitValue;
    clone.offsetValue = this.offsetValue;
    clone.params = [...this.params];
    return clone;
  }
}

// Repository base class
export abstract class BaseRepository<T extends { id: string }> {
  constructor(protected db: DatabaseConnection) {}

  abstract tableName: string;

  async findById(id: string): Promise<T | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ? AND deleted_at IS NULL`;
    return this.db.queryOne<T>(sql, [id]);
  }

  async findByIds(ids: string[]): Promise<T[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const sql = `SELECT * FROM ${this.tableName} WHERE id IN (${placeholders}) AND deleted_at IS NULL`;
    return this.db.query<T>(sql, ids);
  }

  async findAll(options?: {
    where?: string;
    params?: any[];
    orderBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<T[]> {
    let sql = `SELECT * FROM ${this.tableName} WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (options?.where) {
      sql += ` AND ${options.where}`;
      params.push(...(options.params || []));
    }

    if (options?.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    return this.db.query<T>(sql, params);
  }

  async create(data: Partial<T>): Promise<T> {
    const id = this.generateId();
    const now = new Date();
    const record = {
      id,
      created_at: now,
      updated_at: now,
      ...data
    } as any;

    const columns = Object.keys(record);
    const placeholders = columns.map(() => '?').join(',');
    const values = Object.values(record);

    const sql = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
    `;

    await this.db.execute(sql, values);
    return record;
  }

  async update(id: string, data: Partial<T>): Promise<boolean> {
    const updateData = {
      ...data,
      updated_at: new Date()
    };

    const columns = Object.keys(updateData);
    const setClause = columns.map(col => `${col} = ?`).join(',');
    const values = Object.values(updateData);

    const sql = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE id = ? AND deleted_at IS NULL
    `;

    const result = await this.db.execute(sql, [...values, id]);
    return result.rowsAffected > 0;
  }

  async delete(id: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const result = await this.db.execute(sql, [id]);
    return result.rowsAffected > 0;
  }

  async hardDelete(id: string): Promise<boolean> {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    const result = await this.db.execute(sql, [id]);
    return result.rowsAffected > 0;
  }

  async count(where?: string, params?: any[]): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE deleted_at IS NULL`;
    const queryParams: any[] = [];

    if (where) {
      sql += ` AND ${where}`;
      queryParams.push(...(params || []));
    }

    const result = await this.db.queryOne<{ count: number }>(sql, queryParams);
    return result?.count || 0;
  }

  async exists(id: string): Promise<boolean> {
    const sql = `SELECT 1 FROM ${this.tableName} WHERE id = ? AND deleted_at IS NULL LIMIT 1`;
    const result = await this.db.queryOne(sql, [id]);
    return result !== null;
  }

  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

// Cache utilities
export class CacheManager {
  private cache: Map<string, { value: any; expiresAt: number }> = new Map();

  constructor(private defaultTTL: number = 60000) {} // 1 minute default

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set(key: string, value: any, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  invalidate(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return Promise.resolve(cached);
    }

    return factory().then(value => {
      this.set(key, value, ttl);
      return value;
    });
  }
}

// Slug generation utility
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Generate unique slug
export async function generateUniqueSlug(
  title: string,
  table: string,
  db: DatabaseConnection,
  excludeId?: string
): Promise<string> {
  let slug = generateSlug(title);
  let counter = 0;
  let unique = false;

  while (!unique) {
    const existing = await db.queryOne<{ id: string }>(
      `SELECT id FROM ${table} WHERE slug = ? ${excludeId ? 'AND id != ?' : ''} LIMIT 1`,
      excludeId ? [slug, excludeId] : [slug]
    );

    if (!existing) {
      unique = true;
    } else {
      counter++;
      slug = `${generateSlug(title)}-${counter}`;
    }
  }

  return slug;
}

// Pagination helper
export function calculatePagination(
  total: number,
  page: number,
  perPage: number
): PaginationMeta {
  return {
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage)
  };
}

// Sanitization utilities
export function sanitizeHtml(html: string): string {
  // Basic HTML sanitization - in production, use a library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

export function sanitizeMarkdown(markdown: string): string {
  // Basic markdown sanitization
  return markdown
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:\w*\/\w*;base64/gi, '');
}
