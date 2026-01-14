/**
 * Multi-Provider Integration System
 *
 * Unified client interface for 12+ AI providers with intelligent routing,
 * automatic failover, quota tracking, and health monitoring.
 *
 * Supported Providers:
 * - Cloudflare Workers AI (10K neurons/day free)
 * - Groq (840 TPS, generous free tier)
 * - Cerebras (2600 TPS, free tier)
 * - OpenRouter ($1 + 50 free/day, 300+ models)
 * - Together AI, Hugging Face, Baseten, Replicate, and more...
 *
 * @example
 * ```typescript
 * import { createProviderRegistry, createRequestRouter } from './lib/providers';
 * import { createCloudflareAIProvider } from './lib/providers/cloudflare-ai';
 * import { createGroqProvider } from './lib/providers/groq';
 *
 * // Create registry and register providers
 * const registry = createProviderRegistry();
 * registry.register(createCloudflareAIProvider({ accountId, apiToken }), { priority: 10 });
 * registry.register(createGroqProvider({ apiKey }), { priority: 8 });
 *
 * // Create router
 * const router = createRequestRouter(registry, {
 *   defaultStrategy: RoutingStrategy.FREE_TIER_FIRST,
 * });
 *
 * // Route requests
 * const response = await router.route({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */

// Base types and interfaces
export * from './base';

// Provider implementations
export { createCloudflareAIProvider, CloudflareAIProvider } from './cloudflare-ai';
export { createGroqProvider, GroqProvider } from './groq';
export { createCerebrasProvider, CerebrasProvider } from './cerebras';
export { createOpenRouterProvider, OpenRouterProvider } from './openrouter';

// Registry and router
export {
  createProviderRegistry,
  ProviderRegistry,
  type RegistryConfig,
  type ProviderMetadata,
} from './registry';

export {
  createRequestRouter,
  RequestRouter,
  RoutingStrategy,
  type RoutingConfig,
  type RoutingResult,
} from './router';

// Circuit breaker and retry
export {
  createCircuitBreaker,
  CircuitBreaker,
  createRetryPolicy,
  RetryPolicy,
  createResilientWrapper,
  ResilientWrapper,
  CircuitState,
  type CircuitBreakerConfig,
  type RetryConfig,
} from './circuit-breaker';

// Quota tracking
export {
  createQuotaTracker,
  QuotaTracker,
  type QuotaConfig,
  type CapacityPrediction,
  type QuotaAlert,
} from './quota';
