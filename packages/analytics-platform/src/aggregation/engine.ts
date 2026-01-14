/**
 * Aggregation Engine
 * High-performance data aggregation with time-series support
 */

import type {
  AnalyticsEvent,
  AggregationConfig,
  AggregationMetric,
  AggregationOperation,
  AggregationGrouping,
  AggregationResult,
  TimeWindow,
} from '../types/index.js';

export interface AggregationEngineConfig {
  maxParallelAggregations: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  compressionEnabled: boolean;
  realtimeEnabled: boolean;
}

export interface TimeSeriesData {
  timestamp: number;
  value: number;
  dimensions: Record<string, any>;
}

export interface AggregationTask {
  id: string;
  config: AggregationConfig;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  result?: AggregationResult[];
  error?: string;
}

/**
 * Aggregation Engine - Main data aggregation system
 */
export class AggregationEngine {
  private config: AggregationEngineConfig;
  private tasks: Map<string, AggregationTask> = new Map();
  private cache: Map<string, CachedAggregation> = new Map();
  private timeSeriesData: Map<string, TimeSeriesData[]> = new Map();
  private metrics: AggregationMetrics;

  constructor(config: Partial<AggregationEngineConfig> = {}) {
    this.config = {
      maxParallelAggregations: 10,
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      compressionEnabled: true,
      realtimeEnabled: true,
      ...config,
    };

    this.metrics = this.createEmptyMetrics();
    this.startCacheCleanup();
  }

  /**
   * Aggregate events based on configuration
   */
  async aggregate(
    events: AnalyticsEvent[],
    config: AggregationConfig
  ): Promise<AggregationResult[]> {
    const task = this.createTask(config);
    this.tasks.set(task.id, task);

    try {
      task.status = 'running';
      task.startTime = Date.now();

      // Check cache
      const cacheKey = this.generateCacheKey(config);
      if (this.config.cacheEnabled) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
          task.status = 'completed';
          task.endTime = Date.now();
          task.result = cached.result;
          this.updateMetrics(task);
          return cached.result;
        }
      }

      // Perform aggregation
      const results = await this.performAggregation(events, config);

      // Cache results
      if (this.config.cacheEnabled) {
        this.cache.set(cacheKey, {
          timestamp: Date.now(),
          result: results,
        });
      }

      task.status = 'completed';
      task.endTime = Date.now();
      task.result = results;
      this.updateMetrics(task);

      return results;
    } catch (error) {
      task.status = 'failed';
      task.endTime = Date.now();
      task.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Perform the actual aggregation
   */
  private async performAggregation(
    events: AnalyticsEvent[],
    config: AggregationConfig
  ): Promise<AggregationResult[]> {
    // Filter events
    const filteredEvents = this.filterEvents(events, config.filters);

    // Group events
    const groups = this.groupEvents(filteredEvents, config);

    // Calculate metrics for each group
    const results: AggregationResult[] = [];
    for (const [key, groupEvents] of groups.entries()) {
      const dimensions = this.parseDimensionKey(key);
      const metrics = await this.calculateMetrics(groupEvents, config.metrics);

      results.push({
        timeWindow: this.getTimeWindowKey(config.timeWindow),
        dimensions,
        metrics,
        count: groupEvents.length,
      });
    }

    return results;
  }

  /**
   * Filter events based on filters
   */
  private filterEvents(
    events: AnalyticsEvent[],
    filters?: any[]
  ): AnalyticsEvent[] {
    if (!filters || filters.length === 0) {
      return events;
    }

    return events.filter((event) => {
      return filters.every((filter) => this.matchesFilter(event, filter));
    });
  }

  /**
   * Check if event matches filter
   */
  private matchesFilter(event: AnalyticsEvent, filter: any): boolean {
    const value = this.getFieldValue(event, filter.field);

    switch (filter.operator) {
      case 'equals':
        return value === filter.value;
      case 'not_equals':
        return value !== filter.value;
      case 'greater_than':
        return typeof value === 'number' && value > filter.value;
      case 'less_than':
        return typeof value === 'number' && value < filter.value;
      case 'contains':
        return typeof value === 'string' && value.includes(filter.value);
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      case 'not_in':
        return Array.isArray(filter.value) && !filter.value.includes(value);
      default:
        return true;
    }
  }

  /**
   * Get field value from event
   */
  private getFieldValue(event: AnalyticsEvent, field: string): any {
    const parts = field.split('.');
    let value: any = event;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Group events by dimensions
   */
  private groupEvents(
    events: AnalyticsEvent[],
    config: AggregationConfig
  ): Map<string, AnalyticsEvent[]> {
    const groups = new Map<string, AnalyticsEvent[]>();

    for (const event of events) {
      const key = this.getGroupKey(event, config);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }

    return groups;
  }

  /**
   * Get group key for event
   */
  private getGroupKey(event: AnalyticsEvent, config: AggregationConfig): string {
    if (!config.grouping || config.grouping.by.length === 0) {
      return 'default';
    }

    const parts: string[] = [];
    for (const dimension of config.grouping.by) {
      const value = this.getFieldValue(event, dimension);
      parts.push(`${dimension}=${value}`);
    }

    return parts.join('|');
  }

  /**
   * Parse dimension key
   */
  private parseDimensionKey(key: string): Record<string, any> {
    if (key === 'default') {
      return {};
    }

    const dimensions: Record<string, any> = {};
    const parts = key.split('|');

    for (const part of parts) {
      const [field, value] = part.split('=');
      dimensions[field] = value;
    }

    return dimensions;
  }

  /**
   * Calculate metrics for events
   */
  private async calculateMetrics(
    events: AnalyticsEvent[],
    metrics: AggregationMetric[]
  ): Promise<Record<string, number>> {
    const results: Record<string, number> = {};

    for (const metric of metrics) {
      const values = this.extractValues(events, metric.field);
      const alias = metric.alias || `${metric.field}_${metric.operations[0]}`;

      for (const operation of metric.operations) {
        const key = metric.operations.length > 1 ? `${alias}_${operation}` : alias;
        results[key] = this.applyOperation(values, operation);
      }
    }

    return results;
  }

  /**
   * Extract values from events
   */
  private extractValues(events: AnalyticsEvent[], field?: string): number[] {
    if (!field) {
      return [events.length]; // For count operations
    }

    const values: number[] = [];
    for (const event of events) {
      const value = this.getFieldValue(event, field);
      if (typeof value === 'number') {
        values.push(value);
      }
    }

    return values;
  }

  /**
   * Apply aggregation operation
   */
  private applyOperation(values: number[], operation: AggregationOperation): number {
    switch (operation) {
      case 'count':
        return values.length;
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'avg':
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      case 'min':
        return values.length > 0 ? Math.min(...values) : 0;
      case 'max':
        return values.length > 0 ? Math.max(...values) : 0;
      case 'stddev':
        return this.calculateStdDev(values);
      case 'variance':
        return this.calculateVariance(values);
      case 'percentile':
        return this.calculatePercentile(values, 95);
      case 'distinct_count':
        return new Set(values).size;
      default:
        return 0;
    }
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const variance = this.calculateVariance(values);
    return Math.sqrt(variance);
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get time window key
   */
  private getTimeWindowKey(window: TimeWindow): string {
    const now = new Date();

    switch (window) {
      case 'minute':
        return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
      case 'hour':
        return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}`;
      case 'day':
        return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        return `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
      case 'month':
        return `${now.getFullYear()}-${now.getMonth() + 1}`;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3) + 1;
        return `${now.getFullYear()}-Q${quarter}`;
      case 'year':
        return `${now.getFullYear()}`;
      default:
        return 'custom';
    }
  }

  /**
   * Create aggregation task
   */
  private createTask(config: AggregationConfig): AggregationTask {
    return {
      id: this.generateTaskId(),
      config,
      status: 'pending',
    };
  }

  /**
   * Generate task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(config: AggregationConfig): string {
    return JSON.stringify(config);
  }

  /**
   * Update metrics
   */
  private updateMetrics(task: AggregationTask): void {
    if (task.startTime && task.endTime) {
      this.metrics.totalAggregations++;
      this.metrics.totalAggregationTime += task.endTime - task.startTime;
    }
  }

  /**
   * Create empty metrics
   */
  private createEmptyMetrics(): AggregationMetrics {
    return {
      totalAggregations: 0,
      totalAggregationTime: 0,
      cacheHitRate: 0,
      avgAggregationTime: 0,
    };
  }

  /**
   * Start cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCache();
    }, 60000); // Every minute
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.config.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get metrics
   */
  getMetrics(): AggregationMetrics {
    return {
      ...this.metrics,
      avgAggregationTime:
        this.metrics.totalAggregations > 0
          ? this.metrics.totalAggregationTime / this.metrics.totalAggregations
          : 0,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): AggregationTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): AggregationTask[] {
    return Array.from(this.tasks.values());
  }
}

export interface AggregationMetrics {
  totalAggregations: number;
  totalAggregationTime: number;
  cacheHitRate: number;
  avgAggregationTime: number;
}

export interface CachedAggregation {
  timestamp: number;
  result: AggregationResult[];
}

/**
 * Time Series Aggregator
 */
export class TimeSeriesAggregator {
  private data: Map<string, TimeSeriesData[]> = new Map();

  /**
   * Add data point to time series
   */
  addPoint(seriesId: string, timestamp: number, value: number, dimensions?: Record<string, any>): void {
    if (!this.data.has(seriesId)) {
      this.data.set(seriesId, []);
    }

    this.data.get(seriesId)!.push({
      timestamp,
      value,
      dimensions: dimensions || {},
    });
  }

  /**
   * Aggregate time series data
   */
  aggregate(
    seriesId: string,
    window: TimeWindow,
    operation: AggregationOperation
  ): AggregationResult[] {
    const data = this.data.get(seriesId);
    if (!data || data.length === 0) {
      return [];
    }

    // Group by time window
    const groups = this.groupByTimeWindow(data, window);

    // Aggregate each group
    const results: AggregationResult[] = [];
    for (const [timeKey, points] of groups.entries()) {
      const values = points.map((p) => p.value);
      const dimensions = points[0]?.dimensions || {};

      results.push({
        timeWindow: timeKey,
        dimensions,
        metrics: {
          value: this.applyOperation(values, operation),
        },
        count: points.length,
      });
    }

    return results;
  }

  /**
   * Group data points by time window
   */
  private groupByTimeWindow(data: TimeSeriesData[], window: TimeWindow): Map<string, TimeSeriesData[]> {
    const groups = new Map<string, TimeSeriesData[]>();

    for (const point of data) {
      const timeKey = this.getTimeWindowKey(point.timestamp, window);
      if (!groups.has(timeKey)) {
        groups.set(timeKey, []);
      }
      groups.get(timeKey)!.push(point);
    }

    return groups;
  }

  /**
   * Get time window key for timestamp
   */
  private getTimeWindowKey(timestamp: number, window: TimeWindow): string {
    const date = new Date(timestamp);

    switch (window) {
      case 'minute':
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
      case 'hour':
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`;
      case 'day':
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
      case 'month':
        return `${date.getFullYear()}-${date.getMonth() + 1}`;
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `${date.getFullYear()}-Q${quarter}`;
      case 'year':
        return `${date.getFullYear()}`;
      default:
        return 'custom';
    }
  }

  /**
   * Apply aggregation operation
   */
  private applyOperation(values: number[], operation: AggregationOperation): number {
    switch (operation) {
      case 'count':
        return values.length;
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'avg':
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      case 'min':
        return values.length > 0 ? Math.min(...values) : 0;
      case 'max':
        return values.length > 0 ? Math.max(...values) : 0;
      default:
        return 0;
    }
  }

  /**
   * Get time series data
   */
  getSeries(seriesId: string): TimeSeriesData[] {
    return this.data.get(seriesId) || [];
  }

  /**
   * Clear time series data
   */
  clearSeries(seriesId: string): void {
    this.data.delete(seriesId);
  }

  /**
   * Get all series IDs
   */
  getSeriesIds(): string[] {
    return Array.from(this.data.keys());
  }
}

/**
 * Real-time Aggregator
 */
export class RealtimeAggregator {
  private windows: Map<string, RollingWindow> = new Map();
  private config: {
    windowSize: number;
    slideInterval: number;
  };

  constructor(windowSize = 60000, slideInterval = 10000) {
    this.config = {
      windowSize,
      slideInterval,
    };

    this.startSliding();
  }

  /**
   * Add event to real-time aggregation
   */
  addEvent(seriesId: string, event: AnalyticsEvent): void {
    if (!this.windows.has(seriesId)) {
      this.windows.set(seriesId, new RollingWindow(this.config.windowSize));
    }

    this.windows.get(seriesId)!.add(event);
  }

  /**
   * Get current aggregation for series
   */
  getAggregation(seriesId: string): AggregationResult | null {
    const window = this.windows.get(seriesId);
    if (!window) {
      return null;
    }

    const events = window.getEvents();
    const now = Date.now();

    return {
      timeWindow: new Date(now).toISOString(),
      dimensions: {},
      metrics: {
        count: events.length,
        uniqueUsers: new Set(events.map((e) => e.userId)).size,
      },
      count: events.length,
    };
  }

  /**
   * Start sliding windows
   */
  private startSliding(): void {
    setInterval(() => {
      this.slideWindows();
    }, this.config.slideInterval);
  }

  /**
   * Slide all windows forward
   */
  private slideWindows(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowSize;

    for (const [seriesId, window] of this.windows.entries()) {
      window.slide(cutoff);
    }
  }
}

/**
 * Rolling Window for real-time aggregation
 */
class RollingWindow {
  private events: AnalyticsEvent[] = [];
  private windowSize: number;

  constructor(windowSize: number) {
    this.windowSize = windowSize;
  }

  /**
   * Add event to window
   */
  add(event: AnalyticsEvent): void {
    this.events.push(event);
  }

  /**
   * Get events in window
   */
  getEvents(): AnalyticsEvent[] {
    return this.events;
  }

  /**
   * Slide window forward
   */
  slide(cutoffTimestamp: number): void {
    this.events = this.events.filter((e) => e.timestamp > cutoffTimestamp);
  }

  /**
   * Get window size
   */
  getSize(): number {
    return this.events.length;
  }
}
