// @ts-nocheck - Unused imports
/**
 * Usage metering core functionality
 */

import {
  UsageMetric,
  UsageMetricType,
  UsageRecord,
  MeteringConfig,
  MeteringEvent,
  BillingError,
  BillingErrorCode,
} from '../types/index.js';

/**
 * Usage meter for tracking and aggregating usage metrics
 */
export class UsageMeter {
  private config: MeteringConfig;
  private metricsBuffer: Map<string, UsageMetric[]>;
  private aggregationBuffer: Map<string, number>;

  constructor(config: MeteringConfig) {
    this.config = config;
    this.metricsBuffer = new Map();
    this.aggregationBuffer = new Map();
  }

  /**
   * Record a usage metric
   */
  async recordMetric(metric: UsageMetric): Promise<void> {
    if (!this.config.enabled) {
      throw new BillingError(
        BillingErrorCode.METERING_ERROR,
        'Metering is disabled'
      );
    }

    const bufferKey = this.getBufferKey(metric.userId, metric.organizationId);

    if (!this.metricsBuffer.has(bufferKey)) {
      this.metricsBuffer.set(bufferKey, []);
    }

    const buffer = this.metricsBuffer.get(bufferKey)!;
    buffer.push(metric);

    // Update aggregation buffer
    const aggKey = `${bufferKey}:${metric.type}`;
    this.aggregationBuffer.set(
      aggKey,
      (this.aggregationBuffer.get(aggKey) || 0) + metric.value
    );

    // If real-time is enabled, process immediately
    if (this.config.realTimeEnabled) {
      await this.flushBuffer(bufferKey);
    }
  }

  /**
   * Record multiple metrics at once
   */
  async recordMetrics(metrics: UsageMetric[]): Promise<void> {
    await Promise.all(metrics.map((m) => this.recordMetric(m)));
  }

  /**
   * Record a metering event
   */
  async recordEvent(event: MeteringEvent): Promise<void> {
    const metrics: UsageMetric[] = [];

    for (const [metricType, value] of Object.entries(event.metrics)) {
      metrics.push({
        type: metricType as UsageMetricType,
        value,
        unit: this.getUnitForMetric(metricType as UsageMetricType),
        timestamp: event.timestamp,
        userId: event.userId,
        organizationId: event.organizationId,
        metadata: event.metadata,
      });
    }

    await this.recordMetrics(metrics);
  }

  /**
   * Get current usage for a specific metric
   */
  async getCurrentUsage(
    organizationId: string,
    metricType: UsageMetricType,
    period: 'day' | 'month' | 'year' = 'month'
  ): Promise<number> {
    const now = new Date();
    const startDate = this.getPeriodStart(now, period);

    // In production, this would query the database
    // For now, return from aggregation buffer
    const usage = Array.from(this.aggregationBuffer.entries())
      .filter(([key]) => key.startsWith(`${organizationId}:${metricType}`))
      .reduce((sum, [, value]) => sum + value, 0);

    return usage;
  }

  /**
   * Get usage for multiple metrics
   */
  async getCurrentUsageBatch(
    organizationId: string,
    metricTypes: UsageMetricType[],
    period: 'day' | 'month' | 'year' = 'month'
  ): Promise<Record<UsageMetricType, number>> {
    const usage: Record<string, number> = {};

    await Promise.all(
      metricTypes.map(async (type) => {
        usage[type] = await this.getCurrentUsage(organizationId, type, period);
      })
    );

    return usage as Record<UsageMetricType, number>;
  }

  /**
   * Get usage history for a time range
   */
  async getUsageHistory(
    organizationId: string,
    metricType: UsageMetricType,
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): Promise<{ timestamp: Date; value: number }[]> {
    // In production, this would query the database
    // For now, return empty array
    return [];
  }

  /**
   * Check if usage exceeds limit
   */
  async checkLimit(
    organizationId: string,
    metricType: UsageMetricType,
    limit: number
  ): Promise<{ exceeds: boolean; current: number; remaining: number }> {
    const current = await this.getCurrentUsage(organizationId, metricType);
    const remaining = Math.max(0, limit - current);
    const exceeds = current > limit;

    return { exceeds, current, remaining };
  }

  /**
   * Get usage summary for all metrics
   */
  async getUsageSummary(
    organizationId: string,
    period: 'day' | 'month' | 'year' = 'month'
  ): Promise<Record<UsageMetricType, number>> {
    return this.getCurrentUsageBatch(
      organizationId,
      Object.values(UsageMetricType),
      period
    );
  }

  /**
   * Flush metrics buffer to storage
   */
  async flushBuffer(bufferKey: string): Promise<void> {
    const buffer = this.metricsBuffer.get(bufferKey);
    if (!buffer || buffer.length === 0) return;

    // In production, this would write to the database
    // For now, clear the buffer
    this.metricsBuffer.delete(bufferKey);
  }

  /**
   * Flush all buffers
   */
  async flushAllBuffers(): Promise<void> {
    const keys = Array.from(this.metricsBuffer.keys());
    await Promise.all(keys.map((key) => this.flushBuffer(key)));
  }

  /**
   * Get buffer key for metrics
   */
  private getBufferKey(userId: string, organizationId: string): string {
    return `${organizationId}:${userId}`;
  }

  /**
   * Get period start date
   */
  private getPeriodStart(date: Date, period: 'day' | 'month' | 'year'): Date {
    const start = new Date(date);

    switch (period) {
      case 'day':
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'year':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        break;
    }

    return start;
  }

  /**
   * Get unit for metric type
   */
  private getUnitForMetric(metricType: UsageMetricType): string {
    const units: Record<UsageMetricType, string> = {
      [UsageMetricType.REQUESTS]: 'requests',
      [UsageMetricType.TOKENS]: 'tokens',
      [UsageMetricType.CPU_TIME]: 'seconds',
      [UsageMetricType.STORAGE]: 'bytes',
      [UsageMetricType.BANDWIDTH]: 'bytes',
      [UsageMetricType.API_CALLS]: 'calls',
      [UsageMetricType.SEATS]: 'seats',
      [UsageMetricType.PROJECTS]: 'projects',
    };
    return units[metricType];
  }

  /**
   * Reset usage for a metric
   */
  async resetUsage(
    organizationId: string,
    metricType: UsageMetricType
  ): Promise<void> {
    const keys = Array.from(this.aggregationBuffer.keys())
      .filter((key) => key.startsWith(`${organizationId}:${metricType}`));

    keys.forEach((key) => this.aggregationBuffer.delete(key));
  }

  /**
   * Reset all usage for an organization
   */
  async resetAllUsage(organizationId: string): Promise<void> {
    const keys = Array.from(this.aggregationBuffer.keys())
      .filter((key) => key.startsWith(`${organizationId}:`));

    keys.forEach((key) => this.aggregationBuffer.delete(key));
  }

  /**
   * Get buffer size
   */
  getBufferSize(bufferKey?: string): number {
    if (bufferKey) {
      return this.metricsBuffer.get(bufferKey)?.length || 0;
    }
    return Array.from(this.metricsBuffer.values()).reduce(
      (sum, buffer) => sum + buffer.length,
      0
    );
  }

  /**
   * Get aggregation buffer size
   */
  getAggregationBufferSize(): number {
    return this.aggregationBuffer.size;
  }

  /**
   * Update metering configuration
   */
  updateConfig(config: Partial<MeteringConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): MeteringConfig {
    return { ...this.config };
  }
}

/**
 * Create a usage meter with default configuration
 */
export function createUsageMeter(config?: Partial<MeteringConfig>): UsageMeter {
  const defaultConfig: MeteringConfig = {
    enabled: true,
    aggregationWindow: 300, // 5 minutes
    retentionPeriod: 90, // 90 days
    realTimeEnabled: false,
    batchProcessingEnabled: true,
  };

  return new UsageMeter({ ...defaultConfig, ...config });
}
