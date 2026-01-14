/**
 * LLM Orchestration Package - Main Entry Point
 *
 * Provides advanced LLM orchestration and management for ClaudeFlare
 */

// Core orchestration
export {
  LLMOrchestrationEngine,
  createOrchestrationEngine,
} from './orchestration/engine.js';
export type { OrchestrationEngineConfig } from './orchestration/engine.js';

// Model Registry
export {
  ModelRegistry,
} from './models/registry.js';
export type {
  ModelInfo,
  ModelMetadata,
  ModelCapabilities,
  ModelPerformanceMetrics,
  ModelConstraints,
  ModelPricing,
  ModelComparison,
  ModelMetrics,
  ProviderState,
} from './models/registry.js';

// Router
export {
  LLMRouter,
} from './router/router.js';
export type {
  RouterConfig,
  CustomRoutingStrategy,
  RoutingAnalytics,
} from './router/router.js';

// Prompt Engine
export {
  PromptEngine,
} from './prompts/engine.js';
export type {
  PromptEngineConfig,
} from './prompts/engine.js';

// Aggregator
export {
  ResponseAggregator,
} from './aggregation/aggregator.js';
export type {
  ResponseSource,
  AggregatorOptions,
} from './aggregation/aggregator.js';

// Cost Optimizer
export {
  CostOptimizer,
} from './cost/optimizer.js';
export type {
  CostOptimizerConfig,
  UsageStats,
} from './cost/optimizer.js';

// Rate Limiter
export {
  RateLimiter,
} from './rate/limiter.js';
export type {
  RateLimiterConfig,
  QuotaStatus,
} from './rate/limiter.js';

// Types
export type {
  // Provider Types
  LLMProvider,
  ProviderRegion,
  ProviderConfig,

  // Model Types
  ModelCapability,
  ModelCapabilities,
  ModelSize,
  ModelTier,
  ModelPricing,
  ModelPerformanceMetrics,
  ModelConstraints,
  ModelVersion,
  ModelMetadata,
  ModelInfo,
  ModelStatus,

  // Request/Response Types
  MessageRole,
  Message,
  TextContent,
  ImageContent,
  ToolUseContent,
  ToolDefinition,
  ResponseFormat,
  LLMRequest,
  Usage,
  ToolCall,
  LLMResponse,
  StreamChunk,

  // Routing Types
  RoutingStrategy,
  RoutingRule,
  RoutingCondition,
  RoutingAction,
  RoutingDecision,
  RoutingOptions,

  // Prompt Types
  PromptTemplateType,
  PromptVariable,
  VariableValidation,
  PromptExample,
  PromptTemplate,
  PromptOptimizationResult,
  PromptTestCase,

  // Aggregation Types
  AggregationMethod,
  AggregationConfig,
  AggregatedResponse,
  QualityScore,

  // Cost Types
  CostTracking,
  BudgetConfig,
  BudgetAction,
  CostReport,
  CostOptimizationStrategy,

  // Rate Limiting Types
  RateLimitConfig,
  RateLimitQuota,
  RateLimitState,
  ThrottleConfig,

  // Configuration Types
  LLMOrchestrationConfig,
  LLMOrchestrationEvents,
  LLMOrchestrationEventType,

  // Error Types
  LLMOrchestrationError,
  ModelUnavailableError,
  RateLimitExceededError,
  BudgetExceededError,
  PromptValidationError,

  // Utility Types
  DeepPartial,
  AsyncCallback,
  ProviderFactory,
  MiddlewareFunction,
  RequestContext,
  PluginContext,
} from './types/index.js';

// Durable Object
export {
  LLMOrchestrationDurableObject,
} from './orchestration/durable-object.js';
export type {
  LLMOrchestrationDOState,
  CachedResponse,
} from './orchestration/durable-object.js';
