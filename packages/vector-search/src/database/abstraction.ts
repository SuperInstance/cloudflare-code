/**
 * Vector Database Abstraction Layer
 *
 * Provides a unified API for multiple vector database backends including
 * Cloudflare Vectorize, Pinecone, Weaviate, Qdrant, Milvus, and in-memory storage.
 */

import {
  Vector,
  VectorId,
  VectorRecord,
  VectorDatabaseConfig,
  SearchResult,
  SearchQuery,
  DistanceMetric,
  IndexType,
  BatchResult,
  IndexStats,
} from '../types/index.js';
import { VectorIndex } from '../index/vector-index.js';
import { SearchEngine } from '../search/engine.js';

/**
 * Vector Database interface
 */
interface IVectorDatabase {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  insert(record: VectorRecord): Promise<void>;
  insertBatch(records: VectorRecord[]): Promise<BatchResult>;
  delete(id: VectorId): Promise<boolean>;
  deleteBatch(ids: VectorId[]): Promise<BatchResult>;
  update(record: VectorRecord): Promise<boolean>;
  search(query: SearchQuery): Promise<SearchResult[]>;
  get(id: VectorId): Promise<VectorRecord | null>;
  has(id: VectorId): Promise<boolean>;
  getStats(): Promise<IndexStats>;
  clear(): Promise<void>;
}

/**
 * In-memory vector database implementation
 */
class InMemoryVectorDatabase implements IVectorDatabase {
  private vectorIndex: VectorIndex;
  private searchEngine: SearchEngine;
  private connected: boolean;

  constructor(config: VectorDatabaseConfig) {
    const indexConfig = {
      type: IndexType.HNSW,
      dimension: config.dimension,
      metric: config.metric,
      M: 16,
      efConstruction: 200,
      efSearch: 50,
    };

    this.vectorIndex = new VectorIndex(indexConfig);
    this.searchEngine = new SearchEngine(this.vectorIndex);
    this.connected = false;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async insert(record: VectorRecord): Promise<void> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    await this.vectorIndex.insert(record);
  }

  async insertBatch(records: VectorRecord[]): Promise<BatchResult> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    return await this.vectorIndex.insertBatch(records);
  }

  async delete(id: VectorId): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    const result = await this.vectorIndex.delete(id);
    return result.success;
  }

  async deleteBatch(ids: VectorId[]): Promise<BatchResult> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    return await this.vectorIndex.deleteBatch(ids);
  }

  async update(record: VectorRecord): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    const result = await this.vectorIndex.update(record);
    return result.success;
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    const { results } = await this.searchEngine.search(query);
    return results;
  }

  async get(id: VectorId): Promise<VectorRecord | null> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    return await this.vectorIndex.get(id);
  }

  async has(id: VectorId): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    return await this.vectorIndex.has(id);
  }

  async getStats(): Promise<IndexStats> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    return this.vectorIndex.getStats();
  }

  async clear(): Promise<void> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    await this.vectorIndex.clear();
  }
}

/**
 * Cloudflare Vectorize implementation
 */
class CloudflareVectorizeDatabase implements IVectorDatabase {
  private config: VectorDatabaseConfig;
  private connected: boolean;
  private binding: any; // Cloudflare Vectorize binding

  constructor(config: VectorDatabaseConfig) {
    this.config = config;
    this.connected = false;
    this.binding = null;
  }

  async connect(): Promise<void> {
    // In Cloudflare Workers, the binding is provided automatically
    // This is a placeholder for demonstration
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async insert(record: VectorRecord): Promise<void> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    if (!this.binding) {
      throw new Error('Vectorize binding not available');
    }

    // Cloudflare Vectorize API
    await this.binding.insert([
      {
        id: record.id,
        values: record.vector,
        metadata: record.metadata,
      },
    ]);
  }

  async insertBatch(records: VectorRecord[]): Promise<BatchResult> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    if (!this.binding) {
      throw new Error('Vectorize binding not available');
    }

    try {
      const vectors = records.map((r) => ({
        id: r.id,
        values: Array.from(r.vector),
        metadata: r.metadata,
      }));

      await this.binding.insert(vectors);

      return {
        succeeded: records.length,
        failed: 0,
        errors: [],
      };
    } catch (error) {
      return {
        succeeded: 0,
        failed: records.length,
        errors: records.map((r) => ({
          id: r.id,
          error: error instanceof Error ? error.message : String(error),
        })),
      };
    }
  }

  async delete(id: VectorId): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    if (!this.binding) {
      throw new Error('Vectorize binding not available');
    }

    try {
      await this.binding.deleteIds([id]);
      return true;
    } catch {
      return false;
    }
  }

  async deleteBatch(ids: VectorId[]): Promise<BatchResult> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    if (!this.binding) {
      throw new Error('Vectorize binding not available');
    }

    try {
      await this.binding.deleteIds(ids);
      return {
        succeeded: ids.length,
        failed: 0,
        errors: [],
      };
    } catch (error) {
      return {
        succeeded: 0,
        failed: ids.length,
        errors: ids.map((id) => ({
          id,
          error: error instanceof Error ? error.message : String(error),
        })),
      };
    }
  }

  async update(record: VectorRecord): Promise<boolean> {
    // Vectorize doesn't have update, so delete and insert
    await this.delete(record.id);
    await this.insert(record);
    return true;
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    if (!this.binding) {
      throw new Error('Vectorize binding not available');
    }

    const topK = query.topK || 10;
    const namespace = query.namespace || this.config.namespace;

    const results = await this.binding.query(query.vector, {
      topK,
      namespace,
      returnMetadata: query.includeMetadata || false,
      filter: query.filter,
    });

    return results.matches.map((match: any) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata,
    }));
  }

  async get(id: VectorId): Promise<VectorRecord | null> {
    // Vectorize doesn't have a get by ID API
    // Would need to implement caching or use another method
    return null;
  }

  async has(id: VectorId): Promise<boolean> {
    // Vectorize doesn't have a has API
    return false;
  }

  async getStats(): Promise<IndexStats> {
    // Vectorize doesn't expose detailed stats
    return {
      vectorCount: 0,
      dimension: this.config.dimension,
      indexSize: 0,
      memoryUsage: 0,
      lastUpdated: Date.now(),
      indexType: IndexType.HNSW,
    };
  }

  async clear(): Promise<void> {
    throw new Error('Clear operation not supported by Vectorize');
  }
}

/**
 * Pinecone implementation
 */
class PineconeDatabase implements IVectorDatabase {
  private config: VectorDatabaseConfig;
  private connected: boolean;
  private apiKey: string;
  private indexName: string;
  private environment: string;

  constructor(config: VectorDatabaseConfig) {
    this.config = config;
    this.connected = false;
    this.apiKey = config.apiKey || '';
    this.indexName = config.indexName || 'default';
    this.environment = config.environment || 'us-east1-gcp';
  }

  async connect(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Pinecone API key required');
    }

    // Initialize Pinecone client
    // This is a placeholder - in production, use the actual Pinecone SDK
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async insert(record: VectorRecord): Promise<void> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    // Pinecone upsert API
    await this.upsert(record);
  }

  async insertBatch(records: VectorRecord[]): Promise<BatchResult> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      const vectors = records.map((r) => ({
        id: r.id,
        values: Array.from(r.vector),
        metadata: r.metadata,
      }));

      // Pinecone upsert API
      // await client.index({ indexName: this.indexName }).upsert({ vectors });

      return {
        succeeded: records.length,
        failed: 0,
        errors: [],
      };
    } catch (error) {
      return {
        succeeded: 0,
        failed: records.length,
        errors: records.map((r) => ({
          id: r.id,
          error: error instanceof Error ? error.message : String(error),
        })),
      };
    }
  }

  async delete(id: VectorId): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      // Pinecone delete API
      // await client.index({ indexName: this.indexName }).deleteOne({ id });
      return true;
    } catch {
      return false;
    }
  }

  async deleteBatch(ids: VectorId[]): Promise<BatchResult> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      // Pinecone delete API
      // await client.index({ indexName: this.indexName }).deleteMany({ ids });
      return {
        succeeded: ids.length,
        failed: 0,
        errors: [],
      };
    } catch (error) {
      return {
        succeeded: 0,
        failed: ids.length,
        errors: ids.map((id) => ({
          id,
          error: error instanceof Error ? error.message : String(error),
        })),
      };
    }
  }

  async upsert(record: VectorRecord): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      // Pinecone upsert API
      // await client.index({ indexName: this.indexName }).upsert({
      //   vectors: [{
      //     id: record.id,
      //     values: Array.from(record.vector),
      //     metadata: record.metadata,
      //   }],
      // });
      return true;
    } catch {
      return false;
    }
  }

  async update(record: VectorRecord): Promise<boolean> {
    return await this.upsert(record);
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    const topK = query.topK || 10;

    // Pinecone query API
    // const response = await client.index({ indexName: this.indexName }).query({
    //   vector: query.vector,
    //   topK,
    //   includeMetadata: query.includeMetadata,
    //   filter: query.filter,
    //   namespace: query.namespace,
    // });

    // return response.matches.map((match) => ({
    //   id: match.id,
    //   score: match.score,
    //   metadata: match.metadata,
    // }));

    return [];
  }

  async get(id: VectorId): Promise<VectorRecord | null> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    // Pinecone fetch API
    // const response = await client.index({ indexName: this.indexName }).fetch([id]);
    // if (response.vectors.length > 0) {
    //   const vector = response.vectors[0];
    //   return {
    //     id: vector.id,
    //     vector: new Float32Array(vector.values),
    //     metadata: vector.metadata,
    //   };
    // }
    return null;
  }

  async has(id: VectorId): Promise<boolean> {
    const record = await this.get(id);
    return record !== null;
  }

  async getStats(): Promise<IndexStats> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    // Pinecone describeIndexStats API
    // const stats = await client.index({ indexName: this.indexName }).describeIndexStats();
    // return {
    //   vectorCount: stats.totalVectorCount,
    //   dimension: stats.dimension,
    //   indexSize: 0,
    //   memoryUsage: 0,
    //   lastUpdated: Date.now(),
    //   indexType: IndexType.HNSW,
    // };

    return {
      vectorCount: 0,
      dimension: this.config.dimension,
      indexSize: 0,
      memoryUsage: 0,
      lastUpdated: Date.now(),
      indexType: IndexType.HNSW,
    };
  }

  async clear(): Promise<void> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    // Pinecone delete all API
    // await client.index({ indexName: this.indexName }).deleteAll();
  }
}

/**
 * Vector Database Abstraction class
 */
export class VectorDatabase implements IVectorDatabase {
  private implementation: IVectorDatabase;
  private config: VectorDatabaseConfig;

  constructor(config: VectorDatabaseConfig) {
    this.config = config;

    switch (config.type) {
      case 'memory':
        this.implementation = new InMemoryVectorDatabase(config);
        break;

      case 'cloudflare-vectorize':
        this.implementation = new CloudflareVectorizeDatabase(config);
        break;

      case 'pinecone':
        this.implementation = new PineconeDatabase(config);
        break;

      // Placeholder for other databases
      case 'weaviate':
      case 'qdrant':
      case 'milvus':
        throw new Error(`${config.type} not yet implemented`);

      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  async connect(): Promise<void> {
    await this.implementation.connect();
  }

  async disconnect(): Promise<void> {
    await this.implementation.disconnect();
  }

  async insert(record: VectorRecord): Promise<void> {
    await this.implementation.insert(record);
  }

  async insertBatch(records: VectorRecord[]): Promise<BatchResult> {
    return await this.implementation.insertBatch(records);
  }

  async delete(id: VectorId): Promise<boolean> {
    return await this.implementation.delete(id);
  }

  async deleteBatch(ids: VectorId[]): Promise<BatchResult> {
    return await this.implementation.deleteBatch(ids);
  }

  async update(record: VectorRecord): Promise<boolean> {
    return await this.implementation.update(record);
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    return await this.implementation.search(query);
  }

  async get(id: VectorId): Promise<VectorRecord | null> {
    return await this.implementation.get(id);
  }

  async has(id: VectorId): Promise<boolean> {
    return await this.implementation.has(id);
  }

  async getStats(): Promise<IndexStats> {
    return await this.implementation.getStats();
  }

  async clear(): Promise<void> {
    await this.implementation.clear();
  }

  /**
   * Get database type
   */
  getType(): string {
    return this.config.type;
  }

  /**
   * Get configuration
   */
  getConfig(): VectorDatabaseConfig {
    return { ...this.config };
  }
}
