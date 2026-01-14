/**
 * ClaudeFlare DevOps Package
 *
 * Advanced DevOps and GitOps automation for distributed AI coding platform
 */

// Core GitOps Engine
export { GitOpsEngine } from './gitops/engine';
export { GitProviderAdapter } from './gitops/providers/git-provider-adapter';
export { GitHubAdapter } from './gitops/providers/github-adapter';
export { GitLabAdapter } from './gitops/providers/gitlab-adapter';
export { BitbucketAdapter } from './gitops/providers/bitbucket-adapter';
export { KubernetesClient } from './gitops/providers/kubernetes-client';
export { CloudflareClient, CloudflareConfig } from './gitops/providers/cloudflare-client';

// IaC Generator
export { IaCGenerator, IaCGenerationOptions, IaCGenerationResult } from './iac/generator';

// Deployment Orchestrator
export { DeploymentOrchestrator, DeploymentOptions, DeploymentResult } from './deployment/orchestrator';

// Utilities
export { Logger, LoggerConfig } from './utils/logger';
export { MetricsCollector, MetricsConfig } from './utils/metrics';
export { Validator } from './utils/validator';
export { TemplateEngine } from './utils/template-engine';
export {
  DurableObjectCoordinator,
  InMemoryStorage,
  DurableObjectStorage,
} from './utils/durable-object';
export { computeCostEstimate } from './utils/cost-calculator';
export {
  generateHash,
  diffObjects,
  sleep,
  retry,
  parallel,
  parseDuration,
  formatDuration,
  truncate,
  sanitizeResourceName,
  generateId,
  deepClone,
  deepMerge,
  chunk,
  debounce,
  throttle,
  isDefined,
  isEmpty,
  pick,
  omit,
} from './utils/helpers';

// Types
export * from './types';
