/**
 * Global Error Handler
 *
 * Centralized error handling system that integrates all error handling components:
 * - Error classification and taxonomy
 * - Retry policies
 * - Fallback strategies
 * - Circuit breaker
 * - Dead letter queue
 * - Error reporting and analytics
 */

import type { ChatRequest, ChatResponse } from '../../types/index';
import type { ProviderClient } from '../providers/base';
import type { R2Bucket } from '@cloudflare/workers-types';
import { ErrorType, classifyError, getErrorMetadata, isRetryable, shouldUseFallback } from './types';
import { RetryPolicy, RetryManager, createAPIRetryPolicy } from './retry';
import { FallbackExecutor, createFallbackExecutor } from './fallback';
import { DeadLetterQueue, createDeadLetterQueue } from './dead-letter';
import { EnhancedCircuitBreaker, createEnhancedCircuitBreaker } from './circuit-breaker';
import { ErrorReporter, createErrorReporter } from './reporting';

// ============================================================================
// ERROR HANDLER CONFIGURATION
// ============================================================================

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  /** Enable retry logic */
  enableRetry: boolean;
  /** Enable fallback strategies */
  enableFallback: boolean;
  /** Enable circuit breaker */
  enableCircuitBreaker: boolean;
  /** Enable dead letter queue */
  enableDeadLetterQueue: boolean;
  /** Enable error reporting */
  enableErrorReporting: boolean;
  /** Retry policy */
  retryPolicy?: RetryPolicy;
  /** Retry manager name */
  retryManagerName?: string;
  /** Circuit breaker */
  circuitBreaker?: EnhancedCircuitBreaker;
  /** Fallback executor */
  fallbackExecutor?: FallbackExecutor;
  /** Dead letter queue */
  deadLetterQueue?: DeadLetterQueue;
  /** Error reporter */
  errorReporter?: ErrorReporter;
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Maximum number of fallback attempts */
  maxFallbackAttempts: number;
  /** Whether to send errors to dead letter queue */
  sendToDeadLetterQueue: boolean;
  /** Whether to report errors */
  reportErrors: boolean;
}

// ============================================================================
// ERROR HANDLING RESULT
// ============================================================================

/**
 * Error handling result with full metadata
 */
export interface ErrorHandlingResult {
  /** Whether handling succeeded */
  success: boolean;
  /** Response if successful */
  response?: ChatResponse;
  /** Final error if failed */
  error?: Error;
  /** Number of retry attempts */
  retryAttempts: number;
  /** Number of fallback attempts */
  fallbackAttempts: number;
  /** Total handling time (ms) */
  totalTime: number;
  /** Error type */
  errorType?: ErrorType;
  /** Whether circuit was open */
  circuitOpen?: boolean;
  /** Whether sent to dead letter queue */
  sentToDeadLetterQueue?: boolean;
  /** Error report ID */
  errorReportId?: string;
  /** Handling steps */
  steps: ErrorHandlingStep[];
}

/**
 * Error handling step
 */
export interface ErrorHandlingStep {
  /** Step type */
  type: 'retry' | 'fallback' | 'circuit_breaker' | 'dead_letter' | 'reporting';
  /** Step number */
  step: number;
  /** Whether step succeeded */
  success: boolean;
  /** Duration (ms) */
  duration: number;
  /** Additional details */
  details?: Record<string, unknown>;
}

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================

/**
 * Global error handler that orchestrates all error handling mechanisms
 */
export class GlobalErrorHandler {
  private config: ErrorHandlerConfig;
  private providers: Map<string, ProviderClient> = new Map();
  private cache: Map<string, { response: ChatResponse; timestamp: number }> = new Map();
  private retryManager: RetryManager;

  constructor(config: ErrorHandlerConfig) {
    this.config = config;
    this.retryManager = createDefaultRetryManager();

    // Register custom retry policy if provided
    if (config.retryPolicy) {
      this.retryManager.registerPolicy('custom', config.retryPolicy);
    }
  }

  /**
   * Handle error with full recovery mechanisms
   */
  async handleError(
    request: ChatRequest,
    error: Error,
    context?: {
      provider?: string;
      model?: string;
      requestId?: string;
      userId?: string;
      sessionId?: string;
    }
  ): Promise<ErrorHandlingResult> {
    const startTime = Date.now();
    const steps: ErrorHandlingStep[] = [];
    let lastError = error;
    let response?: ChatResponse;
    let success = false;

    // Classify error
    const errorType = classifyError(
      (error as any).status ?? 0,
      error.message
    );
    const metadata = getErrorMetadata(errorType);

    console.log(`[ErrorHandler] Error classified as ${errorType}:`, {
      message: error.message,
      retryable: isRetryable(errorType),
      useFallback: shouldUseFallback(errorType),
      severity: metadata.severity,
    });

    // Step 1: Report error
    if (this.config.enableErrorReporting && this.config.errorReporter && this.config.reportErrors) {
      const stepStart = Date.now();
      try {
        const reportId = await this.config.errorReporter.report({
          errorType,
          message: error.message,
          stack: error.stack,
          statusCode: (error as any).status,
          provider: context?.provider,
          model: context?.model,
          requestId: context?.requestId,
          userId: context?.userId,
          sessionId: context?.sessionId,
        });

        steps.push({
          type: 'reporting',
          step: steps.length + 1,
          success: true,
          duration: Date.now() - stepStart,
          details: { reportId },
        });
      } catch (reportError) {
        steps.push({
          type: 'reporting',
          step: steps.length + 1,
          success: false,
          duration: Date.now() - stepStart,
          details: { error: (reportError as Error).message },
        });
      }
    }

    // Step 2: Circuit breaker check
    if (this.config.enableCircuitBreaker && this.config.circuitBreaker) {
      const stepStart = Date.now();
      try {
        const state = this.config.circuitBreaker.getState();
        if (state === 'OPEN' || state === 'FORCED_OPEN') {
          steps.push({
            type: 'circuit_breaker',
            step: steps.length + 1,
            success: false,
            duration: Date.now() - stepStart,
            details: { state },
          });

          // Skip to fallback
          if (this.config.enableFallback && this.config.fallbackExecutor) {
            const fallbackResult = await this.executeFallback(request, error, errorType, context);
            steps.push(...fallbackResult.steps);
            response = fallbackResult.response;
            success = fallbackResult.success;
            lastError = fallbackResult.error;
          }
        } else {
          steps.push({
            type: 'circuit_breaker',
            step: steps.length + 1,
            success: true,
            duration: Date.now() - stepStart,
            details: { state },
          });
        }
      } catch (cbError) {
        steps.push({
          type: 'circuit_breaker',
          step: steps.length + 1,
          success: false,
          duration: Date.now() - stepStart,
          details: { error: (cbError as Error).message },
        });
      }
    }

    // Step 3: Retry logic
    if (!success && this.config.enableRetry && isRetryable(errorType)) {
      const stepStart = Date.now();
      try {
        const retryPolicy = this.config.retryPolicy ??
                            this.retryManager.getPolicy(this.config.retryManagerName ?? 'api') ??
                            createAPIRetryPolicy(this.config.maxRetries);

        const retryResult = await retryPolicy.executeWithResult(
          async () => {
            // Get provider
            const provider = this.getProvider(context?.provider ?? request.provider);
            if (!provider) {
              throw new Error('No provider available');
            }

            // Execute with circuit breaker if enabled
            if (this.config.enableCircuitBreaker && this.config.circuitBreaker) {
              return this.config.circuitBreaker.execute(
                () => provider.chat(request),
                { errorType }
              );
            }

            return provider.chat(request);
          },
          { errorType }
        );

        if (retryResult.success) {
          response = retryResult.data;
          success = true;
          lastError = undefined;
        } else {
          lastError = retryResult.error;
        }

        steps.push({
          type: 'retry',
          step: steps.length + 1,
          success: retryResult.success,
          duration: Date.now() - stepStart,
          details: {
            attempts: retryResult.attempts,
            totalDelay: retryResult.totalDelay,
          },
        });
      } catch (retryError) {
        lastError = retryError as Error;
        steps.push({
          type: 'retry',
          step: steps.length + 1,
          success: false,
          duration: Date.now() - stepStart,
          details: { error: (retryError as Error).message },
        });
      }
    }

    // Step 4: Fallback strategies
    if (!success && this.config.enableFallback && shouldUseFallback(errorType)) {
      const fallbackResult = await this.executeFallback(request, lastError!, errorType, context);
      steps.push(...fallbackResult.steps);
      response = fallbackResult.response;
      success = fallbackResult.success;
      lastError = fallbackResult.error;
    }

    // Step 5: Dead letter queue
    if (!success && this.config.enableDeadLetterQueue && this.config.deadLetterQueue && this.config.sendToDeadLetterQueue) {
      const stepStart = Date.now();
      try {
        const deadLetterId = await this.config.deadLetterQueue.add(
          request,
          lastError!,
          errorType,
          {
            provider: context?.provider,
            model: context?.model,
          }
        );

        steps.push({
          type: 'dead_letter',
          step: steps.length + 1,
          success: true,
          duration: Date.now() - stepStart,
          details: { deadLetterId },
        });
      } catch (dlqError) {
        steps.push({
          type: 'dead_letter',
          step: steps.length + 1,
          success: false,
          duration: Date.now() - stepStart,
          details: { error: (dlqError as Error).message },
        });
      }
    }

    // Update error report with recovery status
    if (this.config.enableErrorReporting && this.config.errorReporter) {
      for (const step of steps) {
        if (step.type === 'reporting' && step.details?.reportId) {
          try {
            await this.config.errorReporter.updateRecovery(
              step.details.reportId as string,
              success,
              success ? 'error_handler' : undefined,
              Date.now() - startTime
            );
          } catch (updateError) {
            console.error('Failed to update error report:', updateError);
          }
        }
      }
    }

    return {
      success,
      response,
      error: lastError,
      retryAttempts: steps.filter(s => s.type === 'retry').reduce((sum, s) => sum + (s.details?.attempts as number ?? 0), 0),
      fallbackAttempts: steps.filter(s => s.type === 'fallback').length,
      totalTime: Date.now() - startTime,
      errorType,
      circuitOpen: steps.some(s => s.type === 'circuit_breaker' && !s.success),
      sentToDeadLetterQueue: steps.some(s => s.type === 'dead_letter' && s.success),
      errorReportId: steps.find(s => s.type === 'reporting')?.details?.reportId as string,
      steps,
    };
  }

  /**
   * Execute request with error handling
   */
  async execute(
    request: ChatRequest,
    context?: {
      provider?: string;
      model?: string;
      requestId?: string;
      userId?: string;
      sessionId?: string;
    }
  ): Promise<ChatResponse> {
    try {
      // Get provider
      const provider = this.getProvider(context?.provider ?? request.provider);
      if (!provider) {
        throw new Error('No provider available');
      }

      // Execute with circuit breaker if enabled
      if (this.config.enableCircuitBreaker && this.config.circuitBreaker) {
        return this.config.circuitBreaker.execute(
          () => provider.chat(request),
          { errorType: undefined }
        );
      }

      return provider.chat(request);
    } catch (error) {
      // Handle error with full recovery mechanisms
      const result = await this.handleError(request, error as Error, context);

      if (result.success && result.response) {
        return result.response;
      }

      // All recovery mechanisms failed
      throw result.error ?? error;
    }
  }

  /**
   * Register a provider
   */
  registerProvider(name: string, provider: ProviderClient): void {
    this.providers.set(name, provider);
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(name: string): void {
    this.providers.delete(name);
  }

  /**
   * Get provider by name
   */
  private getProvider(name?: string): ProviderClient | undefined {
    if (!name) {
      return this.providers.values().next().value;
    }
    return this.providers.get(name);
  }

  /**
   * Execute fallback strategies
   */
  private async executeFallback(
    request: ChatRequest,
    error: Error,
    errorType: ErrorType,
    context?: {
      provider?: string;
      model?: string;
      requestId?: string;
      userId?: string;
      sessionId?: string;
    }
  ): Promise<{
    response?: ChatResponse;
    error?: Error;
    success: boolean;
    steps: ErrorHandlingStep[];
  }> {
    const steps: ErrorHandlingStep[] = [];

    if (!this.config.fallbackExecutor) {
      return {
        error,
        success: false,
        steps,
      };
    }

    const stepStart = Date.now();
    try {
      const fallbackResult = await this.config.fallbackExecutor.execute(
        request,
        error,
        this.providers,
        this.cache
      );

      steps.push({
        type: 'fallback',
        step: 1,
        success: fallbackResult.success,
        duration: Date.now() - stepStart,
        details: {
          strategy: fallbackResult.strategy,
          attempts: fallbackResult.attempts,
        },
      });

      return {
        response: fallbackResult.response,
        error: fallbackResult.error,
        success: fallbackResult.success,
        steps,
      };
    } catch (fallbackError) {
      steps.push({
        type: 'fallback',
        step: 1,
        success: false,
        duration: Date.now() - stepStart,
        details: { error: (fallbackError as Error).message },
      });

      return {
        error: fallbackError as Error,
        success: false,
        steps,
      };
    }
  }

  /**
   * Get error handler configuration
   */
  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }

  /**
   * Update error handler configuration
   */
  updateConfig(config: Partial<ErrorHandlerConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get error handler metrics
   */
  async getMetrics(): Promise<{
    circuitBreaker?: ReturnType<EnhancedCircuitBreaker['getMetrics']>;
    deadLetterQueue?: ReturnType<DeadLetterQueue['getMetrics']>;
    errorReporter?: ReturnType<ErrorReporter['getAnalytics']>;
  }> {
    const metrics: any = {};

    if (this.config.circuitBreaker) {
      metrics.circuitBreaker = this.config.circuitBreaker.getMetrics();
    }

    if (this.config.deadLetterQueue) {
      metrics.deadLetterQueue = await this.config.deadLetterQueue.getMetrics();
    }

    if (this.config.errorReporter) {
      metrics.errorReporter = await this.config.errorReporter.getAnalytics();
    }

    return metrics;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create default retry manager
 */
function createDefaultRetryManager(): RetryManager {
  const manager = new RetryManager();
  manager.registerPolicy('api', createAPIRetryPolicy());
  return manager;
}

/**
 * Create global error handler with default configuration
 */
export function createGlobalErrorHandler(
  config?: Partial<ErrorHandlerConfig>
): GlobalErrorHandler {
  const defaultConfig: ErrorHandlerConfig = {
    enableRetry: true,
    enableFallback: true,
    enableCircuitBreaker: true,
    enableDeadLetterQueue: false,
    enableErrorReporting: true,
    maxRetries: 3,
    maxFallbackAttempts: 5,
    sendToDeadLetterQueue: false,
    reportErrors: true,
  };

  return new GlobalErrorHandler({
    ...defaultConfig,
    ...config,
  });
}

/**
 * Create global error handler for production
 */
export function createProductionErrorHandler(
  providers: Map<string, ProviderClient>,
  bucket: R2Bucket,
  kv?: KVNamespace
): GlobalErrorHandler {
  // Create circuit breaker
  const circuitBreaker = createEnhancedCircuitBreaker('global', {
    kv,
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
  });

  // Create fallback executor
  const fallbackExecutor = createFallbackExecutor(providers);

  // Create dead letter queue
  const deadLetterQueue = createDeadLetterQueue(bucket);

  // Create error reporter
  const errorReporter = createErrorReporter({ kv });

  // Create retry manager
  const retryManager = createDefaultRetryManager();

  return new GlobalErrorHandler({
    enableRetry: true,
    enableFallback: true,
    enableCircuitBreaker: true,
    enableDeadLetterQueue: true,
    enableErrorReporting: true,
    circuitBreaker,
    fallbackExecutor,
    deadLetterQueue,
    errorReporter,
    maxRetries: 3,
    maxFallbackAttempts: 5,
    sendToDeadLetterQueue: true,
    reportErrors: true,
  });
}

/**
 * Create minimal error handler (for development/testing)
 */
export function createMinimalErrorHandler(): GlobalErrorHandler {
  return new GlobalErrorHandler({
    enableRetry: true,
    enableFallback: false,
    enableCircuitBreaker: false,
    enableDeadLetterQueue: false,
    enableErrorReporting: false,
    maxRetries: 2,
    maxFallbackAttempts: 0,
    sendToDeadLetterQueue: false,
    reportErrors: false,
  });
}
