# @claudeflare/partners

Comprehensive partner integration framework for ClaudeFlare distributed AI coding platform.

## Features

- **OAuth 2.0 & OIDC Support**: Full implementation of OAuth 2.0 (RFC 6749) and OpenID Connect Core 1.0
- **Webhook Framework**: Event delivery with retry logic, signature verification, and queue management
- **20+ Integration Templates**: Pre-built integrations for popular platforms
- **Monitoring & Metrics**: Track integration performance, health, and usage
- **Partner API**: RESTful API for managing integrations
- **Type-Safe**: Full TypeScript support

## Supported Integrations

### Git Platforms
- GitHub
- GitLab
- Bitbucket
- Gitea
- Azure DevOps

### CI/CD
- Jenkins
- CircleCI

### Project Management
- Jira
- Linear
- Asana
- Trello
- Monday.com

### Communication
- Slack
- Discord
- Microsoft Teams
- Mattermost

### Documentation
- Notion
- Confluence

### Code Quality
- SonarQube

## Installation

```bash
npm install @claudeflare/partners
```

## Quick Start

```typescript
import { IntegrationManager, getRegistry } from '@claudeflare/partners';

// Get available integrations
const registry = getRegistry();
const templates = registry.getAll();

// Create integration manager
const manager = new IntegrationManager();

// Create GitHub integration
const integration = await manager.createIntegration({
  partnerId: 'github',
  userId: 'user-123',
  workspaceId: 'workspace-456',
  name: 'My GitHub Integration',
  authConfig: {
    method: 'oauth2',
    credentials: {
      access_token: 'github_token'
    }
  },
  webhookConfig: {
    url: 'https://example.com/webhooks',
    events: ['push', 'pull_request', 'issues']
  }
});

// Execute action
const result = await manager.executeAction(
  integration.config.id,
  'create-issue',
  {
    owner: 'myorg',
    repo: 'myrepo',
    title: 'New issue from ClaudeFlare',
    body: 'Issue description'
  }
);
```

## OAuth Flow

```typescript
import { OAuthProviderService } from '@claudeflare/partners/oauth';

const oauth = new OAuthProviderService();

// Generate authorization URL
const { url, session } = oauth.generateAuthorizationUrl(
  'github',
  'client_id',
  'https://example.com/callback',
  ['repo', 'user']
);

// Redirect user to authorization URL
// After callback, exchange code for token
const token = await oauth.exchangeCodeForToken(
  'github',
  code,
  state,
  session
);
```

## Webhooks

```typescript
import { WebhookManager } from '@claudeflare/partners/webhooks';

const webhookManager = new WebhookManager();

// Create webhook
const webhook = await webhookManager.createWebhook({
  partnerId: 'github',
  integrationId: 'integration-123',
  url: 'https://example.com/webhooks',
  events: ['push', 'pull_request'],
  headers: {
    'X-Custom-Header': 'value'
  }
});

// Deliver event
await webhookManager.deliverEvent(
  webhook,
  'push',
  {
    ref: 'refs/heads/main',
    repository: { name: 'myrepo' },
    commits: []
  }
);

// Get delivery history
const history = webhookManager.getHistory(webhook.id, 100);
const stats = webhookManager.getStats(webhook.id);
```

## Monitoring

```typescript
import { IntegrationMonitoringService } from '@claudeflare/partners/monitoring';

const monitoring = new IntegrationMonitoringService();

// Record API call
monitoring.recordAPICall(
  'github',
  'integration-123',
  true,
  150
);

// Get metrics
const metrics = monitoring.getAggregatedMetrics('github', 'integration-123', 'hour');

// Get alerts
const alerts = monitoring.getAlerts('integration-123');

// Perform health check
const health = await monitoring.performHealthCheck('integration-123', [
  {
    name: 'API Connectivity',
    check: async () => {
      const response = await fetch('https://api.github.com');
      return {
        pass: response.ok,
        message: 'API is reachable'
      };
    }
  }
]);
```

## API Routes

```typescript
import { PartnerAPIRouter } from '@claudeflare/partners/api';

const router = new PartnerAPIRouter();

// Handle incoming requests
const response = await router.route(request);
```

## Creating Custom Integrations

```typescript
import { IntegrationTemplate } from '@claudeflare/partners';

const customTemplate: IntegrationTemplate = {
  id: 'my-platform',
  partnerId: 'my-platform',
  name: 'My Platform',
  description: 'Custom integration',
  category: 'other',
  version: '1.0.0',
  author: 'Me',
  authConfig: ['api-key'],
  webhookEvents: ['event.created'],
  actions: [
    {
      id: 'create-item',
      name: 'Create Item',
      description: 'Create a new item',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      endpoint: '/items',
      method: 'POST',
      requiredScopes: []
    }
  ],
  triggers: [],
  configuration: [],
  permissions: [],
  examples: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

// Register template
const registry = getRegistry();
registry.register(customTemplate);
```

## API Reference

### OAuthProviderService

- `registerProvider(provider)` - Register OAuth provider
- `getProvider(id)` - Get provider by ID
- `generateAuthorizationUrl()` - Generate authorization URL
- `exchangeCodeForToken()` - Exchange code for access token
- `refreshToken()` - Refresh access token
- `revokeToken()` - Revoke access token

### WebhookManager

- `createWebhook()` - Create webhook subscription
- `deliverEvent()` - Deliver webhook event
- `verifyWebhook()` - Verify webhook signature
- `getHistory()` - Get delivery history
- `getStats()` - Get delivery statistics

### IntegrationManager

- `createIntegration()` - Create integration instance
- `executeAction()` - Execute integration action
- `triggerWebhook()` - Trigger webhook event
- `getMetrics()` - Get integration metrics
- `testConnection()` - Test integration connection

### IntegrationMonitoringService

- `recordMetrics()` - Record integration metrics
- `recordAPICall()` - Record API call
- `getAggregatedMetrics()` - Get aggregated metrics
- `createAlert()` - Create alert
- `performHealthCheck()` - Perform health check

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
