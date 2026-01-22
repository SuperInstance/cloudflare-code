/**
 * Core type definitions for LLM Orchestration
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Provider Types
// ============================================================================

export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'meta'
  | 'mistral'
  | 'cohere'
  | 'ai21'
  | 'huggingface'
  | 'alexa'
  | 'amazon'
  | 'azure'
  | 'baidu'
  | 'deepmind'
  | 'nvidia'
  | 'stability'
  | 'xai'
  | 'together'
  | 'replicate'
  | 'custom';

export type ProviderRegion = 'us' | 'eu' | 'asia' | 'global';

export interface ProviderConfig {
  id: string;
  name: string;
  provider: LLMProvider;
  region: ProviderRegion;
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  enabled: boolean;
  priority?: number;
}

// ============================================================================
// Model Types
// ============================================================================

export interface ModelCapability {
  name: string;
  supported: boolean;
  confidence?: number;
  notes?: string;
}

export interface ModelCapabilities {
  codeGeneration: ModelCapability;
  codeAnalysis: ModelCapability;
  textGeneration: ModelCapability;
  textAnalysis: ModelCapability;
  translation: ModelCapability;
  summarization: ModelCapability;
  questionAnswering: ModelCapability;
  reasoning: ModelCapability;
  mathematics: ModelCapability;
  functionCalling: ModelCapability;
  multimodal: ModelCapability;
  streaming: ModelCapability;
  jsonMode: ModelCapability;
  systemPrompt: ModelCapability;
  contextWindow: ModelCapability;
  toolUse: ModelCapability;
}

export type ModelSize = 'mini' | 'small' | 'medium' | 'large' | 'xlarge';
export type ModelTier = 'free' | 'basic' | 'standard' | 'premium' | 'enterprise';

export interface ModelPricing {
  input: number; // per 1M tokens
  output: number; // per 1M tokens
  currency?: string;
  effectiveDate?: Date;
  tier?: ModelTier;
}

export interface ModelPerformanceMetrics {
  avgLatency: number; // ms
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number; // requests per second
  successRate: number; // 0-1
  errorRate: number; // 0-1
  timeoutRate: number; // 0-1
  lastUpdated: Date;
}

export interface ModelConstraints {
  maxTokens: number;
  maxOutputTokens?: number;
  maxContextLength?: number;
  maxRequestsPerMinute?: number;
  maxTokensPerMinute?: number;
  maxConcurrentRequests?: number;
  allowedLanguages?: string[];
  forbiddenUseCases?: string[];
}

export interface ModelVersion {
  version: string;
  released: Date;
  deprecated?: Date;
  changelog?: string;
}

export interface ModelMetadata {
  id: string;
  name: string;
  provider: LLMProvider;
  version: string;
  size: ModelSize;
  tier: ModelTier;
  capabilities: ModelCapabilities;
  pricing: ModelPricing;
  performance: ModelPerformanceMetrics;
  constraints: ModelConstraints;
  versions: ModelVersion[];
  tags: string[];
  documentation?: string;
  fineTuned: boolean;
  baseModel?: string;
}

export type ModelStatus = 'available' | 'degraded' | 'unavailable' | 'maintenance';

export interface ModelInfo {
  metadata: ModelMetadata;
  status: ModelStatus;
  availability: number; // 0-1
  currentLoad: number; // 0-1
  lastHealthCheck: Date;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool' | 'function';

export interface Message {
  role: MessageRole;
  content: string | Array<TextContent | ImageContent | ToolUseContent>;
  name?: string;
  toolCallId?: string;
}

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  source: {
    type: 'url' | 'base64';
    data: string;
    mediaType?: string;
  };
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ResponseFormat = 'text' | 'json' | 'json_object' | 'schemad';

export interface LLMRequest {
  messages: Message[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'any' | 'none' | { type: 'tool'; name: string };
  responseFormat?: ResponseFormat;
  stream?: boolean;
  user?: string;
  metadata?: Record<string, unknown>;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: Message;
    finishReason: string | null;
  }>;
  usage: Usage;
  created: number;
  object?: string;
  systemFingerprint?: string;
  toolCalls?: ToolCall[];
  metadata?: Record<string, unknown>;
}

export interface StreamChunk {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finishReason: string | null;
  }>;
  created: number;
}

// ============================================================================
// Routing Types
// ============================================================================

export type RoutingStrategy =
  | 'capability'
  | 'cost'
  | 'performance'
  | 'latency'
  | 'availability'
  | 'round-robin'
  | 'weighted'
  | 'custom';

export interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  condition: RoutingCondition;
  action: RoutingAction;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutingCondition {
  type: 'user' | 'query' | 'context' | 'metadata' | 'composite';
  operator: 'equals' | 'contains' | 'matches' | 'in' | 'gt' | 'lt' | 'and' | 'or' | 'not';
  value: unknown;
  conditions?: RoutingCondition[];
}

export interface RoutingAction {
  type: 'select-model' | 'select-provider' | 'set-parameter' | 'transform';
  value: unknown;
}

export interface RoutingDecision {
  model: string;
  provider: LLMProvider;
  confidence: number;
  reasoning: string[];
  alternatives: Array<{
    model: string;
    provider: LLMProvider;
    score: number;
  }>;
  appliedRules: string[];
}

export interface RoutingOptions {
  strategy?: RoutingStrategy;
  fallbackEnabled?: boolean;
  fallbackModels?: string[];
  timeout?: number;
  maxRetries?: number;
  costLimit?: number;
  latencyLimit?: number;
  capabilityRequirements?: Partial<ModelCapabilities>;
}

// ============================================================================
// Prompt Types
// ============================================================================

export type PromptTemplateType = 'basic' | 'chat' | 'completion' | 'function';

export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  default?: unknown;
  description?: string;
  validation?: VariableValidation;
}

export interface VariableValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: unknown[];
  custom?: (value: unknown) => boolean | string;
}

export interface PromptExample {
  input: Record<string, unknown>;
  output: string;
  explanation?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  type: PromptTemplateType;
  template: string;
  variables: PromptVariable[];
  examples: PromptExample[];
  systemPrompt?: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface PromptOptimizationResult {
  originalTemplate: string;
  optimizedTemplate: string;
  improvements: string[];
  metrics: {
    clarity: number;
    specificity: number;
    conciseness: number;
    effectiveness: number;
  };
  suggestions: string[];
}

export interface PromptTestCase {
  id: string;
  templateId: string;
  variables: Record<string, unknown>;
  expectedOutput?: string;
  evaluationCriteria?: string[];
}

// ============================================================================
// Aggregation Types
// ============================================================================

export type AggregationMethod =
  | 'consensus'
  | 'voting'
  | 'weighted'
  | 'ranked'
  | 'ensemble'
  | 'custom';

export interface AggregationConfig {
  method: AggregationMethod;
  weights?: Record<string, number>;
  threshold?: number;
  strategy: 'majority' | 'supermajority' | 'unanimity' | 'best';
  tieBreaker?: 'first' | 'random' | 'quality' | 'cost';
  qualityWeights?: {
    relevance: number;
    accuracy: number;
    completeness: number;
    coherence: number;
  };
}

export interface AggregatedResponse {
  response: string;
  confidence: number;
  sources: Array<{
    model: string;
    provider: LLMProvider;
    response: string;
    weight: number;
    quality: number;
  }>;
  consensus: number;
  reasoning: string;
  metadata: Record<string, unknown>;
}

export interface QualityScore {
  overall: number;
  relevance: number;
  accuracy: number;
  completeness: number;
  coherence: number;
  details: Record<string, number>;
}

// ============================================================================
// Cost Types
// ============================================================================

export interface CostTracking {
  model: string;
  provider: LLMProvider;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  timestamp: Date;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface BudgetConfig {
  id: string;
  name: string;
  limit: number;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  scope: 'global' | 'user' | 'team' | 'project';
  scopeId?: string;
  alertThreshold?: number;
  hardLimit?: boolean;
  actions?: BudgetAction[];
}

export interface BudgetAction {
  type: 'alert' | 'throttle' | 'reject' | 'downgrade';
  threshold: number;
  parameters?: Record<string, unknown>;
}

export interface CostReport {
  period: {
    start: Date;
    end: Date;
  };
  totalCost: number;
  breakdown: {
    byModel: Record<string, number>;
    byProvider: Record<LLMProvider, number>;
    byUser: Record<string, number>;
  };
  trends: {
    average: number;
    change: number;
    changePercent: number;
  };
  optimization: {
    potentialSavings: number;
    recommendations: string[];
  };
}

export interface CostOptimizationStrategy {
  name: string;
  description: string;
  enabled: boolean;
  parameters: Record<string, unknown>;
  results?: {
    savings: number;
    tradeoffs: string[];
  };
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitConfig {
  requests?: number;
  tokens?: number;
  cost?: number;
  window: number; // milliseconds
}

export interface RateLimitQuota {
  id: string;
  name: string;
  scope: 'global' | 'user' | 'api-key' | 'model';
  scopeId?: string;
  limits: RateLimitConfig;
  priority?: number;
  burstAllowance?: number;
}

export interface RateLimitState {
  requests: number;
  tokens: number;
  cost: number;
  windowStart: number;
  lastRequest: number;
}

export interface ThrottleConfig {
  strategy: 'fixed-window' | 'sliding-window' | 'token-bucket' | 'leaky-bucket';
  queueSize: number;
  queueTimeout: number;
  retryAfter?: number;
  priorityLevels?: number[];
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry {
  key: string;
  request: LLMRequest;
  response: LLMResponse;
  createdAt: Date;
  expiresAt: Date;
  hits: number;
  size: number;
  metadata?: Record<string, unknown>;
}

export interface CacheConfig {
  enabled: boolean;
  maxSize: number;
  maxAge: number;
  strategy: 'lru' | 'lfu' | 'ttl' | 'adaptive';
  compressionEnabled: boolean;
  semanticCacheEnabled: boolean;
  semanticThreshold: number;
}

// ============================================================================
// Monitoring Types
// ============================================================================

export interface HealthCheck {
  model: string;
  provider: LLMProvider;
  status: ModelStatus;
  latency: number;
  error: string | null;
  timestamp: Date;
}

export interface Metrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    cached: number;
  };
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  cost: {
    total: number;
    byModel: Record<string, number>;
  };
  models: Record<string, ModelMetrics>;
}

export interface ModelMetrics {
  requests: number;
  successes: number;
  failures: number;
  avgLatency: number;
  avgTokens: number;
  totalCost: number;
  lastUsed: Date;
}

// ============================================================================
// Error Types
// ============================================================================

export class LLMOrchestrationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'LLMOrchestrationError';
    Error.captureStackTrace(this, LLMOrchestrationError);
  }
}

export class ModelUnavailableError extends LLMOrchestrationError {
  constructor(model: string, reason?: string) {
    super(
      `Model ${model} is unavailable${reason ? `: ${reason}` : ''}`,
      'MODEL_UNAVAILABLE',
      { model }
    );
    this.name = 'ModelUnavailableError';
  }
}

export class RateLimitExceededError extends LLMOrchestrationError {
  constructor(
    scope: string,
    limit: number,
    resetTime?: Date
  ) {
    super(
      `Rate limit exceeded for ${scope}. Limit: ${limit}${resetTime ? `. Resets at ${resetTime.toISOString()}` : ''}`,
      'RATE_LIMIT_EXCEEDED',
      { scope, limit, resetTime }
    );
    this.name = 'RateLimitExceededError';
  }
}

export class BudgetExceededError extends LLMOrchestrationError {
  constructor(
    budget: string,
    limit: number,
    current: number
  ) {
    super(
      `Budget ${budget} exceeded. Limit: ${limit}, Current: ${current}`,
      'BUDGET_EXCEEDED',
      { budget, limit, current }
    );
    this.name = 'BudgetExceededError';
  }
}

export class PromptValidationError extends LLMOrchestrationError {
  constructor(
    template: string,
    errors: string[]
  ) {
    super(
      `Prompt template validation failed for ${template}: ${errors.join(', ')}`,
      'PROMPT_VALIDATION_ERROR',
      { template, errors }
    );
    this.name = 'PromptValidationError';
  }
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface LLMOrchestrationConfig {
  providers: ProviderConfig[];
  models?: string[];
  defaultRoutingStrategy?: RoutingStrategy;
  defaultAggregationMethod?: AggregationMethod;
  cache?: CacheConfig;
  monitoring?: {
    enabled: boolean;
    sampleRate: number;
    detailedMetrics: boolean;
  };
  rateLimit?: {
    enabled: boolean;
    defaultLimits: RateLimitConfig;
    throttleConfig: ThrottleConfig;
  };
  budget?: BudgetConfig[];
  fallback?: {
    enabled: boolean;
    maxRetries: number;
    fallbackModels: string[];
  };
  timeout?: number;
  debug?: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

export interface LLMOrchestrationEvents {
  'request:start': { requestId: string; request: LLMRequest };
  'request:complete': { requestId: string; response: LLMResponse; duration: number };
  'request:error': { requestId: string; error: Error; duration: number };
  'request:cache-hit': { requestId: string; cacheEntry: CacheEntry };
  'routing:decision': { requestId: string; decision: RoutingDecision };
  'model:selected': { requestId: string; model: string; provider: LLMProvider };
  'model:unavailable': { model: string; provider: LLMProvider; error: Error };
  'budget:exceeded': { budget: string; limit: number; current: number };
  'rate-limit:exceeded': { scope: string; limit: number; resetTime: Date };
  'aggregation:complete': { requestId: string; result: AggregatedResponse };
}

export type LLMOrchestrationEventType = keyof LLMOrchestrationEvents;

// ============================================================================
// Durable Object Types
// ============================================================================

export interface DurableObjectState {
  models: Record<string, ModelInfo>;
  rateLimits: Record<string, RateLimitState>;
  budgets: Record<string, { spent: number; periodStart: number }>;
  cache: Record<string, CacheEntry>;
  metrics: Metrics;
  routingRules: RoutingRule[];
  lastUpdated: number;
}

export interface DurableObjectStorage {
  get: <T>(key: string) => Promise<T | undefined>;
  put: <T>(key: string, value: T) => Promise<void>;
  delete: (key: string) => Promise<void>;
  list: (prefix?: string) => Promise<string[]>;
  transaction: <T>(callback: (txn: Transaction) => Promise<T>) => Promise<T>;
}

export interface Transaction {
  get: <T>(key: string) => Promise<T | undefined>;
  put: <T>(key: string, value: T) => Promise<void>;
  delete: (key: string) => Promise<void>;
  rollback: () => void;
  commit: () => Promise<void>;
}

// ============================================================================
// Provider Interface Types
// ============================================================================

export interface LLMProviderClient {
  name: LLMProvider;
  initialize(config: ProviderConfig): Promise<void>;
  isAvailable(): Promise<boolean>;
  chat(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncIterable<StreamChunk>;
  countTokens(text: string): Promise<number>;
  getModels(): Promise<string[]>;
  estimateCost(request: LLMRequest): Promise<number>;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type AsyncCallback<T> = (data: T) => void | Promise<void>;

export type ProviderFactory = (config: ProviderConfig) => LLMProviderClient;

export type MiddlewareFunction = (
  request: LLMRequest,
  context: RequestContext
) => Promise<LLMRequest>;

export interface RequestContext {
  userId?: string;
  sessionId?: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}

export interface PluginContext {
  config: LLMOrchestrationConfig;
  events: EventEmitter;
  storage: DurableObjectStorage;
}
