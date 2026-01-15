/**
 * Alert Manager Module
 * Manages alert rules, notifications, and escalations
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Alert,
  AlertRule,
  AlertType,
  AlertSeverity,
  AlertCondition,
  AlertAction,
  AlertHistory,
  ErrorEvent,
  ErrorGroup
} from '../types';
import { ErrorTrackingEventEmitter } from '../types';

// ============================================================================
// Condition Evaluator
// ============================================================================

export class ConditionEvaluator {
  /**
   * Evaluate if an error matches alert conditions
   */
  static evaluate(
    error: ErrorEvent,
    group: ErrorGroup | undefined,
    conditions: AlertCondition[]
  ): boolean {
    // All conditions must be satisfied (AND logic)
    return conditions.every(condition =>
      this.evaluateCondition(error, group, condition)
    );
  }

  /**
   * Evaluate a single condition
   */
  private static evaluateCondition(
    error: ErrorEvent,
    group: ErrorGroup | undefined,
    condition: AlertCondition
  ): boolean {
    const value = this.getFieldValue(error, group, condition.field);

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;

      case 'ne':
        return value !== condition.value;

      case 'gt':
        return typeof value === 'number' && value > condition.value;

      case 'gte':
        return typeof value === 'number' && value >= condition.value;

      case 'lt':
        return typeof value === 'number' && value < condition.value;

      case 'lte':
        return typeof value === 'number' && value <= condition.value;

      case 'in':
        return Array.isArray(condition.value) &&
          condition.value.includes(value);

      case 'nin':
        return Array.isArray(condition.value) &&
          !condition.value.includes(value);

      case 'contains':
        return typeof value === 'string' &&
          value.includes(condition.value);

      case 'regex':
        if (condition.value instanceof RegExp) {
          return typeof value === 'string' &&
            condition.value.test(value);
        }
        try {
          const regex = new RegExp(condition.value);
          return typeof value === 'string' && regex.test(value);
        } catch {
          return false;
        }

      case 'exists':
        return value !== undefined && value !== null;

      default:
        return false;
    }
  }

  /**
   * Get field value from error or group
   */
  private static getFieldValue(
    error: ErrorEvent,
    group: ErrorGroup | undefined,
    field: string
  ): any {
    // Handle nested field paths
    const parts = field.split('.');
    let value: any = { error, group };

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }

      // Handle special keys
      if (part === 'error') {
        value = error;
      } else if (part === 'group' && group) {
        value = group;
      } else if (part === 'count' && group) {
        value = group.occurrences;
      } else if (part === 'isNew') {
        value = group ? group.occurrences === 1 : true;
      } else {
        value = value[part];
      }
    }

    return value;
  }
}

// ============================================================================
// Notification Handler
// ============================================================================

export class NotificationHandler {
  /**
   * Send alert notification
   */
  static async send(
    alert: Alert,
    action: AlertAction
  ): Promise<boolean> {
    if (!action.enabled) {
      return false;
    }

    try {
      switch (action.type) {
        case 'email':
          return await this.sendEmail(alert, action.config);
        case 'webhook':
          return await this.sendWebhook(alert, action.config);
        case 'slack':
          return await this.sendSlack(alert, action.config);
        case 'pagerduty':
          return await this.sendPagerDuty(alert, action.config);
        case 'custom':
          return await this.sendCustom(alert, action.config);
        default:
          return false;
      }
    } catch (error) {
      console.error(`Failed to send ${action.type} notification:`, error);
      return false;
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmail(
    alert: Alert,
    config: any
  ): Promise<boolean> {
    const { recipients, subject, template } = config;

    if (!recipients || recipients.length === 0) {
      return false;
    }

    const emailSubject = subject ||
      `[${alert.severity.toUpperCase()}] ${alert.ruleName} - ${alert.triggerData.errorType}`;

    const emailBody = this.generateEmailBody(alert, template);

    // In a real implementation, this would use an email service
    console.log('Sending email:', {
      to: recipients,
      subject: emailSubject,
      body: emailBody
    });

    return true;
  }

  /**
   * Generate email body
   */
  private static generateEmailBody(alert: Alert, template?: string): string {
    const defaultBody = `
Alert: ${alert.ruleName}
Severity: ${alert.severity}
Type: ${alert.type}
Status: ${alert.status}

Error Details:
- Type: ${alert.triggerData.errorType}
- Message: ${alert.triggerData.errorMessage}
- Error ID: ${alert.triggerData.errorId}
- Occurrences: ${alert.occurrences}
- Affected Users: ${alert.affectedUsers}

Match Details: ${JSON.stringify(alert.triggerData.matchDetails, null, 2)}
    `.trim();

    if (template) {
      // Simple template variable replacement
      return template
        .replace(/\{\{alert\.ruleName\}\}/g, alert.ruleName)
        .replace(/\{\{alert\.severity\}\}/g, alert.severity)
        .replace(/\{\{alert\.type\}\}/g, alert.type)
        .replace(/\{\{alert\.triggerData\.errorType\}\}/g, alert.triggerData.errorType)
        .replace(/\{\{alert\.triggerData\.errorMessage\}\}/g, alert.triggerData.errorMessage)
        .replace(/\{\{alert\.occurrences\}\}/g, String(alert.occurrences))
        .replace(/\{\{alert\.affectedUsers\}\}/g, String(alert.affectedUsers));
    }

    return defaultBody;
  }

  /**
   * Send webhook notification
   */
  private static async sendWebhook(
    alert: Alert,
    config: any
  ): Promise<boolean> {
    const { url, method = 'POST', headers = {}, body } = config;

    if (!url) {
      return false;
    }

    const payload = body || this.generateWebhookPayload(alert);

    // In a real implementation, this would make an HTTP request
    console.log('Sending webhook:', {
      url,
      method,
      headers,
      payload
    });

    return true;
  }

  /**
   * Generate webhook payload
   */
  private static generateWebhookPayload(alert: Alert): any {
    return {
      alert_id: alert.id,
      rule_id: alert.ruleId,
      rule_name: alert.ruleName,
      type: alert.type,
      severity: alert.severity,
      status: alert.status,
      timestamp: alert.timestamp,
      trigger_data: alert.triggerData,
      occurrences: alert.occurrences,
      affected_users: alert.affectedUsers
    };
  }

  /**
   * Send Slack notification
   */
  private static async sendSlack(
    alert: Alert,
    config: any
  ): Promise<boolean> {
    const { webhookUrl, channel, username = 'ErrorTracker', icon = ':warning:' } = config;

    if (!webhookUrl && !channel) {
      return false;
    }

    const color = this.getSlackColor(alert.severity);
    const message = this.generateSlackMessage(alert);

    const payload: any = {
      username,
      icon_emoji: icon,
      attachments: [
        {
          color,
          title: `${alert.severity.toUpperCase()}: ${alert.ruleName}`,
          text: message,
          fields: [
            {
              title: 'Error Type',
              value: alert.triggerData.errorType,
              short: true
            },
            {
              title: 'Occurrences',
              value: String(alert.occurrences),
              short: true
            },
            {
              title: 'Affected Users',
              value: String(alert.affectedUsers),
              short: true
            },
            {
              title: 'Time',
              value: new Date(alert.timestamp).toISOString(),
              short: true
            }
          ],
          footer: 'ClaudeFlare Error Tracking',
          ts: Math.floor(alert.timestamp / 1000)
        }
      ]
    };

    if (channel) {
      payload.channel = channel;
    }

    console.log('Sending Slack message:', payload);

    return true;
  }

  /**
   * Get Slack color based on severity
   */
  private static getSlackColor(severity: AlertSeverity): string {
    const colors: Record<AlertSeverity, string> = {
      [AlertSeverity.CRITICAL]: 'danger',
      [AlertSeverity.HIGH]: 'danger',
      [AlertSeverity.MEDIUM]: 'warning',
      [AlertSeverity.LOW]: 'good',
      [AlertSeverity.INFO]: 'good'
    };

    return colors[severity] || 'warning';
  }

  /**
   * Generate Slack message
   */
  private static generateSlackMessage(alert: Alert): string {
    return `
*Error:* ${alert.triggerData.errorMessage}
*Type:* ${alert.triggerData.errorType}
*Occurrences:* ${alert.occurrences}
    `.trim();
  }

  /**
   * Send PagerDuty notification
   */
  private static async sendPagerDuty(
    alert: Alert,
    config: any
  ): Promise<boolean> {
    const { integrationKey, severity = 'error' } = config;

    if (!integrationKey) {
      return false;
    }

    const pdSeverity = alert.severity === AlertSeverity.CRITICAL ? 'critical' : 'error';

    const payload = {
      routing_key: integrationKey,
      event_action: 'trigger',
      payload: {
        summary: `${alert.ruleName}: ${alert.triggerData.errorType}`,
        severity: pdSeverity,
        source: 'claudeflare-error-tracking',
        timestamp: new Date(alert.timestamp).toISOString(),
        custom_details: {
          errorId: alert.triggerData.errorId,
          errorMessage: alert.triggerData.errorMessage,
          occurrences: alert.occurrences,
          affectedUsers: alert.affectedUsers,
          matchDetails: alert.triggerData.matchDetails
        }
      },
      dedup_key: alert.id
    };

    console.log('Sending PagerDuty event:', payload);

    return true;
  }

  /**
   * Send custom notification
   */
  private static async sendCustom(
    alert: Alert,
    config: any
  ): Promise<boolean> {
    const { handler } = config;

    if (typeof handler !== 'function') {
      return false;
    }

    try {
      await handler(alert);
      return true;
    } catch (error) {
      console.error('Custom notification handler failed:', error);
      return false;
    }
  }
}

// ============================================================================
// Alert History Manager
// ============================================================================()

export class AlertHistoryManager {
  private history: Map<string, AlertHistory[]> = new Map();

  /**
   * Add history entry
   */
  add(alertId: string, action: AlertHistory['action'], user?: string, details?: Record<string, any>): void {
    if (!this.history.has(alertId)) {
      this.history.set(alertId, []);
    }

    this.history.get(alertId)!.push({
      alertId,
      timestamp: Date.now(),
      action,
      user,
      details: details || {}
    });
  }

  /**
   * Get history for alert
   */
  get(alertId: string): AlertHistory[] {
    return this.history.get(alertId) || [];
  }

  /**
   * Get all history
   */
  getAll(): AlertHistory[] {
    const all: AlertHistory[] = [];

    for (const entries of this.history.values()) {
      all.push(...entries);
    }

    return all.sort((a, b) => b.timestamp - a.timestamp);
  }
}

// ============================================================================
// Alert Manager
// ============================================================================

export class AlertManager extends ErrorTrackingEventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private history: AlertHistoryManager;
  private alertCounts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor() {
    super();
    this.history = new AlertHistoryManager();
  }

  /**
   * Add or update alert rule
   */
  addRule(rule: Partial<AlertRule>): AlertRule {
    const alertRule: AlertRule = {
      id: rule.id || uuidv4(),
      name: rule.name || 'Unnamed Rule',
      description: rule.description,
      type: rule.type || AlertType.CUSTOM,
      enabled: rule.enabled !== false,
      conditions: rule.conditions || [],
      actions: rule.actions || [],
      cooldown: rule.cooldown,
      throttleWindow: rule.throttleWindow,
      maxAlertsPerWindow: rule.maxAlertsPerWindow,
      groupBy: rule.groupBy,
      filters: rule.filters,
      metadata: rule.metadata || {}
    };

    this.rules.set(alertRule.id, alertRule);

    return alertRule;
  }

  /**
   * Remove alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get enabled rules
   */
  getEnabledRules(): AlertRule[] {
    return this.getRules().filter(rule => rule.enabled);
  }

  /**
   * Evaluate error against all rules
   */
  async evaluateError(error: ErrorEvent, group?: ErrorGroup): Promise<Alert[]> {
    const triggeredAlerts: Alert[] = [];
    const enabledRules = this.getEnabledRules();

    for (const rule of enabledRules) {
      // Check filters first
      if (rule.filters && rule.filters.length > 0) {
        const passesFilters = rule.filters.every(filter =>
          ConditionEvaluator['evaluateCondition'](error, group, {
            field: filter.field,
            operator: filter.operator,
            value: filter.value || filter.values
          })
        );

        if (!passesFilters) {
          continue;
        }
      }

      // Check if conditions are met
      if (ConditionEvaluator.evaluate(error, group, rule.conditions)) {
        const alert = await this.createAlert(rule, error, group);

        if (alert) {
          triggeredAlerts.push(alert);
        }
      }
    }

    return triggeredAlerts;
  }

  /**
   * Create alert from rule
   */
  private async createAlert(
    rule: AlertRule,
    error: ErrorEvent,
    group?: ErrorGroup
  ): Promise<Alert | null> {
    const now = Date.now();

    // Check cooldown
    const existingAlert = this.findRecentAlertForRule(rule.id, rule.cooldown || 0);
    if (existingAlert && rule.cooldown) {
      return null;
    }

    // Check throttle
    if (rule.throttleWindow && rule.maxAlertsPerWindow) {
      const windowStart = now - rule.throttleWindow;
      const recentAlerts = Array.from(this.alerts.values()).filter(
        a => a.ruleId === rule.id && a.timestamp >= windowStart
      );

      if (recentAlerts.length >= rule.maxAlertsPerWindow) {
        return null;
      }
    }

    // Create alert
    const alert: Alert = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      type: rule.type,
      severity: this.determineAlertSeverity(error, group),
      status: 'triggered',
      timestamp: now,
      triggerData: {
        errorId: error.id,
        errorType: error.type,
        errorMessage: error.message,
        matchDetails: this.extractMatchDetails(error, group, rule.conditions)
      },
      occurrences: group ? group.occurrences : 1,
      affectedUsers: group ? group.affectedUsers : (error.user ? 1 : 0),
      notificationStatus: {}
    };

    // Store alert
    this.alerts.set(alert.id, alert);

    // Add to history
    this.history.add(alert.id, 'triggered');

    // Emit event
    this.emit('alert:triggered', alert);

    // Send notifications
    await this.sendNotifications(alert, rule.actions);

    return alert;
  }

  /**
   * Find recent alert for rule
   */
  private findRecentAlertForRule(ruleId: string, cooldownMs: number): Alert | null {
    if (cooldownMs === 0) return null;

    const cutoff = Date.now() - cooldownMs;

    for (const alert of this.alerts.values()) {
      if (alert.ruleId === ruleId &&
          alert.timestamp >= cutoff &&
          alert.status !== 'resolved') {
        return alert;
      }
    }

    return null;
  }

  /**
   * Determine alert severity
   */
  private determineAlertSeverity(
    error: ErrorEvent,
    group?: ErrorGroup
  ): AlertSeverity {
    // Use error severity as base
    const severityMap: Record<string, AlertSeverity> = {
      critical: AlertSeverity.CRITICAL,
      high: AlertSeverity.HIGH,
      medium: AlertSeverity.MEDIUM,
      low: AlertSeverity.LOW,
      info: AlertSeverity.INFO
    };

    const baseSeverity = severityMap[error.severity] || AlertSeverity.MEDIUM;

    // Upgrade based on occurrences
    if (group && group.occurrences > 100) {
      return AlertSeverity.CRITICAL;
    } else if (group && group.occurrences > 50) {
      return AlertSeverity.HIGH;
    }

    return baseSeverity;
  }

  /**
   * Extract match details from conditions
   */
  private extractMatchDetails(
    error: ErrorEvent,
    group: ErrorGroup | undefined,
    conditions: AlertCondition[]
  ): Record<string, any> {
    const details: Record<string, any> = {};

    for (const condition of conditions) {
      const value = ConditionEvaluator['getFieldValue'](error, group, condition.field);
      details[condition.field] = {
        operator: condition.operator,
        expected: condition.value,
        actual: value,
        matched: true
      };
    }

    return details;
  }

  /**
   * Send notifications for alert
   */
  private async sendNotifications(alert: Alert, actions: AlertAction[]): Promise<void> {
    const notificationPromises = actions.map(async action => {
      const success = await NotificationHandler.send(alert, action);
      alert.notificationStatus[action.type] = success ? 'sent' : 'failed';
    });

    await Promise.all(notificationPromises);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, user?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'acknowledged';
    alert.acknowledgedAt = Date.now();
    alert.acknowledgedBy = user;

    this.history.add(alertId, 'acknowledged', user);

    this.emit('alert:acknowledged', alert);

    return true;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string, user?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'resolved';
    alert.resolvedAt = Date.now();
    alert.resolvedBy = user;

    this.history.add(alertId, 'resolved', user);

    this.emit('alert:resolved', alert);

    return true;
  }

  /**
   * Suppress alert
   */
  suppressAlert(alertId: string, until: number, reason?: string, user?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'suppressed';
    alert.suppressUntil = until;
    alert.suppressReason = reason;

    this.history.add(alertId, 'suppressed', user, { until, reason });

    return true;
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  /**
   * Get all alerts
   */
  getAlerts(filter?: {
    status?: Alert['status'];
    severity?: AlertSeverity;
    ruleId?: string;
  }): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (filter) {
      if (filter.status) {
        alerts = alerts.filter(a => a.status === filter.status);
      }
      if (filter.severity) {
        alerts = alerts.filter(a => a.severity === filter.severity);
      }
      if (filter.ruleId) {
        alerts = alerts.filter(a => a.ruleId === filter.ruleId);
      }
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get active alerts (not resolved or suppressed)
   */
  getActiveAlerts(): Alert[] {
    const now = Date.now();

    return Array.from(this.alerts.values()).filter(alert => {
      if (alert.status === 'suppressed' && alert.suppressUntil) {
        return alert.suppressUntil > now;
      }
      return alert.status !== 'resolved' && alert.status !== 'suppressed';
    });
  }

  /**
   * Get alert history
   */
  getAlertHistory(alertId: string): AlertHistory[] {
    return this.history.get(alertId);
  }

  /**
   * Get all history
   */
  getAllHistory(): AlertHistory[] {
    return this.history.getAll();
  }

  /**
   * Delete alert
   */
  deleteAlert(alertId: string): boolean {
    return this.alerts.delete(alertId);
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts.clear();
  }

  /**
   * Clear all rules
   */
  clearRules(): void {
    this.rules.clear();
  }
}
