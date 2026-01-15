/**
 * Cloudflare Workers AI Provider
 *
 * Implements the ProviderClient interface for Cloudflare Workers AI.
 * Uses 10K free neurons/day with models like Llama, Mistral, etc.
 *
 * @see https://developers.cloudflare.com/workers-ai/
 */

import type { Env } from '../../types/index';
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
} from './base';

/**
 * Cloudflare Workers AI specific configuration
 */
export interface CloudflareAIConfig extends ProviderConfig {
  /** Cloudflare account ID */
  accountId: string;
  /** API token (uses Workers AI binding if not provided) */
  apiToken?: string;
  /** Workers AI binding name (if using binding instead of HTTP API) */
  bindingName?: string;
}

/**
 * Available Cloudflare AI models
 */
const CLOUDFLARE_MODELS = {
  '@cf/meta/llama-3.1-8b-instruct': 'Meta Llama 3.1 8B Instruct',
  '@cf/meta/llama-3.3-70b-instruct': 'Meta Llama 3.3 70B Instruct',
  '@cf/mistral/mistral-7b-instruct-v0.2': 'Mistral 7B Instruct',
  '@cf/meta/llama-2-7b-chat-int8': 'Llama 2 7B Chat (quantized)',
  '@hf/google/gemma-7b-it': 'Google Gemma 7B IT',
  '@cf/qwen/qwen1.5-14b-chat-awq': 'Qwen 1.5 14B Chat',
} as const;

/**
 * Neuron to token conversion factor (roughly 1 neuron = 1-2 tokens)
 */
const NEURON_TO_TOKEN = 1.5;

/**
 * Cloudflare Workers AI Provider Implementation
 */
export class CloudflareAIProvider implements ProviderClient {
  readonly name = 'cloudflare';

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    functionCalling: false,
    vision: false,
    maxContextTokens: 128000, // For Llama 3.3
    maxOutputTokens: 4096,
    avgLatency: 200,
    hasFreeTier: true,
    freeTierDaily: 10000, // 10K neurons/day
    inputCostPer1M: 11, // $0.011 per 1K neurons = $11 per 1M
    outputCostPer1M: 11,
  };

  private quota: QuotaInfo;
  private health: HealthStatus;
  private config: CloudflareAIConfig;
  private env?: Env;

  constructor(config: CloudflareAIConfig, env?: Env) {
    this.config = config;
    if (env !== undefined) {
      this.env = env;
    }

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
      // Check if we have API binding or token
      if (!this.env && !this.config.apiToken) {
        return false;
      }

      // Check quota
      await this.updateQuota();
      if (this.quota.isExhausted) {
        return false;
      }

      return true;
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
      const model = request.model || '@cf/meta/llama-3.1-8b-instruct';
      const messages = this.transformMessages(request.messages);

      // Use Workers AI binding if available, otherwise use HTTP API
      let response: Response;

      if (this.env && this.env.AI) {
        // Use binding
        response = await this.env.AI.run(model, {
          messages,
          stream: false,
        });
      } else {
        // Use HTTP API
        response = await this.callHTTPAPI(model, messages, false);
      }

      const result = await response.json() as CloudflareAIResponse;
      const latency = Date.now() - startTime;

      // Update health metrics
      this.health.avgLatency = (this.health.avgLatency * 0.9) + (latency * 0.1);
      this.health.successRate = Math.max(0, this.health.successRate);

      // Track usage
      const estimatedTokens = estimateChatTokens(request.messages);
      const neuronsUsed = Math.ceil(estimatedTokens / NEURON_TO_TOKEN);
      await this.trackUsage(neuronsUsed);

      return this.transformResponse(result, model, request);
    } catch (error) {
      this.health.failedRequests++;
      this.health.successRate = Math.max(
        0,
        (this.health.totalRequests - this.health.failedRequests) / this.health.totalRequests
      );

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
      const model = request.model || '@cf/meta/llama-3.1-8b-instruct';
      const messages = this.transformMessages(request.messages);
      const requestId = crypto.randomUUID();

      let response: Response;

      if (this.env && this.env.AI) {
        // Use binding
        response = await this.env.AI.run(model, {
          messages,
          stream: true,
        });
      } else {
        // Use HTTP API
        response = await this.callHTTPAPI(model, messages, true);
      }

      // Stream response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullContent += chunk;

        yield {
          id: requestId,
          delta: chunk,
          model,
          provider: this.name,
          isComplete: false,
          timestamp: Date.now(),
        };
      }

      // Final chunk with usage
      const estimatedTokens = estimateChatTokens(request.messages);
      const completionTokens = estimateChatTokens([
        { role: 'assistant', content: fullContent },
      ]);

      const latency = Date.now() - startTime;
      this.health.avgLatency = (this.health.avgLatency * 0.9) + (latency * 0.1);

      const neuronsUsed = Math.ceil(
        (estimatedTokens + completionTokens) / NEURON_TO_TOKEN
      );
      await this.trackUsage(neuronsUsed);

      yield {
        id: requestId,
        delta: '',
        model,
        provider: this.name,
        isComplete: true,
        finishReason: 'stop',
        usage: {
          promptTokens: estimatedTokens,
          completionTokens,
          totalTokens: estimatedTokens + completionTokens,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      this.health.failedRequests++;
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
    return Object.keys(CLOUDFLARE_MODELS);
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
   * Transform messages to Cloudflare format
   */
  private transformMessages(
    messages: Array<{ role: string; content: string }>
  ): Array<{ role: string; content: string }> {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Call Cloudflare AI HTTP API
   */
  private async callHTTPAPI(
    model: string,
    messages: Array<{ role: string; content: string }>,
    stream: boolean
  ): Promise<Response> {
    const { accountId, apiToken } = this.config;

    if (!accountId || !apiToken) {
      throw new Error('Cloudflare accountId and apiToken are required for HTTP API');
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        stream,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudflare AI API error: ${response.status} ${error}`);
    }

    return response;
  }

  /**
   * Transform Cloudflare response to standard format
   */
  private transformResponse(
    result: CloudflareAIResponse,
    model: string,
    request: ChatRequest
  ): ChatResponse {
    const estimatedInputTokens = estimateChatTokens(request.messages);
    const estimatedOutputTokens = estimateChatTokens([
      { role: 'assistant', content: result.response?.result?.response || '' },
    ]);

    return {
      id: result.response?.result?.id || crypto.randomUUID(),
      content: result.response?.result?.response || '',
      model,
      provider: this.name,
      finishReason: 'stop',
      usage: {
        promptTokens: estimatedInputTokens,
        completionTokens: estimatedOutputTokens,
        totalTokens: estimatedInputTokens + estimatedOutputTokens,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Track usage and update quota
   */
  private async trackUsage(neurons: number): Promise<void> {
    this.quota.used += neurons;
    this.quota.remaining = Math.max(0, this.quota.limit - this.quota.used);
    this.quota.lastUpdated = Date.now();
    this.quota.isExhausted = this.quota.remaining < (this.quota.limit * 0.1); // 90% threshold
  }

  /**
   * Update quota and check for reset
   */
  private async updateQuota(): Promise<void> {
    const now = Date.now();

    // Check if quota needs reset
    if (now > this.quota.resetTime) {
      this.quota.used = 0;
      this.quota.remaining = this.quota.limit;
      this.quota.resetTime = this.calculateNextReset();
      this.quota.lastUpdated = now;
      this.quota.isExhausted = false;
    }
  }

  /**
   * Calculate next reset time (midnight UTC)
   */
  private calculateNextReset(): number {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }
}

/**
 * Cloudflare AI API response format
 */
interface CloudflareAIResponse {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  response?: {
    result?: {
      id?: string;
      response: string;
      model?: string;
      token_usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      };
    };
  };
}

/**
 * Create Cloudflare AI provider instance
 */
export function createCloudflareAIProvider(
  config: CloudflareAIConfig,
  env?: Env
): CloudflareAIProvider {
  return new CloudflareAIProvider(config, env);
}
