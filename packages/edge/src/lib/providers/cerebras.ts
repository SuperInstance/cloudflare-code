/**
 * Cerebras Provider
 *
 * Implements the ProviderClient interface for Cerebras Cloud API.
 * Known for ultra-fast inference (2600 TPS) with competitive pricing.
 *
 * @see https://inference-docs.cerebras.ai/
 * @see https://cloud.cerebras.ai/
 */

import type {
  ProviderClient,
  ProviderConfig,
  ProviderCapabilities,
  QuotaInfo,
  HealthStatus,
  ChatChunk,
} from './base';
import type { ChatRequest, ChatResponse } from '../../types/index';
import {
  estimateChatTokens,
  normalizeError,
  ProviderErrorType,
} from './base';

/**
 * Cerebras API configuration
 */
export interface CerebrasConfig extends ProviderConfig {
  /** Cerebras API key */
  apiKey: string;
  /** Base URL (default: https://api.cerebras.ai/v1) */
  baseURL?: string;
}

/**
 * Available Cerebras models
 */
const CEREBRAS_MODELS = {
  'llama3.1-70b': 'Llama 3.1 70B',
  'llama3.1-8b': 'Llama 3.1 8B',
  'llama3-70b': 'Llama 3 70B',
  'llama3-8b': 'Llama 3 8B',
} as const;

/**
 * Cerebras API endpoint
 */
const CEREBRAS_API_BASE = 'https://api.cerebras.ai/v1';

/**
 * Cerebras Provider Implementation
 */
export class CerebrasProvider implements ProviderClient {
  readonly name = 'cerebras';

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    functionCalling: true,
    vision: false,
    maxContextTokens: 128000,
    maxOutputTokens: 4096,
    avgLatency: 30, // Ultra-fast: 2600 TPS
    hasFreeTier: true,
    freeTierDaily: 100000, // Free tier
    inputCostPer1M: 0.10, // $0.10 per 1M input tokens
    outputCostPer1M: 0.10, // $0.10 per 1M output tokens
  };

  private quota: QuotaInfo;
  private health: HealthStatus;
  private config: CerebrasConfig;

  constructor(config: CerebrasConfig) {
    this.config = {
      ...config,
      baseURL: config.baseURL || CEREBRAS_API_BASE,
    };

    // Initialize quota tracking
    this.quota = {
      provider: this.name,
      used: 0,
      limit: this.capabilities.freeTierDaily || 0,
      remaining: this.capabilities.freeTierDaily || 0,
      resetTime: this.calculateNextReset(),
      resetType: 'daily',
      lastUpdated: Date.now(),
      isExhausted: false,
    };

    // Initialize health status
    this.health = {
      provider: this.name,
      isHealthy: true,
      lastCheck: Date.now(),
      avgLatency: this.capabilities.avgLatency,
      successRate: 1.0,
      totalRequests: 0,
      failedRequests: 0,
      circuitState: 'closed',
    };
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        return false;
      }

      await this.updateQuota();
      return !this.quota.isExhausted;
    } catch (error) {
      return false;
    }
  }

  /**
   * Execute non-streaming chat completion
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    this.health.totalRequests++;

    try {
      const model = request.model || 'llama3.1-8b';
      const response = await this.callCerebrasAPI(model, request, false);

      const latency = Date.now() - startTime;
      this.updateHealthMetrics(latency, true);

      // Track token usage
      if (response.usage) {
        await this.trackUsage(response.usage.totalTokens);
      }

      return response;
    } catch (error) {
      this.updateHealthMetrics(0, false);
      throw normalizeError(this.name, error);
    } finally {
      this.health.lastCheck = Date.now();
    }
  }

  /**
   * Execute streaming chat completion
   */
  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    const startTime = Date.now();
    this.health.totalRequests++;

    try {
      const model = request.model || 'llama3.1-8b';
      const requestId = crypto.randomUUID();
      let fullContent = '';

      const response = await this.callCerebrasAPIStream(model, request);

      for await (const chunk of response) {
        if (chunk.delta.content) {
          fullContent += chunk.delta.content;
        }

        yield {
          id: requestId,
          delta: chunk.delta.content || '',
          model,
          provider: this.name,
          isComplete: false,
          timestamp: Date.now(),
        };

        if (chunk.finishReason) {
          const latency = Date.now() - startTime;
          this.updateHealthMetrics(latency, true);

          const estimatedTokens = estimateChatTokens(request.messages);
          const completionTokens = estimateChatTokens([
            { role: 'assistant', content: fullContent },
          ]);

          await this.trackUsage(estimatedTokens + completionTokens);

          yield {
            id: requestId,
            delta: '',
            model,
            provider: this.name,
            isComplete: true,
            finishReason: chunk.finishReason === 'stop' ? 'stop' : 'length',
            usage: {
              promptTokens: estimatedTokens,
              completionTokens,
              totalTokens: estimatedTokens + completionTokens,
            },
            timestamp: Date.now(),
          };
          break;
        }
      }
    } catch (error) {
      this.updateHealthMetrics(0, false);
      throw normalizeError(this.name, error);
    } finally {
      this.health.lastCheck = Date.now();
    }
  }

  /**
   * Get current quota information
   */
  async getQuota(): Promise<QuotaInfo> {
    await this.updateQuota();
    return { ...this.quota };
  }

  /**
   * Get list of available models
   */
  async getModelList(): Promise<string[]> {
    return Object.keys(CEREBRAS_MODELS);
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    return { ...this.health };
  }

  /**
   * Test provider connectivity
   */
  async test(): Promise<boolean> {
    try {
      const response = await this.chat({
        messages: [{ role: 'user', content: 'test' }],
      });
      return !!response.content;
    } catch (error) {
      return false;
    }
  }

  /**
   * Call Cerebras API (non-streaming)
   */
  private async callCerebrasAPI(
    model: string,
    request: ChatRequest,
    stream: boolean
  ): Promise<ChatResponse> {
    const url = `${this.config.baseURL}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
        stream,
      }),
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data = await response.json() as CerebrasAPIResponse;
    return this.transformResponse(data, model);
  }

  /**
   * Call Cerebras API (streaming)
   */
  private async *callCerebrasAPIStream(
    model: string,
    request: ChatRequest
  ): AsyncIterable<CerebrasStreamChunk> {
    const url = `${this.config.baseURL}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
        stream: true,
      }),
      signal: AbortSignal.timeout(this.config.timeout || 60000),
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = trimmed.slice(6);
          const data = JSON.parse(json) as CerebrasStreamResponse;
          yield data.choices[0];
        } catch (e) {
          // Skip invalid JSON
          continue;
        }
      }
    }
  }

  /**
   * Handle error response from Cerebras API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));

    if (response.status === 401) {
      throw new Error(`Cerebras authentication failed: ${error.error?.message || 'Invalid API key'}`);
    } else if (response.status === 429) {
      throw new Error(`Cerebras rate limit exceeded: ${error.error?.message || 'Too many requests'}`);
    } else if (response.status === 400) {
      throw new Error(`Cerebras invalid request: ${error.error?.message || 'Bad request'}`);
    } else {
      throw new Error(`Cerebras API error: ${response.status} ${error.error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Transform Cerebras API response to standard format
   */
  private transformResponse(data: CerebrasAPIResponse, model: string): ChatResponse {
    const choice = data.choices[0];

    return {
      id: data.id,
      content: choice.message.content,
      model: data.model,
      provider: this.name,
      finishReason: choice.finishReason === 'stop' ? 'stop' : 'length',
      usage: {
        promptTokens: data.usage.promptTokens,
        completionTokens: data.usage.completionTokens,
        totalTokens: data.usage.totalTokens,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Update health metrics
   */
  private updateHealthMetrics(latency: number, success: boolean): void {
    if (latency > 0) {
      this.health.avgLatency = (this.health.avgLatency * 0.9) + (latency * 0.1);
    }

    if (!success) {
      this.health.failedRequests++;
    }

    this.health.successRate =
      (this.health.totalRequests - this.health.failedRequests) / this.health.totalRequests;
  }

  /**
   * Track usage and update quota
   */
  private async trackUsage(tokens: number): Promise<void> {
    this.quota.used += tokens;
    this.quota.remaining = Math.max(0, this.quota.limit - this.quota.used);
    this.quota.lastUpdated = Date.now();
    this.quota.isExhausted = this.quota.remaining < (this.quota.limit * 0.1);
  }

  /**
   * Update quota and check for reset
   */
  private async updateQuota(): Promise<void> {
    const now = Date.now();

    if (now > this.quota.resetTime) {
      this.quota.used = 0;
      this.quota.remaining = this.quota.limit;
      this.quota.resetTime = this.calculateNextReset();
      this.quota.lastUpdated = now;
      this.quota.isExhausted = false;
    }
  }

  /**
   * Calculate next reset time
   */
  private calculateNextReset(): number {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }
}

/**
 * Cerebras API response format
 */
interface CerebrasAPIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finishReason: 'stop' | 'length';
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Cerebras streaming response format
 */
interface CerebrasStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<CerebrasStreamChunk>;
}

/**
 * Cerebras stream chunk
 */
interface CerebrasStreamChunk {
  index: number;
  delta: {
    role?: string;
    content?: string;
  };
  finishReason: 'stop' | 'length' | null;
}

/**
 * Create Cerebras provider instance
 */
export function createCerebrasProvider(config: CerebrasConfig): CerebrasProvider {
  return new CerebrasProvider(config);
}
