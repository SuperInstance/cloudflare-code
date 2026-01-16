// @ts-nocheck
/**
 * Deployment Monitoring and Observability
 * Provides real-time monitoring and alerting for deployments
 */

import {
  DeploymentMetrics,
  DeploymentTarget,
  HealthCheck,
  HealthCheckResult,
  MonitoringConfig,
  AlertConfig,
  MetricConfig,
} from '../types';
import { Logger } from '../utils/logger';

export interface DeploymentMonitorOptions {
  deploymentId: string;
  config?: MonitoringConfig;
  logger?: Logger;
}

export interface MonitoringEvent {
  timestamp: Date;
  deploymentId: string;
  eventType: 'deployment_started' | 'deployment_progress' | 'deployment_complete' | 'deployment_failed' | 'rollback_triggered';
  data: Record<string, any>;
}

export interface AlertTriggered {
  alertId: string;
  alertName: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: Date;
  deploymentId: string;
  message: string;
  metrics: Record<string, number>;
}

export class DeploymentMonitor {
  private deploymentId: string;
  private config: MonitoringConfig;
  private logger: Logger;
  private eventListeners: Map<string, (event: MonitoringEvent) => void> = new Map();
  private alertListeners: Map<string, (alert: AlertTriggered) => void> = new Map();
  private activeAlerts: Set<string> = new Set();
  private metricsHistory: Array<{ timestamp: Date; metrics: Partial<DeploymentMetrics> }> = [];

  constructor(options: DeploymentMonitorOptions) {
    this.deploymentId = options.deploymentId;
    this.config = options.config || this.getDefaultConfig();
    this.logger = options.logger || new Logger({ component: 'DeploymentMonitor' });
  }

  /**
   * Start monitoring deployment
   */
  async startMonitoring(): Promise<void> {
    this.logger.info('Starting deployment monitoring', {
      deploymentId: this.deploymentId,
    });

    this.emitEvent({
      timestamp: new Date(),
      deploymentId: this.deploymentId,
      eventType: 'deployment_started',
      data: {
        deploymentId: this.deploymentId,
      },
    });

    // Start metrics collection interval
    if (this.config.enabled) {
      setInterval(() => {
        this.collectMetrics();
      }, this.config.interval);
    }
  }

  /**
   * Record deployment progress
   */
  recordProgress(progress: {
    stage: string;
    percentage: number;
    targets?: DeploymentTarget[];
    healthChecks?: HealthCheckResult[];
  }): void {
    this.logger.debug('Recording deployment progress', {
      deploymentId: this.deploymentId,
      stage: progress.stage,
      percentage: progress.percentage,
    });

    this.emitEvent({
      timestamp: new Date(),
      deploymentId: this.deploymentId,
      eventType: 'deployment_progress',
      data: progress,
    });

    // Check alerts
    this.checkAlerts({
      stage: progress.stage,
      percentage: progress.percentage,
    });
  }

  /**
   * Record deployment completion
   */
  recordCompletion(result: {
    status: 'success' | 'failed';
    duration: number;
    metrics: DeploymentMetrics;
  }): void {
    this.logger.info('Recording deployment completion', {
      deploymentId: this.deploymentId,
      status: result.status,
      duration: result.duration,
    });

    this.emitEvent({
      timestamp: new Date(),
      deploymentId: this.deploymentId,
      eventType: result.status === 'success' ? 'deployment_complete' : 'deployment_failed',
      data: result,
    });

    // Clear active alerts on success
    if (result.status === 'success') {
      this.activeAlerts.clear();
    }
  }

  /**
   * Record rollback trigger
   */
  recordRollback(reason: string): void {
    this.logger.warn('Recording rollback triggered', {
      deploymentId: this.deploymentId,
      reason,
    });

    this.emitEvent({
      timestamp: new Date(),
      deploymentId: this.deploymentId,
      eventType: 'rollback_triggered',
      data: {
        reason,
      },
    });

    this.triggerAlert({
      alertId: 'rollback-triggered',
      alertName: 'Rollback Triggered',
      severity: 'critical',
      timestamp: new Date(),
      deploymentId: this.deploymentId,
      message: `Deployment rolled back: ${reason}`,
      metrics: {},
    });
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): void {
    // In a real implementation, this would collect metrics from various sources
    const metrics: Partial<DeploymentMetrics> = {
      deploymentId: this.deploymentId,
      startTime: new Date(),
    };

    this.metricsHistory.push({
      timestamp: new Date(),
      metrics,
    });

    // Keep only recent history based on retention setting
    const maxHistorySize = Math.floor(this.config.retention / this.config.interval);
    if (this.metricsHistory.length > maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-maxHistorySize);
    }
  }

  /**
   * Check alert conditions
   */
  private checkAlerts(currentMetrics: Record<string, number>): void {
    for (const alert of this.config.alerts) {
      const shouldTrigger = this.evaluateAlertCondition(alert.condition, currentMetrics);

      if (shouldTrigger && !this.activeAlerts.has(alert.id)) {
        this.activeAlerts.add(alert.id);

        this.triggerAlert({
          alertId: alert.id,
          alertName: alert.name,
          severity: alert.severity,
          timestamp: new Date(),
          deploymentId: this.deploymentId,
          message: `Alert triggered: ${alert.name}`,
          metrics: currentMetrics,
        });

        // Send notifications
        this.sendAlertNotifications(alert, currentMetrics);
      } else if (!shouldTrigger && this.activeAlerts.has(alert.id)) {
        this.activeAlerts.delete(alert.id);
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateAlertCondition(
    condition: string,
    metrics: Record<string, number>
  ): boolean {
    // Simple condition evaluation
    // In a real implementation, use a proper expression parser

    try {
      // Replace metric names with values
      let expression = condition;
      for (const [key, value] of Object.entries(metrics)) {
        expression = expression.replace(new RegExp(`\\b${key}\\b`, 'g'), value.toString());
      }

      // Evaluate expression (simplified - use proper parser in production)
      // eslint-disable-next-line no-new-func
      return new Function('return ' + expression)() as boolean;
    } catch {
      return false;
    }
  }

  /**
   * Trigger alert
   */
  private triggerAlert(alert: AlertTriggered): void {
    this.logger.warn('Alert triggered', {
      alertId: alert.alertId,
      alertName: alert.alertName,
      severity: alert.severity,
      message: alert.message,
    });

    for (const listener of this.alertListeners.values()) {
      try {
        listener(alert);
      } catch (error) {
        this.logger.error('Alert listener error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Send alert notifications
   */
  private sendAlertNotifications(
    alert: AlertConfig,
    metrics: Record<string, number>
  ): void {
    for (const notification of alert.notifications) {
      this.logger.info('Sending alert notification', {
        alertId: alert.id,
        notification,
      });

      // Implement notification sending
      this.sendNotification(notification, {
        alertName: alert.name,
        severity: alert.severity,
        deploymentId: this.deploymentId,
        metrics,
      });
    }
  }

  /**
   * Send notification
   */
  private sendNotification(
    channel: string,
    data: Record<string, any>
  ): void {
    // In a real implementation, this would send to various notification channels
    this.logger.debug('Sending notification', {
      channel,
      data,
    });
  }

  /**
   * Add event listener
   */
  onEvent(
    eventType: string,
    listener: (event: MonitoringEvent) => void
  ): void {
    this.eventListeners.set(eventType, listener);
  }

  /**
   * Add alert listener
   */
  onAlert(listener: (alert: AlertTriggered) => void): void {
    const listenerId = Math.random().toString(36).substr(2, 9);
    this.alertListeners.set(listenerId, listener);
  }

  /**
   * Remove event listener
   */
  offEvent(eventType: string): void {
    this.eventListeners.delete(eventType);
  }

  /**
   * Remove alert listener
   */
  offAlert(listenerId: string): void {
    this.alertListeners.delete(listenerId);
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: MonitoringEvent): void {
    const listener = this.eventListeners.get(event.eventType);
    if (listener) {
      try {
        listener(event);
      } catch (error) {
        this.logger.error('Event listener error', {
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): Array<{ timestamp: Date; metrics: Partial<DeploymentMetrics> }> {
    return [...this.metricsHistory];
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): string[] {
    return Array.from(this.activeAlerts);
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    deploymentId: string;
    monitoring: boolean;
    activeAlerts: number;
    metricsHistorySize: number;
  } {
    return {
      deploymentId: this.deploymentId,
      monitoring: this.config.enabled,
      activeAlerts: this.activeAlerts.size,
      metricsHistorySize: this.metricsHistory.length,
    };
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.logger.info('Stopping deployment monitoring', {
      deploymentId: this.deploymentId,
    });

    this.eventListeners.clear();
    this.alertListeners.clear();
  }

  /**
   * Get default monitoring configuration
   */
  private getDefaultConfig(): MonitoringConfig {
    return {
      enabled: true,
      interval: 10000,
      retention: 3600000, // 1 hour
      metrics: [
        {
          name: 'deployment_duration',
          type: 'gauge',
          description: 'Deployment duration in milliseconds',
          labels: ['deployment_id', 'environment'],
        },
        {
          name: 'deployment_status',
          type: 'gauge',
          description: 'Deployment status (0=failed, 1=success)',
          labels: ['deployment_id', 'environment'],
        },
        {
          name: 'health_check_total',
          type: 'counter',
          description: 'Total number of health checks',
          labels: ['deployment_id', 'status'],
        },
        {
          name: 'target_healthy',
          type: 'gauge',
          description: 'Number of healthy targets',
          labels: ['deployment_id'],
        },
      ],
      alerts: [
        {
          id: 'deployment-timeout',
          name: 'Deployment Timeout',
          condition: 'deployment_duration > 600000',
          severity: 'warning',
          notifications: ['slack', 'email'],
        },
        {
          id: 'high-failure-rate',
          name: 'High Failure Rate',
          condition: 'failure_rate > 50',
          severity: 'critical',
          notifications: ['slack', 'pagerduty'],
        },
        {
          id: 'unhealthy-targets',
          name: 'Unhealthy Targets',
          condition: 'unhealthy_targets > 0',
          severity: 'warning',
          notifications: ['slack'],
        },
      ],
    };
  }

  /**
   * Export monitoring data as JSON
   */
  exportData(): string {
    return JSON.stringify({
      deploymentId: this.deploymentId,
      metricsHistory: this.metricsHistory,
      activeAlerts: Array.from(this.activeAlerts),
      status: this.getStatus(),
    }, null, 2);
  }

  /**
   * Create monitoring dashboard URL
   */
  getDashboardUrl(): string {
    // In a real implementation, this would return a URL to a monitoring dashboard
    return `https://monitoring.claudeflare.com/deployments/${this.deploymentId}`;
  }
}
