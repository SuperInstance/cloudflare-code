/**
 * REST API Data Ingestion
 * Handles data ingestion from REST APIs with support for pagination, rate limiting, and authentication
 */

import type {
  RestApiConfig,
  AuthConfig,
  PaginationConfig,
  RateLimitConfig,
  StreamEvent,
  BatchingConfig
} from '../types';

export interface RestApiIngestorConfig {
  id: string;
  config: RestApiConfig;
  batching?: BatchingConfig;
}

export class RestApiIngestor {
  private config: RestApiIngestorConfig;
  private rateLimiter: RateLimiter | null = null;
  private buffer: unknown[] = [];
  private controller: AbortController | null = null;

  constructor(config: RestApiIngestorConfig) {
    this.config = config;
    if (this.config.config.rateLimit) {
      this.rateLimiter = new RateLimiter(this.config.config.rateLimit);
    }
  }

  /**
   * Fetch data from the REST API
   */
  async fetch(): Promise<StreamEvent[]> {
    const events: StreamEvent[] = [];
    let pageCount = 0;
    let hasMore = true;

    this.controller = new AbortController();

    try {
      while (hasMore) {
        // Check pagination limits
        if (this.config.config.pagination?.maxPages &&
            pageCount >= this.config.config.pagination.maxPages) {
          break;
        }

        // Apply rate limiting
        if (this.rateLimiter) {
          await this.rateLimiter.acquire();
        }

        // Build request options
        const options = await this.buildRequestOptions();
        const url = this.buildUrl(pageCount);

        // Fetch data
        const response = await fetch(url, {
          ...options,
          signal: this.controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const records = this.extractRecords(data);

        // Convert records to stream events
        for (const record of records) {
          events.push(this.createEvent(record));
        }

        // Check for more pages
        hasMore = this.hasMorePages(data, response);
        pageCount++;
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
   * Stream data from the REST API
   */
  async *stream(): AsyncGenerator<StreamEvent> {
    let pageCount = 0;
    let hasMore = true;

    this.controller = new AbortController();

    try {
      while (hasMore) {
        // Check pagination limits
        if (this.config.config.pagination?.maxPages &&
            pageCount >= this.config.config.pagination.maxPages) {
          break;
        }

        // Apply rate limiting
        if (this.rateLimiter) {
          await this.rateLimiter.acquire();
        }

        // Build request options
        const options = await this.buildRequestOptions();
        const url = this.buildUrl(pageCount);

        // Fetch data
        const response = await fetch(url, {
          ...options,
          signal: this.controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const records = this.extractRecords(data);

        // Yield records as stream events
        for (const record of records) {
          yield this.createEvent(record);
        }

        // Check for more pages
        hasMore = this.hasMorePages(data, response);
        pageCount++;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      throw error;
    }
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
   * Build request options with authentication
   */
  private async buildRequestOptions(): Promise<RequestInit> {
    const options: RequestInit = {
      method: this.config.config.method,
      headers: { ...this.config.config.headers }
    };

    // Add authentication
    if (this.config.config.auth) {
      const authHeaders = await this.buildAuthHeaders(this.config.config.auth);
      Object.assign(options.headers, authHeaders);
    }

    // Add body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(this.config.config.method) && this.config.config.body) {
      options.body = JSON.stringify(this.config.config.body);
      (options.headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    return options;
  }

  /**
   * Build URL with pagination parameters
   */
  private buildUrl(page: number): string {
    let url = this.config.config.url;

    // Add query parameters
    const params = new URLSearchParams();

    // Add custom params
    if (this.config.config.params) {
      Object.entries(this.config.config.params).forEach(([key, value]) => {
        params.append(key, value);
      });
    }

    // Add pagination params
    if (this.config.config.pagination) {
      const { type, pageSize, pageParam, pageSizeParam } = this.config.config.pagination;

      if (type === 'offset' || type === 'page') {
        if (pageParam) {
          params.append(pageParam, String(page + 1));
        }
        if (pageSize && pageSizeParam) {
          params.append(pageSizeParam, String(pageSize));
        }
      }
    }

    const queryString = params.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }

    return url;
  }

  /**
   * Extract records from response data
   */
  private extractRecords(data: unknown): unknown[] {
    if (Array.isArray(data)) {
      return data;
    }

    if (typeof data === 'object' && data !== null) {
      // Try common response wrapper keys
      const obj = data as Record<string, unknown>;
      for (const key of ['data', 'results', 'items', 'records', 'entries']) {
        if (Array.isArray(obj[key])) {
          return obj[key] as unknown[];
        }
      }
    }

    // Return single item as array
    return [data];
  }

  /**
   * Check if there are more pages
   */
  private hasMorePages(data: unknown, response: Response): boolean {
    if (!this.config.config.pagination) {
      return false;
    }

    const { type } = this.config.config.pagination;

    if (type === 'link-header') {
      const linkHeader = response.headers.get('Link');
      if (linkHeader) {
        return linkHeader.includes('rel="next"');
      }
      return false;
    }

    if (type === 'cursor' && typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      return !!(obj.nextCursor || obj.next_page_token);
    }

    return false;
  }

  /**
   * Build authentication headers
   */
  private async buildAuthHeaders(auth: AuthConfig): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    switch (auth.type) {
      case 'basic':
        const basicCreds = auth.credentials || {};
        const username = basicCreds.username || '';
        const password = basicCreds.password || '';
        headers['Authorization'] = 'Basic ' + btoa(`${username}:${password}`);
        break;

      case 'bearer':
        headers['Authorization'] = `Bearer ${auth.credentials?.token || ''}`;
        break;

      case 'api-key':
        const apiKeyName = auth.credentials?.headerName || 'X-API-Key';
        headers[apiKeyName] = auth.credentials?.apiKey || '';
        break;

      case 'oauth2':
        const token = await this.getOAuthToken(auth.credentials || {});
        headers['Authorization'] = `Bearer ${token}`;
        break;
    }

    return headers;
  }

  /**
   * Get OAuth2 token (simplified implementation)
   */
  private async getOAuthToken(credentials: Record<string, string>): Promise<string> {
    // In a real implementation, this would handle OAuth2 flow
    // For now, return the access token if available
    return credentials.access_token || '';
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
        sourceType: 'rest-api'
      }
    };
  }

  /**
   * Generate a unique key for a record
   */
  private generateKey(record: unknown): string {
    if (typeof record === 'object' && record !== null) {
      const obj = record as Record<string, unknown>;
      // Try common ID fields
      for (const key of ['id', '_id', 'uuid', 'key']) {
        if (typeof obj[key] === 'string' || typeof obj[key] === 'number') {
          return `${this.config.id}-${obj[key]}`;
        }
      }
    }

    // Fallback to hash
    return `${this.config.id}-${Date.now()}-${Math.random()}`;
  }
}

/**
 * Rate limiter for API requests
 */
class RateLimiter {
  private config: RateLimitConfig;
  private tokens: number;
  private lastRefill: number;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.tokens = config.maxRequests;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    // Refill tokens based on elapsed time
    const refillAmount = Math.floor(
      (elapsed / this.config.windowMs) * this.config.maxRequests
    );
    this.tokens = Math.min(
      this.config.maxRequests,
      this.tokens + refillAmount
    );
    this.lastRefill = now;

    // Wait if no tokens available
    if (this.tokens <= 0) {
      const waitTime = this.config.windowMs / this.config.maxRequests;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      await this.acquire();
      return;
    }

    this.tokens--;
  }
}
