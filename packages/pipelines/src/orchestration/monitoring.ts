// @ts-nocheck
/**
 * Pipeline Monitoring
 * Monitors pipeline execution and generates alerts
 */

import type {
  MonitoringConfig,
  MetricConfig,
  AlertConfig,
  PipelineEvent,
  ExecutionMetrics
} from '../types';

export interface MetricValue {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
}

export interface Alert {
  id: string;
  alertId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export class PipelineMonitor {
  private config: MonitoringConfig;
  private metrics: Map<string, MetricValue[]> = new Map();
  private alerts: Alert[] = [];
  private eventHandlers: Map<string, Array<(event: PipelineEvent) => void>> = new Map();

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.initializeMetrics();
  }

  /**
   * Record metric value
   */
  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const metric: MetricValue = {
      name,
      value,
      labels: labels || {},
      timestamp: new Date()
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);

    // Retain only recent metrics (last 1000)
    const metrics = this.metrics.get(name)!;
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }

    // Check alerts
    this.checkAlerts(name, value, labels);
  }

  /**
   * Get metric values
   */
  getMetrics(name: string, since?: Date): MetricValue[] {
    const metrics = this.metrics.get(name) || [];

    if (since) {
      return metrics.filter(m => m.timestamp >= since);
    }

    return metrics;
  }

  /**
   * Get aggregated metric value
   */
  getMetricAggregation(
    name: string,
    aggregation: 'sum' | 'avg' | 'min' | 'max',
    since?: Date
  ): number {
    const metrics = this.getMetrics(name, since);

    if (metrics.length === 0) {
      return 0;
    }

    switch (aggregation) {
      case 'sum':
        return metrics.reduce((sum, m) => sum + m.value, 0);

      case 'avg':
        return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;

      case 'min':
        return Math.min(...metrics.map(m => m.value));

      case 'max':
        return Math.max(...metrics.map(m => m.value));

      default:
        return 0;
    }
  }

  /**
   * Record pipeline event
   */
  recordEvent(event: PipelineEvent): void {
    const handlers = this.eventHandlers.get(event.type) || [];

    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in event handler:', error);
      }
    }

    // Record metrics from event
    if (event.type === 'pipeline.completed' || event.type === 'transform.completed') {
      const data = event.data as any;
      if (data.metrics) {
        this.recordExecutionMetrics(data.metrics);
      }
    }
  }

  /**
   * Register event handler
   */
  on(eventType: string, handler: (event: PipelineEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }

    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Remove event handler
   */
  off(eventType: string, handler: (event: PipelineEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);

    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => {
      const age = Date.now() - a.timestamp.getTime();
      return age < 3600000; // 1 hour
    });
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * Clear old alerts
   */
  clearAlerts(olderThan: Date = new Date(Date.now() - 86400000)): void {
    this.alerts = this.alerts.filter(a => a.timestamp >= olderThan);
  }

  /**
   * Get monitoring dashboard data
   */
  getDashboardData(): DashboardData {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3600000);

    return {
      metrics: this.getMetricSummary(hourAgo),
      alerts: this.getActiveAlerts(),
      timestamp: now
    };
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): void {
    for (const metric of this.config.metrics) {
      this.metrics.set(metric.name, []);
    }
  }

  /**
   * Check alerts
   */
  private checkAlerts(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    for (const alert of this.config.alerts) {
      if (alert.condition.includes(name)) {
        // Evaluate condition
        const shouldAlert = this.evaluateAlertCondition(alert, name, value);

        if (shouldAlert) {
          const alertObj: Alert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            alertId: alert.id,
            severity: this.determineSeverity(value, alert.threshold),
            message: alert.name,
            metric: name,
            value,
            threshold: alert.threshold,
            timestamp: new Date()
          };

          this.alerts.push(alertObj);

          // Execute alert actions
          this.executeAlertActions(alert, alertObj);
        }
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateAlertCondition(alert: AlertConfig, name: string, value: number): boolean {
    // Simple threshold check
    // In production, use proper expression evaluation
    if (alert.condition.includes('>')) {
      return value > alert.threshold;
    } else if (alert.condition.includes('<')) {
      return value < alert.threshold;
    } else if (alert.condition.includes('==')) {
      return value === alert.threshold;
    }

    return false;
  }

  /**
   * Determine alert severity
   */
  private determineSeverity(value: number, threshold: number): 'info' | 'warning' | 'error' | 'critical' {
    const ratio = value / threshold;

    if (ratio > 2) {
      return 'critical';
    } else if (ratio > 1.5) {
      return 'error';
    } else if (ratio > 1.1) {
      return 'warning';
    }

    return 'info';
  }

  /**
   * Execute alert actions
   */
  private executeAlertActions(alert: AlertConfig, alertObj: Alert): void {
    for (const action of alert.actions) {
      this.executeAlertAction(action, alertObj);
    }
  }

  /**
   * Execute single alert action
   */
  private executeAlertAction(action: any, alert: Alert): void {
    switch (action.type) {
      case 'webhook':
        this.sendWebhookAlert(action.config.url, alert);
        break;

      case 'log':
        console.log(`[ALERT] ${alert.message}: ${alert.metric} = ${alert.value}`);
        break;

      case 'email':
        // Send email notification
        break;

      case 'slack':
        // Send Slack notification
        break;

      case 'pagerduty':
        // Create PagerDuty incident
        break;
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(url: string, alert: Alert): Promise<void> {
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }

  /**
   * Record execution metrics
   */
  private recordExecutionMetrics(metrics: ExecutionMetrics): void {
    this.recordMetric('pipeline.throughput', metrics.throughput);
    this.recordMetric('pipeline.latency', metrics.latency);
    this.recordMetric('pipeline.memory', metrics.memoryUsage);
    this.recordMetric('pipeline.cpu', metrics.cpuUsage);

    if (metrics.customMetrics) {
      for (const [name, value] of Object.entries(metrics.customMetrics)) {
        this.recordMetric(name, value as number);
      }
    }
  }

  /**
   * Get metric summary
   */
  private getMetricSummary(since: Date): MetricSummary[] {
    const summary: MetricSummary[] = [];

    for (const [name, _] of this.metrics) {
      summary.push({
        name,
        current: this.getMetricAggregation(name, 'avg', since),
        min: this.getMetricAggregation(name, 'min', since),
        max: this.getMetricAggregation(name, 'max', since),
        avg: this.getMetricAggregation(name, 'avg', since),
        sum: this.getMetricAggregation(name, 'sum', since)
      });
    }

    return summary;
  }
}

/**
 * Metric summary
 */
export interface MetricSummary {
  name: string;
  current: number;
  min: number;
  max: number;
  avg: number;
  sum: number;
}

/**
 * Dashboard data
 */
export interface DashboardData {
  metrics: MetricSummary[];
  alerts: Alert[];
  timestamp: Date;
}

/**
 * Metrics collector
 */
export class MetricsCollector {
  private monitor: PipelineMonitor;

  constructor(monitor: PipelineMonitor) {
    this.monitor = monitor;
  }

  /**
   * Collect pipeline metrics
   */
  collectPipelineMetrics(pipelineId: string, execution: any): void {
    const labels = { pipelineId };

    this.monitor.recordMetric('pipeline.records', execution.recordsProcessed || 0, labels);
    this.monitor.recordMetric('pipeline.errors', execution.recordsFailed || 0, labels);
    this.monitor.recordMetric('pipeline.duration', execution.duration || 0, labels);
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics(metrics: {
    memory: number;
    cpu: number;
    uptime: number;
  }): void {
    this.monitor.recordMetric('system.memory', metrics.memory);
    this.monitor.recordMetric('system.cpu', metrics.cpu);
    this.monitor.recordMetric('system.uptime', metrics.uptime);
  }

  /**
   * Collect custom metrics
   */
  collectCustomMetrics(name: string, value: number, labels?: Record<string, string>): void {
    this.monitor.recordMetric(name, value, labels);
  }
}

/**
 * Health checker
 */
export class HealthChecker {
  private checks: Map<string, HealthCheck> = new Map();

  /**
   * Register health check
   */
  register(name: string, check: HealthCheck): void {
    this.checks.set(name, check);
  }

  /**
   * Run all health checks
   */
  async checkAll(): Promise<HealthStatus> {
    const results = await Promise.all(
      Array.from(this.checks.entries()).map(async ([name, check]) => {
        try {
          await check.fn();
          return { name, status: 'healthy', message: check.message };
        } catch (error) {
          return {
            name,
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    const overall = results.every(r => r.status === 'healthy') ? 'healthy' : 'unhealthy';

    return {
      status: overall,
      checks: results,
      timestamp: new Date()
    };
  }

  /**
   * Run specific health check
   */
  async check(name: string): Promise<HealthCheckResult> {
    const check = this.checks.get(name);

    if (!check) {
      return {
        name,
        status: 'unknown',
        message: 'Health check not found'
      };
    }

    try {
      await check.fn();
      return { name, status: 'healthy', message: check.message };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Health check
 */
interface HealthCheck {
  fn: () => Promise<void>;
  message?: string;
}

/**
 * Health status
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  checks: HealthCheckResult[];
  timestamp: Date;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  message?: string;
}
