/**
 * Metrics Collection Middleware
 *
 * Automatically collects metrics for all requests.
 * Can be applied globally or to specific routes.
 */

import type { MiddlewareHandler } from 'hono';
import type { Env, RequestContext } from '../types';

interface MetricsConfig {
  /**
   * Enable request metrics collection
   */
  collectRequestMetrics?: boolean;

  /**
   * Enable provider metrics collection
   */
  collectProviderMetrics?: boolean;

  /**
   * Enable cache metrics collection
   */
  collectCacheMetrics?: boolean;

  /**
   * Sample rate for metrics (0-1)
   * 1.0 = collect all metrics
   * 0.1 = collect 10% of metrics
   */
  sampleRate?: number;
}

/**
 * Create metrics collection middleware
 */
export function metricsCollector(config: MetricsConfig = {}): MiddlewareHandler<{
  Bindings: Env;
  Variables: RequestContext;
}> {
  const {
    collectRequestMetrics = true,
    collectProviderMetrics = true,
    collectCacheMetrics = true,
    sampleRate = 1.0,
  } = config;

  return async (c, next) => {
    // Skip if not sampled
    if (Math.random() > sampleRate) {
      return next();
    }

    const startTime = Date.now();
    const requestId = c.get('requestId') || generateRequestId();

    // Store request context
    c.set('requestId', requestId);
    c.set('timestamp', startTime);

    // Continue with request
    await next();

    // Collect metrics after response
    const latency = Date.now() - startTime;
    const response = c.res;
    const success = response.status < 400;

    // Collect request metrics
    if (collectRequestMetrics && c.env.CACHE_KV && c.env.STORAGE_R2) {
      collectRequestMetric(c, requestId, startTime, latency, success).catch(
        console.error
      );
    }

    return c;
  };
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Collect request metrics asynchronously
 */
async function collectRequestMetric(
  c: any,
  requestId: string,
  timestamp: number,
  latency: number,
  success: boolean
): Promise<void> {
  try {
    // Extract metrics from context
    const provider = c.get('provider') || 'unknown';
    const model = c.get('model') || 'unknown';
    const tokens = c.get('tokens') || { prompt: 0, completion: 0, total: 0 };
    const cacheHit = c.get('cacheHit') || false;
    const cacheTier = c.get('cacheTier');
    const cost = c.get('cost') || 0;
    const errorCode = c.get('errorCode');
    const userId = c.get('userId');
    const sessionId = c.get('sessionId');
    const feature = c.get('feature');

    // Prepare metrics payload
    const metricsPayload = {
      requestId,
      timestamp,
      provider,
      model,
      latency,
      tokens,
      cacheHit,
      cacheTier,
      cost,
      success,
      errorCode,
      userId,
      sessionId,
      feature,
    };

    // Record metrics using the metrics API
    // This is done asynchronously to not block the response
    const metricsUrl = new URL('/v1/metrics/record', c.req.url);
    await fetch(metricsUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metricsPayload),
    });
  } catch (error) {
    // Silently fail to not impact requests
    console.error('Failed to collect metrics:', error);
  }
}

/**
 * Helper to set metrics context in handlers
 */
export function setMetricsContext(
  c: any,
  context: {
    provider?: string;
    model?: string;
    tokens?: { prompt: number; completion: number; total: number };
    cacheHit?: boolean;
    cacheTier?: 'hot' | 'warm' | 'cold';
    cost?: number;
    errorCode?: string;
    userId?: string;
    sessionId?: string;
    feature?: string;
  }
): void {
  if (context.provider) c.set('provider', context.provider);
  if (context.model) c.set('model', context.model);
  if (context.tokens) c.set('tokens', context.tokens);
  if (context.cacheHit !== undefined) c.set('cacheHit', context.cacheHit);
  if (context.cacheTier) c.set('cacheTier', context.cacheTier);
  if (context.cost !== undefined) c.set('cost', context.cost);
  if (context.errorCode) c.set('errorCode', context.errorCode);
  if (context.userId) c.set('userId', context.userId);
  if (context.sessionId) c.set('sessionId', context.sessionId);
  if (context.feature) c.set('feature', context.feature);
}

/**
 * Calculate cost from tokens and provider
 */
export function calculateCost(
  provider: string,
  model: string,
  tokens: { prompt: number; completion: number }
): number {
  // Pricing per 1K tokens (as of 2026)
  const pricing: Record<string, Record<string, { input: number; output: number }>> = {
    anthropic: {
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    },
    openai: {
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    },
    groq: {
      'llama-3.3-70b': { input: 0.00059, output: 0.00079 },
      'llama-3.1-70b': { input: 0.00059, output: 0.00079 },
      'mixtral-8x7b': { input: 0.00027, output: 0.00027 },
    },
    cerebras: {
      'llama-3.3-70b': { input: 0.0001, output: 0.0001 },
    },
    cloudflare: {
      'llama-3.3-70b': { input: 0, output: 0 },
    },
  };

  const providerPricing = pricing[provider]?.[model];
  if (!providerPricing) return 0;

  const inputCost = (tokens.prompt / 1000) * providerPricing.input;
  const outputCost = (tokens.completion / 1000) * providerPricing.output;

  return inputCost + outputCost;
}
