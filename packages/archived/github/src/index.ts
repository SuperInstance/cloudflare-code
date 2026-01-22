/**
 * @claudeflare/github - GitHub Integration and Automation
 * Main export file for the GitHub integration package
 */

// @ts-nocheck - Missing type exports

// Client
export {
  GitHubClient,
  createGitHubClient,
  RateLimitTracker
} from './client/client';

// Webhooks
export {
  WebhookHandler,
  WebhookEventRegistry,
  WebhookMiddleware,
  WebhookDeliveryTracker,
  EventFilters,
  WebhookEventBuilders,
  createWebhookHandler,
  createWebhookMiddleware
} from './webhooks/handler';

// Pull Requests
export {
  PRAutomation,
  createPRAutomation
} from './pr/automation';

// Issues
export {
  IssueManager,
  createIssueManager
} from './issues/manager';

// Repository
export {
  RepositoryManager,
  createRepositoryManager
} from './repo/manager';

// CI/CD
export {
  CICDIntegration,
  createCICDIntegration
} from './cicd/integration';

// Security
export {
  SecurityIntegration,
  createSecurityIntegration
} from './security/scanner';

// Types
export * from './types';

// Errors
export * from './errors';

// Cache
export {
  CacheProvider,
  MemoryCacheProvider,
  RedisCacheProvider,
  CacheFactory,
  CacheKeyGenerator,
  cached
} from './cache/cache';

// Default export
export { GitHubClient as default } from './client/client';
