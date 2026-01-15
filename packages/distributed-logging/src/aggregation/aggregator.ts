/**
 * Log Aggregator - Aggregates logs by various dimensions
 */

import EventEmitter from 'eventemitter3';
import LRUCache from 'lru-cache';
import { v4 as uuidv4 } from 'uuid';
import {
  LogEntry,
  AggregationType,
  AggregationConfig,
  AggregationResult,
  AggregationSummary,
  LogFilter,
  LogLevel,
  TimeRange,
} from '../types';
import { createLogger } from '../utils/logger';
import { chunk, average, now } from '../utils/helpers';

export interface AggregatorEvents {
  'aggregation:started': { type: AggregationType; key: string };
  'aggregation:completed': AggregationResult;
  'aggregation:error': { type: AggregationType; key: string; error: Error };
  'aggregation:expired': { type: AggregationType; key: string };
}

export interface AggregatorConfig {
  maxCacheSize?: number;
  maxAggregations?: number;
  defaultTTL?: number;
  autoExpire?: boolean;
  gcInterval?: number;
}

/**
 * Log Aggregator class
 */
export class LogAggregator extends EventEmitter<AggregatorEvents> {
  private logger = createLogger({ component: 'LogAggregator' });
  private aggregations: Map<string, AggregationData>;
  private cache: LRUCache<string, AggregationResult>;
  private config: Required<AggregatorConfig>;
  private gcTimer: NodeJS.Timeout | null = null;

  constructor(config: AggregatorConfig = {}) {
    super();

    this.config = {
      maxCacheSize: config.maxCacheSize ?? 10000,
      maxAggregations: config.maxAggregations ?? 1000,
      defaultTTL: config.defaultTTL ?? 3600000, // 1 hour
      autoExpire: config.autoExpire ?? true,
      gcInterval: config.gcInterval ?? 60000, // 1 minute
    };

    this.aggregations = new Map();
    this.cache = new LRUCache({
      max: this.config.maxCacheSize,
      ttl: this.config.defaultTTL,
    });

    if (this.config.autoExpire) {
      this.startGC();
    }

    this.logger.info('Log aggregator initialized', {
      maxCacheSize: this.config.maxCacheSize,
      maxAggregations: this.config.maxAggregations,
    });
  }

  /**
   * Add log entries to aggregations
   */
  public aggregate(entries: LogEntry[], configs: AggregationConfig[]): AggregationResult[] {
    const results: AggregationResult[] = [];

    for (const config of configs) {
      try {
        const result = this.processAggregation(entries, config);
        results.push(result);
        this.emit('aggregation:completed', result);
      } catch (error) {
        this.logger.error('Failed to process aggregation', error);
        this.emit('aggregation:error', {
          type: config.type,
          key: 'unknown',
          error: error as Error,
        });
      }
    }

    return results;
  }

  /**
   * Process a single aggregation
   */
  private processAggregation(entries: LogEntry[], config: AggregationConfig): AggregationResult {
    const key = this.generateAggregationKey(config);

    this.emit('aggregation:started', { type: config.type, key });

    // Filter entries if filters are provided
    let filteredEntries = entries;
    if (config.filters && config.filters.length > 0) {
      filteredEntries = this.filterEntries(entries, config.filters);
    }

    // Group entries based on aggregation type
    const groups = this.groupEntries(filteredEntries, config);

    // Calculate summary for each group
    const results: AggregationResult[] = [];

    for (const [groupKey, groupEntries] of groups.entries()) {
      const summary = this.calculateSummary(groupEntries);
      const result: AggregationResult = {
        key: groupKey,
        count: groupEntries.length,
        firstSeen: Math.min(...groupEntries.map((e) => e.timestamp)),
        lastSeen: Math.max(...groupEntries.map((e) => e.timestamp)),
        entries: groupEntries,
        summary,
      };

      results.push(result);

      // Store in cache
      const cacheKey = `${key}:${groupKey}`;
      this.cache.set(cacheKey, result);
    }

    // Store aggregation metadata
    this.storeAggregation(key, config, results.length);

    // Return first (or primary) result
    return results[0] ?? {
      key: 'empty',
      count: 0,
      firstSeen: now(),
      lastSeen: now(),
      entries: [],
    };
  }

  /**
   * Generate aggregation key from config
   */
  private generateAggregationKey(config: AggregationConfig): string {
    const parts = [config.type];

    if (config.windowSize) {
      parts.push(config.windowSize.toString());
    }

    if (config.groupBy) {
      parts.push(config.groupBy.join(','));
    }

    return parts.join(':');
  }

  /**
   * Filter entries based on filters
   */
  private filterEntries(entries: LogEntry[], filters: LogFilter[]): LogEntry[] {
    return entries.filter((entry) => this.matchesFilters(entry, filters));
  }

  /**
   * Check if entry matches all filters
   */
  private matchesFilters(entry: LogEntry, filters: LogFilter[]): boolean {
    return filters.every((filter) => this.matchesFilter(entry, filter));
  }

  /**
   * Check if entry matches a single filter
   */
  private matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
    const value = this.getFieldValue(entry, filter.field);

    switch (filter.operator) {
      case 'eq':
        return value === filter.value;
      case 'ne':
        return value !== filter.value;
      case 'contains':
        return typeof value === 'string' && value.includes(filter.value);
      case 'not_contains':
        return typeof value === 'string' && !value.includes(filter.value);
      case 'starts_with':
        return typeof value === 'string' && value.startsWith(filter.value);
      case 'ends_with':
        return typeof value === 'string' && value.endsWith(filter.value);
      case 'gt':
        return typeof value === 'number' && value > filter.value;
      case 'gte':
        return typeof value === 'number' && value >= filter.value;
      case 'lt':
        return typeof value === 'number' && value < filter.value;
      case 'lte':
        return typeof value === 'number' && value <= filter.value;
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      case 'not_in':
        return Array.isArray(filter.value) && !filter.value.includes(value);
      case 'regex':
        return typeof value === 'string' && new RegExp(filter.value).test(value);
      case 'exists':
        return value !== undefined && value !== null;
      case 'not_exists':
        return value === undefined || value === null;
      default:
        return false;
    }
  }

  /**
   * Get field value from entry using dot notation
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
   * Group entries based on aggregation type
   */
  private groupEntries(
    entries: LogEntry[],
    config: AggregationConfig
  ): Map<string, LogEntry[]> {
    const groups = new Map<string, LogEntry[]>();

    for (const entry of entries) {
      const key = this.getGroupKey(entry, config);

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(entry);
    }

    return groups;
  }

  /**
   * Get group key for an entry
   */
  private getGroupKey(entry: LogEntry, config: AggregationConfig): string {
    switch (config.type) {
      case AggregationType.TEMPORAL:
        return this.getTemporalKey(entry, config);

      case AggregationType.SERVICE:
        return entry.service;

      case AggregationType.TRACE:
        return entry.traceId ?? 'no-trace';

      case AggregationType.SESSION:
        return entry.context?.sessionId ?? 'no-session';

      case AggregationType.ERROR:
        return this.getErrorKey(entry);

      case AggregationType.CUSTOM:
        return this.getCustomKey(entry, config);

      default:
        return 'default';
    }
  }

  /**
   * Get temporal grouping key
   */
  private getTemporalKey(entry: LogEntry, config: AggregationConfig): string {
    const windowSize = config.windowSize ?? 3600000; // 1 hour default
    const timestamp = entry.timestamp;
    const window = Math.floor(timestamp / windowSize) * windowSize;
    return new Date(window).toISOString();
  }

  /**
   * Get error grouping key
   */
  private getErrorKey(entry: LogEntry): string {
    if (entry.error) {
      return `${entry.error.name}:${entry.error.code ?? 'unknown'}`;
    }
    if (entry.level >= LogLevel.ERROR) {
      return `error:${entry.message}`;
    }
    return 'no-error';
  }

  /**
   * Get custom grouping key
   */
  private getCustomKey(entry: LogEntry, config: AggregationConfig): string {
    if (!config.groupBy || config.groupBy.length === 0) {
      return 'default';
    }

    const parts: string[] = [];

    for (const field of config.groupBy) {
      const value = this.getFieldValue(entry, field);
      parts.push(String(value ?? 'null'));
    }

    return parts.join(':');
  }

  /**
   * Calculate summary statistics for a group of entries
   */
  private calculateSummary(entries: LogEntry[]): AggregationSummary {
    const errorCount = entries.filter((e) => e.level >= LogLevel.ERROR).length;
    const warningCount = entries.filter((e) => e.level === LogLevel.WARN).length;

    const uniqueUsers = new Set(
      entries.filter((e) => e.context?.userId).map((e) => e.context!.userId!)
    ).size;

    // Top services
    const serviceCounts = new Map<string, number>();
    for (const entry of entries) {
      serviceCounts.set(entry.service, (serviceCounts.get(entry.service) ?? 0) + 1);
    }
    const topServices = Array.from(serviceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([service, count]) => ({ service, count }));

    // Top errors
    const errorCounts = new Map<string, number>();
    for (const entry of entries) {
      if (entry.level >= LogLevel.ERROR) {
        const key = entry.error?.name ?? entry.message;
        errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
      }
    }
    const topErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));

    return {
      errorCount,
      warningCount,
      uniqueUsers,
      topServices,
      topErrors,
    };
  }

  /**
   * Store aggregation metadata
   */
  private storeAggregation(key: string, config: AggregationConfig, groupCount: number): void {
    const data: AggregationData = {
      key,
      config,
      groupCount,
      createdAt: now(),
      expiresAt: now() + (config.ttl ?? this.config.defaultTTL),
    };

    this.aggregations.set(key, data);

    // Enforce max aggregations limit
    if (this.aggregations.size > this.config.maxAggregations) {
      // Remove oldest aggregation
      const oldestKey = Array.from(this.aggregations.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt)
        [0][0];
      this.aggregations.delete(oldestKey);
    }
  }

  /**
   * Get aggregation result from cache
   */
  public getAggregation(type: AggregationType, key: string): AggregationResult | undefined {
    const cacheKey = `${type}:${key}`;
    return this.cache.get(cacheKey);
  }

  /**
   * Get multiple aggregation results
   */
  public getAggregations(type: AggregationType, keys: string[]): Map<string, AggregationResult> {
    const results = new Map<string, AggregationResult>();

    for (const key of keys) {
      const result = this.getAggregation(type, key);
      if (result) {
        results.set(key, result);
      }
    }

    return results;
  }

  /**
   * Get all aggregation keys for a type
   */
  public getAggregationKeys(type: AggregationType): string[] {
    const keys: string[] = [];

    for (const [key] of this.cache.entries()) {
      if (key.startsWith(`${type}:`)) {
        keys.push(key.substring(type.length + 1));
      }
    }

    return keys;
  }

  /**
   * Clear aggregation by type and key
   */
  public clearAggregation(type: AggregationType, key: string): boolean {
    const cacheKey = `${type}:${key}`;
    return this.cache.delete(cacheKey);
  }

  /**
   * Clear all aggregations of a type
   */
  public clearAggregations(type: AggregationType): number {
    let count = 0;

    for (const key of this.cache.keys()) {
      if (key.startsWith(`${type}:`)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all aggregations
   */
  public clearAll(): void {
    this.aggregations.clear();
    this.cache.clear();
  }

  /**
   * Get aggregator stats
   */
  public getStats(): {
    aggregationCount: number;
    cacheSize: number;
    cacheStats: {
      size: number;
      maxSize: number;
      calculatedSize: number;
      itemCount: number;
    };
  } {
    return {
      aggregationCount: this.aggregations.size,
      cacheSize: this.cache.size,
      cacheStats: {
        size: this.cache.size,
        maxSize: this.cache.max,
        calculatedSize: this.cache.calculatedSize,
        itemCount: this.cache.size,
      },
    };
  }

  /**
   * Start garbage collection
   */
  private startGC(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
    }

    this.gcTimer = setInterval(() => {
      this.runGC();
    }, this.config.gcInterval);
  }

  /**
   * Stop garbage collection
   */
  private stopGC(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }

  /**
   * Run garbage collection
   */
  private runGC(): void {
    const now = now();
    let expiredCount = 0;

    for (const [key, data] of this.aggregations.entries()) {
      if (data.expiresAt <= now) {
        this.clearAggregations(data.config.type);
        this.aggregations.delete(key);
        expiredCount++;

        this.emit('aggregation:expired', {
          type: data.config.type,
          key: data.key,
        });
      }
    }

    if (expiredCount > 0) {
      this.logger.debug('Expired aggregations', { count: expiredCount });
    }
  }

  /**
   * Reconstruct session from logs
   */
  public reconstructSession(sessionId: string): LogEntry[] {
    const entries: LogEntry[] = [];

    for (const [key, result] of this.cache.entries()) {
      if (key.startsWith(`${AggregationType.SESSION}:`)) {
        const sessionKey = key.substring(AggregationType.SESSION.length + 1);
        if (sessionKey === sessionId) {
          entries.push(...result.entries);
        }
      }
    }

    // Sort by timestamp
    return entries.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Reconstruct trace from logs
   */
  public reconstructTrace(traceId: string): LogEntry[] {
    const entries: LogEntry[] = [];

    for (const [key, result] of this.cache.entries()) {
      if (key.startsWith(`${AggregationType.TRACE}:`)) {
        const traceKey = key.substring(AggregationType.TRACE.length + 1);
        if (traceKey === traceId) {
          entries.push(...result.entries);
        }
      }
    }

    // Sort by timestamp
    return entries.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get trace statistics
   */
  public getTraceStats(traceId: string): {
    entryCount: number;
    spanCount: number;
    services: string[];
    duration: number;
    errorCount: number;
  } | null {
    const entries = this.reconstructTrace(traceId);

    if (entries.length === 0) {
      return null;
    }

    const spans = new Set(entries.map((e) => e.spanId).filter(Boolean));
    const services = Array.from(new Set(entries.map((e) => e.service)));
    const timestamps = entries.map((e) => e.timestamp);
    const errorCount = entries.filter((e) => e.level >= LogLevel.ERROR).length;

    return {
      entryCount: entries.length,
      spanCount: spans.size,
      services,
      duration: Math.max(...timestamps) - Math.min(...timestamps),
      errorCount,
    };
  }

  /**
   * Shutdown the aggregator
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down log aggregator');
    this.stopGC();
    this.clearAll();
    this.logger.info('Log aggregator shutdown complete');
  }
}

interface AggregationData {
  key: string;
  config: AggregationConfig;
  groupCount: number;
  createdAt: number;
  expiresAt: number;
}

/**
 * Create a log aggregator instance
 */
export function createLogAggregator(config?: AggregatorConfig): LogAggregator {
  return new LogAggregator(config);
}
