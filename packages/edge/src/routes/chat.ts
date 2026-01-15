/**
 * Chat Completions Endpoint with Multi-Provider Integration
 *
 * Implements intelligent routing across multiple AI providers with:
 * - Automatic failover
 * - Quota tracking
 * - Health monitoring
 * - Cost optimization
 */

import type { Context } from 'hono';
import type { Env, ChatRequest, ChatResponse } from '../types/index';
import {
  createProviderRegistry,
  createRequestRouter,
  RoutingStrategy,
  createCloudflareAIProvider,
  createGroqProvider,
  createCerebrasProvider,
  createOpenRouterProvider,
} from '../lib/providers';

/**
 * Provider registry singleton (initialized on first request)
 */
let registry: ReturnType<typeof createProviderRegistry> | null = null;
let router: ReturnType<typeof createRequestRouter> | null = null;

/**
 * Initialize provider registry with available providers
 */
function initializeProviders(env: Env): void {
  if (registry) return; // Already initialized

  registry = createProviderRegistry({
    healthCheckInterval: 60000, // 1 minute
    minSuccessRate: 0.9,
    maxLatency: 5000,
  });

  // Register Cloudflare Workers AI (highest priority - native integration)
  if (env.CLOUDFLARE_ACCOUNT_ID && (env.AI || env.CLOUDFLARE_API_TOKEN)) {
    registry.register(createCloudflareAIProvider({
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiKey: env.CLOUDFLARE_API_TOKEN ?? '',
      ...(env.CLOUDFLARE_API_TOKEN ? { apiToken: env.CLOUDFLARE_API_TOKEN } : {}),
    }, env), {
      priority: 10,
      enabled: true,
    });
  }

  // Register Groq (fastest - 840 TPS)
  if (env.GROQ_API_KEY) {
    registry.register(createGroqProvider({
      apiKey: env.GROQ_API_KEY,
    }), {
      priority: 8,
      enabled: true,
    });
  }

  // Register Cerebras (ultra-fast - 2600 TPS)
  if (env.CEREBRAS_API_KEY) {
    registry.register(createCerebrasProvider({
      apiKey: env.CEREBRAS_API_KEY,
    }), {
      priority: 7,
      enabled: true,
    });
  }

  // Register OpenRouter (300+ models)
  if (env.OPENROUTER_API_KEY) {
    registry.register(createOpenRouterProvider({
      apiKey: env.OPENROUTER_API_KEY,
    }), {
      priority: 5,
      enabled: true,
    });
  }

  // Initialize router
  router = createRequestRouter(registry, {
    defaultStrategy: RoutingStrategy.FREE_TIER_FIRST,
    enableCircuitBreaker: true,
    enableRetry: true,
    enableFallback: true,
    maxRetries: 3,
    maxFallbackAttempts: 3,
    circuitFailureThreshold: 5,
    circuitTimeout: 60000,
  });
}

/**
 * Chat completions endpoint
 * POST /v1/chat
 */
export async function createChatCompletion(c: Context<{ Bindings: Env }>) {
  const env = c.env;
  const startTime = Date.now();

  try {
    // Initialize providers on first request
    initializeProviders(env);

    // Validate registry and router
    if (!registry || !router) {
      return c.json(
        {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'No AI providers configured. Please add API keys to environment variables.',
            timestamp: Date.now(),
          },
        },
        503
      );
    }

    // Parse and validate request
    const body = (await c.req.json()) as ChatRequest;

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'messages field is required and must be a non-empty array',
            timestamp: Date.now(),
          },
        },
        400
      );
    }

    // Set default values
    if (!body.model) {
      body.model = 'auto';
    }

    if (body.temperature === undefined) {
      body.temperature = 0.7;
    }

    if (body.stream === undefined) {
      body.stream = false;
    }

    // Route request to optimal provider
    const response = await router!.route(body);

    // Add routing metadata
    const routingTime = Date.now() - startTime;
    const enhancedResponse: ChatResponse & { _routing?: unknown } = {
      ...response,
      _routing: {
        totalLatency: Date.now() - startTime,
        routingOverhead: routingTime,
      },
    };

    return c.json(enhancedResponse, 200);
  } catch (error) {
    console.error('Chat completion error:', error);

    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error ? error.message : 'An unexpected error occurred',
          timestamp: Date.now(),
        },
      },
      500
    );
  }
}

/**
 * Streaming chat completions endpoint
 * POST /v1/chat/stream
 */
export async function createChatCompletionStream(c: Context<{ Bindings: Env }>) {
  const env = c.env;

  try {
    // Initialize providers on first request
    initializeProviders(env);

    // Validate registry
    if (!registry) {
      return c.json(
        {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'No AI providers configured.',
            timestamp: Date.now(),
          },
        },
        503
      );
    }

    // Parse and validate request
    const body = (await c.req.json()) as ChatRequest & { stream: true };

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'messages field is required and must be a non-empty array',
            timestamp: Date.now(),
          },
        },
        400
      );
    }

    // Force streaming
    body.stream = true;

    // Get available provider
    const availableProviders = await registry.getAvailable();
    if (availableProviders.length === 0) {
      return c.json(
        {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'No AI providers currently available',
            timestamp: Date.now(),
          },
        },
        503
      );
    }

    // Use first available provider for streaming
    const provider = availableProviders[0];
    if (!provider) {
      return c.json(
        {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'No available providers',
            timestamp: Date.now(),
          },
        },
        503
      );
    }

    // Set up SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of provider.stream(body)) {
            const data = JSON.stringify(chunk);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));

            if (chunk.isComplete) {
              break;
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat completion stream error:', error);

    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error ? error.message : 'An unexpected error occurred',
          timestamp: Date.now(),
        },
      },
      500
    );
  }
}

/**
 * Get provider status endpoint
 * GET /v1/providers/status
 */
export async function getProvidersStatus(c: Context<{ Bindings: Env }>) {
  const env = c.env;

  try {
    // Initialize providers
    initializeProviders(env);

    if (!registry) {
      return c.json(
        {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'No providers configured',
            timestamp: Date.now(),
          },
        },
        503
      );
    }

    // Get all provider statuses
    const quotas = await registry.getAllQuotas();
    const _stats = registry.getStats();

    const providers: Array<{
      name: string;
      enabled: boolean;
      healthy: boolean;
      quota?: {
        used: number;
        limit: number;
        remaining: number;
        percentage: number;
      };
    }> = [];

    for (const [_name, metadata] of Object.entries(registry['providers'].entries())) {
      const [_providerName, providerMetadata] = metadata as [string, unknown];
      const meta = providerMetadata as {
        provider: { name: string };
        enabled: boolean;
        isHealthy: boolean;
      };

      const quota = quotas.get(meta.provider.name);

      const providerData: {
        name: string;
        enabled: boolean;
        healthy: boolean;
        quota?: {
          used: number;
          limit: number;
          remaining: number;
          percentage: number;
        };
      } = {
        name: meta.provider.name,
        enabled: meta.enabled,
        healthy: meta.isHealthy,
      };

      if (quota) {
        providerData.quota = {
          used: quota.used,
          limit: quota.limit,
          remaining: quota.remaining,
          percentage: (quota.used / quota.limit) * 100,
        };
      }

      providers.push(providerData);
    }

    return c.json(
      {
        _stats,
        providers,
        timestamp: Date.now(),
      },
      200
    );
  } catch (error) {
    console.error('Provider status error:', error);

    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error ? error.message : 'An unexpected error occurred',
          timestamp: Date.now(),
        },
      },
      500
    );
  }
}
