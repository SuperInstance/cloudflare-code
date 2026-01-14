/**
 * GraphQL API Data Ingestion
 * Handles data ingestion from GraphQL APIs
 */

import type {
  GraphQLApiConfig,
  AuthConfig,
  StreamEvent
} from '../types';

export interface GraphQLIngestorConfig {
  id: string;
  config: GraphQLApiConfig;
}

export class GraphQLIngestor {
  private config: GraphQLIngestorConfig;
  private controller: AbortController | null = null;

  constructor(config: GraphQLIngestorConfig) {
    this.config = config;
  }

  /**
   * Fetch data from GraphQL API
   */
  async fetch(): Promise<StreamEvent[]> {
    const events: StreamEvent[] = [];

    this.controller = new AbortController();

    try {
      const response = await this.execute();
      const records = this.extractRecords(response.data);

      for (const record of records) {
        events.push(this.createEvent(record));
      }

      return events;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      throw error;
    }
  }

  /**
   * Stream data from GraphQL API
   */
  async *stream(): AsyncGenerator<StreamEvent> {
    this.controller = new AbortController();

    try {
      const response = await this.execute();
      const records = this.extractRecords(response.data);

      for (const record of records) {
        yield this.createEvent(record);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      throw error;
    }
  }

  /**
   * Subscribe to GraphQL subscriptions
   */
  async *subscribe(): AsyncGenerator<StreamEvent> {
    // For subscriptions, we'd use WebSocket
    // This is a placeholder for subscription support
    throw new Error('Subscriptions not yet implemented');
  }

  /**
   * Cancel ongoing requests
   */
  cancel(): void {
    if (this.controller) {
      this.controller.abort();
    }
  }

  /**
   * Execute GraphQL query
   */
  private async execute(): Promise<{ data: unknown; errors?: unknown[] }> {
    const headers = { ...this.config.config.headers };

    // Add authentication
    if (this.config.config.auth) {
      const authHeaders = await this.buildAuthHeaders(this.config.config.auth);
      Object.assign(headers, authHeaders);
    }

    const response = await fetch(this.config.config.url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: this.config.config.query,
        variables: this.config.config.variables || {}
      }),
      signal: this.controller?.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Extract records from GraphQL response
   */
  private extractRecords(data: unknown): unknown[] {
    if (data === null || data === undefined) {
      return [];
    }

    if (Array.isArray(data)) {
      return data;
    }

    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      // Get the first key's value if it's an array
      const keys = Object.keys(obj);
      if (keys.length > 0) {
        const firstValue = obj[keys[0]];
        if (Array.isArray(firstValue)) {
          return firstValue;
        }
      }
    }

    return [data];
  }

  /**
   * Build authentication headers
   */
  private async buildAuthHeaders(auth: AuthConfig): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    switch (auth.type) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${auth.credentials?.token || ''}`;
        break;

      case 'api-key':
        const apiKeyName = auth.credentials?.headerName || 'X-API-Key';
        headers[apiKeyName] = auth.credentials?.apiKey || '';
        break;
    }

    return headers;
  }

  /**
   * Create a stream event from a record
   */
  private createEvent(record: unknown): StreamEvent {
    return {
      key: this.generateKey(record),
      value: record,
      timestamp: new Date(),
      headers: {},
      metadata: {
        source: this.config.id,
        sourceType: 'graphql-api'
      }
    };
  }

  /**
   * Generate a unique key for a record
   */
  private generateKey(record: unknown): string {
    if (typeof record === 'object' && record !== null) {
      const obj = record as Record<string, unknown>;
      for (const key of ['id', '_id', 'uuid', 'nodeId']) {
        if (typeof obj[key] === 'string' || typeof obj[key] === 'number') {
          return `${this.config.id}-${obj[key]}`;
        }
      }
    }

    return `${this.config.id}-${Date.now()}-${Math.random()}`;
  }
}
