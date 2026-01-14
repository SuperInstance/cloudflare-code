/**
 * Provider type definitions for ClaudeFlare platform
 * @packageDocumentation
 */

import { z } from 'zod';
import { QualityTier } from './core';

// ============================================================================
// PROVIDER TYPES
// ============================================================================

/**
 * AI provider configuration and capabilities
 */
export interface Provider {
  /** Unique provider identifier */
  id: string;
  /** Human-readable provider name */
  name: string;
  /** Base URL for API requests */
  baseUrl: string;
  /** API key for authentication */
  apiKey?: string;
  /** Available models from this provider */
  models: string[];
  /** Quality tier of this provider */
  qualityTier: QualityTier;
  /** Cost per 1000 tokens */
  costPer1KTokens: TokenCost;
  /** Performance metrics */
  performance: ProviderPerformance;
  /** Current availability status */
  availability: ProviderAvailability;
  /** Technical constraints */
  constraints: ProviderConstraints;
  /** Provider configuration */
  config: ProviderConfig;
}

/**
 * Token cost structure
 */
export interface TokenCost {
  /** Cost per 1000 input tokens in USD */
  input: number;
  /** Cost per 1000 output tokens in USD */
  output: number;
}

/**
 * Zod schema for TokenCost validation
 */
export const TokenCostSchema = z.object({
  input: z.number().nonnegative(),
  output: z.number().nonnegative()
});

/**
 * Provider performance metrics
 */
export interface ProviderPerformance {
  /** Average latency in milliseconds */
  avgLatency: number;
  /** P50 latency in milliseconds */
  p50Latency: number;
  /** P90 latency in milliseconds */
  p90Latency: number;
  /** P99 latency in milliseconds */
  p99Latency: number;
  /** Tokens processed per second */
  tokensPerSecond: number;
  /** Success rate (0-1) */
  successRate: number;
}

/**
 * Zod schema for ProviderPerformance validation
 */
export const ProviderPerformanceSchema = z.object({
  avgLatency: z.number().positive(),
  p50Latency: z.number().positive(),
  p90Latency: z.number().positive(),
  p99Latency: z.number().positive(),
  tokensPerSecond: z.number().positive(),
  successRate: z.number().min(0).max(1)
});

/**
 * Provider availability information
 */
export interface ProviderAvailability {
  /** Whether provider is healthy */
  healthy: boolean;
  /** Rate limit remaining (requests per minute) */
  rateLimitRemaining: number;
  /** Free tier quota remaining */
  freeTierRemaining: number;
  /** Total free tier quota */
  freeTierQuota: number;
  /** Current usage in tokens */
  currentUsage: number;
  /** Last health check timestamp (Unix ms) */
  lastHealthCheck: number;
}

/**
 * Zod schema for ProviderAvailability validation
 */
export const ProviderAvailabilitySchema = z.object({
  healthy: z.boolean(),
  rateLimitRemaining: z.number().nonnegative(),
  freeTierRemaining: z.number().nonnegative(),
  freeTierQuota: z.number().nonnegative(),
  currentUsage: z.number().nonnegative(),
  lastHealthCheck: z.number().nonnegative()
});

/**
 * Provider technical constraints
 */
export interface ProviderConstraints {
  /** Maximum context window in tokens */
  maxContextWindow: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Supported features */
  supportedFeatures: ProviderFeature[];
  /** Rate limit requests per minute */
  rateLimitRpm: number;
  /** Rate limit tokens per minute */
  rateLimitTpm: number;
  /** Regions supported */
  regions: string[];
}

/**
 * Provider features enum
 */
export enum ProviderFeature {
  STREAMING = 'streaming',
  FUNCTION_CALLING = 'function_calling',
  CODE_EXECUTION = 'code_execution',
  IMAGE_GENERATION = 'image_generation',
  VISION = 'vision',
  AUDIO_INPUT = 'audio_input',
  AUDIO_OUTPUT = 'audio_output',
  TOOLS = 'tools'
}

/**
 * Zod schema for ProviderConstraints validation
 */
export const ProviderConstraintsSchema = z.object({
  maxContextWindow: z.number().positive(),
  maxOutputTokens: z.number().positive(),
  supportedFeatures: z.array(z.enum([
    'streaming',
    'function_calling',
    'code_execution',
    'image_generation',
    'vision',
    'audio_input',
    'audio_output',
    'tools'
  ])),
  rateLimitRpm: z.number().positive(),
  rateLimitTpm: z.number().positive(),
  regions: z.array(z.string())
});

/**
 * Provider configuration options
 */
export interface ProviderConfig {
  /** Whether provider is enabled */
  enabled: boolean;
  /** Provider priority for routing (higher = preferred) */
  priority: number;
  /** Load balancing weight (0-1) */
  weight: number;
  /** Timeout in milliseconds */
  timeout: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
  /** Whether to use fallback */
  enableFallback: boolean;
}

/**
 * Zod schema for ProviderConfig validation
 */
export const ProviderConfigSchema = z.object({
  enabled: z.boolean(),
  priority: z.number(),
  maxRetries: z.number().nonnegative(),
  retryDelay: z.number().nonnegative(),
  enableFallback: z.boolean(),
  weight: z.number().min(0).max(1),
  timeout: z.number().positive()
});

/**
 * Zod schema for Provider validation
 */
export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  models: z.array(z.string()),
  qualityTier: z.nativeEnum(QualityTier),
  costPer1KTokens: TokenCostSchema,
  performance: ProviderPerformanceSchema,
  availability: ProviderAvailabilitySchema,
  constraints: ProviderConstraintsSchema,
  config: ProviderConfigSchema
});

// ============================================================================
// PROVIDER HEALTH TYPES
// ============================================================================

/**
 * Provider health status
 */
export interface ProviderHealth {
  /** Provider identifier */
  providerId: string;
  /** Whether provider is healthy */
  healthy: boolean;
  /** Last health check timestamp (Unix ms) */
  lastCheck: number;
  /** Current latency in milliseconds */
  latency: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Rate limit status */
  rateLimitStatus: RateLimitStatus;
  /** Health check details */
  details?: HealthCheckDetails;
}

/**
 * Rate limit status enum
 */
export enum RateLimitStatus {
  OK = 'ok',
  WARNING = 'warning',
  EXHAUSTED = 'exhausted'
}

/**
 * Health check details
 */
export interface HealthCheckDetails {
  /** Last successful request timestamp */
  lastSuccess?: number;
  /** Last failure timestamp */
  lastFailure?: number;
  /** Consecutive failures */
  consecutiveFailures: number;
  /** Recent error messages */
  recentErrors: string[];
  /** Response time trend */
  responseTimeTrend: 'improving' | 'stable' | 'degrading';
}

/**
 * Zod schema for HealthCheckDetails validation
 */
export const HealthCheckDetailsSchema = z.object({
  lastSuccess: z.number().optional(),
  lastFailure: z.number().optional(),
  consecutiveFailures: z.number().nonnegative(),
  recentErrors: z.array(z.string()),
  responseTimeTrend: z.enum(['improving', 'stable', 'degrading'])
});

/**
 * Zod schema for ProviderHealth validation
 */
export const ProviderHealthSchema = z.object({
  providerId: z.string(),
  healthy: z.boolean(),
  lastCheck: z.number().nonnegative(),
  latency: z.number().nonnegative(),
  errorRate: z.number().min(0).max(1),
  rateLimitStatus: z.enum(['ok', 'warning', 'exhausted']),
  details: HealthCheckDetailsSchema.optional()
});

// ============================================================================
// PROVIDER REQUEST TYPES
// ============================================================================

/**
 * Provider-specific API request
 */
export interface ProviderRequest {
  /** Provider identifier */
  providerId: string;
  /** Model to use */
  model: string;
  /** Request messages */
  messages: Array<{
    role: string;
    content: string;
  }>;
  /** Request parameters */
  parameters: ProviderRequestParameters;
  /** Request metadata */
  metadata?: {
    requestId: string;
    timestamp: number;
    userId?: string;
    sessionId?: string;
  };
}

/**
 * Provider request parameters
 */
export interface ProviderRequestParameters {
  /** Sampling temperature */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Top-p sampling */
  topP?: number;
  /** Top-k sampling */
  topK?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** Frequency penalty */
  frequencyPenalty?: number;
  /** Presence penalty */
  presencePenalty?: number;
  /** Whether to stream response */
  stream?: boolean;
}

/**
 * Zod schema for ProviderRequestParameters validation
 */
export const ProviderRequestParametersSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().positive().optional(),
  stopSequences: z.array(z.string()).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  stream: z.boolean().optional()
});

/**
 * Zod schema for ProviderRequest validation
 */
export const ProviderRequestSchema = z.object({
  providerId: z.string(),
  model: z.string(),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string()
  })),
  parameters: ProviderRequestParametersSchema,
  metadata: z.object({
    requestId: z.string(),
    timestamp: z.number(),
    userId: z.string().optional(),
    sessionId: z.string().optional()
  }).optional()
});

// ============================================================================
// PROVIDER RESPONSE TYPES
// ============================================================================

/**
 * Provider API response
 */
export interface ProviderResponse {
  /** Provider identifier */
  providerId: string;
  /** Request identifier */
  requestId: string;
  /** Response content */
  content: string;
  /** Model used */
  model: string;
  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Request duration in milliseconds */
  duration: number;
  /** Whether request was successful */
  success: boolean;
  /** Error details if failed */
  error?: ProviderError;
  /** Response metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Provider error details
 */
export interface ProviderError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** HTTP status code */
  statusCode: number;
  /** Whether error is retryable */
  retryable: boolean;
  /** Suggested retry delay in milliseconds */
  retryAfter?: number;
}

/**
 * Zod schema for ProviderError validation
 */
export const ProviderErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  statusCode: z.number(),
  retryable: z.boolean(),
  retryAfter: z.number().optional()
});

/**
 * Zod schema for ProviderResponse validation
 */
export const ProviderResponseSchema = z.object({
  providerId: z.string(),
  requestId: z.string(),
  content: z.string(),
  model: z.string(),
  usage: z.object({
    promptTokens: z.number().nonnegative(),
    completionTokens: z.number().nonnegative(),
    totalTokens: z.number().nonnegative()
  }),
  duration: z.number().nonnegative(),
  success: z.boolean(),
  error: ProviderErrorSchema.optional(),
  metadata: z.record(z.unknown()).optional()
});

// ============================================================================
// TYPE INFERENCE UTILITIES
// ============================================================================

/**
 * Infer Provider type from schema
 */
export type ProviderType = z.infer<typeof ProviderSchema>;

/**
 * Infer ProviderHealth type from schema
 */
export type ProviderHealthType = z.infer<typeof ProviderHealthSchema>;

/**
 * Infer ProviderRequest type from schema
 */
export type ProviderRequestType = z.infer<typeof ProviderRequestSchema>;

/**
 * Infer ProviderResponse type from schema
 */
export type ProviderResponseType = z.infer<typeof ProviderResponseSchema>;

/**
 * Infer ProviderConfig type from schema
 */
export type ProviderConfigType = z.infer<typeof ProviderConfigSchema>;
