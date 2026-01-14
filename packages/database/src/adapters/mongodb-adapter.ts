/**
 * MongoDB Adapter
 * NoSQL document database adapter with advanced features
 */

import { DatabaseAdapter } from './adapter';
import { MongoDBConfig, QueryResult, FieldInfo, QueryOptions, QueryCondition } from '../types';

// ============================================================================
// MongoDB Adapter Implementation
// ============================================================================

export class MongoDBAdapter extends DatabaseAdapter {
  protected declare config: MongoDBConfig;
  private client: any = null;
  private db: any = null;

  constructor(config: MongoDBConfig) {
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
      // Dynamic import of mongodb module
      const { MongoClient } = await import('mongodb');

      this.client = new MongoClient(this.config.url, {
        maxPoolSize: this.config.maxConnections || 20,
        minPoolSize: this.config.minConnections || 2,
        maxIdleTimeMS: this.config.idleTimeout || 60000,
        serverSelectionTimeoutMS: this.config.connectionTimeout || 10000,
        socketTimeoutMS: 30000,
        connectTimeoutMS: 10000,
      });

      await this.client.connect();
      this.db = this.client.db(this.config.database);
      this.isConnectedFlag = true;
    } catch (error) {
      throw new Error(`MongoDB connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
    this.isConnectedFlag = false;
  }

  isConnected(): boolean {
    return this.isConnectedFlag && this.client !== null;
  }

  // ========================================================================
  // Query Execution (MongoDB-specific)
  // ========================================================================

  async query<T = any>(collection: string, options: QueryOptions = {}): Promise<QueryResult<T>> {
    this.validateConnection();
    const startTime = Date.now();

    try {
      const coll = this.db.collection(collection);
      const filter = this.buildMongoFilter(options.where);
      const projection = this.buildMongoProjection(options.select);
      const sort = this.buildMongoSort(options.orderBy);

      let query = coll.find(filter);

      if (projection) {
        query = query.project(projection);
      }
      if (sort) {
        query = query.sort(sort);
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.skip(options.offset);
      }

      const rows = await query.toArray();
      const rowCount = rows.length;

      return {
        rows,
        rowCount,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`MongoDB query failed: ${error}`);
    }
  }

  async execute(sql: string, params?: any[]): Promise<QueryResult> {
    // MongoDB doesn't use SQL, but we provide this interface for compatibility
    // This method can be used for running aggregation pipelines
    const startTime = Date.now();

    try {
      const collection = params?.[0];
      const pipeline = JSON.parse(sql);

      const coll = this.db.collection(collection);
      const cursor = coll.aggregate(pipeline);
      const rows = await cursor.toArray();

      return {
        rows,
        rowCount: rows.length,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`MongoDB execute failed: ${error}`);
    }
  }

  // ========================================================================
  // MongoDB CRUD Operations
  // ========================================================================

  async insert(collection: string, document: Record<string, any>): Promise<QueryResult> {
    this.validateConnection();
    const startTime = Date.now();

    try {
      const coll = this.db.collection(collection);
      const result = await coll.insertOne(document);

      return {
        rows: [],
        rowCount: 0,
        affectedRows: result.insertedCount,
        insertId: result.insertedId,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`MongoDB insert failed: ${error}`);
    }
  }

  async insertMany(collection: string, documents: Record<string, any>[]): Promise<QueryResult> {
    this.validateConnection();
    const startTime = Date.now();

    try {
      const coll = this.db.collection(collection);
      const result = await coll.insertMany(documents);

      return {
        rows: [],
        rowCount: 0,
        affectedRows: result.insertedCount,
        insertId: result.insertedId,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`MongoDB insertMany failed: ${error}`);
    }
  }

  async update(
    collection: string,
    filter: Record<string, any>,
    update: Record<string, any>,
    options: { upsert?: boolean; multi?: boolean } = {}
  ): Promise<QueryResult> {
    this.validateConnection();
    const startTime = Date.now();

    try {
      const coll = this.db.collection(collection);
      const updateDoc = this.buildMongoUpdate(update);
      const updateOptions: any = {};

      if (options.upsert) {
        updateOptions.upsert = true;
      }

      if (options.multi) {
        const result = await coll.updateMany(filter, updateDoc, updateOptions);
        return {
          rows: [],
          rowCount: 0,
          affectedRows: result.modifiedCount + result.upsertedCount,
          executionTime: Date.now() - startTime,
        };
      } else {
        const result = await coll.updateOne(filter, updateDoc, updateOptions);
        return {
          rows: [],
          rowCount: 0,
          affectedRows: result.modifiedCount + result.upsertedCount,
          executionTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      throw new Error(`MongoDB update failed: ${error}`);
    }
  }

  async delete(collection: string, filter: Record<string, any>): Promise<QueryResult> {
    this.validateConnection();
    const startTime = Date.now();

    try {
      const coll = this.db.collection(collection);
      const result = await coll.deleteMany(filter);

      return {
        rows: [],
        rowCount: 0,
        affectedRows: result.deletedCount,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`MongoDB delete failed: ${error}`);
    }
  }

  async count(collection: string, filter: Record<string, any> = {}): Promise<number> {
    this.validateConnection();

    try {
      const coll = this.db.collection(collection);
      return await coll.countDocuments(filter);
    } catch (error) {
      throw new Error(`MongoDB count failed: ${error}`);
    }
  }

  async distinct(collection: string, field: string, filter: Record<string, any> = {}): Promise<any[]> {
    this.validateConnection();

    try {
      const coll = this.db.collection(collection);
      return await coll.distinct(field, filter);
    } catch (error) {
      throw new Error(`MongoDB distinct failed: ${error}`);
    }
  }

  // ========================================================================
  // Aggregation
  // ========================================================================

  async aggregate(collection: string, pipeline: any[]): Promise<QueryResult> {
    this.validateConnection();
    const startTime = Date.now();

    try {
      const coll = this.db.collection(collection);
      const cursor = coll.aggregate(pipeline);
      const rows = await cursor.toArray();

      return {
        rows,
        rowCount: rows.length,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`MongoDB aggregation failed: ${error}`);
    }
  }

  // ========================================================================
  // Index Management
  // ========================================================================

  async createIndex(
    collection: string,
    keys: Record<string, 1 | -1>,
    options: any = {}
  ): Promise<string> {
    this.validateConnection();

    try {
      const coll = this.db.collection(collection);
      return await coll.createIndex(keys, options);
    } catch (error) {
      throw new Error(`MongoDB createIndex failed: ${error}`);
    }
  }

  async dropIndex(collection: string, indexName: string): Promise<void> {
    this.validateConnection();

    try {
      const coll = this.db.collection(collection);
      await coll.dropIndex(indexName);
    } catch (error) {
      throw new Error(`MongoDB dropIndex failed: ${error}`);
    }
  }

  async listIndexes(collection: string): Promise<any[]> {
    this.validateConnection();

    try {
      const coll = this.db.collection(collection);
      return await coll.indexes();
    } catch (error) {
      throw new Error(`MongoDB listIndexes failed: ${error}`);
    }
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private buildMongoFilter(conditions?: QueryCondition[]): Record<string, any> {
    if (!conditions || conditions.length === 0) {
      return {};
    }

    const filter: Record<string, any> = {};

    for (const cond of conditions) {
      const field = cond.field;
      const value = cond.value;

      switch (cond.operator) {
        case '=':
          filter[field] = value;
          break;
        case '!=':
          filter[field] = { $ne: value };
          break;
        case '>':
          filter[field] = { $gt: value };
          break;
        case '<':
          filter[field] = { $lt: value };
          break;
        case '>=':
          filter[field] = { $gte: value };
          break;
        case '<=':
          filter[field] = { $lte: value };
          break;
        case 'IN':
          filter[field] = { $in: Array.isArray(value) ? value : [value] };
          break;
        case 'NOT IN':
          filter[field] = { $nin: Array.isArray(value) ? value : [value] };
          break;
        case 'LIKE':
          filter[field] = { $regex: value, $options: 'i' };
          break;
        case 'IS NULL':
          filter[field] = { $exists: false };
          break;
        case 'IS NOT NULL':
          filter[field] = { $exists: true };
          break;
      }
    }

    return filter;
  }

  private buildMongoProjection(select?: string[]): Record<string, any> | null {
    if (!select || select.length === 0) {
      return null;
    }

    const projection: Record<string, any> = {};
    for (const field of select) {
      projection[field] = 1;
    }
    projection['_id'] = 0; // Exclude _id by default

    return projection;
  }

  private buildMongoSort(orderBy?: { field: string; direction: 'ASC' | 'DESC' }[]): Record<string, any> | null {
    if (!orderBy || orderBy.length === 0) {
      return null;
    }

    const sort: Record<string, any> = {};
    for (const order of orderBy) {
      sort[order.field] = order.direction === 'ASC' ? 1 : -1;
    }

    return sort;
  }

  private buildMongoUpdate(update: Record<string, any>): Record<string, any> {
    // Detect update operations
    const operations = ['$set', '$unset', '$inc', '$push', '$pull', '$addToSet'];
    const updateDoc: Record<string, any> = {};

    let hasOperation = false;
    for (const op of operations) {
      if (update[op]) {
        updateDoc[op] = update[op];
        hasOperation = true;
      }
    }

    // If no explicit operation, treat as $set
    if (!hasOperation) {
      updateDoc.$set = update;
    }

    return updateDoc;
  }

  // ========================================================================
  // Schema Operations (MongoDB-specific)
  // ========================================================================

  async getTableInfo(collection: string): Promise<FieldInfo[]> {
    this.validateConnection();

    try {
      const coll = this.db.collection(collection);
      const sampleDoc = await coll.findOne();

      if (!sampleDoc) {
        return [];
      }

      return Object.keys(sampleDoc).map(key => ({
        name: key,
        type: this.inferType(sampleDoc[key]),
        nullable: sampleDoc[key] === null,
      }));
    } catch (error) {
      throw new Error(`Failed to get collection info: ${error}`);
    }
  }

  private inferType(value: any): string {
    if (value === null) return 'null';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  }

  async tableExists(table: string): Promise<boolean> {
    this.validateConnection();

    try {
      const collections = await this.db.listCollections().toArray();
      return collections.some((c: any) => c.name === table);
    } catch (error) {
      throw new Error(`Failed to check collection existence: ${error}`);
    }
  }

  async createTable(table: string, schema: Record<string, any>): Promise<void> {
    // MongoDB is schemaless, but we can create a collection with validation
    this.validateConnection();

    try {
      const validationSchema = this.buildMongoValidationSchema(schema);
      await this.db.createCollection(table, {
        validator: validationSchema,
      });
    } catch (error) {
      throw new Error(`Failed to create collection: ${error}`);
    }
  }

  private buildMongoValidationSchema(schema: Record<string, any>): any {
    const properties: Record<string, any> = {};

    for (const [field, definition] of Object.entries(schema)) {
      const fieldSchema: any = {};

      if (definition.type) {
        const bsonType = this.mapTypeToBSONType(definition.type);
        if (bsonType) {
          fieldSchema.bsonType = bsonType;
        }
      }

      if (definition.required) {
        fieldSchema.required = true;
      }

      if (definition.minimum !== undefined) {
        fieldSchema.minimum = definition.minimum;
      }

      if (definition.maximum !== undefined) {
        fieldSchema.maximum = definition.maximum;
      }

      if (definition.pattern) {
        fieldSchema.pattern = definition.pattern;
      }

      properties[field] = fieldSchema;
    }

    return {
      $jsonSchema: {
        bsonType: 'object',
        properties,
      },
    };
  }

  private mapTypeToBSONType(type: string): string[] {
    const typeMap: Record<string, string[]> = {
      'string': ['string'],
      'number': ['int', 'long', 'double', 'decimal'],
      'boolean': ['bool'],
      'date': ['date'],
      'json': ['object'],
      'binary': ['binData'],
    };

    return typeMap[type] || [];
  }

  async dropTable(table: string): Promise<void> {
    this.validateConnection();

    try {
      await this.db.dropCollection(table);
    } catch (error) {
      throw new Error(`Failed to drop collection: ${error}`);
    }
  }

  async alterTable(table: string, changes: Record<string, any>): Promise<void> {
    // MongoDB collections are schemaless, so we modify collection validator
    this.validateConnection();

    try {
      const coll = this.db.collection(table);
      const currentValidator = await coll.options();

      if (currentValidator.validator) {
        const newValidator = { ...currentValidator.validator };
        // Apply changes to validator
        await coll.revokeValidator();
        await coll.createCollection(table, {
          validator: newValidator,
        });
      }
    } catch (error) {
      throw new Error(`Failed to alter collection: ${error}`);
    }
  }

  async truncateTable(table: string): Promise<void> {
    this.validateConnection();

    try {
      const coll = this.db.collection(table);
      await coll.deleteMany({});
    } catch (error) {
      throw new Error(`Failed to truncate collection: ${error}`);
    }
  }

  // Placeholder implementations for abstract methods
  async addColumn(table: string, column: string, definition: any): Promise<void> {
    // MongoDB doesn't have fixed columns, but we can add validation
  }

  async dropColumn(table: string, column: string): Promise<void> {
    // MongoDB doesn't have fixed columns, but we can remove validation
  }

  async renameColumn(table: string, oldName: string, newName: string): Promise<void> {
    // MongoDB doesn't have fixed columns, need to update all documents
    const coll = this.db.collection(table);
    await coll.updateMany(
      { [oldName]: { $exists: true } },
      { $rename: { [oldName]: newName } }
    );
  }

  async changeColumn(table: string, column: string, definition: any): Promise<void> {
    // Update validator for the column
  }

  async addIndex(table: string, columns: string[], options?: any): Promise<void> {
    const keys: Record<string, any> = {};
    for (const col of columns) {
      keys[col] = 1;
    }
    await this.createIndex(table, keys, options);
  }

  async dropIndex(table: string, indexName: string): Promise<void> {
    await this.dropIndex(table, indexName);
  }

  // ========================================================================
  // Transaction Support (MongoDB 4.0+)
  // ========================================================================

  async beginTransaction(): Promise<any> {
    const session = this.client.startSession();
    session.startTransaction();
    return session;
  }

  async commitTransaction(session: any): Promise<void> {
    await session.commitTransaction();
    session.endSession();
  }

  async rollbackTransaction(session: any): Promise<void> {
    await session.abortTransaction();
    session.endSession();
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  quoteIdentifier(identifier: string): string {
    // MongoDB uses dot notation for nested fields
    return identifier;
  }

  getPlaceholder(): string {
    // MongoDB doesn't use placeholders
    return '?';
  }

  // ========================================================================
  // MongoDB Specific Features
  // ========================================================================

  async watch(collection: string, pipeline?: any[]): Promise<any> {
    const coll = this.db.collection(collection);
    return coll.watch(pipeline);
  }

  async bulkWrite(collection: string, operations: any[]): Promise<QueryResult> {
    this.validateConnection();
    const startTime = Date.now();

    try {
      const coll = this.db.collection(collection);
      const result = await coll.bulkWrite(operations);

      return {
        rows: [],
        rowCount: 0,
        affectedRows: result.insertedCount + result.modifiedCount + result.deletedCount,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`MongoDB bulkWrite failed: ${error}`);
    }
  }

  async getCollectionStats(collection: string): Promise<any> {
    this.validateConnection();

    try {
      const coll = this.db.collection(collection);
      return await coll.aggregate([{ $collStats: { count: {} } }]).toArray();
    } catch (error) {
      throw new Error(`Failed to get collection stats: ${error}`);
    }
  }
}
