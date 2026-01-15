import { Observable, ObservableConfig } from '../core/Observable';
import {
  AlertRule,
  Alert,
  AlertCondition,
  AlertConditionType,
  AlertOperator,
  AlertAggregation,
  AlertSeverity,
  AlertStatus,
  AlertAction,
  AlertActionType,
  NotificationConfig,
  AlertEscalationPolicy,
  EscalationLevel,
  AlertingHistory
} from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Alerting Service with advanced alerting and notification capabilities
 */
export class AlertingService extends Observable {
  private config: ObservableConfig;
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: AlertingHistory[] = [];
  private escalationPolicies: Map<string, AlertEscalationPolicy> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private lastCheckTime: number = 0;

  constructor(config: ObservableConfig = {}) {
    super(config);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Set up periodic alert checking
      this.checkInterval = setInterval(() => {
        this.checkAllRules();
      }, 30000); // Check every 30 seconds

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize AlertingService:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.initialized) return;

    // Clear check interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.initialized = false;
  }

  async export(): Promise<any> {
    this.ensureInitialized();

    try {
      return {
        success: true,
        exported: 1,
        duration: 0,
        alertingData: {
          rules: Array.from(this.rules.values()),
          activeAlerts: Array.from(this.activeAlerts.values()),
          history: this.alertHistory.slice(-100), // Last 100 entries
          escalationPolicies: Array.from(this.escalationPolicies.values())
        }
      };
    } catch (error) {
      return this.handleExportError(error as Error);
    }
  }

  /**
   * Create a new alert rule
   */
  createRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const newRule: AlertRule = {
      id: uuidv4(),
      ...rule
    };

    this.rules.set(newRule.id, newRule);
    return newRule;
  }

  /**
   * Update an existing alert rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): AlertRule | null {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    const updatedRule = { ...rule, ...updates };
    this.rules.set(ruleId, updatedRule);
    return updatedRule;
  }

  /**
   * Delete an alert rule
   */
  deleteRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Get an alert rule
   */
  getRule(ruleId: string): AlertRule | null {
    return this.rules.get(ruleId) || null;
  }

  /**
   * Get all alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Enable an alert rule
   */
  enableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    rule.enabled = true;
    return true;
  }

  /**
   * Disable an alert rule
   */
  disableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    rule.enabled = false;
    return true;
  }

  /**
   * Create escalation policy
   */
  createEscalationPolicy(policy: AlertEscalationPolicy): void {
    this.escalationPolicies.set(policy.levels[0].actions[0].config.recipients![0], policy);
  }

  /**
   * Get escalation policy
   */
  getEscalationPolicy(recipient: string): AlertEscalationPolicy | null {
    return this.escalationPolicies.get(recipient) || null;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(severity?: AlertSeverity): Alert[] {
    const alerts = Array.from(this.activeAlerts.values());
    if (severity) {
      return alerts.filter(alert => alert.severity === severity);
    }
    return alerts;
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100): AlertingHistory[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, message?: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.status = 'acknowledged';
    alert.metadata.acknowledgedAt = Date.now();
    alert.metadata.acknowledgmentMessage = message;

    this.logAlertHistory(alertId, 'acknowledged', message || 'Alert acknowledged');
    return true;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, message?: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.status = 'resolved';
    alert.resolvedAt = Date.now();
    alert.metadata.resolvedMessage = message;

    this.logAlertHistory(alertId, 'resolved', message || 'Alert resolved');
    this.activeAlerts.delete(alertId);
    return true;
  }

  /**
   * Suppress an alert
   */
  suppressAlert(alertId: string, reason: string, duration?: number): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.status = 'suppressed';
    alert.metadata.suppressedAt = Date.now();
    alert.metadata.suppressionReason = reason;
    alert.metadata.suppressionDuration = duration;

    this.logAlertHistory(alertId, 'suppressed', reason);
    return true;
  }

  /**
   * Check all alert rules
   */
  private async checkAllRules(): Promise<void> {
    const currentTime = Date.now();
    if (currentTime - this.lastCheckTime < 15000) return; // Throttle checks

    this.lastCheckTime = currentTime;

    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;

      try {
        const alert = await this.checkRule(rule);
        if (alert) {
          this.handleAlert(alert);
        }
      } catch (error) {
        console.error(`Failed to check alert rule ${ruleId}:`, error);
      }
    }
  }

  /**
   * Check a single alert rule
   */
  private async checkRule(rule: AlertRule): Promise<Alert | null> {
    // This is a placeholder - in a real implementation, this would query metrics
    const value = await this.queryMetricValue(rule.condition);

    // Check condition
    let shouldTrigger = false;
    switch (rule.condition.operator) {
      case 'gt':
        shouldTrigger = value > rule.condition.threshold!;
        break;
      case 'gte':
        shouldTrigger = value >= rule.condition.threshold!;
        break;
      case 'lt':
        shouldTrigger = value < rule.condition.threshold!;
        break;
      case 'lte':
        shouldTrigger = value <= rule.condition.threshold!;
        break;
      case 'eq':
        shouldTrigger = value === rule.condition.threshold!;
        break;
      case 'neq':
        shouldTrigger = value !== rule.condition.threshold!;
        break;
    }

    if (!shouldTrigger) return null;

    // Check if already active
    const existingAlert = this.activeAlerts.get(rule.id);
    if (existingAlert) {
      return null;
    }

    // Create new alert
    return this.createAlert(rule, value);
  }

  /**
   * Query metric value (placeholder implementation)
   */
  private async queryMetricValue(condition: AlertCondition): Promise<number> {
    // In a real implementation, this would query a metrics database
    // For now, simulate metric values
    return Math.random() * 100;
  }

  /**
   * Create an alert
   */
  private createAlert(rule: AlertRule, value: number): Alert {
    const alert: Alert = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: this.generateAlertMessage(rule, value),
      value,
      timestamp: Date.now(),
      metadata: {
        tags: rule.tags || {}
      },
      status: 'firing'
    };

    return alert;
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, value: number): string {
    const conditionText = `${rule.condition.metric} ${rule.condition.operator} ${rule.condition.threshold}`;
    return `${rule.name}: ${conditionText} (current value: ${value.toFixed(2)})`;
  }

  /**
   * Handle an alert
   */
  private async handleAlert(alert: Alert): Promise<void> {
    // Store alert
    this.activeAlerts.set(alert.id, alert);

    // Log to history
    this.logAlertHistory(alert.id, 'triggered', alert.message);

    // Send notifications
    await this.sendNotifications(alert);

    // Handle escalation
    this.handleEscalation(alert);
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    const rule = this.rules.get(alert.ruleId);
    if (!rule) return;

    for (const action of rule.actions) {
      if (!action.config.recipients?.length) continue;

      try {
        await this.sendNotification(action.type, action.config, alert);
      } catch (error) {
        console.error(`Failed to send notification ${action.type}:`, error);
      }
    }
  }

  /**
   * Send a notification
   */
  private async sendNotification(
    type: AlertActionType,
    config: NotificationConfig,
    alert: Alert
  ): Promise<void> {
    switch (type) {
      case 'email':
        await this.sendEmailNotification(config, alert);
        break;
      case 'slack':
        await this.sendSlackNotification(config, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(config, alert);
        break;
      case 'pagerduty':
        await this.sendPagerDutyNotification(config, alert);
        break;
      default:
        console.warn(`Unsupported notification type: ${type}`);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    config: NotificationConfig,
    alert: Alert
  ): Promise<void> {
    // Placeholder implementation
    console.log(`Email notification sent to ${config.recipients!.join(', ')} for alert: ${alert.message}`);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(
    config: NotificationConfig,
    alert: Alert
  ): Promise<void> {
    // Placeholder implementation
    const payload = {
      text: `Alert: ${alert.ruleName}`,
      attachments: [{
        color: alert.severity === 'critical' || alert.severity === 'fatal' ? 'danger' : 'warning',
        fields: [
          {
            title: 'Severity',
            value: alert.severity,
            short: true
          },
          {
            title: 'Message',
            value: alert.message,
            short: false
          }
        ]
      }]
    };

    console.log('Slack notification payload:', JSON.stringify(payload));
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    config: NotificationConfig,
    alert: Alert
  ): Promise<void> {
    // Placeholder implementation using fetch
    if (!config.webhookUrl) return;

    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alert: {
            id: alert.id,
            ruleName: alert.ruleName,
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Webhook notification failed:', error);
      throw error;
    }
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(
    config: NotificationConfig,
    alert: Alert
  ): Promise<void> {
    // Placeholder implementation
    console.log(`PagerDuty notification sent for alert: ${alert.message}`);
  }

  /**
   * Handle alert escalation
   */
  private handleEscalation(alert: Alert): void {
    // Placeholder for escalation logic
    // In a real implementation, this would manage time-based escalation
  }

  /**
   * Log alert history
   */
  private logAlertHistory(ruleId: string, status: AlertStatus, message: string): void {
    const history: AlertingHistory = {
      rule: ruleId,
      timestamp: Date.now(),
      value: 0, // Placeholder
      threshold: 0, // Placeholder
      status,
      message,
      notifications: []
    };

    this.alertHistory.push(history);

    // Keep history size manageable
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): AlertStats {
    const activeAlerts = Array.from(this.activeAlerts.values());
    const history = this.alertHistory;

    const stats: AlertStats = {
      totalRules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      activeAlerts: activeAlerts.length,
      activeBySeverity: {
        info: activeAlerts.filter(a => a.severity === 'info').length,
        warning: activeAlerts.filter(a => a.severity === 'warning').length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        fatal: activeAlerts.filter(a => a.severity === 'fatal').length
      },
      resolvedAlerts: history.filter(h => h.status === 'resolved').length,
      triggeredAlerts: history.filter(h => h.status === 'triggered').length
    };

    return stats;
  }
}

/**
 * Alert statistics interface
 */
export interface AlertStats {
  totalRules: number;
  enabledRules: number;
  activeAlerts: number;
  activeBySeverity: Record<AlertSeverity, number>;
  resolvedAlerts: number;
  triggeredAlerts: number;
}