/**
 * Data Ingestion Module
 * Unified interface for all data ingestion sources
 */

export { RestApiIngestor } from './rest-api';
export { GraphQLIngestor } from './graphql-api';
export { WebhookIngestor, WebhookManager } from './webhook';
export { SSEIngestor, SSEManager } from './sse';
export { DatabaseIngestor, DatabaseConnectionPool } from './database';
export { FileIngestor } from './file';

export type {
  RestApiIngestorConfig,
  GraphQLIngestorConfig,
  WebhookIngestorConfig,
  SSEIngestorConfig,
  DatabaseIngestorConfig,
  FileIngestorConfig
} from './rest-api';

import type {
  DataSource,
  DataSourceType,
  StreamEvent
} from '../types';

import { RestApiIngestor, type RestApiIngestorConfig } from './rest-api';
import { GraphQLIngestor, type GraphQLIngestorConfig } from './graphql-api';
import { WebhookIngestor, WebhookManager, type WebhookIngestorConfig } from './webhook';
import { SSEIngestor, SSEManager, type SSEIngestorConfig } from './sse';
import { DatabaseIngestor, type DatabaseIngestorConfig } from './database';
import { FileIngestor, type FileIngestorConfig } from './file';

/**
 * Data Ingestor Factory
 * Creates appropriate ingestor based on data source type
 */
export class DataIngestorFactory {
  /**
   * Create ingestor from data source configuration
   */
  static create(source: DataSource): DataIngestor {
    const config = {
      id: source.id,
      config: source.config as any
    };

    switch (source.type) {
      case 'rest-api':
        return new RestApiIngestor(config as RestApiIngestorConfig);

      case 'graphql-api':
        return new GraphQLIngestor(config as GraphQLIngestorConfig);

      case 'webhook':
        return new WebhookIngestor(config as WebhookIngestorConfig);

      case 'sse':
        return new SSEIngestor(config as SSEIngestorConfig);

      case 'postgresql':
      case 'mysql':
      case 'mongodb':
      case 'redis':
      case 'd1':
      case 'kv':
        return new DatabaseIngestor(config as DatabaseIngestorConfig);

      case 'csv':
      case 'json':
      case 'parquet':
      case 'avro':
      case 'xml':
        return new FileIngestor(config as FileIngestorConfig);

      default:
        throw new Error(`Unsupported data source type: ${source.type}`);
    }
  }
}

/**
 * Unified Data Ingestor Interface
 */
export interface DataIngestor {
  /**
   * Fetch all data from the source
   */
  fetch(): Promise<StreamEvent[]>;

  /**
   * Stream data from the source
   */
  stream?(): AsyncGenerator<StreamEvent>;

  /**
   * Cancel ongoing operations
   */
  cancel?(): void;
}

/**
 * Multi-source Ingestor
 * Aggregates data from multiple sources
 */
export class MultiSourceIngestor {
  private ingestors: Map<string, DataIngestor> = new Map();
  private controller: AbortController | null = null;

  /**
   * Add a data source
   */
  addSource(source: DataSource): void {
    const ingestor = DataIngestorFactory.create(source);
    this.ingestors.set(source.id, ingestor);
  }

  /**
   * Remove a data source
   */
  removeSource(sourceId: string): void {
    const ingestor = this.ingestors.get(sourceId);
    if (ingestor && ingestor.cancel) {
      ingestor.cancel();
    }
    this.ingestors.delete(sourceId);
  }

  /**
   * Fetch data from all sources
   */
  async fetchAll(): Promise<Map<string, StreamEvent[]>> {
    const results = new Map<string, StreamEvent[]>();

    const promises = Array.from(this.ingestors.entries()).map(
      async ([sourceId, ingestor]) => {
        try {
          const events = await ingestor.fetch();
          results.set(sourceId, events);
        } catch (error) {
          console.error(`Error fetching from source ${sourceId}:`, error);
          results.set(sourceId, []);
        }
      }
    );

    await Promise.all(promises);
    return results;
  }

  /**
   * Stream data from all sources
   */
  async *streamAll(): AsyncGenerator<{ sourceId: string; event: StreamEvent }> {
    this.controller = new AbortController();

    const promises = Array.from(this.ingestors.entries()).map(
      async ([sourceId, ingestor]) => {
        if (ingestor.stream) {
          try {
            for await (const event of ingestor.stream()) {
              yield { sourceId, event };

              if (this.controller?.signal.aborted) {
                break;
              }
            }
          } catch (error) {
            console.error(`Error streaming from source ${sourceId}:`, error);
          }
        }
      }
    );

    // Run all streams in parallel
    await Promise.all(promises);
  }

  /**
   * Stop all operations
   */
  stop(): void {
    if (this.controller) {
      this.controller.abort();
    }

    for (const ingestor of this.ingestors.values()) {
      if (ingestor.cancel) {
        ingestor.cancel();
      }
    }
  }

  /**
   * Get number of sources
   */
  get count(): number {
    return this.ingestors.size;
  }
}

/**
 * Batched Ingestor
 * Buffers events and emits them in batches
 */
export class BatchedIngestor {
  private ingestor: DataIngestor;
  private batchSize: number;
  private maxWaitTime: number;
  private buffer: StreamEvent[] = [];
  private timer: number | null = null;
  private resolveFlush: ((events: StreamEvent[]) => void) | null = null;

  constructor(
    ingestor: DataIngestor,
    batchSize: number = 100,
    maxWaitTime: number = 5000
  ) {
    this.ingestor = ingestor;
    this.batchSize = batchSize;
    this.maxWaitTime = maxWaitTime;
  }

  /**
   * Fetch data in batches
   */
  async *fetchBatches(): AsyncGenerator<StreamEvent[]> {
    if (!this.ingestor.stream) {
      // If no streaming support, fall back to fetch
      const events = await this.ingestor.fetch();
      yield events;
      return;
    }

    for await (const event of this.ingestor.stream()) {
      this.buffer.push(event);

      if (this.buffer.length >= this.batchSize) {
        yield this.flush();
      }
    }

    // Flush remaining events
    if (this.buffer.length > 0) {
      yield this.flush();
    }
  }

  /**
   * Flush buffered events
   */
  private flush(): StreamEvent[] {
    const events = [...this.buffer];
    this.buffer = [];
    return events;
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = [];
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/**
 * Filtered Ingestor
 * Filters events based on a predicate function
 */
export class FilteredIngestor {
  private ingestor: DataIngestor;
  private predicate: (event: StreamEvent) => boolean;

  constructor(
    ingestor: DataIngestor,
    predicate: (event: StreamEvent) => boolean
  ) {
    this.ingestor = ingestor;
    this.predicate = predicate;
  }

  /**
   * Fetch filtered data
   */
  async fetch(): Promise<StreamEvent[]> {
    const events = await this.ingestor.fetch();
    return events.filter(this.predicate);
  }

  /**
   * Stream filtered data
   */
  async *stream(): AsyncGenerator<StreamEvent> {
    if (!this.ingestor.stream) {
      const events = await this.fetch();
      for (const event of events) {
        yield event;
      }
      return;
    }

    for await (const event of this.ingestor.stream()) {
      if (this.predicate(event)) {
        yield event;
      }
    }
  }
}

/**
 * Transformed Ingestor
 * Transforms events using a mapper function
 */
export class TransformedIngestor {
  private ingestor: DataIngestor;
  private mapper: (event: StreamEvent) => StreamEvent;

  constructor(
    ingestor: DataIngestor,
    mapper: (event: StreamEvent) => StreamEvent
  ) {
    this.ingestor = ingestor;
    this.mapper = mapper;
  }

  /**
   * Fetch and transform data
   */
  async fetch(): Promise<StreamEvent[]> {
    const events = await this.ingestor.fetch();
    return events.map(this.mapper);
  }

  /**
   * Stream and transform data
   */
  async *stream(): AsyncGenerator<StreamEvent> {
    if (!this.ingestor.stream) {
      const events = await this.fetch();
      for (const event of events) {
        yield event;
      }
      return;
    }

    for await (const event of this.ingestor.stream()) {
      yield this.mapper(event);
    }
  }
}
