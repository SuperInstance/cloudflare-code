/**
 * Alert Manager with Notification Channels
 *
 * Comprehensive alerting system with real-time evaluation, notification
 * channels, and integration with external services.
 *
 * Features:
 * - Configurable alert rules with conditions
 * - Multiple severity levels (info, warning, critical, emergency)
 * - Multiple notification channels (Slack, Email, PagerDuty, Webhook)
 * - Alert cooldown and deduplication
 * - Alert history and status tracking
 * - Alert acknowledgment and resolution
 * - Integration with Cloudflare Analytics
 */

import type {
  AlertRule,
  AlertCondition,
  NotificationChannel,
  NotificationChannelConfig,
  Alert,
  AlertSummary,
  MetricLabels,
} from './types';
import type { MetricsCollector } from './metrics';

/**
 * Alert Manager Configuration
 */
export interface AlertManagerConfig {
  evaluationInterval: number; // milliseconds
  defaultNotificationChannels: NotificationChannel[];
  maxAlerts: number;
}

/**
 * Alert Manager Class
 */
export class AlertManager {
  private rules: Map<string, AlertRule>;
  private activeAlerts: Map<string, Alert>;
  private alertHistory: Alert[];
  private config: AlertManagerConfig;
  private metricsCollector?: MetricsCollector;
  private evaluationTimer?: ReturnType<typeof setInterval>;

  constructor(
    config: Partial<AlertManagerConfig> = {},
    metricsCollector?: MetricsCollector
  ) {
    this.config = {
      evaluationInterval: config.evaluationInterval || 60000, // 1 minute
      defaultNotificationChannels: config.defaultNotificationChannels || [],
      maxAlerts: config.maxAlerts || 1000,
    };
    this.metricsCollector = metricsCollector;
    this.rules = new Map();
    this.activeAlerts = new Map();
    this.alertHistory = [];
  }

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Get an alert rule
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Update an alert rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    Object.assign(rule, updates);
  }

  /**
   * Enable an alert rule
   */
  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    rule.enabled = true;
  }

  /**
   * Disable an alert rule
   */
  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    rule.enabled = false;
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(
    condition: AlertCondition,
    metricValue: number
  ): boolean {
    switch (condition.operator) {
      case 'gt':
        return metricValue > condition.threshold;
      case 'lt':
        return metricValue < condition.threshold;
      case 'gte':
        return metricValue >= condition.threshold;
      case 'lte':
        return metricValue <= condition.threshold;
      case 'eq':
        return metricValue === condition.threshold;
      case 'ne':
        return metricValue !== condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Evaluate all rules
   */
  async evaluateRules(): Promise<Alert[]> {
    const triggeredAlerts: Alert[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      // Check cooldown
      if (
        rule.lastTriggered &&
        Date.now() - rule.lastTriggered < rule.cooldown
      ) {
        continue;
      }

      // Evaluate all conditions
      const results = await Promise.all(
        rule.conditions.map(async (condition) => {
          const metricValue = await this.getMetricValue(condition.metric);
          return this.evaluateCondition(condition, metricValue);
        })
      );

      // All conditions must be true to trigger
      const allConditionsMet = results.every((r) => r);

      if (allConditionsMet) {
        const alert = await this.triggerAlert(rule);
        triggeredAlerts.push(alert);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Trigger an alert
   */
  async triggerAlert(rule: AlertRule): Promise<Alert> {
    const alertId = `alert-${Date.now()}-${rule.id}`;

    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      status: 'firing',
      message: this.buildAlertMessage(rule),
      details: await this.buildAlertDetails(rule),
      triggeredAt: Date.now(),
      notificationStatus: new Map(),
    };

    // Store alert
    this.activeAlerts.set(alertId, alert);
    this.alertHistory.push(alert);

    // Update rule
    rule.lastTriggered = Date.now();
    rule.triggerCount++;

    // Enforce max alerts limit
    if (this.alertHistory.length > this.config.maxAlerts) {
      this.alertHistory = this.alertHistory.slice(-this.config.maxAlerts);
    }

    // Send notifications
    await this.sendNotifications(alert, rule);

    // Update metrics
    if (this.metricsCollector) {
      const alertCounter = this.metricsCollector.counter(
        'alerts_total',
        'Total number of alerts triggered',
        ['severity']
      );
      alertCounter(1, { severity: alert.severity });
    }

    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = 'resolved';
    alert.resolvedAt = Date.now();

    this.activeAlerts.delete(alertId);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = Date.now();
    alert.acknowledgedBy = acknowledgedBy;
  }

  /**
   * Get an active alert
   */
  getAlert(alertId: string): Alert | undefined {
    return this.activeAlerts.get(alertId);
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(filter?: {
    ruleId?: string;
    severity?: string;
    status?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Alert[] {
    let filtered = [...this.alertHistory];

    if (filter) {
      if (filter.ruleId) {
        filtered = filtered.filter((a) => a.ruleId === filter.ruleId);
      }

      if (filter.severity) {
        filtered = filtered.filter((a) => a.severity === filter.severity);
      }

      if (filter.status) {
        filtered = filtered.filter((a) => a.status === filter.status);
      }

      if (filter.startTime) {
        filtered = filtered.filter((a) => a.triggeredAt >= filter.startTime!);
      }

      if (filter.endTime) {
        filtered = filtered.filter((a) => a.triggeredAt <= filter.endTime!);
      }

      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  /**
   * Get alert summary
   */
  getAlertSummary(): AlertSummary {
    const activeAlerts = this.getActiveAlerts();
    const total = this.alertHistory.length;

    const bySeverity: Record<string, number> = {
      info: 0,
      warning: 0,
      critical: 0,
      emergency: 0,
    };

    const byStatus: Record<string, number> = {
      firing: 0,
      resolved: 0,
      acknowledged: 0,
    };

    for (const alert of this.alertHistory) {
      bySeverity[alert.severity]++;
      byStatus[alert.status]++;
    }

    return {
      total,
      bySeverity,
      byStatus,
      recent: this.getAlertHistory({ limit: 10 }),
    };
  }

  /**
   * Start automatic rule evaluation
   */
  startEvaluation(): void {
    if (this.evaluationTimer) {
      this.stopEvaluation();
    }

    this.evaluationTimer = setInterval(async () => {
      await this.evaluateRules();
    }, this.config.evaluationInterval);
  }

  /**
   * Stop automatic rule evaluation
   */
  stopEvaluation(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = undefined;
    }
  }

  /**
   * Get metric value for evaluation
   */
  private async getMetricValue(metricName: string): Promise<number> {
    if (!this.metricsCollector) {
      return 0;
    }

    // Parse metric name (e.g., "requests_total", "cache_hit_rate", etc.)
    // In a real implementation, you'd query the metrics collector
    // For now, we'll return 0 as a placeholder
    return 0;
  }

  /**
   * Build alert message
   */
  private buildAlertMessage(rule: AlertRule): string {
    return `[${rule.severity.toUpperCase()}] ${rule.name}: ${rule.description}`;
  }

  /**
   * Build alert details
   */
  private async buildAlertDetails(rule: AlertRule): Promise<Record<string, any>> {
    const details: Record<string, any> = {
      ruleId: rule.id,
      ruleName: rule.name,
      conditions: rule.conditions,
    };

    // Add current metric values
    for (const condition of rule.conditions) {
      const metricValue = await this.getMetricValue(condition.metric);
      details[condition.metric] = {
        current: metricValue,
        threshold: condition.threshold,
        operator: condition.operator,
      };
    }

    return details;
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(
    alert: Alert,
    rule: AlertRule
  ): Promise<void> {
    const channels = rule.notificationChannels.length > 0
      ? rule.notificationChannels
      : this.config.defaultNotificationChannels;

    for (const channel of channels) {
      if (!channel.enabled) {
        continue;
      }

      try {
        await this.sendNotification(alert, channel);
        alert.notificationStatus.set(channel.type, 'sent');
      } catch (error) {
        console.error(`Failed to send notification to ${channel.type}:`, error);
        alert.notificationStatus.set(channel.type, 'failed');
      }
    }
  }

  /**
   * Send notification to a specific channel
   */
  private async sendNotification(
    alert: Alert,
    channel: NotificationChannel
  ): Promise<void> {
    switch (channel.type) {
      case 'slack':
        await this.sendSlackNotification(alert, channel.config);
        break;
      case 'email':
        await this.sendEmailNotification(alert, channel.config);
        break;
      case 'pagerduty':
        await this.sendPagerDutyNotification(alert, channel.config);
        break;
      case 'webhook':
        await this.sendWebhookNotification(alert, channel.config);
        break;
      case 'cloudflare_analytics':
        await this.sendCloudflareNotification(alert, channel.config);
        break;
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(
    alert: Alert,
    config: NotificationChannelConfig
  ): Promise<void> {
    if (!config.webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const color = {
      info: '#36a64f',
      warning: '#ff9900',
      critical: '#ff0000',
      emergency: '#990000',
    }[alert.severity];

    const payload = {
      channel: config.channel,
      username: config.username || 'ClaudeFlare Alerts',
      icon_emoji: config.iconEmoji || ':warning:',
      attachments: [
        {
          color,
          title: alert.message,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Status',
              value: alert.status.toUpperCase(),
              short: true,
            },
            {
              title: 'Triggered At',
              value: new Date(alert.triggeredAt).toISOString(),
              short: true,
            },
            {
              title: 'Rule',
              value: alert.ruleName,
              short: true,
            },
          ],
          footer: 'ClaudeFlare Monitoring',
          ts: Math.floor(alert.triggeredAt / 1000),
        },
      ],
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    alert: Alert,
    config: NotificationChannelConfig
  ): Promise<void> {
    if (!config.to || config.to.length === 0) {
      throw new Error('Email recipients not configured');
    }

    // In Cloudflare Workers, you'd use Email API or a service like SendGrid
    // For now, we'll just log the notification
    console.log('Email notification:', {
      to: config.to,
      cc: config.cc,
      subject: config.subject || alert.message,
      body: JSON.stringify(alert, null, 2),
    });
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(
    alert: Alert,
    config: NotificationChannelConfig
  ): Promise<void> {
    if (!config.integrationKey) {
      throw new Error('PagerDuty integration key not configured');
    }

    const severity = {
      info: 'info',
      warning: 'warning',
      critical: 'critical',
      emergency: 'critical',
    }[alert.severity];

    const payload = {
      routing_key: config.integrationKey,
      event_action: 'trigger',
      payload: {
        summary: alert.message,
        severity: severity || 'warning',
        source: 'claudeflare',
        timestamp: new Date(alert.triggeredAt).toISOString(),
        custom_details: alert.details,
      },
    };

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`PagerDuty notification failed: ${response.statusText}`);
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    alert: Alert,
    config: NotificationChannelConfig
  ): Promise<void> {
    if (!config.url) {
      throw new Error('Webhook URL not configured');
    }

    const method = config.method || 'POST';
    const headers = config.headers || {};

    let body: string;
    if (config.bodyTemplate) {
      // Use custom template
      body = config.bodyTemplate
        .replace('{{alert_id}}', alert.id)
        .replace('{{alert_message}}', alert.message)
        .replace('{{alert_severity}}', alert.severity)
        .replace('{{alert_details}}', JSON.stringify(alert.details));
    } else {
      body = JSON.stringify(alert);
    }

    const response = await fetch(config.url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.statusText}`);
    }
  }

  /**
   * Send notification to Cloudflare Analytics
   */
  private async sendCloudflareNotification(
    alert: Alert,
    config: NotificationChannelConfig
  ): Promise<void> {
    // In a real implementation, this would send to Cloudflare Workers Analytics
    console.log('Cloudflare Analytics notification:', {
      dataset: config.dataset || 'alerts',
      alert,
    });
  }
}

/**
 * Create an alert manager
 */
export function createAlertManager(
  config?: Partial<AlertManagerConfig>,
  metricsCollector?: MetricsCollector
): AlertManager {
  return new AlertManager(config, metricsCollector);
}

/**
 * Create predefined alert rules
 */
export function createPredefinedAlertRules(): AlertRule[] {
  return [
    {
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'Error rate exceeds 5%',
      enabled: true,
      severity: 'critical',
      conditions: [
        {
          metric: 'error_rate',
          operator: 'gt',
          threshold: 0.05,
          duration: 300000, // 5 minutes
        },
      ],
      notificationChannels: [],
      cooldown: 600000, // 10 minutes
      triggerCount: 0,
    },
    {
      id: 'high-latency',
      name: 'High Latency',
      description: 'Request latency exceeds 1 second',
      enabled: true,
      severity: 'warning',
      conditions: [
        {
          metric: 'request_latency_p95',
          operator: 'gt',
          threshold: 1000,
          duration: 300000, // 5 minutes
        },
      ],
      notificationChannels: [],
      cooldown: 600000, // 10 minutes
      triggerCount: 0,
    },
    {
      id: 'low-cache-hit-rate',
      name: 'Low Cache Hit Rate',
      description: 'Cache hit rate drops below 50%',
      enabled: true,
      severity: 'warning',
      conditions: [
        {
          metric: 'cache_hit_rate',
          operator: 'lt',
          threshold: 0.5,
          duration: 600000, // 10 minutes
        },
      ],
      notificationChannels: [],
      cooldown: 1800000, // 30 minutes
      triggerCount: 0,
    },
    {
      id: 'high-cost',
      name: 'High Cost',
      description: 'Hourly cost exceeds budget',
      enabled: true,
      severity: 'critical',
      conditions: [
        {
          metric: 'cost_per_hour',
          operator: 'gt',
          threshold: 100, // $100 per hour
          duration: 3600000, // 1 hour
        },
      ],
      notificationChannels: [],
      cooldown: 3600000, // 1 hour
      triggerCount: 0,
    },
    {
      id: 'provider-down',
      name: 'Provider Down',
      description: 'AI provider is not responding',
      enabled: true,
      severity: 'emergency',
      conditions: [
        {
          metric: 'provider_up',
          operator: 'eq',
          threshold: 0,
          duration: 60000, // 1 minute
        },
      ],
      notificationChannels: [],
      cooldown: 300000, // 5 minutes
      triggerCount: 0,
    },
  ];
}

/**
 * Create notification channel
 */
export function createNotificationChannel(
  type: NotificationChannel['type'],
  config: NotificationChannelConfig,
  enabled: boolean = true
): NotificationChannel {
  return {
    type,
    config,
    enabled,
  };
}
