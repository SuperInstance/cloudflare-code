/**
 * Database Mock Service
 * Provides database mocking capabilities for testing data layer integrations
 */

import {
  MockDatabaseConfig,
  MockTableConfig,
  MockColumnConfig,
  MockDatabase,
  MockRequest,
  MockResponse
} from './types';
import { Logger } from '../core/logger';

export class DatabaseMockService {
  private config: MockDatabaseConfig;
  private logger: Logger;
  private tables: Map<string, any[]> = new Map();
  private queries = 0;
  private connections = 0;
  private isConnected = false;

  constructor(config: MockDatabaseConfig) {
    this.config = config;
    this.logger = new Logger(`DatabaseMock:${config.database}`);
    this.initializeTables();
  }

  /**
   * Connect to the mock database
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      this.logger.warn('Database already connected');
      return;
    }

    try {
      this.connections++;
      this.isConnected = true;
      this.logger.info(`Connected to mock database: ${this.config.database}`);
    } catch (error) {
      this.logger.error(`Failed to connect: ${error}`);
      throw error;
    }
  }

  /**
   * Disconnect from the mock database
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Database not connected');
      return;
    }

    try {
      this.connections--;
      if (this.connections <= 0) {
        this.isConnected = false;
        this.connections = 0;
      }
      this.logger.info(`Disconnected from mock database: ${this.config.database}`);
    } catch (error) {
      this.logger.error(`Failed to disconnect: ${error}`);
      throw error;
    }
  }

  /**
   * Execute a query
   */
  async query(sql: string, params?: any[]): Promise<any[]> {
    this.queries++;
    this.logger.debug(`Executing query: ${sql}`);

    try {
      if (sql.toLowerCase().includes('select')) {
        return await this.executeQuery(sql, params);
      } else if (sql.toLowerCase().includes('insert')) {
        return await this.executeInsert(sql, params);
      } else if (sql.toLowerCase().includes('update')) {
        return await this.executeUpdate(sql, params);
      } else if (sql.toLowerCase().includes('delete')) {
        return await this.executeDelete(sql, params);
      } else {
        throw new Error(`Unsupported query type: ${sql}`);
      }
    } catch (error) {
      this.logger.error(`Query failed: ${error}`);
      throw error;
    }
  }

  /**
   * Find records by table and criteria
   */
  find(table: string, criteria?: any): any[] {
    const tableData = this.tables.get(table);
    if (!tableData) {
      throw new Error(`Table not found: ${table}`);
    }

    if (!criteria) {
      return [...tableData];
    }

    return tableData.filter(item => {
      return Object.keys(criteria).every(key => {
        const itemValue = item[key];
        const criteriaValue = criteria[key];

        if (typeof criteriaValue === 'object' && criteriaValue !== null) {
          // Handle operators like { age: { $gt: 18 } }
          return Object.keys(criteriaValue).every(op => {
            switch (op) {
              case '$gt': return itemValue > criteriaValue[op];
              case '$gte': return itemValue >= criteriaValue[op];
              case '$lt': return itemValue < criteriaValue[op];
              case '$lte': return itemValue <= criteriaValue[op];
              case '$eq': return itemValue === criteriaValue[op];
              case '$ne': return itemValue !== criteriaValue[op];
              case '$in': return Array.isArray(criteriaValue[op]) && criteriaValue[op].includes(itemValue);
              case '$nin': return Array.isArray(criteriaValue[op]) && !criteriaValue[op].includes(itemValue);
              case '$regex': return new RegExp(criteriaValue[op]).test(itemValue);
              case '$exists': return criteriaValue[op] ? (itemValue !== undefined) : (itemValue === undefined);
              default: return true;
            }
          });
        }

        return itemValue === criteriaValue;
      });
    });
  }

  /**
   * Insert records into a table
   */
  insert(table: string, data: any | any[]): any | any[] {
    const tableData = this.tables.get(table);
    if (!tableData) {
      throw new Error(`Table not found: ${table}`);
    }

    const records = Array.isArray(data) ? data : [data];
    const results = [];

    for (const record of records) {
      const newRecord = { ...record, id: this.generateId() };
      tableData.push(newRecord);
      results.push(newRecord);
    }

    this.logger.debug(`Inserted ${records.length} records into ${table}`);
    return Array.isArray(data) ? results : results[0];
  }

  /**
   * Update records in a table
   */
  update(table: string, criteria: any, data: any): number {
    const tableData = this.tables.get(table);
    if (!tableData) {
      throw new Error(`Table not found: ${table}`);
    }

    const recordsToUpdate = tableData.filter(item => {
      return Object.keys(criteria).every(key => item[key] === criteria[key]);
    });

    for (const record of recordsToUpdate) {
      Object.assign(record, data);
    }

    this.logger.debug(`Updated ${recordsToUpdate.length} records in ${table}`);
    return recordsToUpdate.length;
  }

  /**
   * Delete records from a table
   */
  delete(table: string, criteria: any): number {
    const tableData = this.tables.get(table);
    if (!tableData) {
      throw new Error(`Table not found: ${table}`);
    }

    const recordsToDelete = tableData.filter(item => {
      return Object.keys(criteria).every(key => item[key] === criteria[key]);
    });

    for (const record of recordsToDelete) {
      const index = tableData.indexOf(record);
      tableData.splice(index, 1);
    }

    this.logger.debug(`Deleted ${recordsToDelete.length} records from ${table}`);
    return recordsToDelete.length;
  }

  /**
   * Count records in a table
   */
  count(table: string, criteria?: any): number {
    if (!criteria) {
      return this.tables.get(table)?.length || 0;
    }
    return this.find(table, criteria).length;
  }

  /**
   * Check if a record exists
   */
  exists(table: string, criteria: any): boolean {
    return this.find(table, criteria).length > 0;
  }

  /**
   * Get table schema
   */
  getSchema(table: string): MockColumnConfig[] {
    const tableConfig = this.config.tables?.find(t => t.name === table);
    if (!tableConfig) {
      throw new Error(`Table not found: ${table}`);
    }
    return tableConfig.schema;
  }

  /**
   * Create a table
   */
  createTable(name: string, schema: MockColumnConfig[]): void {
    if (this.tables.has(name)) {
      throw new Error(`Table already exists: ${name}`);
    }

    const tableConfig: MockTableConfig = { name, schema };
    this.config.tables?.push(tableConfig);
    this.tables.set(name, []);
    this.logger.info(`Created table: ${name}`);
  }

  /**
   * Drop a table
   */
  dropTable(name: string): void {
    if (!this.tables.has(name)) {
      throw new Error(`Table not found: ${name}`);
    }

    this.tables.delete(name);
    this.config.tables = this.config.tables?.filter(t => t.name !== name);
    this.logger.info(`Dropped table: ${name}`);
  }

  /**
   * Get all table names
   */
  getTableNames(): string[] {
    return Array.from(this.tables.keys());
  }

  /**
   * Get table data
   */
  getTableData(table: string): any[] {
    const data = this.tables.get(table);
    if (!data) {
      throw new Error(`Table not found: ${table}`);
    }
    return [...data];
  }

  /**
   * Clear table data
   */
  clearTable(table: string): void {
    const tableData = this.tables.get(table);
    if (!tableData) {
      throw new Error(`Table not found: ${table}`);
    }

    tableData.length = 0;
    this.logger.info(`Cleared table: ${table}`);
  }

  /**
   * Reset all tables
   */
  reset(): void {
    for (const [table] of this.tables) {
      this.clearTable(table);
    }
    this.queries = 0;
    this.logger.info('Database reset complete');
  }

  /**
   * Get database information
   */
  getInfo(): MockDatabase {
    return {
      id: this.config.database,
      config: this.config,
      connections: this.connections,
      queries: this.queries,
      tables: new Map(this.tables)
    };
  }

  /**
   * Get database statistics
   */
  getStats(): {
    tables: number;
    totalRows: number;
    queries: number;
    connections: number;
    memoryUsage: number;
  } {
    let totalRows = 0;
    for (const tableData of this.tables.values()) {
      totalRows += tableData.length;
    }

    return {
      tables: this.tables.size,
      totalRows,
      queries: this.queries,
      connections: this.connections,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  /**
   * Seed database with test data
   */
  seed(table: string, data: any[]): void {
    this.insert(table, data);
    this.logger.info(`Seeded ${table} with ${data.length} records`);
  }

  /**
   * Create common database tables
   */
  createCommonTables(): void {
    // Users table
    this.createTable('users', [
      { name: 'id', type: 'string', primaryKey: true },
      { name: 'username', type: 'string', unique: true },
      { name: 'email', type: 'string', unique: true },
      { name: 'password', type: 'string' },
      { name: 'role', type: 'string', default: 'user' },
      { name: 'createdAt', type: 'datetime', default: new Date() },
      { name: 'updatedAt', type: 'datetime', default: new Date() }
    ]);

    // Posts table
    this.createTable('posts', [
      { name: 'id', type: 'string', primaryKey: true },
      { name: 'title', type: 'string' },
      { name: 'content', type: 'text' },
      { name: 'authorId', type: 'string' },
      { name: 'status', type: 'string', default: 'draft' },
      { name: 'publishedAt', type: 'datetime', nullable: true },
      { name: 'createdAt', type: 'datetime', default: new Date() },
      { name: 'updatedAt', type: 'datetime', default: new Date() }
    ]);

    // Comments table
    this.createTable('comments', [
      { name: 'id', type: 'string', primaryKey: true },
      { name: 'postId', type: 'string' },
      { name: 'authorId', type: 'string' },
      { name: 'content', type: 'text' },
      { name: 'createdAt', type: 'datetime', default: new Date() },
      { name: 'updatedAt', type: 'datetime', default: new Date() }
    ]);

    // Categories table
    this.createTable('categories', [
      { name: 'id', type: 'string', primaryKey: true },
      { name: 'name', type: 'string', unique: true },
      { name: 'description', type: 'text', nullable: true },
      { name: 'createdAt', type: 'datetime', default: new Date() },
      { name: 'updatedAt', type: 'datetime', default: new Date() }
    ]);

    // Post-Categories junction table
    this.createTable('post_categories', [
      { name: 'postId', type: 'string' },
      { name: 'categoryId', type: 'string' },
      { name: 'createdAt', type: 'datetime', default: new Date() }
    ]);

    this.logger.info('Created common database tables');
  }

  /**
   * Seed common tables with sample data
   */
  seedCommonData(): void {
    // Seed users
    this.seed('users', [
      {
        id: '1',
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin'
      },
      {
        id: '2',
        username: 'john',
        email: 'john@example.com',
        password: 'john123',
        role: 'user'
      },
      {
        id: '3',
        username: 'jane',
        email: 'jane@example.com',
        password: 'jane123',
        role: 'user'
      }
    ]);

    // Seed categories
    this.seed('categories', [
      { id: '1', name: 'Technology', description: 'Tech related posts' },
      { id: '2', name: 'Science', description: 'Science related posts' },
      { id: '3', name: 'Business', description: 'Business related posts' }
    ]);

    // Seed posts
    this.seed('posts', [
      {
        id: '1',
        title: 'Getting Started with TypeScript',
        content: 'TypeScript is a superset of JavaScript that adds static typing...',
        authorId: '1',
        status: 'published',
        publishedAt: new Date('2023-01-15')
      },
      {
        id: '2',
        title: 'The Future of AI',
        content: 'Artificial Intelligence is rapidly transforming industries...',
        authorId: '2',
        status: 'published',
        publishedAt: new Date('2023-01-20')
      },
      {
        id: '3',
        title: 'Building Scalable Applications',
        content: 'Learn how to build applications that can scale with your business...',
        authorId: '3',
        status: 'draft'
      }
    ]);

    // Seed comments
    this.seed('comments', [
      {
        id: '1',
        postId: '1',
        authorId: '2',
        content: 'Great article! Very helpful for beginners.'
      },
      {
        id: '2',
        postId: '1',
        authorId: '3',
        content: 'Thanks for sharing this insight.'
      },
      {
        id: '3',
        postId: '2',
        authorId: '1',
        content: 'Interesting perspective on AI trends.'
      }
    ]);

    // Seed post-categories
    this.seed('post_categories', [
      { postId: '1', categoryId: '1' },
      { postId: '2', categoryId: '2' },
      { postId: '3', categoryId: '3' }
    ]);

    this.logger.info('Seeded common database data');
  }

  /**
   * Private methods
   */
  private initializeTables(): void {
    if (this.config.tables) {
      for (const tableConfig of this.config.tables) {
        this.tables.set(tableConfig.name, []);
      }
    }

    if (this.config.data) {
      for (const [tableName, data] of Object.entries(this.config.data)) {
        this.tables.set(tableName, data);
      }
    }
  }

  private async executeQuery(sql: string, params?: any[]): Promise<any[]> {
    const tableName = this.extractTableNameFromQuery(sql);
    if (!tableName) {
      throw new Error('Could not determine table from query');
    }

    const tableData = this.tables.get(tableName);
    if (!tableData) {
      throw new Error(`Table not found: ${tableName}`);
    }

    // Simple query parsing - in real implementation, use proper SQL parser
    if (sql.toLowerCase().includes('where')) {
      // Extract WHERE clause (simplified)
      const whereMatch = sql.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|\s+offset|$)/i);
      if (whereMatch) {
        const whereClause = whereMatch[1];
        // Simple field = value matching
        const conditions = whereClause.split('and').map(c => c.trim());
        const criteria: any = {};

        for (const condition of conditions) {
          const match = condition.match(/(\w+)\s*=\s*(?:(['"])(.*?)\2|(\d+))/);
          if (match) {
            criteria[match[1]] = match[3] || match[4];
          }
        }

        return this.find(tableName, criteria);
      }
    }

    return [...tableData];
  }

  private async executeInsert(sql: string, params?: any[]): Promise<any[]> {
    const tableName = this.extractTableNameFromQuery(sql);
    if (!tableName) {
      throw new Error('Could not determine table from query');
    }

    const data = params ? params[0] : this.extractDataFromInsert(sql);
    const result = this.insert(tableName, data);
    return Array.isArray(result) ? result : [result];
  }

  private async executeUpdate(sql: string, params?: any[]): Promise<any[]> {
    const tableName = this.extractTableNameFromQuery(sql);
    if (!tableName) {
      throw new Error('Could not determine table from query');
    }

    const [criteria, data] = params || [this.extractCriteriaFromUpdate(sql), this.extractDataFromUpdate(sql)];
    const affected = this.update(tableName, criteria, data);
    return [{ affectedRows: affected }];
  }

  private async executeDelete(sql: string, params?: any[]): Promise<any[]> {
    const tableName = this.extractTableNameFromQuery(sql);
    if (!tableName) {
      throw new Error('Could not determine table from query');
    }

    const criteria = params ? params[0] : this.extractCriteriaFromDelete(sql);
    const affected = this.delete(tableName, criteria);
    return [{ affectedRows: affected }];
  }

  private extractTableNameFromQuery(sql: string): string | null {
    const tableMatch = sql.match(/(?:from|into|update)\s+(\w+)/i);
    return tableMatch ? tableMatch[1] : null;
  }

  private extractDataFromInsert(sql: string): any {
    // Simplified data extraction - in real implementation, parse SQL properly
    const valuesMatch = sql.match(/\(([^)]+)\)/);
    if (valuesMatch) {
      const values = valuesMatch[1].split(',').map(v => v.trim().replace(/['"]/g, ''));
      return { id: this.generateId(), ...values.reduce((acc, val, i) => ({ ...acc, [`field_${i}`]: val }), {}) };
    }
    return { id: this.generateId() };
  }

  private extractCriteriaFromUpdate(sql: string): any {
    // Simplified criteria extraction
    const whereMatch = sql.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      const match = whereClause.match(/(\w+)\s*=\s*(?:(['"])(.*?)\2|(\d+))/);
      if (match) {
        return { [match[1]]: match[3] || match[4] };
      }
    }
    return {};
  }

  private extractDataFromUpdate(sql: string): any {
    // Simplified data extraction
    const setMatch = sql.match(/set\s+(.+?)(?:\s+where|\s+order\s+by|\s+limit|$)/i);
    if (setMatch) {
      const setClause = setMatch[1];
      const assignments = setClause.split(',').map(a => a.trim());
      const data: any = {};

      for (const assignment of assignments) {
        const match = assignment.match(/(\w+)\s*=\s*(?:(['"])(.*?)\2|(\d+))/);
        if (match) {
          data[match[1]] = match[3] || match[4];
        }
      }

      return data;
    }
    return {};
  }

  private extractCriteriaFromDelete(sql: string): any {
    return this.extractCriteriaFromUpdate(sql);
  }

  private generateId(): string {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}