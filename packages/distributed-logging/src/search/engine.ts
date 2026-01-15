/**
 * Log Search Engine - Full-text search and filtering for logs
 */

import EventEmitter from 'eventemitter3';
import LRUCache from 'lru-cache';
import { Index as ElasticLunrIndex } from 'elasticlunr';
import {
  LogEntry,
  SearchQuery,
  SearchResult,
  LogFilter,
  FilterOperator,
  SortField,
  SortOrder,
  LogLevel,
  TimeRange,
} from '../types';
import { createLogger } from '../utils/logger';
import { isWithinRange, wildcardMatch, escapeRegex } from '../utils/helpers';

export interface SearchEngineConfig {
  indexFields?: string[];
  cacheSize?: number;
  cacheTTL?: number;
  maxResults?: number;
  timeout?: number;
}

export interface SearchEngineEvents {
  'search:started': { query: SearchQuery };
  'search:completed': { query: SearchQuery; result: SearchResult };
  'search:error': { query: SearchQuery; error: Error };
  'index:updated': { count: number };
}

/**
 * Log Search Engine class
 */
export class LogSearchEngine extends EventEmitter<SearchEngineEvents> {
  private logger = createLogger({ component: 'LogSearchEngine' });
  private index: ElasticLunrIndex<any>;
  private entries: Map<string, LogEntry> = new Map();
  private cache: LRUCache<string, SearchResult>;
  private config: Required<SearchEngineConfig>;

  constructor(config: SearchEngineConfig = {}) {
    super();

    this.config = {
      indexFields: config.indexFields ?? ['message', 'service', 'host', 'environment'],
      cacheSize: config.cacheSize ?? 1000,
      cacheTTL: config.cacheTTL ?? 60000, // 1 minute
      maxResults: config.maxResults ?? 10000,
      timeout: config.timeout ?? 30000, // 30 seconds
    };

    // Initialize search index
    this.index = ElasticLunrIndex();
    this.setupIndex();

    this.cache = new LRUCache({
      max: this.config.cacheSize,
      ttl: this.config.cacheTTL,
    });

    this.logger.info('Log search engine initialized', {
      indexFields: this.config.indexFields,
      cacheSize: this.config.cacheSize,
    });
  }

  /**
   * Setup search index
   */
  private setupIndex(): void {
    // Add fields to index
    for (const field of this.config.indexFields) {
      this.index.addField(field);
    }

    // Set reference field
    this.index.setRef('id');
  }

  /**
   * Index log entries for searching
   */
  public indexEntries(entries: LogEntry[]): void {
    let addedCount = 0;

    for (const entry of entries) {
      this.addEntry(entry);
      addedCount++;
    }

    this.logger.debug('Indexed entries', { count: addedCount });
    this.emit('index:updated', { count: addedCount });
  }

  /**
   * Add a single entry to the index
   */
  private addEntry(entry: LogEntry): void {
    // Remove existing document if present
    if (this.entries.has(entry.id)) {
      this.index.removeDoc(entry.id);
    }

    // Store entry
    this.entries.set(entry.id, entry);

    // Add to search index
    const doc = this.buildSearchDocument(entry);
    this.index.addDoc(doc);
  }

  /**
   * Build search document from entry
   */
  private buildSearchDocument(entry: LogEntry): any {
    const doc: any = {
      id: entry.id,
    };

    for (const field of this.config.indexFields) {
      const value = this.getFieldValue(entry, field);
      if (value !== undefined) {
        doc[field] = typeof value === 'string' ? value : String(value);
      }
    }

    return doc;
  }

  /**
   * Get field value from entry
   */
  private getFieldValue(entry: LogEntry, field: string): any {
    const parts = field.split('.');
    let value: any = entry;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Remove entries from index
   */
  public removeEntries(entryIds: string[]): void {
    for (const id of entryIds) {
      this.index.removeDoc(id);
      this.entries.delete(id);
    }

    // Invalidate cache
    this.cache.clear();
  }

  /**
   * Search for log entries
   */
  public async search(query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();

    this.emit('search:started', { query });

    try {
      // Check cache
      const cacheKey = this.getCacheKey(query);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug('Cache hit', { query });
        return cached;
      }

      // Execute search
      let results = this.entries.values();

      // Apply filters
      if (query.filters && query.filters.length > 0) {
        results = this.applyFilters(results, query.filters);
      }

      // Apply full-text search
      if (query.query) {
        results = this.applyFullTextSearch(results, query.query);
      }

      // Apply level filter
      if (query.level !== undefined) {
        results = this.applyLevelFilter(results, query.level);
      }

      // Apply time range
      if (query.timeRange) {
        results = this.applyTimeRange(results, query.timeRange);
      }

      // Convert to array
      let entriesArray = Array.from(results);

      // Sort results
      entriesArray = this.sortResults(entriesArray, query.sortBy, query.sortOrder);

      // Apply pagination
      const total = entriesArray.length;
      const offset = query.offset ?? 0;
      const limit = query.limit ?? this.config.maxResults;

      const paginatedEntries = entriesArray.slice(offset, offset + limit);

      // Apply highlighting if requested
      let highlightedEntries = paginatedEntries;
      if (query.highlight && query.query) {
        highlightedEntries = paginatedEntries.map((entry) =>
          this.highlightEntry(entry, query.query!)
        );
      }

      const result: SearchResult = {
        entries: highlightedEntries,
        total,
        took: Date.now() - startTime,
      };

      // Cache result
      this.cache.set(cacheKey, result);

      this.emit('search:completed', { query, result });

      this.logger.debug('Search completed', {
        total,
        took: result.took,
        query: query.query,
      });

      return result;
    } catch (error) {
      this.logger.error('Search failed', error);
      this.emit('search:error', { query, error: error as Error });
      throw error;
    }
  }

  /**
   * Apply filters to results
   */
  private applyFilters(
    results: IterableIterator<LogEntry>,
    filters: LogFilter[]
  ): IterableIterator<LogEntry> {
    return (function* () {
      for (const entry of results) {
        if (this.matchesAllFilters(entry, filters)) {
          yield entry;
        }
      }
    }).call(this);
  }

  /**
   * Check if entry matches all filters
   */
  private matchesAllFilters(entry: LogEntry, filters: LogFilter[]): boolean {
    return filters.every((filter) => this.matchesFilter(entry, filter));
  }

  /**
   * Check if entry matches a filter
   */
  private matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
    const value = this.getFieldValue(entry, filter.field);

    switch (filter.operator) {
      case FilterOperator.EQUALS:
        return value === filter.value;

      case FilterOperator.NOT_EQUALS:
        return value !== filter.value;

      case FilterOperator.CONTAINS:
        return typeof value === 'string' && value.toLowerCase().includes(String(filter.value).toLowerCase());

      case FilterOperator.NOT_CONTAINS:
        return typeof value === 'string' && !value.toLowerCase().includes(String(filter.value).toLowerCase());

      case FilterOperator.STARTS_WITH:
        return typeof value === 'string' && value.toLowerCase().startsWith(String(filter.value).toLowerCase());

      case FilterOperator.ENDS_WITH:
        return typeof value === 'string' && value.toLowerCase().endsWith(String(filter.value).toLowerCase());

      case FilterOperator.GREATER_THAN:
        return typeof value === 'number' && value > filter.value;

      case FilterOperator.GREATER_THAN_OR_EQUAL:
        return typeof value === 'number' && value >= filter.value;

      case FilterOperator.LESS_THAN:
        return typeof value === 'number' && value < filter.value;

      case FilterOperator.LESS_THAN_OR_EQUAL:
        return typeof value === 'number' && value <= filter.value;

      case FilterOperator.IN:
        return Array.isArray(filter.value) && filter.value.includes(value);

      case FilterOperator.NOT_IN:
        return Array.isArray(filter.value) && !filter.value.includes(value);

      case FilterOperator.REGEX:
        try {
          const regex = new RegExp(filter.value, 'i');
          return typeof value === 'string' && regex.test(value);
        } catch {
          return false;
        }

      case FilterOperator.EXISTS:
        return value !== undefined && value !== null;

      case FilterOperator.NOT_EXISTS:
        return value === undefined || value === null;

      default:
        return false;
    }
  }

  /**
   * Apply full-text search
   */
  private applyFullTextSearch(
    results: IterableIterator<LogEntry>,
    query: string
  ): IterableIterator<LogEntry> {
    const searchResults = this.index.search(query, {
      fields: this.config.indexFields,
      expand: true,
    });

    const matchedIds = new Set(searchResults.map((r) => r.ref));

    return (function* () {
      for (const entry of results) {
        if (matchedIds.has(entry.id)) {
          yield entry;
        }
      }
    })();
  }

  /**
   * Apply level filter
   */
  private applyLevelFilter(
    results: IterableIterator<LogEntry>,
    level: LogLevel
  ): IterableIterator<LogEntry> {
    return (function* () {
      for (const entry of results) {
        if (entry.level === level) {
          yield entry;
        }
      }
    })();
  }

  /**
   * Apply time range filter
   */
  private applyTimeRange(
    results: IterableIterator<LogEntry>,
    timeRange: TimeRange
  ): IterableIterator<LogEntry> {
    return (function* () {
      for (const entry of results) {
        if (isWithinRange(entry.timestamp, timeRange.start, timeRange.end)) {
          yield entry;
        }
      }
    })();
  }

  /**
   * Sort results
   */
  private sortResults(
    entries: LogEntry[],
    sortBy?: SortField,
    sortOrder?: SortOrder
  ): LogEntry[] {
    if (!sortBy) {
      // Default sort by timestamp descending
      return entries.sort((a, b) => b.timestamp - a.timestamp);
    }

    const sorted = [...entries].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortBy) {
        case SortField.TIMESTAMP:
          aVal = a.timestamp;
          bVal = b.timestamp;
          break;
        case SortField.LEVEL:
          aVal = a.level;
          bVal = b.level;
          break;
        case SortField.SERVICE:
          aVal = a.service;
          bVal = b.service;
          break;
        case SortField.MESSAGE:
          aVal = a.message;
          bVal = b.message;
          break;
        default:
          aVal = a.timestamp;
          bVal = b.timestamp;
      }

      if (aVal < bVal) return sortOrder === SortOrder.ASC ? -1 : 1;
      if (aVal > bVal) return sortOrder === SortOrder.ASC ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  /**
   * Highlight matching terms in entry
   */
  private highlightEntry(entry: LogEntry, query: string): LogEntry {
    const terms = query.split(/\s+/).filter(Boolean);
    let highlightedMessage = entry.message;

    for (const term of terms) {
      const escapedTerm = escapeRegex(term);
      const regex = new RegExp(`(${escapedTerm})`, 'gi');
      highlightedMessage = highlightedMessage.replace(regex, '**$1**');
    }

    return {
      ...entry,
      message: highlightedMessage,
    };
  }

  /**
   * Generate cache key from query
   */
  private getCacheKey(query: SearchQuery): string {
    const parts = [
      query.query ?? '',
      JSON.stringify(query.filters ?? []),
      query.level?.toString() ?? '',
      query.timeRange?.start.toString() ?? '',
      query.timeRange?.end.toString() ?? '',
      query.sortBy ?? '',
      query.sortOrder ?? '',
      query.offset ?? 0,
      query.limit ?? 0,
    ];

    return parts.join('|');
  }

  /**
   * Clear the index
   */
  public clearIndex(): void {
    this.entries.clear();
    this.index = ElasticLunrIndex();
    this.setupIndex();
    this.cache.clear();

    this.logger.info('Search index cleared');
  }

  /**
   * Get search statistics
   */
  public getStats(): {
    indexedEntries: number;
    cacheSize: number;
    cacheHitRate: number;
    indexFields: string[];
  } {
    return {
      indexedEntries: this.entries.size,
      cacheSize: this.cache.size,
      cacheHitRate: 0, // Would need to track hits/misses
      indexFields: this.config.indexFields,
    };
  }

  /**
   * Faceted search - get unique values for a field
   */
  public getFacets(field: string, limit = 100): Map<string, number> {
    const counts = new Map<string, number>();

    for (const entry of this.entries.values()) {
      const value = this.getFieldValue(entry, field);
      const key = String(value ?? 'null');

      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    // Sort by count and limit
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    return new Map(sorted);
  }

  /**
   * Get suggestions for auto-complete
   */
  public getSuggestions(field: string, prefix: string, limit = 10): string[] {
    const suggestions = new Set<string>();

    for (const entry of this.entries.values()) {
      const value = String(this.getFieldValue(entry, field) ?? '');

      if (value.toLowerCase().startsWith(prefix.toLowerCase())) {
        suggestions.add(value);
      }

      if (suggestions.size >= limit) {
        break;
      }
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Get similar logs based on content
   */
  public getSimilarEntries(entryId: string, limit = 10): LogEntry[] {
    const entry = this.entries.get(entryId);
    if (!entry) {
      return [];
    }

    // Search for similar messages
    const words = entry.message.split(/\s+/).filter((w) => w.length > 4);
    const query = words.slice(0, 5).join(' ');

    const searchResults = this.index.search(query, {
      fields: ['message'],
      expand: true,
    });

    const similarIds = searchResults
      .filter((r) => r.ref !== entryId)
      .slice(0, limit)
      .map((r) => r.ref);

    return similarIds
      .map((id) => this.entries.get(id))
      .filter((e) => e !== undefined) as LogEntry[];
  }
}

/**
 * Create a log search engine instance
 */
export function createLogSearchEngine(config?: SearchEngineConfig): LogSearchEngine {
  return new LogSearchEngine(config);
}
