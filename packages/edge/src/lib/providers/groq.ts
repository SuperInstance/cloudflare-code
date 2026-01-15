/**
 * Groq Provider
 *
 * Implements the ProviderClient interface for Groq API.
 * Known for ultra-fast inference (840 TPS) with generous free tier.
 *
 * @see https://groq.com/
 * @see https://console.groq.com/docs/quickstart
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
} from './base';

/**
 * Groq API configuration
 */
export interface GroqConfig extends ProviderConfig {
  /** Groq API key */
  apiKey: string;
  /** Base URL (default: https://api.groq.com/openai/v1) */
  baseURL?: string;
}

/**
 * Available Groq models
 */
const GROQ_MODELS = {
  'llama-3.3-70b-versatile': 'Llama 3.3 70B Versatile',
  'llama-3.1-70b-versatile': 'Llama 3.1 70B Versatile',
  'llama-3.3-8b-instant': 'Llama 3.3 8B Instant',
  'llama-3.1-8b-instant': 'Llama 3.1 8B Instant',
  'mixtral-8x7b-32768': 'Mixtral 8x7b 32K',
  'gemma2-9b-it': 'Gemma 2 9B IT',
} as const;

/**
 * Groq API endpoint
 */
const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

/**
 * Groq Provider Implementation
 */
export class GroqProvider implements ProviderClient {
  readonly name = 'groq';

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    functionCalling: true,
    vision: false,
    maxContextTokens: 128000,
    maxOutputTokens: 4096,
    avgLatency: 50, // Ultra-fast: 840 TPS
    hasFreeTier: true,
    freeTierDaily: 100000, // Generous free tier
    inputCostPer1M: 0.05, // $0.05 per 1M input tokens
    outputCostPer1M: 0.08, // $0.08 per 1M output tokens
  };

  private quota: QuotaInfo;
  private health: HealthStatus;
  private config: GroqConfig;

  constructor(config: GroqConfig) {
    this.config = {
      ...config,
      baseURL: config.baseURL || GROQ_API_BASE,
    };

    // Initialize quota tracking (generous free tier)
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
      const model = request.model || 'llama-3.3-8b-instant';
      const response = await this.callGroqAPI(model, request, false);

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
      const model = request.model || 'llama-3.3-8b-instant';
      const requestId = crypto.randomUUID();
      let fullContent = '';

      const response = await this.callGroqAPIStream(model, request);

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
    return Object.keys(GROQ_MODELS);
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
   * Call Groq API (non-streaming)
   */
  private async callGroqAPI(
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

    const data = await response.json() as GroqAPIResponse;
    return this.transformResponse(data, model);
  }

  /**
   * Call Groq API (streaming)
   */
  private async *callGroqAPIStream(
    model: string,
    request: ChatRequest
  ): AsyncIterable<GroqStreamChunk> {
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
          const data = JSON.parse(json) as GroqStreamResponse;
          const choice = data.choices[0];
          if (choice) {
            yield choice;
          }
        } catch (e) {
          // Skip invalid JSON
          continue;
        }
      }
    }
  }

  /**
   * Handle error response from Groq API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } })) as { error?: { message?: string } };

    if (response.status === 401) {
      throw new Error(`Groq authentication failed: ${errorData.error?.message || 'Invalid API key'}`);
    } else if (response.status === 429) {
      throw new Error(`Groq rate limit exceeded: ${errorData.error?.message || 'Too many requests'}`);
    } else if (response.status === 400) {
      throw new Error(`Groq invalid request: ${errorData.error?.message || 'Bad request'}`);
    } else {
      throw new Error(`Groq API error: ${response.status} ${errorData.error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Transform Groq API response to standard format
   */
  private transformResponse(data: GroqAPIResponse, _model: string): ChatResponse {
    const choice = data.choices[0];
    if (!choice) {
      throw new Error('Invalid response: no choices returned');
    }

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
 * Groq API response format
 */
interface GroqAPIResponse {
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
 * Groq streaming response format
 */
interface GroqStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<GroqStreamChunk>;
}

/**
 * Groq stream chunk
 */
interface GroqStreamChunk {
  index: number;
  delta: {
    role?: string;
    content?: string;
  };
  finish_reason: 'stop' | 'length' | null;
}

/**
 * Create Groq provider instance
 */
export function createGroqProvider(config: GroqConfig): GroqProvider {
  return new GroqProvider(config);
}
