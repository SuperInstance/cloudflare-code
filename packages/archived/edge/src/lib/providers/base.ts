/**
 * Base Provider Interface and Types for Multi-Provider AI Integration
 *
 * This module defines the unified interface that all AI providers must implement,
 * enabling seamless routing, load balancing, and failover across 10+ providers.
 */

import type { ChatRequest, ChatResponse } from '../../types/index';

/**
 * Provider quota information
 */
export interface QuotaInfo {
  /** Provider name */
  provider: string;
  /** Amount used in current period */
  used: number;
  /** Total quota limit for period */
  limit: number;
  /** Remaining quota */
  remaining: number;
  /** When quota resets (Unix timestamp) */
  resetTime: number;
  /** Reset period type */
  resetType: 'daily' | 'monthly' | 'never';
  /** Last update timestamp */
  lastUpdated: number;
  /** Is quota exhausted (at threshold) */
  isExhausted: boolean;
}

/**
 * Chat streaming chunk
 */
export interface ChatChunk {
  /** Chunk ID */
  id: string;
  /** Content delta for this chunk */
  delta: string;
  /** Model being used */
  model: string;
  /** Provider name */
  provider: string;
  /** Is this the final chunk? */
  isComplete: boolean;
  /** Finish reason if complete */
  finishReason?: 'stop' | 'length' | 'content_filter';
  /** Usage statistics if complete */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Timestamp */
  timestamp: number;
}

/**
 * Provider health status
 */
export interface HealthStatus {
  /** Provider name */
  provider: string;
  /** Is provider healthy */
  isHealthy: boolean;
  /** Last check timestamp */
  lastCheck: number;
  /** Average latency in ms */
  avgLatency: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Total requests */
  totalRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Circuit breaker state */
  circuitState: 'closed' | 'open' | 'half_open';
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports function calling */
  functionCalling: boolean;
  /** Supports vision/multimodal */
  vision: boolean;
  /** Maximum context window */
  maxContextTokens: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Average latency in ms */
  avgLatency: number;
  /** Has free tier */
  hasFreeTier: boolean;
  /** Free tier daily requests (0 if no free tier) */
  freeTierDaily?: number;
  /** Input cost per 1M tokens (USD) */
  inputCostPer1M: number;
  /** Output cost per 1M tokens (USD) */
  outputCostPer1M: number;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for API endpoints */
  baseURL?: string;
  /** Default model to use */
  defaultModel?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Maximum retries */
  maxRetries?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Unified Provider Client Interface
 *
 * All AI providers must implement this interface to enable:
 * - Seamless routing and load balancing
 * - Automatic failover
 * - Quota tracking
 * - Health monitoring
 */
export interface ProviderClient {
  /** Unique provider name */
  readonly name: string;

  /** Provider capabilities */
  readonly capabilities: ProviderCapabilities;

  /**
   * Check if provider is available and healthy
   * @returns Promise resolving to availability status
   */
  isAvailable(): Promise<boolean>;

  /**
   * Execute a non-streaming chat completion request
   * @param request - Chat request with messages, model, and parameters
   * @returns Promise resolving to chat response
   */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Execute a streaming chat completion request
   * @param request - Chat request with stream=true
   * @returns Async iterable yielding chat chunks
   */
  stream(request: ChatRequest): AsyncIterable<ChatChunk>;

  /**
   * Get current quota information
   * @returns Promise resolving to quota info
   */
  getQuota(): Promise<QuotaInfo>;

  /**
   * Get list of available models
   * @returns Promise resolving to array of model IDs
   */
  getModelList(): Promise<string[]>;

  /**
   * Get provider health status
   * @returns Promise resolving to health status
   */
  getHealthStatus(): Promise<HealthStatus>;

  /**
   * Test provider connectivity with a minimal request
   * @returns Promise resolving to true if test succeeds
   */
  test(): Promise<boolean>;
}

/**
 * Base provider configuration map
 */
export type ProviderConfigMap = Map<string, ProviderConfig>;

/**
 * Priority score for provider selection
 */
export interface ProviderScore {
  /** Provider name */
  provider: string;
  /** Overall score (higher is better) */
  score: number;
  /** Cost score (0-1, higher is cheaper/free) */
  costScore: number;
  /** Latency score (0-1, higher is faster) */
  latencyScore: number;
  /** Quota score (0-1, higher is more available) */
  quotaScore: number;
  /** Reliability score (0-1, higher is more reliable) */
  reliabilityScore: number;
}

/**
 * Provider error types
 */
export enum ProviderErrorType {
  /** Authentication failed */
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  /** Rate limit exceeded */
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  /** Quota exceeded */
  QUOTA_EXCEEDED_ERROR = 'QUOTA_EXCEEDED_ERROR',
  /** Invalid request */
  INVALID_REQUEST_ERROR = 'INVALID_REQUEST_ERROR',
  /** Model not found */
  MODEL_NOT_FOUND_ERROR = 'MODEL_NOT_FOUND_ERROR',
  /** Server error */
  SERVER_ERROR = 'SERVER_ERROR',
  /** Network error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Timeout */
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  /** Unknown error */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Provider-specific error
 */
export class ProviderError extends Error {
  constructor(
    public provider: string,
    public type: ProviderErrorType,
    message: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(config: ProviderConfig): void {
  if (!config.apiKey || typeof config.apiKey !== 'string') {
    throw new Error('Invalid API key in provider configuration');
  }

  if (config.timeout !== undefined && (config.timeout < 0 || config.timeout > 300000)) {
    throw new Error('Timeout must be between 0 and 300000ms (5 minutes)');
  }

  if (config.maxRetries !== undefined && (config.maxRetries < 0 || config.maxRetries > 10)) {
    throw new Error('Max retries must be between 0 and 10');
  }
}

/**
 * Estimate token count from text (rough estimation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens from chat messages
 */
export function estimateChatTokens(messages: Array<{ role: string; content: string }>): number {
  const totalText = messages.map(m => m.content).join(' ');
  return estimateTokens(totalText);
}

/**
 * Convert provider-specific error to ProviderError
 */
export function normalizeError(provider: string, error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Rate limit errors
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429')
    ) {
      return new ProviderError(provider, ProviderErrorType.RATE_LIMIT_ERROR, error.message, error);
    }

    // Authentication errors
    if (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('invalid api key') ||
      message.includes('401')
    ) {
      return new ProviderError(
        provider,
        ProviderErrorType.AUTHENTICATION_ERROR,
        error.message,
        error
      );
    }

    // Quota errors
    if (
      message.includes('quota') ||
      message.includes('exceeded') ||
      message.includes('limit') ||
      message.includes('402')
    ) {
      return new ProviderError(provider, ProviderErrorType.QUOTA_EXCEEDED_ERROR, error.message, error);
    }

    // Model not found
    if (
      message.includes('model not found') ||
      message.includes('invalid model') ||
      message.includes('404')
    ) {
      return new ProviderError(provider, ProviderErrorType.MODEL_NOT_FOUND_ERROR, error.message, error);
    }

    // Server errors
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return new ProviderError(provider, ProviderErrorType.SERVER_ERROR, error.message, error);
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return new ProviderError(provider, ProviderErrorType.TIMEOUT_ERROR, error.message, error);
    }

    // Network errors
    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    ) {
      return new ProviderError(provider, ProviderErrorType.NETWORK_ERROR, error.message, error);
    }

    return new ProviderError(provider, ProviderErrorType.UNKNOWN_ERROR, error.message, error);
  }

  return new ProviderError(
    provider,
    ProviderErrorType.UNKNOWN_ERROR,
    'Unknown error occurred',
    error
  );
}
