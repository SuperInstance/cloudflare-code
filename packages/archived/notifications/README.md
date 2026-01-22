# @claudeflare/notifications

A comprehensive multi-channel notification system for ClaudeFlare with intelligent alert routing, template engine, delivery tracking, rate limiting, preferences management, and escalation.

## Features

### 7+ Notification Channels
- **Email** - SMTP, SendGrid, AWS SES, Mailgun, Postmark
- **SMS** - Twilio, AWS SNS, MessageBird, Nexmo
- **Push** - FCM, APNs
- **Slack** - Webhooks with rich formatting
- **Discord** - Webhooks with embeds
- **Webhook** - Generic HTTP webhooks with retry logic
- **In-App** - Stored notifications for app display

### Alert Routing
- Priority-based routing rules
- Time-based routing
- On-call rotation support
- Alert grouping and deduplication
- Custom routing conditions

### Template Engine
- Multi-language support
- Template variables and inheritance
- Conditional blocks (`{{#if}}...{{/if}}`)
- Loops (`{{#each}}...{{/each}}`)
- Template caching for performance
- Template preview functionality

### Delivery Tracking
- Real-time delivery status
- Automatic retry with exponential backoff
- Bounce detection and handling
- Detailed delivery analytics
- Per-channel delivery metrics

### Rate Limiting
- Multiple strategies (fixed window, sliding window, token bucket, leaky bucket)
- Per-channel and per-user limits
- Priority-based limit adjustment
- Burst handling
- Comprehensive rate limit analytics

### Preferences Management
- User notification preferences
- Channel preferences
- Category preferences
- Time-based schedules
- Do-not-disturb functionality
- Notification grouping

### Escalation Engine
- Configurable escalation paths
- Automatic escalation on timeout
- Multi-level escalation
- Escalation history tracking
- Integration with on-call rotation

## Installation

```bash
npm install @claudeflare/notifications
```

## Quick Start

```typescript
import { NotificationSystem } from '@claudeflare/notifications';

// Initialize the notification system
const notifications = new NotificationSystem();

// Register email channel
const emailChannel = new EmailChannel({
  provider: {
    type: 'smtp',
    config: {
      host: 'smtp.example.com',
      port: 587,
      auth: {
        user: 'user@example.com',
        pass: 'password',
      },
    },
  },
});

notifications.channels.register('email', emailChannel);

// Send a notification
const notification = {
  id: 'notif-1',
  userId: 'user-1',
  channel: 'email',
  category: 'system',
  priority: 'normal',
  status: 'pending',
  subject: 'Welcome!',
  content: 'Welcome to our platform!',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const recipient = {
  id: 'recipient-1',
  userId: 'user-1',
  type: 'email',
  address: 'user@example.com',
  verified: true,
  primary: true,
  createdAt: new Date(),
};

const results = await notifications.send(notification, [recipient]);
```

## Usage Examples

### Template-based Notifications

```typescript
// Register a template
const template = {
  id: 'welcome-email',
  name: 'Welcome Email',
  category: 'system',
  channel: 'email',
  subject: 'Welcome {{name}}!',
  content: 'Dear {{name}},\n\nWelcome to our platform!',
  variables: [
    { name: 'name', type: 'string', required: true },
  ],
  locale: 'en',
  version: 1,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

notifications.templates.registerTemplate(template);

// Send using template
await notifications.sendFromTemplate('welcome-email', [recipient], {
  userId: 'user-1',
  channel: 'email',
  category: 'system',
  locale: 'en',
  variables: {
    name: 'John Doe',
  },
});
```

### Alert Routing

```typescript
// Create an alert route
const route = {
  id: 'critical-alerts',
  name: 'Critical Alerts Route',
  priority: 10,
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
        users: ['on-call-user'],
      },
    },
  ],
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

notifications.alerts.addRoute(route);

// Send an alert
const alert = {
  id: 'alert-1',
  title: 'Server Down',
  description: 'Production server is not responding',
  severity: 'critical',
  status: 'open',
  source: 'monitoring',
  type: 'server',
  priority: 'urgent',
  createdAt: new Date(),
  updatedAt: new Date(),
};

await notifications.sendAlert(alert);
```

### Rate Limiting

```typescript
// Add a rate limit
notifications.rateLimit.addLimit({
  id: 'email-limit',
  identifier: 'user-1',
  channel: 'email',
  strategy: 'sliding_window',
  limit: 100,
  windowMs: 3600000, // 1 hour
  priority: 'normal',
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Check rate limit
const check = await notifications.rateLimit.check('user-1', 'email', 'high');

if (!check.allowed) {
  console.log(`Rate limit exceeded. Retry after: ${check.retryAfter}`);
}
```

### User Preferences

```typescript
// Set user preferences
const preferences = {
  userId: 'user-1',
  channels: {
    email: { enabled: true },
    sms: { enabled: false },
    push: { enabled: true },
    slack: { enabled: false },
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
      channels: ['in_app', 'email', 'sms'],
      priority: 'urgent',
    },
    // ... more categories
  },
  schedule: {
    enabled: true,
    schedules: [],
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
};

notifications.preferences.setPreferences(preferences);

// Check if user should receive notification
const shouldNotify = notifications.preferences.shouldNotify(
  'user-1',
  'security',
  'email',
  'urgent'
);
```

### Escalation

```typescript
// Create escalation path
const path = {
  id: 'escalation-path-1',
  name: 'On-Call Escalation',
  levels: [
    {
      order: 0,
      userId: 'user-1',
      channels: ['email', 'sms'],
      timeoutMinutes: 5,
    },
    {
      order: 1,
      userId: 'user-2',
      channels: ['email', 'sms', 'slack'],
      timeoutMinutes: 10,
    },
    {
      order: 2,
      userId: 'manager',
      channels: ['email', 'sms', 'slack', 'call'],
      timeoutMinutes: 15,
    },
  ],
  timeoutMinutes: 30,
  repeatEnabled: true,
  maxEscalations: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
};

notifications.escalation.addPath(path);

// Create escalation rule
const rule = {
  id: 'escalation-rule-1',
  name: 'Critical Alert Escalation',
  priority: 10,
  conditions: [
    {
      type: 'severity',
      operator: 'equals',
      value: 'critical',
    },
    {
      type: 'unacknowledged',
      operator: 'equals',
      value: true,
      durationMinutes: 5,
    },
  ],
  pathId: 'escalation-path-1',
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

notifications.escalation.addRule(rule);
```

## API Reference

### NotificationSystem

Main class that integrates all notification components.

#### Methods

- `send(notification, recipients, options?)` - Send a notification
- `sendMultiChannel(notification, channelRecipients, options?)` - Send to multiple channels
- `sendFromTemplate(templateId, recipients, data)` - Send using a template
- `sendAlert(alert, options?)` - Send an alert with routing
- `getHealthStatus()` - Get system health status
- `shutdown()` - Shutdown the notification system

### Channel Classes

- `EmailChannel` - Email notifications
- `SmsChannel` - SMS notifications
- `PushChannel` - Push notifications
- `SlackChannel` - Slack notifications
- `DiscordChannel` - Discord notifications
- `WebhookChannel` - Webhook notifications
- `InAppChannel` - In-app notifications

### Component Classes

- `AlertRouter` - Route alerts based on rules
- `OnCallManager` - Manage on-call rotations
- `TemplateEngine` - Render notification templates
- `DeliveryTracker` - Track delivery status
- `RateLimiter` - Enforce rate limits
- `PreferencesManager` - Manage user preferences
- `EscalationEngine` - Handle alert escalation

## Configuration

Default configuration is provided but can be customized:

```typescript
import { defaultConfig } from '@claudeflare/notifications';

// Customize channel defaults
defaultConfig.channels.defaults.set('email', {
  enabled: true,
  priority: 'high',
  maxRetries: 5,
  timeout: 60000,
});

// Customize rate limits
defaultConfig.rateLimit.limits.set('email', {
  limit: 200,
  windowMs: 3600000,
  burstLimit: 20,
});
```

## Testing

```bash
npm test
npm run test:coverage
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
