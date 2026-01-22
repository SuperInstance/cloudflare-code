/**
 * Complete example demonstrating the notification system
 */

import { NotificationSystem } from '../src';
import { EmailChannel } from '../src/channels/email';
import { SlackChannel } from '../src/channels/slack';
import { SmsChannel } from '../src/channels/sms';
import type { Notification, NotificationRecipient, NotificationTemplate, AlertRoute, EscalationPath } from '../src/types';

async function main() {
  // Initialize the notification system
  const notifications = new NotificationSystem({
    enableAlertRouting: true,
    enableEscalation: true,
    enableRateLimiting: true,
    enablePreferences: true,
    enableTemplates: true,
  });

  console.log('Notification System initialized');

  // ============================================
  // 1. Setup Channels
  // ============================================
  console.log('\n=== Setting up channels ===');

  // Configure email channel
  const emailChannel = new EmailChannel({
    provider: {
      type: 'smtp',
      config: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'notifications@example.com',
          pass: 'password',
        },
        from: 'notifications@example.com',
        fromName: 'ClaudeFlare',
      },
    },
    maxRetries: 3,
    timeout: 30000,
  });

  notifications.channels.register('email', emailChannel);
  console.log('✓ Email channel registered');

  // Configure Slack channel
  const slackChannel = new SlackChannel({
    provider: {
      webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX',
      channel: '#alerts',
      username: 'ClaudeFlare Bot',
      iconEmoji: ':robot_face:',
    },
  });

  notifications.channels.register('slack', slackChannel);
  console.log('✓ Slack channel registered');

  // Configure SMS channel
  const smsChannel = new SmsChannel({
    provider: {
      type: 'twilio',
      config: {
        accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        authToken: 'your_auth_token',
        fromNumber: '+1234567890',
      },
    },
  });

  notifications.channels.register('sms', smsChannel);
  console.log('✓ SMS channel registered');

  // ============================================
  // 2. Setup Templates
  // ============================================
  console.log('\n=== Setting up templates ===');

  const welcomeTemplate: NotificationTemplate = {
    id: 'welcome-email',
    name: 'Welcome Email',
    category: 'system',
    channel: 'email',
    subject: 'Welcome to ClaudeFlare, {{name}}!',
    content: `Dear {{name}},

Welcome to ClaudeFlare! We're excited to have you on board.

Your account has been created and you can now start using our platform.

If you have any questions, don't hesitate to reach out.

Best regards,
The ClaudeFlare Team`,
    htmlContent: `<!DOCTYPE html>
<html>
<body>
  <h1>Welcome to ClaudeFlare, {{name}}!</h1>
  <p>We're excited to have you on board.</p>
  <p>Your account has been created and you can now start using our platform.</p>
  <p>If you have any questions, don't hesitate to reach out.</p>
  <p>Best regards,<br>The ClaudeFlare Team</p>
</body>
</html>`,
    variables: [
      { name: 'name', type: 'string', required: true, description: 'User name' },
    ],
    locale: 'en',
    version: 1,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  notifications.templates.registerTemplate(welcomeTemplate);
  console.log('✓ Welcome template registered');

  // ============================================
  // 3. Setup Alert Routing
  // ============================================
  console.log('\n=== Setting up alert routing ===');

  const criticalAlertRoute: AlertRoute = {
    id: 'critical-alert-route',
    name: 'Critical Alert Route',
    description: 'Route for critical alerts requiring immediate attention',
    priority: 100,
    conditions: [
      {
        type: 'severity',
        operator: 'equals',
        value: 'critical',
      },
    ],
    actions: [
      {
        type: 'notify',
        config: {
          channels: ['email', 'sms', 'slack'],
          users: ['on-call-engineer', 'team-lead'],
        },
      },
      {
        type: 'escalate',
        config: {
          escalationPath: 'critical-escalation',
          channels: ['email', 'sms', 'slack'],
        },
      },
    ],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  notifications.alerts.addRoute(criticalAlertRoute);
  console.log('✓ Critical alert route registered');

  // ============================================
  // 4. Setup Escalation Paths
  // ============================================
  console.log('\n=== Setting up escalation paths ===');

  const escalationPath: EscalationPath = {
    id: 'critical-escalation',
    name: 'Critical Alert Escalation',
    levels: [
      {
        order: 0,
        userId: 'on-call-engineer',
        channels: ['email', 'sms', 'slack'],
        timeoutMinutes: 5,
      },
      {
        order: 1,
        userId: 'team-lead',
        channels: ['email', 'sms', 'slack'],
        timeoutMinutes: 10,
      },
      {
        order: 2,
        userId: 'engineering-manager',
        channels: ['email', 'sms', 'slack'],
        timeoutMinutes: 15,
      },
    ],
    timeoutMinutes: 30,
    repeatEnabled: true,
    maxEscalations: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  notifications.escalation.addPath(escalationPath);
  console.log('✓ Escalation path registered');

  // ============================================
  // 5. Setup Rate Limits
  // ============================================
  console.log('\n=== Setting up rate limits ===');

  notifications.rateLimit.addLimit({
    id: 'user-email-limit',
    identifier: 'user-123',
    channel: 'email',
    strategy: 'sliding_window',
    limit: 100,
    windowMs: 3600000, // 1 hour
    priority: 'normal',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('✓ Rate limit registered for user-123');

  // ============================================
  // 6. Setup User Preferences
  // ============================================
  console.log('\n=== Setting up user preferences ===');

  notifications.preferences.setPreferences({
    userId: 'user-123',
    channels: {
      email: { enabled: true, priority: 'normal' },
      sms: { enabled: true, priority: 'high' },
      push: { enabled: true, priority: 'normal' },
      slack: { enabled: true, priority: 'high' },
      discord: { enabled: false },
      webhook: { enabled: false },
      in_app: { enabled: true },
    },
    categories: {
      system: {
        enabled: true,
        channels: ['in_app', 'email'],
        priority: 'normal',
      },
      security: {
        enabled: true,
        channels: ['in_app', 'email', 'sms', 'push'],
        priority: 'urgent',
      },
      billing: {
        enabled: true,
        channels: ['in_app', 'email'],
        priority: 'normal',
      },
      deployment: {
        enabled: true,
        channels: ['in_app', 'email', 'slack'],
        priority: 'high',
      },
      performance: {
        enabled: true,
        channels: ['in_app'],
        priority: 'low',
      },
      alert: {
        enabled: true,
        channels: ['in_app', 'email', 'sms', 'push'],
        priority: 'high',
      },
      social: {
        enabled: true,
        channels: ['in_app'],
        priority: 'low',
      },
      marketing: {
        enabled: false,
        channels: ['in_app', 'email'],
        priority: 'low',
      },
      workflow: {
        enabled: true,
        channels: ['in_app', 'email'],
        priority: 'normal',
      },
    },
    schedule: {
      enabled: true,
      schedules: [
        {
          id: 'work-hours',
          name: 'Work Hours',
          daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
          startTime: '09:00',
          endTime: '18:00',
          channels: ['slack', 'email'],
          categories: ['deployment', 'performance'],
        },
      ],
    },
    grouping: {
      enabled: true,
      windowMinutes: 5,
      maxGroupSize: 10,
      channels: ['email'],
    },
    doNotDisturb: {
      enabled: false,
      schedules: [],
      overrideUrgent: true,
      overrideCritical: true,
    },
    locale: 'en',
    timezone: 'America/New_York',
    updatedAt: new Date(),
  });
  console.log('✓ User preferences registered for user-123');

  // ============================================
  // 7. Send Notifications
  // ============================================
  console.log('\n=== Sending notifications ===');

  // Create recipient
  const recipient: NotificationRecipient = {
    id: 'recipient-1',
    userId: 'user-123',
    type: 'email',
    address: 'john.doe@example.com',
    verified: true,
    primary: true,
    createdAt: new Date(),
  };

  // Send welcome email using template
  console.log('\nSending welcome email...');
  const welcomeResults = await notifications.sendFromTemplate(
    'welcome-email',
    [recipient],
    {
      userId: 'user-123',
      channel: 'email',
      category: 'system',
      priority: 'normal',
      locale: 'en',
      variables: {
        name: 'John Doe',
      },
    }
  );

  console.log(`✓ Welcome email sent: ${welcomeResults.size} recipients`);

  // Send a direct notification
  console.log('\nSending direct notification...');
  const notification: Notification = {
    id: 'notif-direct-1',
    userId: 'user-123',
    channel: 'email',
    category: 'system',
    priority: 'normal',
    status: 'pending',
    subject: 'System Update',
    content: 'A system update has been scheduled for tonight at 11 PM EST.',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const directResults = await notifications.send(notification, [recipient]);
  console.log(`✓ Direct notification sent: ${directResults.size} recipients`);

  // Send a critical alert
  console.log('\nSending critical alert...');
  const alert = {
    id: 'alert-critical-1',
    title: 'Database Connection Failed',
    description: 'Unable to connect to the primary database. Automatic failover initiated.',
    severity: 'critical' as const,
    status: 'open' as const,
    source: 'database-monitor',
    type: 'connection-error',
    priority: 'urgent' as const,
    data: {
      database: 'prod-db-1',
      region: 'us-east-1',
      error: 'Connection timeout',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await notifications.sendAlert(alert);
  console.log('✓ Critical alert sent and routed');

  // ============================================
  // 8. Check System Health
  // ============================================
  console.log('\n=== System health ===');

  const health = await notifications.getHealthStatus();

  console.log('\nChannel Health:');
  for (const [channel, healthy] of health.channels.entries()) {
    console.log(`  ${channel}: ${healthy ? '✓ Healthy' : '✗ Unhealthy'}`);
  }

  console.log('\nDelivery Stats:');
  console.log(`  Total Jobs: ${health.delivery.totalJobs}`);
  console.log(`  Pending: ${health.delivery.pendingJobs}`);
  console.log(`  Delivered: ${health.delivery.deliveredJobs}`);
  console.log(`  Failed: ${health.delivery.failedJobs}`);

  console.log('\nRate Limiting:');
  console.log(`  Total Limits: ${health.rateLimit.totalLimits}`);
  console.log(`  Active States: ${health.rateLimit.activeStates}`);

  console.log('\nEscalation:');
  console.log(`  Total Escalations: ${health.escalation.totalEscalations}`);
  console.log(`  Active Escalations: ${health.escalation.activeEscalations}`);

  // ============================================
  // 9. Cleanup
  // ============================================
  console.log('\n=== Shutting down ===');

  await notifications.shutdown();
  console.log('✓ Notification system shut down gracefully');

  console.log('\n=== Example complete ===');
}

// Run the example
if (require.main === module) {
  main().catch((error) => {
    console.error('Error running example:', error);
    process.exit(1);
  });
}

export { main };
