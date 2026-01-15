/**
 * SLI (Service Level Indicator) Tracker
 * Calculates and monitors service level indicators from metrics
 */

import { EventEmitter } from 'eventemitter3';
import { SLIMetric, SLIMetricType, SLIReport, Statistics } from '../types';

export class SLITracker {
  private indicators: Map<string, SLIMetric>;
  private eventEmitter: EventEmitter;
  private history: Map<string, SLIMetric[]>;
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 1000) {
    this.indicators = new Map();
    this.eventEmitter = new EventEmitter();
    this.history = new Map();
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Register a new SLI
   */
  registerSLI(sli: Omit<SLIMetric, 'goodEvents' | 'validEvents' | 'value' | 'timestamp'>): SLIMetric {
    const sliMetric: SLIMetric = {
      ...sli,
      goodEvents: 0,
      validEvents: 0,
      value: 0,
      timestamp: Date.now()
    };

    this.indicators.set(sli.name, sliMetric);
    this.addToHistory(sli.name, sliMetric);

    this.eventEmitter.emit('sli:registered', { name: sli.name, type: sli.type });

    return sliMetric;
  }

  /**
   * Record an event for an SLI
   */
  recordEvent(sliName: string, success: boolean, metadata?: Record<string, unknown>): void {
    const sli = this.indicators.get(sliName);
    if (!sli) {
      throw new Error(`SLI ${sliName} not found`);
    }

    sli.validEvents++;
    if (success) {
      sli.goodEvents++;
    }

    sli.value = sli.validEvents > 0 ? sli.goodEvents / sli.validEvents : 0;
    sli.timestamp = Date.now();

    this.addToHistory(sliName, sli);

    this.eventEmitter.emit('sli:event:recorded', {
      name: sliName,
      success,
      value: sli.value,
      metadata
    });
  }

  /**
   * Record multiple events
   */
  recordEvents(sliName: string, events: Array<{ success: boolean; metadata?: Record<string, unknown> }>): void {
    for (const event of events) {
      this.recordEvent(sliName, event.success, event.metadata);
    }
  }

  /**
   * Get an SLI
   */
  getSLI(name: string): SLIMetric | undefined {
    return this.indicators.get(name);
  }

  /**
   * Get all SLIs
   */
  getAllSLIs(): SLIMetric[] {
    return Array.from(this.indicators.values());
  }

  /**
   * Calculate SLI value from metric data
   */
  calculateSLI(
    name: string,
    type: SLIMetricType,
    goodEvents: number,
    validEvents: number,
    description?: string,
    query?: string
  ): SLIMetric {
    const sli: SLIMetric = {
      name,
      type,
      description: description || '',
      query: query || '',
      measurementWindow: 300000, // 5 minutes default
      aggregations: ['avg'],
      goodEvents,
      validEvents,
      value: validEvents > 0 ? goodEvents / validEvents : 0,
      timestamp: Date.now()
    };

    this.indicators.set(name, sli);
    this.addToHistory(name, sli);

    return sli;
  }

  /**
   * Calculate availability SLI
   */
  calculateAvailability(
    name: string,
    successfulRequests: number,
    totalRequests: number
  ): SLIMetric {
    return this.calculateSLI(
      name,
      'availability',
      successfulRequests,
      totalRequests,
      'Percentage of successful requests',
      'sum(rate(requests_total{status=~"2.."}[5m])) / sum(rate(requests_total[5m]))'
    );
  }

  /**
   * Calculate latency SLI
   */
  calculateLatency(
    name: string,
    fastRequests: number,
    totalRequests: number,
    threshold: number
  ): SLIMetric {
    const sli = this.calculateSLI(
      name,
      'latency',
      fastRequests,
      totalRequests,
      `Percentage of requests faster than ${threshold}ms`,
      `sum(rate(http_request_duration_seconds_bucket{le="${threshold}"}[5m])) / sum(rate(http_request_duration_seconds_count[5m]))`
    );

    sli.metadata = { threshold };

    return sli;
  }

  /**
   * Calculate error rate SLI
   */
  calculateErrorRate(
    name: string,
    errorRequests: number,
    totalRequests: number
  ): SLIMetric {
    const value = totalRequests > 0 ? 1 - (errorRequests / totalRequests) : 1;

    return this.calculateSLI(
      name,
      'error_rate',
      totalRequests - errorRequests,
      totalRequests,
      'Percentage of error-free requests',
      '1 - (sum(rate(requests_total{status=~"5.."}[5m])) / sum(rate(requests_total[5m])))'
    );
  }

  /**
   * Calculate throughput SLI
   */
  calculateThroughput(
    name: string,
    requests: number,
    window: number
  ): SLIMetric {
    const rate = requests / (window / 1000); // requests per second

    const sli: SLIMetric = {
      name,
      type: 'throughput',
      description: 'Requests per second',
      query: 'sum(rate(requests_total[5m]))',
      measurementWindow: window,
      aggregations: ['sum', 'rate'],
      goodEvents: requests,
      validEvents: requests,
      value: rate,
      timestamp: Date.now()
    };

    this.indicators.set(name, sli);
    this.addToHistory(name, sli);

    return sli;
  }

  /**
   * Calculate saturation SLI
   */
  calculateSaturation(
    name: string,
    current: number,
    capacity: number
  ): SLIMetric {
    const value = capacity > 0 ? current / capacity : 0;

    const sli: SLIMetric = {
      name,
      type: 'saturation',
      description: 'Resource utilization',
      query: 'avg(cpu_usage_percent)',
      measurementWindow: 300000,
      aggregations: ['avg'],
      goodEvents: capacity - current,
      validEvents: capacity,
      value,
      timestamp: Date.now()
    };

    this.indicators.set(name, sli);
    this.addToHistory(name, sli);

    return sli;
  }

  /**
   * Get SLI history
   */
  getHistory(name: string, limit?: number): SLIMetric[] {
    const history = this.history.get(name) || [];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get SLI statistics over time window
   */
  getStatistics(name: string, windowMs: number): Statistics | null {
    const history = this.history.get(name);
    if (!history || history.length === 0) {
      return null;
    }

    const now = Date.now();
    const cutoff = now - windowMs;
    const values = history
      .filter(sli => sli.timestamp >= cutoff)
      .map(sli => sli.value);

    if (values.length === 0) {
      return null;
    }

    values.sort((a, b) => a - b);

    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = sum / values.length;
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;

    return {
      count: values.length,
      sum,
      avg: mean,
      min: values[0],
      max: values[values.length - 1],
      median: values[Math.floor(values.length / 2)],
      p75: values[Math.floor(values.length * 0.75)],
      p90: values[Math.floor(values.length * 0.9)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
      stdDev: Math.sqrt(variance),
      variance
    };
  }

  /**
   * Generate SLI report
   */
  generateReport(): SLIReport {
    const metrics = this.getAllSLIs();
    const now = Date.now();

    const summary = {
      healthy: 0,
      warning: 0,
      critical: 0
    };

    let totalHealth = 0;

    for (const metric of metrics) {
      if (metric.value >= 0.95) {
        summary.healthy++;
        totalHealth += 100;
      } else if (metric.value >= 0.9) {
        summary.warning++;
        totalHealth += 70;
      } else {
        summary.critical++;
        totalHealth += 30;
      }
    }

    const overallHealth = metrics.length > 0 ? totalHealth / metrics.length : 0;

    return {
      timestamp: now,
      period: 300000, // 5 minutes
      metrics,
      overallHealth,
      summary
    };
  }

  /**
   * Reset an SLI
   */
  resetSLI(name: string): void {
    const sli = this.indicators.get(name);
    if (!sli) {
      throw new Error(`SLI ${name} not found`);
    }

    sli.goodEvents = 0;
    sli.validEvents = 0;
    sli.value = 0;
    sli.timestamp = Date.now();

    this.eventEmitter.emit('sli:reset', { name });
  }

  /**
   * Delete an SLI
   */
  deleteSLI(name: string): boolean {
    const deleted = this.indicators.delete(name);
    if (deleted) {
      this.history.delete(name);
      this.eventEmitter.emit('sli:deleted', { name });
    }
    return deleted;
  }

  /**
   * Clear all SLIs
   */
  clear(): void {
    this.indicators.clear();
    this.history.clear();
    this.eventEmitter.emit('slis:cleared');
  }

  /**
   * Add SLI to history
   */
  private addToHistory(name: string, sli: SLIMetric): void {
    if (!this.history.has(name)) {
      this.history.set(name, []);
    }

    const history = this.history.get(name)!;
    history.push({ ...sli });

    // Trim history if needed
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Register event listener
   */
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, listener);
  }
}
