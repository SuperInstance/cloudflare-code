/**
 * Resilient API Client Example
 *
 * Complete example showing how to integrate all resilience patterns:
 * - Rate limiting (token bucket + sliding window)
 * - Circuit breaker
 * - Retry logic
 * - Quota tracking
 * - Provider failover
 */

import {
  TokenBucket,
  SlidingWindow,
  CircuitBreaker,
  RetryPolicy,
  QuotaTracker,
  createRateLimiterRPM,
  createAPIRetryPolicy,
  createQuotaTracker,
} from '../lib/rate-limit';

interface APIResponse {
  data: unknown;
  provider: string;
  tokens: number;
  latency: number;
}

export class ResilientAPIClient {
  // Rate limiters
  private userRateLimiter: TokenBucket;
  private ipRateLimiter: SlidingWindow;

  // Circuit breakers per provider
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  // Retry policy
  private retryPolicy: RetryPolicy;

  // Quota tracker
  private quotaTracker: QuotaTracker;

  // Provider configuration
  private providers: string[] = ['openai', 'anthropic', 'groq', 'cerebras'];

  constructor(kv: KVNamespace, doNamespace: DurableObjectNamespace) {
    // Initialize rate limiters
    this.userRateLimiter = createRateLimiterRPM(100, doNamespace);
    this.ipRateLimiter = new SlidingWindow({
      maxRequests: 1000,
      windowMs: 60000,
      kv,
    });

    // Initialize retry policy
    this.retryPolicy = createAPIRetryPolicy(3);

    // Initialize quota tracker
    this.quotaTracker = createQuotaTracker(kv);

    // Initialize circuit breakers for each provider
    for (const provider of this.providers) {
      this.circuitBreakers.set(
        provider,
        new CircuitBreaker({
          name: `${provider}-api`,
          failureThreshold: 5,
          successThreshold: 2,
          timeout: 60000,
          kv,
        })
      );
    }

    // Initialize provider quotas
    this.initializeQuotas();
  }

  /**
   * Make a resilient API call
   */
  async callAPI(
    prompt: string,
    userId: string,
    userIP: string
  ): Promise<APIResponse> {
    // Step 1: Check user-level rate limits
    const userAllowed = await this.userRateLimiter.tryConsume(userId, 1);
    if (!userAllowed) {
      throw new Error('User rate limit exceeded. Please try again later.');
    }

    // Step 2: Check IP-level rate limits
    const ipAllowed = await this.ipRateLimiter.isAllowed(userIP);
    if (!ipAllowed) {
      throw new Error('IP rate limit exceeded. Please try again later.');
    }

    // Step 3: Select best provider (with failover)
    const provider = await this.selectProvider();

    // Step 4: Make API call with circuit breaker and retry
    try {
      const response = await this.executeWithResilience(provider, prompt);

      // Step 5: Record usage
      await this.quotaTracker.recordUsage(provider, response.tokens);

      return response;
    } catch (error) {
      // Step 6: Handle failure with fallback
      console.error(`Provider ${provider} failed:`, error);

      // Try next provider
      const fallbackProvider = await this.selectProvider(provider);
      if (fallbackProvider) {
        return await this.executeWithResilience(fallbackProvider, prompt);
      }

      throw new Error('All providers are currently unavailable.');
    }
  }

  /**
   * Execute API call with circuit breaker and retry
   */
  private async executeWithResilience(
    provider: string,
    prompt: string
  ): Promise<APIResponse> {
    const circuitBreaker = this.circuitBreakers.get(provider)!;

    return await circuitBreaker.execute(async () => {
      return await this.retryPolicy.execute(async () => {
        return await this.fetchFromProvider(provider, prompt);
      });
    });
  }

  /**
   * Select best available provider
   */
  private async selectProvider(excludeProvider?: string): Promise<string> {
    // Get providers sorted by remaining quota
    const availableProviders = await this.quotaTracker.getProvidersByRemaining();

    // Filter out excluded provider and unavailable ones
    for (const provider of availableProviders) {
      if (provider === excludeProvider) continue;

      // Check circuit breaker state
      const breaker = this.circuitBreakers.get(provider);
      if (!breaker) continue;

      if (breaker.getState() === 'OPEN') continue;

      // Check quota
      const hasQuota = await this.quotaTracker.hasQuota(provider, 1000);
      if (!hasQuota) continue;

      return provider;
    }

    throw new Error('No available providers');
  }

  /**
   * Fetch from provider (simulated)
   */
  private async fetchFromProvider(
    provider: string,
    prompt: string
  ): Promise<APIResponse> {
    const startTime = Date.now();

    // Simulate API call
    // In production, this would be actual fetch() to provider API
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    // Simulate occasional failures
    if (Math.random() > 0.9) {
      throw new Error('Provider error');
    }

    const latency = Date.now() - startTime;
    const estimatedTokens = Math.ceil(prompt.length / 4);

    return {
      data: { response: `Response from ${provider}` },
      provider,
      tokens: estimatedTokens,
      latency,
    };
  }

  /**
   * Initialize provider quotas
   */
  private async initializeQuotas(): Promise<void> {
    // Daily quotas for each provider
    const quotas = {
      openai: 1000000,      // 1M tokens/day
      anthropic: 500000,   // 500K tokens/day
      groq: 10000000,      // 10M tokens/day
      cerebras: 10000000,  // 10M tokens/day
    };

    for (const [provider, limit] of Object.entries(quotas)) {
      try {
        await this.quotaTracker.initialize(provider, limit, 'daily');
      } catch (error) {
        // Already initialized
        console.debug(`${provider} quota already initialized`);
      }
    }
  }

  /**
   * Get statistics for monitoring
   */
  async getStats(): Promise<{
    rateLimiting: {
      userRequests: number;
      ipRequests: number;
    };
    circuitBreakers: Map<string, { state: string; failureCount: number }>;
    quotas: Array<{ provider: string; usagePercent: number; remaining: number }>;
  }> {
    // Get circuit breaker stats
    const cbStats = new Map();
    for (const [provider, breaker] of this.circuitBreakers.entries()) {
      const stats = breaker.getStats();
      cbStats.set(provider, {
        state: stats.state,
        failureCount: stats.failureCount,
      });
    }

    // Get quota stats
    const quotaStats = [];
    for (const provider of this.providers) {
      try {
        const stats = await this.quotaTracker.getStats(provider);
        quotaStats.push({
          provider,
          usagePercent: stats.usagePercent,
          remaining: stats.remaining,
        });
      } catch (error) {
        // Provider not initialized
      }
    }

    return {
      rateLimiting: {
        userRequests: 0, // Would be tracked in production
        ipRequests: 0,
      },
      circuitBreakers: cbStats,
      quotas: quotaStats,
    };
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<
    Map<string, { healthy: boolean; state: string; quota: number }>
  > {
    const health = new Map();

    for (const provider of this.providers) {
      const breaker = this.circuitBreakers.get(provider)!;
      const state = breaker.getState();
      const stats = await this.quotaTracker.getStats(provider);

      health.set(provider, {
        healthy: state !== 'OPEN' && stats.remaining > 0,
        state,
        quota: stats.remaining,
      });
    }

    return health;
  }

  /**
   * Reset rate limits for a user (admin function)
   */
  async resetUserRateLimit(userId: string): Promise<void> {
    await this.userRateLimiter.reset(userId);
  }

  /**
   * Reset IP rate limit (admin function)
   */
  async resetIPRateLimit(ip: string): Promise<void> {
    await this.ipRateLimiter.reset(ip);
  }

  /**
   * Reset circuit breaker for a provider (admin function)
   */
  async resetCircuitBreaker(provider: string): Promise<void> {
    const breaker = this.circuitBreakers.get(provider);
    if (breaker) {
      await breaker.reset();
    }
  }

  /**
   * Get quota status for all providers
   */
  async getQuotaStatus(): Promise<
    Array<{ provider: string; used: number; limit: number; remaining: number; percent: number }>
  > {
    const status = [];

    for (const provider of this.providers) {
      try {
        const stats = await this.quotaTracker.getStats(provider);
        status.push({
          provider,
          used: stats.provider ? stats.limit - stats.remaining : 0,
          limit: stats.limit,
          remaining: stats.remaining,
          percent: stats.usagePercent,
        });
      } catch (error) {
        // Skip if not initialized
      }
    }

    return status;
  }
}

/**
 * Usage Example
 */
export async function exampleUsage() {
  // Mock KV and DO namespace
  const mockKV = {
    get: async () => null,
    put: async () => {},
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true, cursor: '' }),
  } as unknown as KVNamespace;

  const mockDO = {} as DurableObjectNamespace;

  // Create client
  const client = new ResilientAPIClient(mockKV, mockDO);

  // Make API call
  try {
    const response = await client.callAPI(
      'What is the capital of France?',
      'user-123',
      '192.168.1.1'
    );

    console.log('Response:', response);
  } catch (error) {
    console.error('Error:', error);
  }

  // Get statistics
  const stats = await client.getStats();
  console.log('Stats:', stats);

  // Health check
  const health = await client.healthCheck();
  console.log('Health:', health);

  // Quota status
  const quotaStatus = await client.getQuotaStatus();
  console.log('Quota Status:', quotaStatus);
}

/**
 * Worker Integration Example
 */
export async function workerHandler(request: Request, env: any): Promise<Response> {
  const client = new ResilientAPIClient(env.CACHE_KV, env.SESSIONS);

  try {
    const { prompt, userId } = await request.json();

    // Get user IP from headers
    const userIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Make resilient API call
    const response = await client.callAPI(prompt, userId, userIP);

    return Response.json({
      success: true,
      data: response.data,
      provider: response.provider,
      tokens: response.tokens,
      latency: response.latency,
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
