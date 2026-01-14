/**
 * Alerting Engine with Multi-Channel Notifications
 */

import axios from 'axios';
import { EventEmitter } from 'eventemitter3';
import * as nodemailer from 'nodemailer';
import { CronJob } from 'cron';
import { v4 as uuidv4 } from 'uuid';
import {
  AlertRule, AlertCondition, AlertSeverity, AlertAction,
  Alert, AlertStatus, AlertEscalationPolicy, OnCallRotation,
  NotificationConfig, AlertOperator
} from '../types';

export class EmailNotificationChannel {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async send(recipients: string[], subject: string, body: string, isHtml = false): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'alerts@claudeflare.com',
        to: recipients.join(', '),
        subject,
        [isHtml ? 'html' : 'text']: body,
      });
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }
}

export class SlackNotificationChannel {
  private webhookUrl: string;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL || '';
  }

  async send(channel: string, message: string, severity: AlertSeverity): Promise<boolean> {
    if (!this.webhookUrl) return false;
    try {
      const color = this.getSeverityColor(severity);
      const payload = {
        channel,
        attachments: [{
          color,
          title: 'Alert Notification',
          text: message,
          ts: Math.floor(Date.now() / 1000),
        }],
      };
      const response = await axios.post(this.webhookUrl, payload);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'info': return '#36a64f';
      case 'warning': return '#ff9900';
      case 'critical': return '#ff0000';
      case 'fatal': return '#990000';
      default: return '#cccccc';
    }
  }
}

export class PagerDutyNotificationChannel {
  private apiUrl = 'https://events.pagerduty.com/v2/enqueue';
  private integrationKey: string;

  constructor() {
    this.integrationKey = process.env.PAGERDUTY_INTEGRATION_KEY || '';
  }

  async createIncident(summary: string, severity: AlertSeverity, dedupKey?: string): Promise<boolean> {
    if (!this.integrationKey) return false;
    try {
      const payload = {
        routing_key: this.integrationKey,
        event_action: 'trigger',
        dedup_key: dedupKey || uuidv4(),
        payload: {
          summary,
          severity: this.mapSeverity(severity),
          source: 'claudeflare',
        },
      };
      const response = await axios.post(this.apiUrl, payload);
      return response.status === 202;
    } catch (error) {
      return false;
    }
  }

  private mapSeverity(severity: AlertSeverity): string {
    return severity === 'critical' || severity === 'fatal' ? 'critical' : 'info';
  }
}

export class ConditionEvaluator {
  evaluate(condition: AlertCondition, value: number, history?: number[]): boolean {
    switch (condition.type) {
      case 'threshold':
        return this.evaluateThreshold(condition, value);
      case 'anomaly':
        return this.evaluateAnomaly(condition, value, history || []);
      default:
        return false;
    }
  }

  private evaluateThreshold(condition: AlertCondition, value: number): boolean {
    if (condition.threshold === undefined) return false;
    switch (condition.operator) {
      case 'gt': return value > condition.threshold;
      case 'gte': return value >= condition.threshold;
      case 'lt': return value < condition.threshold;
      case 'lte': return value <= condition.threshold;
      case 'eq': return value === condition.threshold;
      case 'neq': return value !== condition.threshold;
      default: return false;
    }
  }

  private evaluateAnomaly(condition: AlertCondition, value: number, history: number[]): boolean {
    if (history.length < 10) return false;
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const variance = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length;
    const stdDev = Math.sqrt(variance);
    const zScore = Math.abs((value - mean) / stdDev);
    const threshold = condition.threshold || 2;
    return zScore > threshold;
  }
}

export class AlertingEngine extends EventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private suppressedAlerts: Set<string> = new Set();
  private alertHistory: Alert[] = [];
  private metricHistory: Map<string, number[]> = new Map();
  private evaluator: ConditionEvaluator;
  private emailChannel: EmailNotificationChannel;
  private slackChannel: SlackNotificationChannel;
  private pagerdutyChannel: PagerDutyNotificationChannel;

  constructor() {
    super();
    this.evaluator = new ConditionEvaluator();
    this.emailChannel = new EmailNotificationChannel();
    this.slackChannel = new SlackNotificationChannel();
    this.pagerdutyChannel = new PagerDutyNotificationChannel();
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.emit('rule:added', rule);
  }

  removeRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) this.emit('rule:removed', ruleId);
    return deleted;
  }

  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  async evaluateMetric(metricName: string, value: number): Promise<void> {
    if (!this.metricHistory.has(metricName)) {
      this.metricHistory.set(metricName, []);
    }
    const history = this.metricHistory.get(metricName)!;
    history.push(value);
    if (history.length > 1000) history.shift();

    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.condition.metric !== metricName) continue;
      const triggered = this.evaluator.evaluate(rule.condition, value, history);
      if (triggered) {
        await this.triggerAlert(rule, value);
      } else {
        await this.resolveAlert(rule.id);
      }
    }
  }

  private async triggerAlert(rule: AlertRule, value: number): Promise<void> {
    if (this.activeAlerts.has(rule.id)) return;
    if (this.suppressedAlerts.has(rule.id)) return;

    const alert: Alert = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: `${rule.name}: ${value} ${rule.condition.operator} ${rule.condition.threshold}`,
      value,
      timestamp: Date.now(),
      metadata: {},
      status: 'firing',
    };

    this.activeAlerts.set(rule.id, alert);
    this.alertHistory.push(alert);
    this.emit('alert:triggered', alert);
    await this.sendNotifications(alert, rule.actions);
  }

  private async resolveAlert(ruleId: string): Promise<void> {
    const alert = this.activeAlerts.get(ruleId);
    if (!alert) return;
    alert.status = 'resolved';
    alert.resolvedAt = Date.now();
    this.activeAlerts.delete(ruleId);
    this.emit('alert:resolved', alert);
  }

  private async sendNotifications(alert: Alert, actions: AlertAction[]): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'email':
            if (action.config.recipients) {
              await this.emailChannel.send(
                action.config.recipients,
                `[${alert.severity}] ${alert.ruleName}`,
                alert.message
              );
            }
            break;
          case 'slack':
            await this.slackChannel.send('#alerts', alert.message, alert.severity);
            break;
          case 'pagerduty':
            await this.pagerdutyChannel.createIncident(alert.message, alert.severity);
            break;
        }
      } catch (error) {
        console.error('Notification failed:', error);
      }
    }
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(limit?: number): Alert[] {
    return limit ? this.alertHistory.slice(-limit) : [...this.alertHistory];
  }

  shutdown(): void {
    this.rules.clear();
    this.activeAlerts.clear();
  }
}
