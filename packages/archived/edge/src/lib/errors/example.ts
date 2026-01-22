/**
 * Complete Error Handling Integration Example
 *
 * This example demonstrates how to integrate the complete error handling
 * and recovery system into a Cloudflare Worker for ClaudeFlare.
 */

import { createProductionErrorHandler } from './errors';
import type { ProviderClient } from '../providers/base';
import type { ChatRequest, ChatResponse } from '../../types/index';
import type { R2Bucket } from '@cloudflare/workers-types';

/**
 * Example Cloudflare Worker with comprehensive error handling
 */
export class ClaudeFlareWorker {
  private errorHandler: ReturnType<typeof createProductionErrorHandler>;

  constructor(env: {
    R2_BUCKET: R2Bucket;
    KV_NAMESPACE: KVNamespace;
    OPENAI_API_KEY: string;
    ANTHROPIC_API_KEY: string;
  }) {
    // Initialize providers
    const providers = new Map<string, ProviderClient>();

    // Register AI providers (simplified example)
    providers.set('openai', {
      name: 'openai',
      chat: async (request: ChatRequest) => {
        // Actual OpenAI API call here
        return {} as ChatResponse;
      },
    } as ProviderClient);

    providers.set('anthropic', {
      name: 'anthropic',
      chat: async (request: ChatRequest) => {
        // Actual Anthropic API call here
        return {} as ChatResponse;
      },
    } as ProviderClient);

    // Create production error handler
    this.errorHandler = createProductionErrorHandler(
      providers,
      env.R2_BUCKET,
      env.KV_NAMESPACE
    );
  }

  /**
   * Handle chat request with comprehensive error handling
   */
  async handleChat(request: ChatRequest, context: {
    requestId: string;
    userId: string;
    sessionId: string;
  }): Promise<ChatResponse> {
    try {
      // Execute with full error handling and recovery
      const response = await this.errorHandler.execute(request, {
        provider: request.provider,
        requestId: context.requestId,
        userId: context.userId,
        sessionId: context.sessionId,
      });

      return response;
    } catch (error) {
      // All recovery mechanisms exhausted
      // Return user-friendly error response
      return {
        content: this.getErrorMessage(error),
        model: request.model,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        metadata: {
          error: true,
          errorMessage: (error as Error).message,
          errorType: this.classifyError(error),
          timestamp: Date.now(),
        },
      };
    }
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: unknown): string {
    const err = error as Error;

    // Check for specific error patterns
    if (err.message.includes('rate limit')) {
      return 'I apologize, but I am currently rate limited. Please wait a moment and try again.';
    }

    if (err.message.includes('timeout')) {
      return 'The request timed out. Please try again with a shorter message.';
    }

    if (err.message.includes('unauthorized')) {
      return 'Authentication failed. Please check your API credentials.';
    }

    if (err.message.includes('quota')) {
      return 'You have exceeded your quota. Please upgrade your plan to continue.';
    }

    // Default error message
    return 'I apologize, but an error occurred. Please try again later.';
  }

  /**
   * Classify error for metadata
   */
  private classifyError(error: unknown): string {
    const err = error as Error;
    const statusCode = (err as any).status ?? 0;
    const message = err.message?.toLowerCase() ?? '';

    if (statusCode === 429 || message.includes('rate limit')) {
      return 'RATE_LIMITED';
    }

    if (statusCode === 401 || message.includes('unauthorized')) {
      return 'UNAUTHORIZED';
    }

    if (statusCode === 404 || message.includes('not found')) {
      return 'NOT_FOUND';
    }

    if (message.includes('timeout')) {
      return 'TIMEOUT';
    }

    if (message.includes('network') || message.includes('connection')) {
      return 'NETWORK_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Get error handler metrics
   */
  async getMetrics() {
    return await this.errorHandler.getMetrics();
  }
}

/**
 * Example Cloudflare Worker export
 */
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const worker = new ClaudeFlareWorker(env);

    try {
      // Parse request
      const body = await request.json() as ChatRequest;
      const requestId = request.headers.get('X-Request-ID') ?? crypto.randomUUID();
      const userId = request.headers.get('X-User-ID') ?? 'anonymous';
      const sessionId = request.headers.get('X-Session-ID') ?? crypto.randomUUID();

      // Handle chat with comprehensive error handling
      const response = await worker.handleChat(body, {
        requestId,
        userId,
        sessionId,
      });

      // Return success response
      return Response.json(response, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        },
      });
    } catch (error) {
      // This should rarely be reached as error handler handles most errors
      return Response.json({
        error: 'Internal server error',
        message: (error as Error).message,
      }, {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  },

  /**
   * Scheduled event handler for cleanup and maintenance
   */
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext): Promise<void> {
    const worker = new ClaudeFlareWorker(env);

    // Perform periodic cleanup
    try {
      const metrics = await worker.getMetrics();

      // Clean up dead letter queue
      if (metrics.deadLetterQueue) {
        const deleted = await metrics.deadLetterQueue.cleanup();
        console.log(`Cleaned up ${deleted} expired DLQ entries`);
      }

      // Reset circuit breakers if needed
      if (metrics.circuitBreaker) {
        const state = metrics.circuitBreaker;
        console.log(`Circuit breaker state: ${state}`);
      }

      // Log error statistics
      if (metrics.errorReporter) {
        const analytics = metrics.errorReporter;
        console.log(`Total errors: ${analytics.totalErrors}`);
        console.log(`Recovery rate: ${analytics.overallRecoveryRate}`);
      }
    } catch (error) {
      console.error('Error during scheduled cleanup:', error);
    }
  },
};

/**
 * Example: Custom error handler configuration
 */
export function createCustomErrorHandler() {
  const { createGlobalErrorHandler } = require('./errors');
  const { createEnhancedCircuitBreaker } = require('./errors');
  const { createFallbackExecutor } = require('./errors');
  const { createDeadLetterQueue } = require('./errors');
  const { createErrorReporter } = require('./errors');

  // Create custom circuit breaker
  const circuitBreaker = createEnhancedCircuitBreaker('custom-api', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000,
    ignoreErrorTypes: [],
  });

  // Create custom fallback executor
  const providers = new Map();
  const fallbackExecutor = createFallbackExecutor(providers, {
    primaryStrategy: 'provider_fallback' as any,
    fallbackChain: [
      'provider_fallback' as any,
      'model_fallback' as any,
      'cache_fallback' as any,
    ],
    maxFallbackAttempts: 3,
  });

  // Create custom dead letter queue
  const deadLetterQueue = createDeadLetterQueue({} as any, {
    keyPrefix: 'custom-dlq',
    defaultTTL: 3600000,
    maxRetries: 5,
    enableAutoRetry: true,
  });

  // Create custom error reporter
  const errorReporter = createErrorReporter({
    enableAggregation: true,
    enableAnalytics: true,
    enableAlerts: true,
    alerts: [
      {
        id: 'high-error-rate',
        type: 'threshold' as any,
        condition: 'greater_than' as any,
        threshold: 100,
        active: true,
        triggerCount: 0,
        channels: ['webhook'],
        cooldown: 600000,
      },
    ],
  });

  // Create custom error handler
  return createGlobalErrorHandler({
    enableRetry: true,
    enableFallback: true,
    enableCircuitBreaker: true,
    enableDeadLetterQueue: true,
    enableErrorReporting: true,
    circuitBreaker,
    fallbackExecutor,
    deadLetterQueue,
    errorReporter,
    maxRetries: 5,
    maxFallbackAttempts: 3,
    sendToDeadLetterQueue: true,
    reportErrors: true,
  });
}

/**
 * Example: Error handling middleware for Hono
 */
export function errorHandlingMiddleware(errorHandler: any) {
  return async (c: any, next: any) => {
    try {
      await next();
    } catch (error) {
      // Handle error with comprehensive recovery
      const request = c.req.json();
      const context = {
        requestId: c.req.header('X-Request-ID'),
        userId: c.req.header('X-User-ID'),
        sessionId: c.req.header('X-Session-ID'),
      };

      try {
        const response = await errorHandler.execute(request, context);
        return c.json(response);
      } catch (finalError) {
        // All recovery failed
        return c.json({
          error: 'Request failed after all recovery attempts',
          message: (finalError as Error).message,
        }, 500);
      }
    }
  };
}

/**
 * Example: Monitoring and alerting
 */
export async function monitorErrors(errorHandler: any) {
  const metrics = await errorHandler.getMetrics();

  // Check circuit breaker status
  if (metrics.circuitBreaker) {
    const cb = metrics.circuitBreaker;
    if (cb.state === 'OPEN') {
      console.warn(`Circuit breaker OPEN: ${cb.totalOpens} opens detected`);
      // Send alert
    }
  }

  // Check dead letter queue size
  if (metrics.deadLetterQueue) {
    const dlq = metrics.deadLetterQueue;
    if (dlq.totalEntries > 1000) {
      console.warn(`Dead letter queue size: ${dlq.totalEntries}`);
      // Send alert
    }
  }

  // Check error rate
  if (metrics.errorReporter) {
    const analytics = metrics.errorReporter;
    if (analytics.errorTrend === 'increasing') {
      console.warn('Error trend is increasing');
      // Send alert
    }

    if (analytics.overallRecoveryRate < 0.5) {
      console.warn(`Low recovery rate: ${analytics.overallRecoveryRate}`);
      // Send alert
    }
  }
}

/**
 * Example: Dead letter queue processing
 */
export async function processDeadLetterQueue(errorHandler: any) {
  const config = errorHandler.getConfig();
  const dlq = config.deadLetterQueue;

  if (!dlq) {
    console.log('Dead letter queue not enabled');
    return;
  }

  // Get entries ready for retry
  const entries = await dlq.getEntriesForRetry();
  console.log(`Found ${entries.length} entries to retry`);

  // Retry each entry
  let successCount = 0;
  let failCount = 0;

  for (const entry of entries) {
    try {
      const result = await dlq.retry(entry.id, async (request) => {
        // Retry logic here
        console.log(`Retrying entry ${entry.id}`);
        return { success: true };
      });

      if (result) {
        successCount++;
        console.log(`Successfully recovered entry ${entry.id}`);
      } else {
        failCount++;
        console.log(`Failed to recover entry ${entry.id}`);
      }
    } catch (error) {
      failCount++;
      console.error(`Error retrying entry ${entry.id}:`, error);
    }
  }

  console.log(`Retry complete: ${successCount} succeeded, ${failCount} failed`);

  // Cleanup expired entries
  const deleted = await dlq.cleanup();
  console.log(`Cleaned up ${deleted} expired entries`);
}
