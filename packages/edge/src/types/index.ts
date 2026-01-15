/**
 * Cloudflare Workers Environment Types
 */
export interface Env {
  // KV Namespaces
  CACHE_KV?: KVNamespace;
  CONFIG_KV?: KVNamespace;
  KV?: KVNamespace; // Generic KV for codebase indexing

  // Durable Objects
  SESSIONS?: DurableObjectNamespace;
  DIRECTOR_DO?: DurableObjectNamespace;
  PLANNER_DO?: DurableObjectNamespace;
  EXECUTOR_DO?: DurableObjectNamespace;
  AGENT_REGISTRY?: DurableObjectNamespace;
  AGENTS_KV?: KVNamespace; // For agent messaging cache
  VECTOR_DB?: DurableObjectNamespace;
  GITHUB_DO?: DurableObjectNamespace; // GitHub session/token management

  // R2 Storage
  STORAGE_R2?: R2Bucket;

  // D1 Database
  DB?: D1Database;

  // Queues
  QUEUE_PRODUCER?: Queue<unknown>;

  // Cloudflare Workers AI
  AI?: AiTextEmbeddingsInput;

  // Environment Variables
  ENVIRONMENT: 'development' | 'staging' | 'production';
  API_VERSION: string;

  // AI Provider API Keys
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  GROQ_API_KEY?: string;
  CEREBRAS_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;

  // GitHub App Configuration
  GITHUB_APP_ID?: string;
  GITHUB_PRIVATE_KEY?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;

  // GitHub Storage
  GITHUB_KV?: KVNamespace; // For caching GitHub tokens/responses
  GITHUB_R2?: R2Bucket; // For storing repository archives

  // Codebase RAG Storage (runtime)
  CODEBASE_VECTOR_STORE?: unknown; // CodeVectorStore instance

  // Index signature for Hono compatibility
  [key: string]: unknown;
}

/**
 * Request Context
 */
export interface RequestContext {
  requestId: string;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

/**
 * Health Response
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  version: string;
  environment: string;
  uptime: number;
}

/**
 * Status Response
 */
export interface StatusResponse {
  status: 'operational' | 'degraded' | 'down';
  version: string;
  environment: string;
  timestamp: number;
  services: {
    api: boolean;
    cache?: boolean;
    storage?: boolean;
    database?: boolean;
    queue?: boolean;
  };
  metrics: {
    requestsPerSecond?: number;
    averageLatency?: number;
    errorRate?: number;
  };
}

/**
 * LLM Provider
 */
export type LLMProvider = 'anthropic' | 'openai' | 'groq' | 'cerebras' | 'cloudflare';

/**
 * Chat Message Role
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * Chat Message
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp?: number;
}

/**
 * Chat Completion Request
 */
export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  provider?: LLMProvider;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  sessionId?: string;
}

/**
 * Chat Completion Response
 */
export interface ChatResponse {
  id: string;
  content: string;
  model: string;
  provider: LLMProvider;
  finishReason: 'stop' | 'length' | 'content_filter';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timestamp: number;
}

/**
 * Model Information
 */
export interface Model {
  id: string;
  name: string;
  provider: LLMProvider;
  contextLength: number;
  description: string;
  capabilities: {
    streaming: boolean;
    functionCalling: boolean;
    vision: boolean;
  };
  pricing?: {
    inputCostPer1K: number;
    outputCostPer1K: number;
  };
}

/**
 * Models List Response
 */
export interface ModelsResponse {
  models: Model[];
  count: number;
  timestamp: number;
}

/**
 * Error Response
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
    timestamp: number;
  };
}

/**
 * Error Codes
 */
export enum ErrorCode {
  // Validation Errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_JSON = 'INVALID_JSON',

  // Authentication/Authorization Errors (4xx)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_API_KEY = 'INVALID_API_KEY',

  // Rate Limiting (4xx)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Not Found (4xx)
  NOT_FOUND = 'NOT_FOUND',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  // Server Errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UPSTREAM_ERROR = 'UPSTREAM_ERROR',
  TIMEOUT = 'TIMEOUT',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',

  // LLM Provider Errors (5xx)
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}

/**
 * HTTP Status Codes
 */
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

/**
 * App Error
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// Re-export storage types
export type { SessionData, ConversationMessage, UserPreferences, MemoryEntry } from '../storage-types';
