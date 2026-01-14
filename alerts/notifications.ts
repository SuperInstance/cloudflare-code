/**
 * Alert Notification Handlers
 *
 * Comprehensive notification system for alerts with support for multiple channels:
 * - Slack
 * - Email
 * - PagerDuty
 * - Webhook
 * - Discord
 * - Microsoft Teams
 */

import type {
  Alert,
  NotificationChannel,
  NotificationChannelConfig,
} from '../packages/edge/src/lib/monitoring/types';

/**
 * Notification Handler Interface
 */
export interface NotificationHandler {
  send(alert: Alert, config: NotificationChannelConfig): Promise<void>;
  validate(config: NotificationChannelConfig): Promise<boolean>;
}

/**
 * Slack Notification Handler
 */
export class SlackNotificationHandler implements NotificationHandler {
  async send(alert: Alert, config: NotificationChannelConfig): Promise<void> {
    if (!config.webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const color = {
      info: '#36a64f',
      warning: '#ff9900',
      critical: '#ff0000',
      emergency: '#990000',
    }[alert.severity];

    const emoji = {
      info: ':information_source:',
      warning: ':warning:',
      critical: ':rotating_light:',
      emergency: ':skull_crossbones:',
    }[alert.severity];

    const payload = {
      channel: config.channel,
      username: config.username || 'ClaudeFlare Alerts',
      icon_emoji: config.iconEmoji || ':bell:',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${alert.message}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Severity:*\n${alert.severity.toUpperCase()}`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n${alert.status.toUpperCase()}`,
            },
            {
              type: 'mrkdwn',
              text: `*Triggered:*\n<!date^${Math.floor(alert.triggeredAt / 1000)}^{date_num} {time_secs}|${new Date(alert.triggeredAt).toISOString()}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Rule:*\n${alert.ruleName}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Details:*',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '```' + JSON.stringify(alert.details, null, 2) + '```',
          },
        },
      ],
      attachments: [
        {
          color,
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

  async validate(config: NotificationChannelConfig): Promise<boolean> {
    if (!config.webhookUrl) {
      return false;
    }

    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'ClaudeFlare alert notification test',
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Email Notification Handler
 */
export class EmailNotificationHandler implements NotificationHandler {
  async send(alert: Alert, config: NotificationChannelConfig): Promise<void> {
    if (!config.to || config.to.length === 0) {
      throw new Error('Email recipients not configured');
    }

    const subject = config.subject || `[${alert.severity.toUpperCase()}] ${alert.message}`;
    const html = this.generateEmailHTML(alert);

    // In Cloudflare Workers, use Email API or service like SendGrid/Mailgun
    // This is a placeholder implementation
    console.log('Email notification:', {
      to: config.to,
      cc: config.cc,
      subject,
      html,
    });

    // Example with SendGrid (if available in env)
    // const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     personalizations: [{
    //       to: config.to.map(email => ({ email })),
    //       cc: config.cc?.map(email => ({ email })),
    //     }],
    //     from: { email: 'alerts@claudeflare.ai' },
    //     subject,
    //     content: [{ type: 'text/html', value: html }],
    //   }),
    // });
  }

  async validate(config: NotificationChannelConfig): Promise<boolean> {
    return !!(config.to && config.to.length > 0);
  }

  private generateEmailHTML(alert: Alert): string {
    const color = {
      info: '#36a64f',
      warning: '#ff9900',
      critical: '#ff0000',
      emergency: '#990000',
    }[alert.severity];

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${color}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .details { background-color: #fff; padding: 15px; margin: 10px 0; border-left: 4px solid ${color}; }
          .footer { background-color: #f9f9f9; padding: 10px; text-align: center; font-size: 12px; color: #666; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
          pre { background-color: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${alert.message}</h2>
          </div>
          <div class="content">
            <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
            <p><strong>Status:</strong> ${alert.status.toUpperCase()}</p>
            <p><strong>Triggered:</strong> ${new Date(alert.triggeredAt).toISOString()}</p>
            <p><strong>Rule:</strong> ${alert.ruleName}</p>
            <div class="details">
              <h3>Details:</h3>
              <pre>${JSON.stringify(alert.details, null, 2)}</pre>
            </div>
          </div>
          <div class="footer">
            <p>ClaudeFlare Monitoring System</p>
            <p>${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

/**
 * PagerDuty Notification Handler
 */
export class PagerDutyNotificationHandler implements NotificationHandler {
  async send(alert: Alert, config: NotificationChannelConfig): Promise<void> {
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
        component: alert.ruleName,
        custom_details: alert.details,
      },
      dedup_key: alert.id,
      client: 'ClaudeFlare',
      client_url: 'https://claudeflare.ai',
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

  async validate(config: NotificationChannelConfig): Promise<boolean> {
    return !!config.integrationKey;
  }
}

/**
 * Discord Notification Handler
 */
export class DiscordNotificationHandler implements NotificationHandler {
  async send(alert: Alert, config: NotificationChannelConfig): Promise<void> {
    if (!config.webhookUrl) {
      throw new Error('Discord webhook URL not configured');
    }

    const color = {
      info: 0x36a64f,
      warning: 0xff9900,
      critical: 0xff0000,
      emergency: 0x990000,
    }[alert.severity];

    const payload = {
      username: config.username || 'ClaudeFlare Alerts',
      avatar_url: config.avatarUrl,
      embeds: [
        {
          title: alert.message,
          color,
          fields: [
            {
              name: 'Severity',
              value: alert.severity.toUpperCase(),
              inline: true,
            },
            {
              name: 'Status',
              value: alert.status.toUpperCase(),
              inline: true,
            },
            {
              name: 'Triggered',
              value: new Date(alert.triggeredAt).toISOString(),
              inline: true,
            },
            {
              name: 'Rule',
              value: alert.ruleName,
              inline: true,
            },
            {
              name: 'Details',
              value: '```' + JSON.stringify(alert.details, null, 2) + '```',
              inline: false,
            },
          ],
          timestamp: new Date(alert.triggeredAt).toISOString(),
          footer: {
            text: 'ClaudeFlare Monitoring',
          },
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
      throw new Error(`Discord notification failed: ${response.statusText}`);
    }
  }

  async validate(config: NotificationChannelConfig): Promise<boolean> {
    return !!config.webhookUrl;
  }
}

/**
 * Microsoft Teams Notification Handler
 */
export class TeamsNotificationHandler implements NotificationHandler {
  async send(alert: Alert, config: NotificationChannelConfig): Promise<void> {
    if (!config.webhookUrl) {
      throw new Error('Teams webhook URL not configured');
    }

    const color = {
      info: '36a64f',
      warning: 'ff9900',
      critical: 'ff0000',
      emergency: '990000',
    }[alert.severity];

    const payload = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: alert.message,
      themeColor: color,
      title: alert.message,
      sections: [
        {
          activityTitle: alert.ruleName,
          activitySubtitle: `Severity: ${alert.severity.toUpperCase()}`,
          activityImage: 'https://claudeflare.ai/icon.png',
          facts: [
            {
              name: 'Status',
              value: alert.status.toUpperCase(),
            },
            {
              name: 'Triggered',
              value: new Date(alert.triggeredAt).toISOString(),
            },
          ],
          markdown: true,
        },
        {
          text: '```' + JSON.stringify(alert.details, null, 2) + '```',
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
      throw new Error(`Teams notification failed: ${response.statusText}`);
    }
  }

  async validate(config: NotificationChannelConfig): Promise<boolean> {
    return !!config.webhookUrl;
  }
}

/**
 * Generic Webhook Notification Handler
 */
export class WebhookNotificationHandler implements NotificationHandler {
  async send(alert: Alert, config: NotificationChannelConfig): Promise<void> {
    if (!config.url) {
      throw new Error('Webhook URL not configured');
    }

    const method = config.method || 'POST';
    const headers = config.headers || {};

    let body: string;
    if (config.bodyTemplate) {
      body = this.renderTemplate(config.bodyTemplate, alert);
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

  async validate(config: NotificationChannelConfig): Promise<boolean> {
    return !!config.url;
  }

  private renderTemplate(template: string, alert: Alert): string {
    return template
      .replace(/\{\{alert_id\}\}/g, alert.id)
      .replace(/\{\{alert_message\}\}/g, alert.message)
      .replace(/\{\{alert_severity\}\}/g, alert.severity)
      .replace(/\{\{alert_status\}\}/g, alert.status)
      .replace(/\{\{alert_rule\}\}/g, alert.ruleName)
      .replace(/\{\{alert_triggered\}\}/g, new Date(alert.triggeredAt).toISOString())
      .replace(/\{\{alert_details\}\}/g, JSON.stringify(alert.details));
  }
}

/**
 * Notification Manager
 */
export class NotificationManager {
  private handlers: Map<string, NotificationHandler>;

  constructor() {
    this.handlers = new Map([
      ['slack', new SlackNotificationHandler()],
      ['email', new EmailNotificationHandler()],
      ['pagerduty', new PagerDutyNotificationHandler()],
      ['discord', new DiscordNotificationHandler()],
      ['teams', new TeamsNotificationHandler()],
      ['webhook', new WebhookNotificationHandler()],
    ]);
  }

  /**
   * Send notification to a channel
   */
  async send(alert: Alert, channel: NotificationChannel): Promise<void> {
    if (!channel.enabled) {
      return;
    }

    const handler = this.handlers.get(channel.type);
    if (!handler) {
      throw new Error(`Unsupported notification channel: ${channel.type}`);
    }

    await handler.send(alert, channel.config);
  }

  /**
   * Send notification to multiple channels
   */
  async sendToChannels(alert: Alert, channels: NotificationChannel[]): Promise<void> {
    const promises = channels.map((channel) => {
      return this.send(alert, channel).catch((error) => {
        console.error(`Failed to send notification to ${channel.type}:`, error);
        alert.notificationStatus.set(channel.type, 'failed');
      });
    });

    await Promise.all(promises);
  }

  /**
   * Validate notification channel configuration
   */
  async validate(channel: NotificationChannel): Promise<boolean> {
    const handler = this.handlers.get(channel.type);
    if (!handler) {
      return false;
    }

    return await handler.validate(channel.config);
  }

  /**
   * Register custom notification handler
   */
  registerHandler(type: string, handler: NotificationHandler): void {
    this.handlers.set(type, handler);
  }
}

/**
 * Factory function to create notification manager
 */
export function createNotificationManager(): NotificationManager {
  return new NotificationManager();
}

/**
 * Incident Response Workflow
 */
export class IncidentResponseWorkflow {
  private notificationManager: NotificationManager;

  constructor(notificationManager?: NotificationManager) {
    this.notificationManager = notificationManager || createNotificationManager();
  }

  /**
   * Trigger incident response workflow
   */
  async triggerIncident(alert: Alert, channels: NotificationChannel[]): Promise<void> {
    // Send initial notification
    await this.notificationManager.sendToChannels(alert, channels);

    // Create incident ticket (if configured)
    await this.createIncidentTicket(alert);

    // Update dashboard
    await this.updateIncidentDashboard(alert);

    // Log incident
    await this.logIncident(alert);
  }

  /**
   * Escalate incident
   */
  async escalateIncident(alert: Alert, escalationChannels: NotificationChannel[]): Promise<void> {
    // Send escalation notification
    await this.notificationManager.sendToChannels(alert, escalationChannels);

    // Update incident severity
    alert.details.escalated = true;
    alert.details.escalatedAt = new Date().toISOString();
  }

  /**
   * Resolve incident
   */
  async resolveIncident(alert: Alert, resolutionChannels: NotificationChannel[]): Promise<void> {
    // Send resolution notification
    await this.notificationManager.sendToChannels(alert, resolutionChannels);

    // Close incident ticket
    await this.closeIncidentTicket(alert);

    // Update dashboard
    await this.updateIncidentDashboard(alert);
  }

  private async createIncidentTicket(alert: Alert): Promise<void> {
    // Placeholder for incident ticket creation
    // Could integrate with Jira, ServiceNow, etc.
    console.log('Creating incident ticket for alert:', alert.id);
  }

  private async closeIncidentTicket(alert: Alert): Promise<void> {
    // Placeholder for incident ticket closure
    console.log('Closing incident ticket for alert:', alert.id);
  }

  private async updateIncidentDashboard(alert: Alert): Promise<void> {
    // Placeholder for incident dashboard update
    console.log('Updating incident dashboard for alert:', alert.id);
  }

  private async logIncident(alert: Alert): Promise<void> {
    // Placeholder for incident logging
    console.log('Logging incident:', alert.id);
  }
}

/**
 * Factory function to create incident response workflow
 */
export function createIncidentResponseWorkflow(
  notificationManager?: NotificationManager
): IncidentResponseWorkflow {
  return new IncidentResponseWorkflow(notificationManager);
}
