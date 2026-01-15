/**
 * Alert Manager
 * Manages alert rules, evaluation, and notification delivery
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  Alert,
  AlertRule,
  AlertCondition,
  AlertSeverity,
  AlertStatus,
  AlertHistoryEntry,
  NotificationChannel,
  NotificationConfig,
  Metric
} from '../types';

export class AlertManager {
  private rules: Map<string, AlertRule>;
  private alerts: Map<string, Alert>;
  private notificationChannels: Map<string, NotificationConfig>;
  private eventEmitter: EventEmitter;
  private evaluationInterval?: NodeJS.Timeout;

  constructor(evaluationInterval: number = 60000) {
    this.rules = new Map();
    this.alerts = new Map();
    this.notificationChannels = new Map();
    this.eventEmitter = new EventEmitter();

    // Start periodic evaluation
    this.startEvaluation(evaluationInterval);
  }

  /**
   * Create a new alert rule
   */
  createRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const alertRule: AlertRule = {
      id: uuidv4(),
      ...rule
    };

    this.rules.set(alertRule.id, alertRule);

    this.eventEmitter.emit('rule:created', alertRule);

    return alertRule;
  }

  /**
   * Update an existing rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): AlertRule | null {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return null;
    }

    const updatedRule = { ...rule, ...updates };
    this.rules.set(ruleId, updatedRule);

    this.eventEmitter.emit('rule:updated', updatedRule);

    return updatedRule;
  }

  /**
   * Delete a rule
   */
  deleteRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) {
      this.eventEmitter.emit('rule:deleted', { id: ruleId });
    }
    return deleted;
  }

  /**
   * Get a rule
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all rules
   */
  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get enabled rules
   */
  getEnabledRules(): AlertRule[] {
    return this.getAllRules().filter(rule => rule.enabled);
  }

  /**
   * Add a notification channel
   */
  addNotificationChannel(config: NotificationConfig): void {
    const channelId = `${config.type}-${Date.now()}`;
    this.notificationChannels.set(channelId, config);
    this.eventEmitter.emit('channel:added', { channelId, config });
  }

  /**
   * Remove a notification channel
   */
  removeNotificationChannel(channelId: string): boolean {
    const deleted = this.notificationChannels.delete(channelId);
    if (deleted) {
      this.eventEmitter.emit('channel:removed', { channelId });
    }
    return deleted;
  }

  /**
   * Evaluate a rule against metric data
   */
  evaluateRule(rule: AlertRule, metricValue: number): Alert | null {
    if (!rule.enabled) {
      return null;
    }

    const shouldFire = this.checkCondition(rule.condition, metricValue);

    if (shouldFire) {
      return this.fireAlert(rule, metricValue);
    }

    return null;
  }

  /**
   * Check if a condition is met
   */
  private checkCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case 'gt':
        return value > condition.threshold;
      case 'lt':
        return value < condition.threshold;
      case 'eq':
        return value === condition.threshold;
      case 'ne':
        return value !== condition.threshold;
      case 'gte':
        return value >= condition.threshold;
      case 'lte':
        return value <= condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Fire an alert
   */
  private fireAlert(rule: AlertRule, value: number): Alert {
    const existingAlert = this.findActiveAlert(rule.id);

    if (existingAlert) {
      // Update existing alert
      existingAlert.firingValue = value;
      existingAlert.history.push({
        timestamp: Date.now(),
        status: existingAlert.status,
        value,
        message: `Alert continues to fire for ${rule.name}`
      });

      this.eventEmitter.emit('alert:updated', existingAlert);
      return existingAlert;
    }

    // Create new alert
    const alert: Alert = {
      id: uuidv4(),
      name: rule.name,
      severity: rule.severity,
      status: 'firing',
      message: `${rule.name}: Value ${value} ${rule.condition.operator} ${rule.condition.threshold}`,
      metric: rule.condition.query,
      condition: rule.condition,
      timestamp: Date.now(),
      labels: rule.labels,
      annotations: rule.annotations,
      firingValue: value,
      threshold: rule.condition.threshold,
      history: [
        {
          timestamp: Date.now(),
          status: 'firing',
          value,
          message: `Alert fired for ${rule.name}`
        }
      ],
      notifications: []
    };

    this.alerts.set(alert.id, alert);

    // Send notifications
    this.sendNotifications(alert, rule.notificationChannels);

    this.eventEmitter.emit('alert:fired', alert);

    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): Alert | null {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status === 'resolved') {
      return null;
    }

    alert.status = 'resolved';
    alert.resolvedAt = Date.now();

    alert.history.push({
      timestamp: alert.resolvedAt,
      status: 'resolved',
      value: alert.firingValue,
      message: `Alert ${alert.name} resolved`
    });

    this.eventEmitter.emit('alert:resolved', alert);

    return alert;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): Alert | null {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== 'firing') {
      return null;
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = Date.now();

    alert.history.push({
      timestamp: alert.acknowledgedAt,
      status: 'acknowledged',
      value: alert.firingValue,
      message: `Alert ${alert.name} acknowledged`
    });

    this.eventEmitter.emit('alert:acknowledged', alert);

    return alert;
  }

  /**
   * Silence an alert
   */
  silenceAlert(alertId: string, duration: number): Alert | null {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return null;
    }

    alert.status = 'silenced';
    alert.silencedUntil = Date.now() + duration;

    alert.history.push({
      timestamp: Date.now(),
      status: 'silenced',
      value: alert.firingValue,
      message: `Alert ${alert.name} silenced for ${duration}ms`
    });

    this.eventEmitter.emit('alert:silenced', alert);

    return alert;
  }

  /**
   * Find an active alert for a rule
   */
  private findActiveAlert(ruleId: string): Alert | undefined {
    for (const alert of this.alerts.values()) {
      if (alert.status === 'firing' && alert.condition.query === this.rules.get(ruleId)?.condition.query) {
        return alert;
      }
    }
    return undefined;
  }

  /**
   * Send notifications for an alert
   */
  private sendNotifications(alert: Alert, channelIds: string[]): void {
    for (const channelId of channelIds) {
      const channel = this.notificationChannels.get(channelId);
      if (!channel || !channel.enabled) {
        continue;
      }

      const notification = {
        channel: channelId,
        status: 'sent' as const,
        timestamp: Date.now()
      };

      alert.notifications.push(notification);

      this.eventEmitter.emit('notification:sent', {
        alert,
        channel,
        timestamp: notification.timestamp
      });
    }
  }

  /**
   * Start periodic rule evaluation
   */
  private startEvaluation(interval: number): void {
    if (this.evaluationInterval) {
      return;
    }

    this.evaluationInterval = setInterval(() => {
      this.eventEmitter.emit('evaluation:tick');
    }, interval);
  }

  /**
   * Stop periodic evaluation
   */
  stopEvaluation(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = undefined;
    }
  }

  /**
   * Get an alert
   */
  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.getAllAlerts().filter(alert => alert.status === 'firing');
  }

  /**
   * Get alerts by status
   */
  getAlertsByStatus(status: AlertStatus): Alert[] {
    return this.getAllAlerts().filter(alert => alert.status === status);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return this.getAllAlerts().filter(alert => alert.severity === severity);
  }

  /**
   * Delete an alert
   */
  deleteAlert(alertId: string): boolean {
    const deleted = this.alerts.delete(alertId);
    if (deleted) {
      this.eventEmitter.emit('alert:deleted', { id: alertId });
    }
    return deleted;
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

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopEvaluation();
    this.rules.clear();
    this.alerts.clear();
    this.notificationChannels.clear();
    this.eventEmitter.removeAllListeners();
  }
}
