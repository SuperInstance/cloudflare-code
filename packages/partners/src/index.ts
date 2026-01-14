/**
 * ClaudeFlare Partner Integrations
 *
 * Comprehensive partner integration framework for ClaudeFlare
 * Provides OAuth/OIDC, webhooks, integrations, monitoring, and API management
 *
 * @package partners
 */

// Types
export * from './types';

// OAuth/OIDC
export {
  OAuthProviderService,
  OIDCService,
  type IDTokenClaims,
  type UserInfoResponse
} from './oauth';

// Webhooks
export {
  WebhookManager,
  WebhookDeliveryService,
  WebhookQueue,
  WebhookSignatureService,
  type Webhook,
  type WebhookEvent,
  type WebhookDelivery,
  type WebhookLog
} from './webhooks';

// Integrations
export {
  IntegrationRegistry,
  IntegrationManager,
  getRegistry,
  templates,
  githubTemplate,
  gitlabTemplate,
  slackTemplate,
  jiraTemplate,
  linearTemplate,
  discordTemplate,
  notionTemplate,
  bitbucketTemplate,
  azureDevOpsTemplate,
  jenkinsTemplate,
  circleciTemplate,
  sonarqubeTemplate,
  confluenceTemplate,
  teamsTemplate,
  asanaTemplate,
  trelloTemplate,
  mondayTemplate,
  giteaTemplate,
  mattermostTemplate
} from './integrations';

// Monitoring
export {
  IntegrationMonitoringService
} from './monitoring';

// API
export {
  PartnerAPIRouter
} from './api';

// Version
export const VERSION = '1.0.0';

/**
 * Create a new partner integration instance
 */
export function createPartnerIntegration() {
  return {
    oauth: new (require('./oauth').OAuthProviderService)(),
    oidc: new (require('./oauth').OIDCService)(),
    webhooks: new (require('./webhooks').WebhookManager)(),
    integrations: new (require('./integrations').IntegrationManager)(),
    monitoring: new (require('./monitoring').IntegrationMonitoringService)(),
    api: new (require('./api').PartnerAPIRouter)()
  };
}

/**
 * Quick start - get the integration registry
 */
export function getAvailableIntegrations() {
  const { getRegistry } = require('./integrations');
  const registry = getRegistry();
  return registry.getAll();
}

/**
 * Get integration count by category
 */
export function getIntegrationStats() {
  const { getRegistry } = require('./integrations');
  const registry = getRegistry();
  return {
    total: registry.count(),
    byCategory: registry.getCategoryStats(),
    categories: registry.getCategories()
  };
}
