/**
 * Analytics Engine - Real-time analytics and metrics collection
 *
 * Features:
 * - Real-time metrics collection
 * - API usage analytics
 * - Performance monitoring
 * - Error tracking
 * - Custom dashboards
 * - Sub-millisecond overhead
 */

import {
  AnalyticsEvent,
  AnalyticsMetric,
  AnalyticsDashboard,
  DashboardWidget,
  AnalyticsQuery,
  EventType,
  WidgetType,
  AggregationType,
  QueryFilter,
  TimeRange,
  GatewayError,
} from '../types/index.js';
import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export interface AnalyticsEngineConfig {
  enabled: boolean;
  bufferSize: number;
  flushInterval: number;
  sampling: number;
  retention: {
    events: number; // milliseconds
    metrics: number; // milliseconds
  };
  aggregation: {
    enabled: boolean;
    interval: number;
  };
}

export interface MetricSummary {
  name: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  timestamp: number;
}

export interface TimeSeries {
  metric: string;
  dataPoints: TimeSeriesDataPoint[];
  aggregation?: AggregationType;
}

export interface TimeSeriesDataPoint {
  timestamp: number;
  value: number;
  dimensions?: Record<string, string>;
}

export interface AnalyticsReport {
  id: string;
  name: string;
  description?: string;
  queries: AnalyticsQuery[];
  schedule?: ReportSchedule;
  format: 'json' | 'csv' | 'pdf';
}

export interface ReportSchedule {
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  timezone: string;
  recipients: string[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: AnalyticsEngineConfig = {
  enabled: true,
  bufferSize: 10000,
  flushInterval: 10000,
  sampling: 1.0,
  retention: {
    events: 7 * 24 * 60 * 60 * 1000, // 7 days
    metrics: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  aggregation: {
    enabled: true,
    interval: 60000, // 1 minute
  },
};

// ============================================================================
// Metrics Store
// ============================================================================

interface MetricValue {
  value: number;
  timestamp: number;
  dimensions: Record<string, string>;
  tags?: string[];
}

interface EventValue {
  event: AnalyticsEvent;
  timestamp: number;
}

// ============================================================================
// Analytics Engine
// ============================================================================

export class AnalyticsEngine extends EventEmitter {
  private config: AnalyticsEngineConfig;
  private eventBuffer: AnalyticsEvent[];
  private metricBuffer: AnalyticsMetric[];
  private eventsStore: EventValue[];
  private metricsStore: Map<string, MetricValue[]>;
  private aggregatedMetrics: Map<string, MetricSummary>;
  private dashboards: Map<string, AnalyticsDashboard>;
  private flushTimer?: number;
  private aggregationTimer?: number;

  constructor(config: Partial<AnalyticsEngineConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventBuffer = [];
    this.metricBuffer = [];
    this.eventsStore = [];
    this.metricsStore = new Map();
    this.aggregatedMetrics = new Map();
    this.dashboards = new Map();

    if (this.config.enabled) {
      this.startTimers();
    }
  }

  /**
   * Record an event
   */
  recordEvent(event: AnalyticsEvent): void {
    if (!this.config.enabled) {
      return;
    }

    // Apply sampling
    if (Math.random() > this.config.sampling) {
      return;
    }

    // Add to buffer
    this.eventBuffer.push(event);

    // Emit for real-time processing
    this.emit('event', event);

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.config.bufferSize) {
      this.flush().catch((error) => {
        console.error('Failed to flush analytics buffer:', error);
      });
    }
  }

  /**
   * Record a metric
   */
  recordMetric(metric: AnalyticsMetric): void {
    if (!this.config.enabled) {
      return;
    }

    // Apply sampling
    if (Math.random() > this.config.sampling) {
      return;
    }

    // Add to buffer
    this.metricBuffer.push(metric);

    // Emit for real-time processing
    this.emit('metric', metric);

    // Flush if buffer is full
    if (this.metricBuffer.length >= this.config.bufferSize) {
      this.flush().catch((error) => {
        console.error('Failed to flush analytics buffer:', error);
      });
    }
  }

  /**
   * Record counter increment
   */
  increment(
    name: string,
    value: number = 1,
    dimensions?: Record<string, string>,
    tags?: string[]
  ): void {
    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      dimensions: dimensions || {},
      tags,
    });
  }

  /**
   * Record gauge value
   */
  gauge(
    name: string,
    value: number,
    dimensions?: Record<string, string>,
    tags?: string[]
  ): void {
    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      dimensions: dimensions || {},
      tags,
    });
  }

  /**
   * Record histogram value
   */
  histogram(
    name: string,
    value: number,
    dimensions?: Record<string, string>,
    tags?: string[]
  ): void {
    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      dimensions: dimensions || {},
      tags,
    });
  }

  /**
   * Record timing
   */
  timing(
    name: string,
    duration: number,
    dimensions?: Record<string, string>,
    tags?: string[]
  ): void {
    this.recordMetric({
      name: `${name}.duration`,
      value: duration,
      timestamp: Date.now(),
      dimensions: dimensions || {},
      tags,
    });
  }

  /**
   * Query events
   */
  queryEvents(query: AnalyticsQuery): AnalyticsEvent[] {
    const now = Date.now();
    const timeRange = query.timeRange || {
      start: now - this.config.retention.events,
      end: now,
    };

    let events = this.eventsStore.filter((e) => {
      const timestamp = e.timestamp || e.event.timestamp;
      return timestamp >= timeRange.start && timestamp <= timeRange.end;
    });

    // Apply filters
    if (query.filters) {
      events = this.applyFilters(events, query.filters);
    }

    // Apply aggregation
    if (query.aggregation) {
      return this.aggregateEvents(events, query.aggregation);
    }

    return events.map((e) => e.event);
  }

  /**
   * Query metrics
   */
  queryMetrics(query: AnalyticsQuery): TimeSeries {
    const metric = query.metric;
    const now = Date.now();
    const timeRange = query.timeRange || {
      start: now - this.config.retention.metrics,
      end: now,
    };

    const values = this.metricsStore.get(metric) || [];
    let filtered = values.filter((v) => {
      return v.timestamp >= timeRange.start && v.timestamp <= timeRange.end;
    });

    // Apply filters
    if (query.filters) {
      filtered = this.applyMetricFilters(filtered, query.filters);
    }

    // Group by time interval
    const interval = timeRange.interval || 60000;
    const grouped = this.groupByTime(filtered, interval, timeRange);

    // Apply aggregation
    const aggregated = this.applyAggregation(grouped, query.aggregation);

    return {
      metric,
      dataPoints: aggregated,
      aggregation: query.aggregation,
    };
  }

  /**
   * Create dashboard
   */
  createDashboard(dashboard: AnalyticsDashboard): void {
    this.dashboards.set(dashboard.id, dashboard);
    this.emit('dashboard-created', dashboard);
  }

  /**
   * Get dashboard
   */
  getDashboard(id: string): AnalyticsDashboard | undefined {
    return this.dashboards.get(id);
  }

  /**
   * List dashboards
   */
  listDashboards(): AnalyticsDashboard[] {
    return Array.from(this.dashboards.values());
  }

  /**
   * Update dashboard
   */
  updateDashboard(id: string, updates: Partial<AnalyticsDashboard>): boolean {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      return false;
    }

    const updated = { ...dashboard, ...updates };
    this.dashboards.set(id, updated);
    this.emit('dashboard-updated', updated);
    return true;
  }

  /**
   * Delete dashboard
   */
  deleteDashboard(id: string): boolean {
    const deleted = this.dashboards.delete(id);
    if (deleted) {
      this.emit('dashboard-deleted', id);
    }
    return deleted;
  }

  /**
   * Execute widget query
   */
  async executeWidget(dashboardId: string, widgetId: string): Promise<unknown> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new GatewayError('Dashboard not found', 'DASHBOARD_NOT_FOUND', 404);
    }

    const widget = dashboard.widgets.find((w) => w.id === widgetId);
    if (!widget) {
      throw new GatewayError('Widget not found', 'WIDGET_NOT_FOUND', 404);
    }

    return this.executeQuery(widget.query);
  }

  /**
   * Execute query
   */
  async executeQuery(query: AnalyticsQuery): Promise<unknown> {
    // Check if it's a metric or event query
    const isMetricQuery = this.metricsStore.has(query.metric);

    if (isMetricQuery) {
      return this.queryMetrics(query);
    } else {
      return this.queryEvents(query);
    }
  }

  /**
   * Get metric summary
   */
  getMetricSummary(metric: string): MetricSummary | undefined {
    return this.aggregatedMetrics.get(metric);
  }

  /**
   * Get all metric summaries
   */
  getAllMetricSummaries(): Map<string, MetricSummary> {
    return new Map(this.aggregatedMetrics);
  }

  /**
   * Flush buffers to storage
   */
  async flush(): Promise<void> {
    const eventsToFlush = [...this.eventBuffer];
    const metricsToFlush = [...this.metricBuffer];

    this.eventBuffer = [];
    this.metricBuffer = [];

    // Store events
    for (const event of eventsToFlush) {
      this.eventsStore.push({
        event,
        timestamp: event.timestamp,
      });
    }

    // Store metrics
    for (const metric of metricsToFlush) {
      const values = this.metricsStore.get(metric.name) || [];
      values.push({
        value: metric.value,
        timestamp: metric.timestamp,
        dimensions: metric.dimensions,
        tags: metric.tags,
      });
      this.metricsStore.set(metric.name, values);
    }

    // Clean up old data
    await this.cleanup();

    this.emit('flush', {
      events: eventsToFlush.length,
      metrics: metricsToFlush.length,
    });
  }

  /**
   * Shutdown engine
   */
  async shutdown(): Promise<void> {
    this.stopTimers();
    await this.flush();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private startTimers(): void {
    // Flush timer
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        console.error('Failed to flush analytics:', error);
      });
    }, this.config.flushInterval);

    // Aggregation timer
    if (this.config.aggregation.enabled) {
      this.aggregationTimer = setInterval(() => {
        this.aggregateMetrics().catch((error) => {
          console.error('Failed to aggregate metrics:', error);
        });
      }, this.config.aggregation.interval);
    }
  }

  private stopTimers(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
  }

  private async aggregateMetrics(): Promise<void> {
    const now = Date.now();

    for (const [metric, values] of this.metricsStore) {
      if (values.length === 0) {
        continue;
      }

      // Calculate summary statistics
      const numericValues = values.map((v) => v.value);
      const sorted = [...numericValues].sort((a, b) => a - b);

      const summary: MetricSummary = {
        name: metric,
        count: numericValues.length,
        sum: numericValues.reduce((a, b) => a + b, 0),
        avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        timestamp: now,
      };

      this.aggregatedMetrics.set(metric, summary);
    }
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    const eventCutoff = now - this.config.retention.events;
    const metricCutoff = now - this.config.retention.metrics;

    // Clean up old events
    this.eventsStore = this.eventsStore.filter((e) => {
      const timestamp = e.timestamp || e.event.timestamp;
      return timestamp > eventCutoff;
    });

    // Clean up old metrics
    for (const [metric, values] of this.metricsStore) {
      const filtered = values.filter((v) => v.timestamp > metricCutoff);
      this.metricsStore.set(metric, filtered);
    }
  }

  private applyFilters(
    events: EventValue[],
    filters: QueryFilter[]
  ): EventValue[] {
    return events.filter((e) => {
      const data = e.event.data;
      return filters.every((filter) => {
        const value = this.getNestedValue(data, filter.field);
        return this.matchFilter(value, filter);
      });
    });
  }

  private applyMetricFilters(
    values: MetricValue[],
    filters: QueryFilter[]
  ): MetricValue[] {
    return values.filter((v) => {
      return filters.every((filter) => {
        const value = this.getNestedValue(v.dimensions, filter.field);
        return this.matchFilter(value, filter);
      });
    });
  }

  private matchFilter(value: unknown, filter: QueryFilter): boolean {
    switch (filter.operator) {
      case 'eq':
        return value === filter.value;
      case 'ne':
        return value !== filter.value;
      case 'gt':
        return typeof value === 'number' && value > (filter.value as number);
      case 'lt':
        return typeof value === 'number' && value < (filter.value as number);
      case 'gte':
        return typeof value === 'number' && value >= (filter.value as number);
      case 'lte':
        return typeof value === 'number' && value <= (filter.value as number);
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      case 'contains':
        return typeof value === 'string' && value.includes(filter.value as string);
      default:
        return true;
    }
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const keys = path.split('.');
    let value: unknown = obj;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  private groupByTime(
    values: MetricValue[],
    interval: number,
    timeRange: TimeRange
  ): Map<number, MetricValue[]> {
    const grouped = new Map<number, MetricValue[]>();

    for (let time = timeRange.start; time < timeRange.end; time += interval) {
      grouped.set(time, []);
    }

    for (const value of values) {
      const bucket = Math.floor((value.timestamp - timeRange.start) / interval) * interval + timeRange.start;
      const bucketValues = grouped.get(bucket);
      if (bucketValues) {
        bucketValues.push(value);
      }
    }

    return grouped;
  }

  private applyAggregation(
    grouped: Map<number, MetricValue[]>,
    aggregation?: AggregationType
  ): TimeSeriesDataPoint[] {
    const result: TimeSeriesDataPoint[] = [];

    for (const [timestamp, values] of grouped) {
      let aggregatedValue: number;

      if (!aggregation || aggregation === 'avg' || values.length === 0) {
        aggregatedValue = values.reduce((sum, v) => sum + v.value, 0) / values.length;
      } else {
        switch (aggregation) {
          case 'sum':
            aggregatedValue = values.reduce((sum, v) => sum + v.value, 0);
            break;
          case 'min':
            aggregatedValue = Math.min(...values.map((v) => v.value));
            break;
          case 'max':
            aggregatedValue = Math.max(...values.map((v) => v.value));
            break;
          case 'count':
            aggregatedValue = values.length;
            break;
          case 'percentile':
            // Default to p95
            const sorted = [...values].sort((a, b) => a.value - b.value);
            aggregatedValue = sorted[Math.floor(sorted.length * 0.95)]?.value || 0;
            break;
          default:
            aggregatedValue = values.reduce((sum, v) => sum + v.value, 0) / values.length;
        }
      }

      result.push({
        timestamp,
        value: aggregatedValue,
      });
    }

    return result;
  }

  private aggregateEvents(
    events: EventValue[],
    aggregation: AggregationType
  ): AnalyticsEvent[] {
    // For events, we mainly count them
    const count = events.length;
    const firstEvent = events[0]?.event;

    return [
      {
        id: `aggregated_${Date.now()}`,
        timestamp: Date.now(),
        type: firstEvent?.type || ('aggregated' as EventType),
        data: {
          count,
          aggregation,
        },
        tags: firstEvent?.tags,
      },
    ];
  }
}

// ============================================================================
// Query Builder
// ============================================================================

export class QueryBuilder {
  private query: Partial<AnalyticsQuery> = {};

  metric(name: string): QueryBuilder {
    this.query.metric = name;
    return this;
  }

  filter(field: string, operator: QueryFilter['operator'], value: unknown): QueryBuilder {
    if (!this.query.filters) {
      this.query.filters = [];
    }
    this.query.filters.push({ field, operator, value });
    return this;
  }

  aggregation(type: AggregationType): QueryBuilder {
    this.query.aggregation = type;
    return this;
  }

  groupBy(...fields: string[]): QueryBuilder {
    this.query.groupBy = fields;
    return this;
  }

  timeRange(start: number, end: number, interval?: number): QueryBuilder {
    this.query.timeRange = { start, end, interval };
    return this;
  }

  lastMinutes(minutes: number): QueryBuilder {
    const now = Date.now();
    const start = now - minutes * 60 * 1000;
    return this.timeRange(start, now);
  }

  lastHours(hours: number): QueryBuilder {
    const now = Date.now();
    const start = now - hours * 60 * 60 * 1000;
    return this.timeRange(start, now);
  }

  build(): AnalyticsQuery {
    return {
      metric: this.query.metric || '',
      filters: this.query.filters || [],
      aggregation: this.query.aggregation,
      groupBy: this.query.groupBy,
      timeRange: this.query.timeRange,
    };
  }
}

// ============================================================================
// Dashboard Builder
// ============================================================================

export class DashboardBuilder {
  private dashboard: Partial<AnalyticsDashboard> = {};

  id(id: string): DashboardBuilder {
    this.dashboard.id = id;
    return this;
  }

  name(name: string): DashboardBuilder {
    this.dashboard.name = name;
    return this;
  }

  description(description: string): DashboardBuilder {
    this.dashboard.description = description;
    return this;
  }

  refreshInterval(interval: number): DashboardBuilder {
    this.dashboard.refreshInterval = interval;
    return this;
  }

  addWidget(widget: DashboardWidget): DashboardBuilder {
    if (!this.dashboard.widgets) {
      this.dashboard.widgets = [];
    }
    this.dashboard.widgets.push(widget);
    return this;
  }

  build(): AnalyticsDashboard {
    return {
      id: this.dashboard.id || '',
      name: this.dashboard.name || '',
      description: this.dashboard.description,
      widgets: this.dashboard.widgets || [],
      refreshInterval: this.dashboard.refreshInterval,
    };
  }
}

// ============================================================================
// Widget Builder
// ============================================================================

export class WidgetBuilder {
  private widget: Partial<DashboardWidget> = {};

  id(id: string): WidgetBuilder {
    this.widget.id = id;
    return this;
  }

  type(type: WidgetType): WidgetBuilder {
    this.widget.type = type;
    return this;
  }

  title(title: string): WidgetBuilder {
    this.widget.title = title;
    return this;
  }

  query(query: AnalyticsQuery): WidgetBuilder {
    this.widget.query = query;
    return this;
  }

  config(config: Partial<DashboardWidget['config']>): WidgetBuilder {
    this.widget.config = {
      height: config.height,
      width: config.width,
      options: config.options,
    };
    return this;
  }

  build(): DashboardWidget {
    return {
      id: this.widget.id || '',
      type: this.widget.type || 'line-chart',
      title: this.widget.title || '',
      query: this.widget.query || { metric: '' },
      config: this.widget.config || {},
    };
  }
}

// ============================================================================
// Real-time Analytics Stream
// ============================================================================

export class AnalyticsStream extends EventEmitter {
  private engine: AnalyticsEngine;
  private subscriptions: Map<string, Set<string>>;

  constructor(engine: AnalyticsEngine) {
    super();
    this.engine = engine;
    this.subscriptions = new Map();

    // Listen to engine events
    this.engine.on('event', (event) => this.handleEvent(event));
    this.engine.on('metric', (metric) => this.handleMetric(metric));
  }

  /**
   * Subscribe to metrics
   */
  subscribeMetrics(clientId: string, metrics: string[]): void {
    const clientSubs = this.subscriptions.get(clientId) || new Set();
    for (const metric of metrics) {
      clientSubs.add(metric);
    }
    this.subscriptions.set(clientId, clientSubs);
  }

  /**
   * Subscribe to all events
   */
  subscribeEvents(clientId: string): void {
    const clientSubs = this.subscriptions.get(clientId) || new Set();
    clientSubs.add('*');
    this.subscriptions.set(clientId, clientSubs);
  }

  /**
   * Unsubscribe client
   */
  unsubscribe(clientId: string): void {
    this.subscriptions.delete(clientId);
  }

  private handleEvent(event: AnalyticsEvent): void {
    this.emit('event', event);
  }

  private handleMetric(metric: AnalyticsMetric): void {
    // Check subscriptions
    for (const [clientId, subscriptions] of this.subscriptions) {
      if (subscriptions.has('*') || subscriptions.has(metric.name)) {
        this.emit('metric', { clientId, metric });
      }
    }
  }
}

// ============================================================================
// Analytics Reporter
// ============================================================================

export class AnalyticsReporter {
  private engine: AnalyticsEngine;
  private reports: Map<string, AnalyticsReport>;

  constructor(engine: AnalyticsEngine) {
    this.engine = engine;
    this.reports = new Map();
  }

  /**
   * Create report
   */
  createReport(report: AnalyticsReport): void {
    this.reports.set(report.id, report);
  }

  /**
   * Generate report
   */
  async generateReport(reportId: string): Promise<unknown> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new GatewayError('Report not found', 'REPORT_NOT_FOUND', 404);
    }

    const results = await Promise.all(
      report.queries.map((query) => this.engine.executeQuery(query))
    );

    return {
      report: {
        id: report.id,
        name: report.name,
        description: report.description,
        generatedAt: new Date().toISOString(),
      },
      results,
    };
  }

  /**
   * List reports
   */
  listReports(): AnalyticsReport[] {
    return Array.from(this.reports.values());
  }

  /**
   * Delete report
   */
  deleteReport(reportId: string): boolean {
    return this.reports.delete(reportId);
  }
}
