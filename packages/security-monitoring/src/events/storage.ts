// @ts-nocheck
/**
 * Event Storage
 * Handles storage and retrieval of security events
 */

// Stub type for Elasticsearch Client
interface ElasticsearchClient {
  index(params: { index: string; id: string; body: unknown; refresh?: boolean }): Promise<unknown>;
  bulk(params: { body: unknown[]; refresh?: boolean }): Promise<unknown>;
  search(params: any): Promise<any>;
  get(params: { index: string; id: string }): Promise<any>;
  indices: {
    create(params: { index: string }): Promise<any>;
    delete(params: { index: string }): Promise<any>;
    exists(params: { index: string }): Promise<any>;
  };
}

import { EnrichedSecurityEvent, SecurityEvent, SecurityEventType, SecurityEventSeverity } from '../types';

// EventQuery interface (moved from logger.ts to avoid external dependencies)
export interface EventQuery {
  type?: SecurityEventType | SecurityEventType[];
  severity?: SecurityEventSeverity | SecurityEventSeverity[];
  startDate?: Date;
  endDate?: Date;
  userId?: string | string[];
  source?: string | string[];
  ipAddress?: string | string[];
  resource?: string | string[];
  outcome?: 'success' | 'failure' | 'partial';
  tags?: string[];
  limit?: number;
  offset?: number;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

export class EventStorage {
  private elasticsearch: ElasticsearchClient;
  private indexPrefix: string;

  constructor(elasticsearch: ElasticsearchClient, indexPrefix: string) {
    this.elasticsearch = elasticsearch;
    this.indexPrefix = indexPrefix;
  }

  /**
   * Store a single event
   */
  public async storeEvent(event: EnrichedSecurityEvent): Promise<void> {
    const indexName = this.getIndexName(event.timestamp);

    await this.elasticsearch.index({
      index: indexName,
      id: event.id,
      body: event,
      refresh: false,
    });
  }

  /**
   * Store multiple events in bulk
   */
  public async storeEvents(events: EnrichedSecurityEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    // Group events by index
    const eventsByIndex = new Map<string, EnrichedSecurityEvent[]>();
    events.forEach(event => {
      const indexName = this.getIndexName(event.timestamp);
      if (!eventsByIndex.has(indexName)) {
        eventsByIndex.set(indexName, []);
      }
      eventsByIndex.get(indexName)!.push(event);
    });

    // Bulk index each group
    for (const [indexName, indexEvents] of eventsByIndex.entries()) {
      const body = indexEvents.flatMap(event => [
        { index: { _index: indexName, _id: event.id } },
        event,
      ]);

      await this.elasticsearch.bulk({
        body,
        refresh: false,
      });
    }
  }

  /**
   * Query events
   */
  public async queryEvents(query: EventQuery): Promise<EnrichedSecurityEvent[]> {
    const must: any[] = [];
    const filter: any[] = [];

    // Build query
    if (query.type) {
      const types = Array.isArray(query.type) ? query.type : [query.type];
      must.push({
        terms: { type: types },
      });
    }

    if (query.severity) {
      const severities = Array.isArray(query.severity) ? query.severity : [query.severity];
      must.push({
        terms: { severity: severities },
      });
    }

    if (query.startDate || query.endDate) {
      const range: any = {};
      if (query.startDate) {
        range.gte = query.startDate;
      }
      if (query.endDate) {
        range.lte = query.endDate;
      }
      filter.push({
        range: { timestamp: range },
      });
    }

    if (query.userId) {
      const userIds = Array.isArray(query.userId) ? query.userId : [query.userId];
      must.push({
        terms: { userId: userIds },
      });
    }

    if (query.source) {
      const sources = Array.isArray(query.source) ? query.source : [query.source];
      must.push({
        terms: { source: sources },
      });
    }

    if (query.ipAddress) {
      const ipAddresses = Array.isArray(query.ipAddress) ? query.ipAddress : [query.ipAddress];
      must.push({
        terms: { ipAddress: ipAddresses },
      });
    }

    if (query.resource) {
      const resources = Array.isArray(query.resource) ? query.resource : [query.resource];
      must.push({
        terms: { 'resource.keyword': resources },
      });
    }

    if (query.outcome) {
      must.push({
        term: { outcome: query.outcome },
      });
    }

    if (query.tags && query.tags.length > 0) {
      must.push({
        terms: { tags: query.tags },
      });
    }

    // Build the complete query
    const esQuery: any = {
      bool: {
        must,
        filter,
      },
    };

    // Build sort
    const sort: any[] = [];
    if (query.sort) {
      sort.push({
        [query.sort.field]: { order: query.sort.order },
      });
    } else {
      sort.push({ timestamp: { order: 'desc' } });
    }

    // Execute search
    const response = await this.elasticsearch.search({
      index: `${this.indexPrefix}-*`,
      body: {
        query: esQuery,
        sort,
        size: query.limit || 100,
        from: query.offset || 0,
      },
    });

    return response.body.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Get event by ID
   */
  public async getEventById(id: string): Promise<EnrichedSecurityEvent | null> {
    try {
      const response = await this.elasticsearch.search({
        index: `${this.indexPrefix}-*`,
        body: {
          query: {
            term: { _id: id },
          },
        },
      });

      const hits = response.body.hits.hits;
      if (hits.length === 0) {
        return null;
      }

      return hits[0]._source;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get recent events
   */
  public async getRecentEvents(limit: number = 100): Promise<EnrichedSecurityEvent[]> {
    const response = await this.elasticsearch.search({
      index: `${this.indexPrefix}-*`,
      body: {
        query: {
          match_all: {},
        },
        sort: [
          { timestamp: { order: 'desc' } },
        ],
        size: limit,
      },
    });

    return response.body.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Get events by type
   */
  public async getEventsByType(
    type: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<EnrichedSecurityEvent[]> {
    const must: any[] = [
      { term: { type } },
    ];

    const filter: any[] = [];
    if (startDate || endDate) {
      const range: any = {};
      if (startDate) range.gte = startDate;
      if (endDate) range.lte = endDate;
      filter.push({ range: { timestamp: range } });
    }

    const response = await this.elasticsearch.search({
      index: `${this.indexPrefix}-*`,
      body: {
        query: {
          bool: {
            must,
            filter,
          },
        },
        sort: [
          { timestamp: { order: 'desc' } },
        ],
        size: 1000,
      },
    });

    return response.body.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Get events by user
   */
  public async getEventsByUser(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<EnrichedSecurityEvent[]> {
    const must: any[] = [
      { term: { userId } },
    ];

    const filter: any[] = [];
    if (startDate || endDate) {
      const range: any = {};
      if (startDate) range.gte = startDate;
      if (endDate) range.lte = endDate;
      filter.push({ range: { timestamp: range } });
    }

    const response = await this.elasticsearch.search({
      index: `${this.indexPrefix}-*`,
      body: {
        query: {
          bool: {
            must,
            filter,
          },
        },
        sort: [
          { timestamp: { order: 'desc' } },
        ],
        size: 1000,
      },
    });

    return response.body.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Create index with proper mappings
   */
  public async createIndex(date: Date): Promise<void> {
    const indexName = this.getIndexName(date);

    const exists = await this.elasticsearch.indices.exists({
      index: indexName,
    });

    if (exists) {
      return;
    }

    await this.elasticsearch.indices.create({
      index: indexName,
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            type: { type: 'keyword' },
            severity: { type: 'keyword' },
            timestamp: { type: 'date' },
            source: { type: 'keyword' },
            userId: { type: 'keyword' },
            sessionId: { type: 'keyword' },
            ipAddress: { type: 'ip' },
            userAgent: { type: 'text' },
            resource: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            action: { type: 'keyword' },
            outcome: { type: 'keyword' },
            details: { type: 'object', enabled: false },
            metadata: { type: 'object', enabled: false },
            tags: { type: 'keyword' },
            correlationId: { type: 'keyword' },
            eventId: { type: 'keyword' },
            enriched: { type: 'boolean' },
            enrichmentData: { type: 'object', enabled: false },
            riskScore: { type: 'integer' },
            mitreTechniques: { type: 'keyword' },
          },
        },
        settings: {
          number_of_shards: 3,
          number_of_replicas: 1,
          'index.lifecycle.name': 'security-events-policy',
          'index.lifecycle.rollover_alias': this.indexPrefix,
        },
      },
    });
  }

  /**
   * Get index name for a date
   */
  private getIndexName(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${this.indexPrefix}-${year}-${month}-${day}`;
  }
}
