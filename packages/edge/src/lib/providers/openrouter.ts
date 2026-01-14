/**
 * OpenRouter Provider
 *
 * Implements the ProviderClient interface for OpenRouter API.
 * Provides access to 300+ models via single API with free tier.
 *
 * @see https://openrouter.ai/
 * @see https://openrouter.ai/docs
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
 * OpenRouter API configuration
 */
export interface OpenRouterConfig extends ProviderConfig {
  /** OpenRouter API key */
  apiKey: string;
  /** Base URL (default: https://openrouter.ai/api/v1) */
  baseURL?: string;
  /** Site URL for ranking (optional) */
  siteUrl?: string;
  /** Site name for ranking (optional) */
  siteName?: string;
}

/**
 * Popular OpenRouter models
 */
const OPENROUTER_MODELS = {
  'anthropic/claude-3.5-haiku': 'Claude 3.5 Haiku',
  'anthropic/claude-3-haiku': 'Claude 3 Haiku',
  'google/gemini-flash-1.5': 'Gemini Flash 1.5',
  'meta-llama/llama-3.1-8b-instruct:free': 'Llama 3.1 8B (Free)',
  'microsoft/phi-3-medium-128k-instruct:free': 'Phi-3 Medium 128K (Free)',
  'qwen/qwen-2-7b-instruct:free': 'Qwen 2 7B (Free)',
} as const;

/**
 * OpenRouter API endpoint
 */
const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

/**
 * OpenRouter Provider Implementation
 */
export class OpenRouterProvider implements ProviderClient {
  readonly name = 'openrouter';

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    functionCalling: true,
    vision: true,
    maxContextTokens: 200000,
    maxOutputTokens: 8192,
    avgLatency: 150,
    hasFreeTier: true,
    freeTierDaily: 50, // 50 free requests per day
    inputCostPer1M: 0, // Varies by model
    outputCostPer1M: 0, // Varies by model
  };

  private quota: QuotaInfo;
  private health: HealthStatus;
  private config: OpenRouterConfig;

  constructor(config: OpenRouterConfig) {
    this.config = {
      ...config,
      baseURL: config.baseURL || OPENROUTER_API_BASE,
    };

    // Initialize quota tracking (50 free requests/day)
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
      const model = request.model || 'meta-llama/llama-3.1-8b-instruct:free';
      const response = await this.callOpenRouterAPI(model, request, false);

      const latency = Date.now() - startTime;
      this.updateHealthMetrics(latency, true);

      // Track request usage
      await this.trackUsage(1);

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
      const model = request.model || 'meta-llama/llama-3.1-8b-instruct:free';
      const requestId = crypto.randomUUID();
      let fullContent = '';

      const response = await this.callOpenRouterAPIStream(model, request);

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

        if (chunk.finish_reason) {
          const latency = Date.now() - startTime;
          this.updateHealthMetrics(latency, true);

          // Track request usage
          await this.trackUsage(1);

          const estimatedTokens = estimateChatTokens(request.messages);
          const completionTokens = estimateChatTokens([
            { role: 'assistant', content: fullContent },
          ]);

          yield {
            id: requestId,
            delta: '',
            model,
            provider: this.name,
            isComplete: true,
            finishReason: chunk.finish_reason === 'stop' ? 'stop' : 'length',
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
    try {
      const url = `${this.config.baseURL}/models`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return Object.keys(OPENROUTER_MODELS);
      }

      const data = await response.json() as OpenRouterModelsResponse;
      return data.data.map((m) => m.id);
    } catch (error) {
      return Object.keys(OPENROUTER_MODELS);
    }
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
   * Call OpenRouter API (non-streaming)
   */
  private async callOpenRouterAPI(
    model: string,
    request: ChatRequest,
    stream: boolean
  ): Promise<ChatResponse> {
    const url = `${this.config.baseURL}/chat/completions`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': this.config.siteUrl || 'https://claudeflare.ai',
      'X-Title': this.config.siteName || 'ClaudeFlare',
      ...this.config.headers,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
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

    const data = await response.json() as OpenRouterAPIResponse;
    return this.transformResponse(data, model);
  }

  /**
   * Call OpenRouter API (streaming)
   */
  private async *callOpenRouterAPIStream(
    model: string,
    request: ChatRequest
  ): AsyncIterable<OpenRouterStreamChunk> {
    const url = `${this.config.baseURL}/chat/completions`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': this.config.siteUrl || 'https://claudeflare.ai',
      'X-Title': this.config.siteName || 'ClaudeFlare',
      ...this.config.headers,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
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
          const data = JSON.parse(json) as OpenRouterStreamResponse;
          yield data.choices[0];
        } catch (e) {
          // Skip invalid JSON
          continue;
        }
      }
    }
  }

  /**
   * Handle error response from OpenRouter API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));

    if (response.status === 401) {
      throw new Error(`OpenRouter authentication failed: ${error.error?.message || 'Invalid API key'}`);
    } else if (response.status === 429) {
      throw new Error(`OpenRouter rate limit exceeded: ${error.error?.message || 'Too many requests'}`);
    } else if (response.status === 400) {
      throw new Error(`OpenRouter invalid request: ${error.error?.message || 'Bad request'}`);
    } else if (response.status === 402) {
      throw new Error(`OpenRouter credit exhausted: ${error.error?.message || 'Insufficient credits'}`);
    } else {
      throw new Error(`OpenRouter API error: ${response.status} ${error.error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Transform OpenRouter API response to standard format
   */
  private transformResponse(data: OpenRouterAPIResponse, model: string): ChatResponse {
    const choice = data.choices[0];

    return {
      id: data.id,
      content: choice.message.content,
      model: data.model,
      provider: this.name,
      finishReason: choice.finish_reason === 'stop' ? 'stop' : 'length',
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
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
  private async trackUsage(requests: number): Promise<void> {
    this.quota.used += requests;
    this.quota.remaining = Math.max(0, this.quota.limit - this.quota.used);
    this.quota.lastUpdated = Date.now();
    this.quota.isExhausted = this.quota.remaining < 5; // Alert when < 5 requests left
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
 * OpenRouter API response format
 */
interface OpenRouterAPIResponse {
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
    finish_reason: 'stop' | 'length';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenRouter streaming response format
 */
interface OpenRouterStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<OpenRouterStreamChunk>;
}

/**
 * OpenRouter stream chunk
 */
interface OpenRouterStreamChunk {
  index: number;
  delta: {
    role?: string;
    content?: string;
  };
  finish_reason: 'stop' | 'length' | null;
}

/**
 * OpenRouter models response format
 */
interface OpenRouterModelsResponse {
  data: Array<{
    id: string;
    name: string;
    context_length: number;
    pricing: {
      prompt: string;
      completion: string;
    };
  }>;
}

/**
 * Create OpenRouter provider instance
 */
export function createOpenRouterProvider(config: OpenRouterConfig): OpenRouterProvider {
  return new OpenRouterProvider(config);
}
