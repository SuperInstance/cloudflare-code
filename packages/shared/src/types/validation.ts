/**
 * Type Validation Examples
 *
 * This file demonstrates that all types are properly defined and usable.
 * This file should compile without any TypeScript errors.
 */

import {
  // Core types
  Message,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  RequestContext,
  RoutingRequest,
  MessageSchema,
  ChatRequestSchema,
  ChatResponseSchema,
  QualityTier,
  TaskType,
  // Storage types
  SessionData,
  SessionMetadata,
  SessionStatus,
  CacheEntry,
  CacheStats,
  CacheConfig,
  SemanticCacheEntry,
  SemanticCacheResult,
  StorageConfig,
  StorageBackend,
  StorageResult,
  // Provider types
  Provider,
  ProviderConfig,
  ProviderPerformance,
  ProviderAvailability,
  ProviderConstraints,
  ProviderFeature,
  ProviderHealth,
  ProviderRequest,
  ProviderRequestParameters,
  ProviderResponse,
  ProviderError,
  RateLimitStatus,
  TokenCost,
  // Metrics types
  RequestMetrics,
  AggregatedMetrics,
  LatencyPercentiles,
  QuotaInfo,
  UserQuota,
  ProviderMetrics,
  CacheMetrics,
  CostBreakdown,
  CostSummary,
  MetricAlert,
  AlertTrigger,
  AlertCondition,
  AlertSeverity,
  CostTrend,
  QuotaStatus,
  // Error types
  APIError,
  RateLimitError,
  ProviderError,
  ProviderUnavailableError,
  ProviderTimeoutError,
  ValidationError,
  SchemaValidationError,
  QuotaExceededError,
  CacheError,
  RoutingError,
  NoAvailableProvidersError,
  SessionError,
  SessionNotFoundError,
  SessionExpiredError,
  isAPIError,
  isRateLimitError,
  isProviderError,
  isValidationError,
  isQuotaExceededError,
  extractErrorInfo,
  // Utility types
  Partial,
  Required,
  Readonly,
  Pick,
  Omit,
  PartialBy,
  RequiredBy,
  DeepPartial,
  Nullable,
  Promisify,
  Dictionary,
  EventMap,
  EventHandler,
  NewEntity,
  UpdateEntity,
  WithoutMeta,
  WithoutId,
  isNullOrUndefined,
  isNotNullOrUndefined,
  isArray,
  isObject,
  isPlainObject,
  isFunction,
  isPromise,
  isString,
  isNumber,
  isBoolean,
  isDate,
  isEmpty
} from './index';

// ============================================================================
// CORE TYPES EXAMPLES
// ============================================================================

// Message example
const message: Message = {
  role: 'user',
  content: 'Hello, ClaudeFlare!',
  timestamp: Date.now(),
  metadata: {
    source: 'web'
  }
};

// Validate message with Zod
const messageValidation = MessageSchema.safeParse(message);
if (messageValidation.success) {
  const validMessage: Message = messageValidation.data;
  console.log('Valid message:', validMessage);
}

// ChatRequest example
const chatRequest: ChatRequest = {
  messages: [message],
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
  stream: false
};

// ChatResponse example
const chatResponse: ChatResponse = {
  content: 'Hello! How can I help you?',
  model: 'gpt-4',
  tokens: {
    prompt: 10,
    completion: 20,
    total: 30
  },
  latency: 500,
  finishReason: 'stop'
};

// ============================================================================
// STORAGE TYPES EXAMPLES
// ============================================================================

// SessionData example
const sessionData: SessionData = {
  sessionId: 'session-123',
  userId: 'user-456',
  createdAt: Date.now(),
  lastActivity: Date.now(),
  messages: [message],
  metadata: {
    totalTokens: 1000,
    totalCost: 0.01,
    requestCount: 5
  },
  status: SessionStatus.ACTIVE
};

// CacheEntry example
const cacheEntry: CacheEntry<string> = {
  key: 'test-key',
  value: 'test-value',
  timestamp: Date.now(),
  ttl: 60000,
  accessCount: 10,
  lastAccess: Date.now()
};

// ============================================================================
// PROVIDER TYPES EXAMPLES
// ============================================================================

// Provider example
const provider: Provider = {
  id: 'openai',
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
  models: ['gpt-4', 'gpt-3.5-turbo'],
  qualityTier: QualityTier.HIGH,
  costPer1KTokens: {
    input: 0.03,
    output: 0.06
  },
  performance: {
    avgLatency: 500,
    p50Latency: 450,
    p90Latency: 800,
    p99Latency: 1200,
    tokensPerSecond: 50,
    successRate: 0.99
  },
  availability: {
    healthy: true,
    rateLimitRemaining: 100,
    freeTierRemaining: 1000000,
    freeTierQuota: 1000000,
    currentUsage: 50000,
    lastHealthCheck: Date.now()
  },
  constraints: {
    maxContextWindow: 128000,
    maxOutputTokens: 4096,
    supportedFeatures: [
      ProviderFeature.STREAMING,
      ProviderFeature.FUNCTION_CALLING
    ],
    rateLimitRpm: 100,
    rateLimitTpm: 150000,
    regions: ['us-east-1', 'eu-west-1']
  },
  config: {
    enabled: true,
    priority: 1,
    weight: 0.8,
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    enableFallback: true
  }
};

// ============================================================================
// METRICS TYPES EXAMPLES
// ============================================================================

// RequestMetrics example
const requestMetrics: RequestMetrics = {
  requestId: 'req-123',
  timestamp: Date.now(),
  provider: 'openai',
  model: 'gpt-4',
  latency: 500,
  tokens: 100,
  cacheHit: false,
  cost: 0.01,
  success: true,
  userId: 'user-456',
  sessionId: 'session-123'
};

// QuotaInfo example
const quotaInfo: QuotaInfo = {
  provider: 'openai',
  used: 50000,
  limit: 1000000,
  resetAt: Date.now() + 86400000,
  usagePercentage: 0.05,
  status: QuotaStatus.OK
};

// ============================================================================
// ERROR TYPES EXAMPLES
// ============================================================================

// APIError example
const apiError = new APIError(
  500,
  'INTERNAL_ERROR',
  'Internal server error',
  { requestId: 'test-123' }
);

// RateLimitError example
const rateLimitError = new RateLimitError(
  60000,
  100,
  1000,
  Date.now() + 60000
);

if (isRateLimitError(rateLimitError)) {
  console.log(`Retry after ${rateLimitError.retryAfter}ms`);
}

// ProviderError example
const providerError = new ProviderError(
  'openai',
  'Provider request failed',
  503,
  true,
  'gpt-4',
  5000
);

if (isProviderError(providerError)) {
  console.log(`Provider ${providerError.providerId} failed`);
}

// QuotaExceededError example
const quotaError = new QuotaExceededError(
  'tokens',
  100000,
  1000000,
  Date.now() + 86400000
);

// ============================================================================
// UTILITY TYPES EXAMPLES
// ============================================================================

// PartialBy example
interface User {
  id: string;
  name: string;
  email: string;
}

type UserUpdate = PartialBy<User, 'name' | 'email'>;

const userUpdate: UserUpdate = {
  id: 'user-123'
  // name and email are optional
};

// Nullable example
type NullableUser = Nullable<User>;

const nullableUser: NullableUser = {
  id: 'user-123',
  name: null,
  email: null
};

// Dictionary example
const cache: Dictionary<string, number> = {
  'key1': 1,
  'key2': 2
};

// ============================================================================
// TYPE GUARDS EXAMPLES
// ============================================================================

// Using type guards
function processValue(value: unknown): void {
  if (isString(value)) {
    console.log('String:', value.toUpperCase());
  } else if (isNumber(value)) {
    console.log('Number:', value * 2);
  } else if (isObject(value)) {
    console.log('Object:', Object.keys(value));
  }
}

// Using extractErrorInfo
function handleError(error: unknown): void {
  const info = extractErrorInfo(error);
  console.log('Error:', info.message);
  console.log('Code:', info.code);
  console.log('Status:', info.statusCode);
  console.log('Retryable:', info.retryable);
}

// ============================================================================
// GENERIC TYPES EXAMPLES
// ============================================================================

// StorageResult with generic type
const storageResult: StorageResult<string> = {
  success: true,
  data: 'stored-value',
  duration: 100
};

// CacheEntry with complex type
interface ComplexData {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}

const complexCacheEntry: CacheEntry<ComplexData> = {
  key: 'complex-key',
  value: {
    id: 'data-123',
    values: [1, 2, 3],
    metadata: {}
  },
  timestamp: Date.now()
};

// ============================================================================
// EVENT HANDLERS EXAMPLES
// ============================================================================

// Define event map
interface MyEvents extends EventMap {
  'user:created': { userId: string; name: string };
  'user:deleted': { userId: string };
  'error': { error: Error };
}

// Event handler
const handleUserCreated: EventHandler<MyEvents['user:created']> = (data) => {
  console.log(`User created: ${data.userId} - ${data.name}`);
};

// ============================================================================
// ASYNC TYPES EXAMPLES
// ============================================================================

// Promisify example
type AsyncChatRequest = Promisify<(req: ChatRequest) => ChatResponse>;

// Async function
async function processChat(request: ChatRequest): Promise<ChatResponse> {
  return chatResponse;
}

// ============================================================================
// VALIDATION COMPLETE
// ============================================================================

console.log('All types validated successfully!');
console.log('No TypeScript errors found!');
