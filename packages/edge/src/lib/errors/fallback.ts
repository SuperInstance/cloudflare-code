/**
 * Fallback Strategies
 *
 * Comprehensive fallback system with multiple strategies:
 * - Provider fallback: Try alternative providers
 * - Model fallback: Try smaller/faster models
 * - Cache fallback: Use cached response if available
 * - Graceful degradation: Reduced functionality
 * - Fail fast: Immediate error for critical failures
 */

import type { ChatRequest, ChatResponse } from '../../types/index';
import type { ProviderClient } from '../providers/base';
import { ErrorType, getErrorMetadata } from './types';

// ============================================================================
// FALLBACK STRATEGY TYPES
// ============================================================================

/**
 * Fallback strategy types
 */
export enum FallbackStrategy {
  /** Try alternative provider */
  PROVIDER_FALLBACK = 'provider_fallback',
  /** Try smaller/faster model */
  MODEL_FALLBACK = 'model_fallback',
  /** Use cached response if available */
  CACHE_FALLBACK = 'cache_fallback',
  /** Reduce functionality gracefully */
  GRACEFUL_DEGRADATION = 'graceful_degradation',
  /** Fail immediately with error */
  FAIL_FAST = 'fail_fast',
  /** Return default/safe response */
  DEFAULT_RESPONSE = 'default_response',
  /** Queue for later processing */
  QUEUE_FOR_RETRY = 'queue_for_retry',
}

// ============================================================================
// FALLBACK CONFIGURATION
// ============================================================================

/**
 * Fallback configuration
 */
export interface FallbackConfig {
  /** Primary strategy */
  primaryStrategy: FallbackStrategy;
  /** Fallback chain (ordered list of strategies to try) */
  fallbackChain: FallbackStrategy[];
  /** Maximum number of fallback attempts */
  maxFallbackAttempts: number;
  /** Timeout for each fallback attempt (ms) */
  fallbackTimeout: number;
  /** Whether to cache responses for fallback */
  enableCacheFallback: boolean;
  /** Cache TTL for fallback (ms) */
  cacheFallbackTTL: number;
  /** Default response for fail-fast scenarios */
  defaultResponse?: any;
  /** Whether to enable graceful degradation */
  enableGracefulDegradation: boolean;
  /** Degradation level (0-1, 1 = full functionality) */
  degradationLevel: number;
}

// ============================================================================
// FALLBACK CONTEXT
// ============================================================================

/**
 * Fallback execution context
 */
export interface FallbackContext {
  /** Original request */
  request: ChatRequest;
  /** Error that triggered fallback */
  error: Error;
  /** Error type */
  errorType: ErrorType;
  /** Current fallback attempt */
  attempt: number;
  /** Providers already tried */
  triedProviders: string[];
  /** Models already tried */
  triedModels: string[];
  /** Timestamp of fallback */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// FALLBACK RESULT
// ============================================================================

/**
 * Fallback execution result
 */
export interface FallbackResult {
  /** Whether fallback succeeded */
  success: boolean;
  /** Response if successful */
  response?: ChatResponse;
  /** Final error if failed */
  error?: Error;
  /** Strategy that succeeded */
  strategy?: FallbackStrategy;
  /** Number of fallback attempts */
  attempts: number;
  /** Total time spent on fallback */
  totalTime: number;
  /** Fallback execution details */
  details: FallbackAttempt[];
}

/**
 * Fallback attempt details
 */
export interface FallbackAttempt {
  /** Attempt number */
  attempt: number;
  /** Strategy used */
  strategy: FallbackStrategy;
  /** Whether attempt succeeded */
  success: boolean;
  /** Error if failed */
  error?: Error;
  /** Time taken for attempt */
  duration: number;
  /** Additional details */
  details?: Record<string, unknown>;
}

// ============================================================================
// FALLBACK HANDLER INTERFACE
// ============================================================================

/**
 * Fallback handler interface
 */
export interface FallbackHandler {
  /**
   * Check if this handler can handle the fallback
   */
  canHandle(context: FallbackContext): boolean;

  /**
   * Execute the fallback strategy
   */
  execute(context: FallbackContext): Promise<ChatResponse>;

  /**
   * Get handler priority (higher = tried first)
   */
  getPriority(): number;

  /**
   * Get handler name
   */
  getName(): string;
}

// ============================================================================
// PROVIDER FALLBACK HANDLER
// ============================================================================

/**
 * Provider fallback handler - tries alternative providers
 */
export class ProviderFallbackHandler implements FallbackHandler {
  constructor(
    private providers: Map<string, ProviderClient>,
    private priority: number = 100
  ) {}

  canHandle(context: FallbackContext): boolean {
    // Check if there are available providers not yet tried
    const availableProviders = Array.from(this.providers.keys())
      .filter(name => !context.triedProviders.includes(name));

    return availableProviders.length > 0;
  }

  async execute(context: FallbackContext): Promise<ChatResponse> {
    const availableProviders = Array.from(this.providers.entries())
      .filter(([name]) => !context.triedProviders.includes(name))
      .sort(([, a], [, b]) => {
        // Sort by health/score if available
        const aScore = (a as any).score ?? 0;
        const bScore = (b as any).score ?? 0;
        return bScore - aScore;
      });

    if (availableProviders.length === 0) {
      throw new Error('No alternative providers available');
    }

    // Try next available provider
    const [providerName, provider] = availableProviders[0];
    context.triedProviders.push(providerName);

    return await provider.chat(context.request);
  }

  getPriority(): number {
    return this.priority;
  }

  getName(): string {
    return 'provider_fallback';
  }
}

// ============================================================================
// MODEL FALLBACK HANDLER
// ============================================================================

/**
 * Model fallback configuration
 */
export interface ModelFallbackConfig {
  /** Model fallback hierarchy */
  modelHierarchy: Record<string, string[]>;
  /** Default fallback models */
  defaultFallbackModels: string[];
}

/**
 * Model fallback handler - tries smaller/faster models
 */
export class ModelFallbackHandler implements FallbackHandler {
  constructor(
    private config: ModelFallbackConfig,
    private priority: number = 90
  ) {}

  canHandle(context: FallbackContext): boolean {
    // Check if there are alternative models
    const currentModel = context.request.model;
    const fallbackModels = this.config.modelHierarchy[currentModel] ??
                          this.config.defaultFallbackModels;

    return fallbackModels.some(model => !context.triedModels.includes(model));
  }

  async execute(context: FallbackContext): Promise<ChatResponse> {
    const currentModel = context.request.model;
    const fallbackModels = this.config.modelHierarchy[currentModel] ??
                          this.config.defaultFallbackModels;

    // Find first untried fallback model
    const fallbackModel = fallbackModels.find(model =>
      !context.triedModels.includes(model)
    );

    if (!fallbackModel) {
      throw new Error('No alternative models available');
    }

    context.triedModels.push(fallbackModel);

    // Create new request with fallback model
    const fallbackRequest = {
      ...context.request,
      model: fallbackModel,
    };

    // Execute with first available provider
    const provider = Array.from(context.metadata?.providers as Map<string, ProviderClient> ?? [])
      .values()
      .next().value;

    if (!provider) {
      throw new Error('No provider available for model fallback');
    }

    return await provider.chat(fallbackRequest);
  }

  getPriority(): number {
    return this.priority;
  }

  getName(): string {
    return 'model_fallback';
  }
}

// ============================================================================
// CACHE FALLBACK HANDLER
// ============================================================================

/**
 * Cache fallback handler - uses cached response
 */
export class CacheFallbackHandler implements FallbackHandler {
  constructor(
    private cache: Map<string, { response: ChatResponse; timestamp: number }>,
    private ttl: number = 300000, // 5 minutes
    private priority: number = 80
  ) {}

  canHandle(context: FallbackContext): boolean {
    const cacheKey = this.getCacheKey(context.request);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return false;
    }

    const age = Date.now() - cached.timestamp;
    return age < this.ttl;
  }

  async execute(context: FallbackContext): Promise<ChatResponse> {
    const cacheKey = this.getCacheKey(context.request);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      throw new Error('Cache entry expired or not found');
    }

    // Add cache indicator to response
    return {
      ...cached.response,
      metadata: {
        ...cached.response.metadata,
        cached: true,
        cacheTimestamp: cached.timestamp,
      },
    };
  }

  getPriority(): number {
    return this.priority;
  }

  getName(): string {
    return 'cache_fallback';
  }

  private getCacheKey(request: ChatRequest): string {
    return JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });
  }
}

// ============================================================================
// GRACEFUL DEGRADATION HANDLER
// ============================================================================

/**
 * Graceful degradation handler - reduces functionality
 */
export class GracefulDegradationHandler implements FallbackHandler {
  constructor(
    private degradationLevel: number = 0.5,
    private priority: number = 70
  ) {}

  canHandle(context: FallbackContext): boolean {
    // Can always degrade gracefully
    return true;
  }

  async execute(context: FallbackContext): Promise<ChatResponse> {
    // Apply degradation strategies:
    // 1. Reduce max tokens
    // 2. Simplify messages
    // 3. Reduce temperature

    const degradedRequest: ChatRequest = {
      ...context.request,
      maxTokens: Math.floor((context.request.maxTokens ?? 2048) * this.degradationLevel),
      messages: context.request.messages.slice(-3), // Keep only last 3 messages
      temperature: (context.request.temperature ?? 0.7) * 0.8,
    };

    // Execute degraded request
    const provider = context.metadata?.provider as ProviderClient;
    if (!provider) {
      throw new Error('No provider available for graceful degradation');
    }

    const response = await provider.chat(degradedRequest);

    // Add degradation indicator
    return {
      ...response,
      metadata: {
        ...response.metadata,
        degraded: true,
        degradationLevel: this.degradationLevel,
      },
    };
  }

  getPriority(): number {
    return this.priority;
  }

  getName(): string {
    return 'graceful_degradation';
  }
}

// ============================================================================
// DEFAULT RESPONSE HANDLER
// ============================================================================

/**
 * Default response handler - returns safe default
 */
export class DefaultResponseHandler implements FallbackHandler {
  constructor(
    private defaultResponse: ChatResponse,
    private priority: number = 60
  ) {}

  canHandle(context: FallbackContext): boolean {
    // Can always provide default response
    return true;
  }

  async execute(context: FallbackContext): Promise<ChatResponse> {
    return {
      ...this.defaultResponse,
      metadata: {
        ...this.defaultResponse.metadata,
        fallback: true,
        originalError: context.error.message,
        timestamp: Date.now(),
      },
    };
  }

  getPriority(): number {
    return this.priority;
  }

  getName(): string {
    return 'default_response';
  }
}

// ============================================================================
// FAIL FAST HANDLER
// ============================================================================

/**
 * Fail fast handler - immediately throws error
 */
export class FailFastHandler implements FallbackHandler {
  constructor(private priority: number = 50) {}

  canHandle(context: FallbackContext): boolean {
    // Always can fail fast
    return true;
  }

  async execute(_context: FallbackContext): Promise<ChatResponse> {
    throw new Error('Fail fast: No fallback strategies available');
  }

  getPriority(): number {
    return this.priority;
  }

  getName(): string {
    return 'fail_fast';
  }
}

// ============================================================================
// FALLBACK EXECUTOR
// ============================================================================

/**
 * Main fallback executor that orchestrates all fallback strategies
 */
export class FallbackExecutor {
  private handlers: FallbackHandler[] = [];

  constructor(private config: FallbackConfig) {
    this.initializeHandlers();
  }

  /**
   * Execute fallback strategies in order
   */
  async execute(
    request: ChatRequest,
    error: Error,
    providers: Map<string, ProviderClient>,
    cache?: Map<string, { response: ChatResponse; timestamp: number }>
  ): Promise<FallbackResult> {
    const startTime = Date.now();
    const details: FallbackAttempt[] = [];
    const errorType = this.classifyError(error);

    const context: FallbackContext = {
      request,
      error,
      errorType,
      attempt: 0,
      triedProviders: [],
      triedModels: [request.model],
      timestamp: Date.now(),
      metadata: {
        providers,
        cache,
      },
    };

    // Get metadata for error type
    const metadata = getErrorMetadata(errorType);

    // Sort handlers by priority
    const sortedHandlers = [...this.handlers]
      .filter(handler => handler.canHandle(context))
      .sort((a, b) => b.getPriority() - a.getPriority());

    let lastError = error;

    for (let attempt = 0; attempt < this.config.maxFallbackAttempts; attempt++) {
      context.attempt = attempt + 1;

      for (const handler of sortedHandlers) {
        const attemptStart = Date.now();

        try {
          const response = await Promise.race([
            handler.execute(context),
            this.timeout(this.config.fallbackTimeout),
          ]) as ChatResponse;

          const attemptDetail: FallbackAttempt = {
            attempt: attempt + 1,
            strategy: handler.getName() as FallbackStrategy,
            success: true,
            duration: Date.now() - attemptStart,
          };
          details.push(attemptDetail);

          return {
            success: true,
            response,
            strategy: handler.getName() as FallbackStrategy,
            attempts: attempt + 1,
            totalTime: Date.now() - startTime,
            details,
          };
        } catch (handlerError) {
          lastError = handlerError as Error;

          const attemptDetail: FallbackAttempt = {
            attempt: attempt + 1,
            strategy: handler.getName() as FallbackStrategy,
            success: false,
            error: lastError,
            duration: Date.now() - attemptStart,
          };
          details.push(attemptDetail);

          // Continue to next handler
          continue;
        }
      }
    }

    // All fallback strategies failed
    return {
      success: false,
      error: lastError,
      attempts: this.config.maxFallbackAttempts,
      totalTime: Date.now() - startTime,
      details,
    };
  }

  /**
   * Register a custom fallback handler
   */
  registerHandler(handler: FallbackHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove a fallback handler
   */
  removeHandler(handlerName: string): void {
    this.handlers = this.handlers.filter(h => h.getName() !== handlerName);
  }

  /**
   * Get registered handlers
   */
  getHandlers(): FallbackHandler[] {
    return [...this.handlers];
  }

  /**
   * Initialize default fallback handlers
   */
  private initializeHandlers(): void {
    // Provider fallback
    // Model fallback
    // Cache fallback
    // Graceful degradation
    // Default response
    // Fail fast
  }

  /**
   * Classify error from Error object
   */
  private classifyError(error: Error): ErrorType {
    const statusCode = (error as any).status ?? 0;
    const message = error.message?.toLowerCase() ?? '';

    if (statusCode === 429 || message.includes('rate limit')) {
      return ErrorType.RATE_LIMITED;
    }
    if (statusCode >= 500 || message.includes('timeout')) {
      return ErrorType.TIMEOUT;
    }
    if (message.includes('network') || message.includes('connection')) {
      return ErrorType.NETWORK_ERROR;
    }
    if (statusCode === 503 || message.includes('unavailable')) {
      return ErrorType.PROVIDER_UNAVAILABLE;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Timeout promise
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Fallback timeout')), ms)
    );
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create fallback executor with default configuration
 */
export function createFallbackExecutor(
  providers: Map<string, ProviderClient>,
  config?: Partial<FallbackConfig>
): FallbackExecutor {
  const defaultConfig: FallbackConfig = {
    primaryStrategy: FallbackStrategy.PROVIDER_FALLBACK,
    fallbackChain: [
      FallbackStrategy.PROVIDER_FALLBACK,
      FallbackStrategy.MODEL_FALLBACK,
      FallbackStrategy.CACHE_FALLBACK,
      FallbackStrategy.GRACEFUL_DEGRADATION,
      FallbackStrategy.DEFAULT_RESPONSE,
    ],
    maxFallbackAttempts: 5,
    fallbackTimeout: 10000,
    enableCacheFallback: true,
    cacheFallbackTTL: 300000,
    enableGracefulDegradation: true,
    degradationLevel: 0.5,
  };

  const executor = new FallbackExecutor({
    ...defaultConfig,
    ...config,
  });

  // Register default handlers
  executor.registerHandler(new ProviderFallbackHandler(providers));
  executor.registerHandler(new GracefulDegradationHandler(0.5));
  executor.registerHandler(new FailFastHandler());

  return executor;
}

/**
 * Create model hierarchy for fallback
 */
export function createModelHierarchy(): Record<string, string[]> {
  return {
    // GPT-4 falls back to GPT-3.5
    'gpt-4': ['gpt-4-turbo', 'gpt-3.5-turbo'],
    'gpt-4-turbo': ['gpt-3.5-turbo'],
    // Claude falls back to smaller models
    'claude-3-opus': ['claude-3-sonnet', 'claude-3-haiku'],
    'claude-3-sonnet': ['claude-3-haiku'],
    // Llama falls back to smaller models
    'llama-3-70b': ['llama-3-8b', 'llama-2-70b'],
    'llama-3-8b': ['llama-2-13b'],
  };
}

/**
 * Create default response for fallback
 */
export function createDefaultResponse(): ChatResponse {
  return {
    content: 'I apologize, but I am currently experiencing technical difficulties. Please try again later.',
    model: 'fallback',
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
    metadata: {
      fallback: true,
      timestamp: Date.now(),
    },
  };
}
