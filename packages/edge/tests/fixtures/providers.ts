/**
 * Test Fixtures - Mock Provider Implementations
 *
 * Mock LLM provider implementations for testing
 */

import type { ChatRequest, ChatResponse, ChatMessage } from '../../src/types';

/**
 * Base mock provider interface
 */
export interface MockProvider {
  name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  latency?: number;
  shouldFail?: boolean;
  errorRate?: number;
}

/**
 * Mock Anthropic Provider
 */
export class MockAnthropicProvider implements MockProvider {
  name = 'anthropic';
  latency = 100;
  shouldFail = false;
  errorRate = 0;

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (this.shouldFail || Math.random() < this.errorRate) {
      throw new Error('Anthropic API error');
    }

    await this.simulateLatency();

    return {
      id: `anthropic-${crypto.randomUUID()}`,
      content: this.generateResponse(request),
      model: request.model || 'claude-3-opus-20240229',
      provider: 'anthropic',
      finishReason: 'stop',
      usage: {
        promptTokens: this.estimateTokens(request.messages),
        completionTokens: 50,
        totalTokens: this.estimateTokens(request.messages) + 50,
      },
      timestamp: Date.now(),
    };
  }

  private generateResponse(request: ChatRequest): string {
    const lastMessage = request.messages[request.messages.length - 1];
    return `[Anthropic] Response to: ${lastMessage?.content ?? ''}`;
  }

  private estimateTokens(messages: ChatMessage[]): number {
    return messages.reduce((acc: number, msg: ChatMessage) => acc + Math.ceil(msg.content.length / 4), 10);
  }

  private async simulateLatency(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.latency));
  }
}

/**
 * Mock OpenAI Provider
 */
export class MockOpenAIProvider implements MockProvider {
  name = 'openai';
  latency = 150;
  shouldFail = false;
  errorRate = 0;

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (this.shouldFail || Math.random() < this.errorRate) {
      throw new Error('OpenAI API error');
    }

    await this.simulateLatency();

    return {
      id: `openai-${crypto.randomUUID()}`,
      content: this.generateResponse(request),
      model: request.model || 'gpt-4',
      provider: 'openai',
      finishReason: 'stop',
      usage: {
        promptTokens: this.estimateTokens(request.messages),
        completionTokens: 45,
        totalTokens: this.estimateTokens(request.messages) + 45,
      },
      timestamp: Date.now(),
    };
  }

  private generateResponse(request: ChatRequest): string {
    const lastMessage = request.messages[request.messages.length - 1];
    return `[OpenAI] Response to: ${lastMessage?.content ?? ''}`;
  }

  private estimateTokens(messages: ChatMessage[]): number {
    return messages.reduce((acc: number, msg: ChatMessage) => acc + Math.ceil(msg.content.length / 4), 10);
  }

  private async simulateLatency(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.latency));
  }
}

/**
 * Mock Groq Provider
 */
export class MockGroqProvider implements MockProvider {
  name = 'groq';
  latency = 50; // Fast
  shouldFail = false;
  errorRate = 0;

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (this.shouldFail || Math.random() < this.errorRate) {
      throw new Error('Groq API error');
    }

    await this.simulateLatency();

    return {
      id: `groq-${crypto.randomUUID()}`,
      content: this.generateResponse(request),
      model: request.model || 'llama2-70b-4096',
      provider: 'groq',
      finishReason: 'stop',
      usage: {
        promptTokens: this.estimateTokens(request.messages),
        completionTokens: 40,
        totalTokens: this.estimateTokens(request.messages) + 40,
      },
      timestamp: Date.now(),
    };
  }

  private generateResponse(request: ChatRequest): string {
    const lastMessage = request.messages[request.messages.length - 1];
    return `[Groq] Response to: ${lastMessage?.content ?? ''}`;
  }

  private estimateTokens(messages: ChatMessage[]): number {
    return messages.reduce((acc: number, msg: ChatMessage) => acc + Math.ceil(msg.content.length / 4), 10);
  }

  private async simulateLatency(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.latency));
  }
}

/**
 * Failing Mock Provider
 */
export class FailingMockProvider implements MockProvider {
  name = 'failing';
  latency = 100;
  shouldFail = true;
  errorRate = 1;

  async chat(_request: ChatRequest): Promise<ChatResponse> {
    await new Promise(resolve => setTimeout(resolve, this.latency));
    throw new Error('Provider intentionally failing');
  }
}

/**
 * Slow Mock Provider
 */
export class SlowMockProvider implements MockProvider {
  name = 'slow';
  latency = 5000; // 5 seconds
  shouldFail = false;
  errorRate = 0;

  async chat(request: ChatRequest): Promise<ChatResponse> {
    await new Promise(resolve => setTimeout(resolve, this.latency));

    const lastMessage = request.messages[request.messages.length - 1];
    return {
      id: `slow-${crypto.randomUUID()}`,
      content: `Finally responded to: ${lastMessage?.content ?? ''}`,
      model: request.model || 'slow-model',
      provider: 'anthropic',
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      timestamp: Date.now(),
    };
  }
}

/**
 * Provider Registry
 */
export const mockProviders = {
  anthropic: new MockAnthropicProvider(),
  openai: new MockOpenAIProvider(),
  groq: new MockGroqProvider(),
  failing: new FailingMockProvider(),
  slow: new SlowMockProvider(),
};

/**
 * Mock Request Router
 */
export class MockRequestRouter {
  private providers: MockProvider[] = [];
  private currentIndex = 0;

  constructor() {
    this.providers = [mockProviders.anthropic, mockProviders.openai, mockProviders.groq];
  }

  setProviders(providers: MockProvider[]): void {
    this.providers = providers;
  }

  async route(_request: ChatRequest): Promise<MockProvider> {
    // Simple round-robin routing
    const provider = this.providers[this.currentIndex % this.providers.length];
    if (!provider) {
      throw new Error('No provider available');
    }
    this.currentIndex++;

    // Check if provider is healthy
    if (provider.shouldFail) {
      // Try next provider
      const nextProvider = this.providers[(this.currentIndex) % this.providers.length];
      if (nextProvider) {
        return nextProvider;
      }
    }

    return provider;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const provider = await this.route(request);
    return provider.chat(request);
  }

  reset(): void {
    this.currentIndex = 0;
  }
}

/**
 * Circuit Breaker State
 */
export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing, stop sending requests
  HALF_OPEN = 'half_open', // Testing if recovered
}

/**
 * Mock Circuit Breaker
 */
export class MockCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly threshold = 5; // Open after 5 failures
  private readonly timeout = 60000; // Try again after 60 seconds

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = CircuitState.HALF_OPEN;
        console.log('Circuit breaker: HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= 3) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        console.log('Circuit breaker: CLOSED');
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
      console.log('Circuit breaker: OPEN');
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Mock Load Balancer
 */
export class MockLoadBalancer {
  private providers: Map<string, { provider: MockProvider; healthy: boolean; load: number }> = new Map();
  private circuitBreakers: Map<string, MockCircuitBreaker> = new Map();

  constructor() {
    // Initialize with default providers
    this.addProvider(mockProviders.anthropic);
    this.addProvider(mockProviders.openai);
    this.addProvider(mockProviders.groq);
  }

  addProvider(provider: MockProvider): void {
    this.providers.set(provider.name, {
      provider,
      healthy: true,
      load: 0,
    });
    this.circuitBreakers.set(provider.name, new MockCircuitBreaker());
  }

  removeProvider(name: string): void {
    this.providers.delete(name);
    this.circuitBreakers.delete(name);
  }

  markUnhealthy(name: string): void {
    const entry = this.providers.get(name);
    if (entry) {
      entry.healthy = false;
    }
  }

  markHealthy(name: string): void {
    const entry = this.providers.get(name);
    if (entry) {
      entry.healthy = true;
    }
    const breaker = this.circuitBreakers.get(name);
    if (breaker) {
      breaker.reset();
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Select provider with lowest load among healthy ones
    const healthyProviders = Array.from(this.providers.entries())
      .filter(([, entry]) => entry.healthy)
      .sort(([, a], [, b]) => a.load - b.load);

    if (healthyProviders.length === 0) {
      throw new Error('No healthy providers available');
    }

    const firstProvider = healthyProviders[0];
    if (!firstProvider) {
      throw new Error('Invalid provider state');
    }
    const [name, entry] = firstProvider;
    if (!name || !entry) {
      throw new Error('Invalid provider state');
    }
    const breaker = this.circuitBreakers.get(name);
    if (!breaker) {
      throw new Error('Circuit breaker not found');
    }

    // Increment load
    entry.load++;

    try {
      const result = await breaker.execute(async () => entry.provider.chat(request));
      return result as ChatResponse;
    } finally {
      // Decrement load
      entry.load--;
    }
  }

  getProviderStatus(): Map<string, { healthy: boolean; load: number; state: CircuitState }> {
    const status = new Map();

    for (const [name, entry] of this.providers) {
      const breaker = this.circuitBreakers.get(name);
      status.set(name, {
        healthy: entry.healthy,
        load: entry.load,
        state: breaker?.getState() || CircuitState.CLOSED,
      });
    }

    return status;
  }

  reset(): void {
    for (const [name, entry] of this.providers) {
      entry.healthy = true;
      entry.load = 0;
      const breaker = this.circuitBreakers.get(name);
      if (breaker) {
        breaker.reset();
      }
    }
  }
}

/**
 * Create provider with custom behavior
 */
export function createCustomProvider(config: {
  name: string;
  latency?: number;
  shouldFail?: boolean;
  errorRate?: number;
}): MockProvider {
  return {
    name: config.name,
    latency: config.latency || 100,
    shouldFail: config.shouldFail || false,
    errorRate: config.errorRate || 0,

    async chat(request: ChatRequest): Promise<ChatResponse> {
      if (config.shouldFail || (config.errorRate && Math.random() < config.errorRate)) {
        throw new Error(`${config.name} provider error`);
      }

      await new Promise(resolve => setTimeout(resolve, config.latency || 100));

      const lastMessage = request.messages[request.messages.length - 1];
      return {
        id: `${config.name}-${crypto.randomUUID()}`,
        content: `[${config.name}] Response to: ${lastMessage?.content ?? ''}`,
        model: request.model || 'custom-model',
        provider: config.name as any,
        finishReason: 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        timestamp: Date.now(),
      };
    },
  };
}
