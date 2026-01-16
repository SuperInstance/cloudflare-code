/**
 * LLM Integration Layer
 * Provides unified interface for multiple LLM providers
 */

import {
  LLMProvider,
  Message,
  CompletionOptions,
  CompletionResult,
  StreamOptions,
  StreamChunk,
  ModelInfo,
  LLMProviderConfig
} from './provider.js';
import type { AnthropicProvider, AnthropicConfig } from './anthropic-provider.js';
import type { OpenAIProvider, OpenAIConfig } from './openai-provider.js';

/**
 * Supported LLM providers
 */
export enum LLMProviderType {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  AZURE_OPENAI = 'azure-openai',
  COHERE = 'cohere',
  HUGGINGFACE = 'huggingface',
  CUSTOM = 'custom'
}

/**
 * LLM Manager configuration
 */
export interface LLMManagerConfig {
  defaultProvider: LLMProviderType;
  providers: Record<LLMProviderType, LLMProviderConfig>;
  fallbackProviders?: LLMProviderType[];
  maxRetries?: number;
  timeout?: number;
}

/**
 * LLM Manager - unified interface for multiple providers
 */
export class LLMManager {
  private providers: Map<LLMProviderType, LLMProvider>;
  private defaultProvider: LLMProviderType;
  private fallbackProviders: LLMProviderType[];

  constructor(config: LLMManagerConfig) {
    this.providers = new Map();
    this.defaultProvider = config.defaultProvider;
    this.fallbackProviders = config.fallbackProviders ?? [];

    // Initialize providers
    for (const [type, providerConfig] of Object.entries(config.providers)) {
      const provider = this.createProvider(
        type as LLMProviderType,
        providerConfig
      );
      this.providers.set(type as LLMProviderType, provider);
    }
  }

  /**
   * Generate a completion
   */
  async complete(
    messages: Message[],
    options?: CompletionOptions & { provider?: LLMProviderType }
  ): Promise<CompletionResult> {
    const providerType = options?.provider ?? this.defaultProvider;
    const provider = this.getProvider(providerType);

    try {
      return await provider.complete(messages, options);
    } catch (error) {
      // Try fallback providers
      for (const fallbackType of this.fallbackProviders) {
        if (fallbackType === providerType) continue;

        try {
          const fallbackProvider = this.getProvider(fallbackType);
          return await fallbackProvider.complete(messages, options);
        } catch {
          continue;
        }
      }
      throw error;
    }
  }

  /**
   * Generate a streaming completion
   */
  async *stream(
    messages: Message[],
    options?: StreamOptions & { provider?: LLMProviderType }
  ): AsyncIterable<StreamChunk> {
    const providerType = options?.provider ?? this.defaultProvider;
    const provider = this.getProvider(providerType);

    try {
      yield* provider.stream(messages, options);
    } catch (error) {
      // Try fallback providers
      for (const fallbackType of this.fallbackProviders) {
        if (fallbackType === providerType) continue;

        try {
          const fallbackProvider = this.getProvider(fallbackType);
          yield* fallbackProvider.stream(messages, options);
          return;
        } catch {
          continue;
        }
      }
      throw error;
    }
  }

  /**
   * Count tokens
   */
  countTokens(text: string, provider?: LLMProviderType): number {
    const providerInstance = this.getProvider(
      provider ?? this.defaultProvider
    );
    return providerInstance.countTokens(text);
  }

  /**
   * Validate API key
   */
  async validateKey(provider?: LLMProviderType): Promise<boolean> {
    const providerInstance = this.getProvider(
      provider ?? this.defaultProvider
    );
    return providerInstance.validateKey();
  }

  /**
   * Get model information
   */
  getModelInfo(provider?: LLMProviderType): ModelInfo {
    const providerInstance = this.getProvider(
      provider ?? this.defaultProvider
    );
    return providerInstance.getModelInfo();
  }

  /**
   * Get provider instance
   */
  private getProvider(type: LLMProviderType): LLMProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Provider ${type} not found`);
    }
    return provider;
  }

  /**
   * Create provider instance
   */
  private createProvider(
    type: LLMProviderType,
    config: LLMProviderConfig
  ): LLMProvider {
    switch (type) {
      case LLMProviderType.ANTHROPIC:
        return new AnthropicProvider(config as AnthropicConfig);

      case LLMProviderType.OPENAI:
        return new OpenAIProvider(config as OpenAIConfig);

      case LLMProviderType.AZURE_OPENAI:
        return new OpenAIProvider(config as OpenAIConfig);

      case LLMProviderType.COHERE:
        throw new Error('Cohere provider not yet implemented');

      case LLMProviderType.HUGGINGFACE:
        throw new Error('HuggingFace provider not yet implemented');

      case LLMProviderType.CUSTOM:
        throw new Error('Custom provider not yet implemented');

      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  /**
   * List available providers
   */
  listProviders(): LLMProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if provider is available
   */
  hasProvider(type: LLMProviderType): boolean {
    return this.providers.has(type);
  }

  /**
   * Add a new provider
   */
  addProvider(type: LLMProviderType, config: LLMProviderConfig): void {
    const provider = this.createProvider(type, config);
    this.providers.set(type, provider);
  }

  /**
   * Remove a provider
   */
  removeProvider(type: LLMProviderType): void {
    this.providers.delete(type);
  }

  /**
   * Set default provider
   */
  setDefaultProvider(type: LLMProviderType): void {
    if (!this.providers.has(type)) {
      throw new Error(`Provider ${type} not found`);
    }
    this.defaultProvider = type;
  }

  /**
   * Set fallback providers
   */
  setFallbackProviders(types: LLMProviderType[]): void {
    this.fallbackProviders = types;
  }

  /**
   * Get default provider
   */
  getDefaultProvider(): LLMProviderType {
    return this.defaultProvider;
  }

  /**
   * Get fallback providers
   */
  getFallbackProviders(): LLMProviderType[] {
    return [...this.fallbackProviders];
  }
}

/**
 * Create default LLM manager from environment variables
 */
export function createLLMManager(): LLMManager {
  const config: LLMManagerConfig = {
    defaultProvider: LLMProviderType.ANTHROPIC,
    providers: {},
    fallbackProviders: [LLMProviderType.OPENAI]
  };

  // Configure Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    config.providers[LLMProviderType.ANTHROPIC] = {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229'
    };
    config.defaultProvider = LLMProviderType.ANTHROPIC;
  }

  // Configure OpenAI
  if (process.env.OPENAI_API_KEY) {
    config.providers[LLMProviderType.OPENAI] = {
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORGANIZATION,
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
    };

    // Set as default if Anthropic not configured
    if (!config.providers[LLMProviderType.ANTHROPIC]) {
      config.defaultProvider = LLMProviderType.OPENAI;
    }
  }

  // Configure Azure OpenAI
  if (process.env.AZURE_OPENAI_API_KEY) {
    config.providers[LLMProviderType.AZURE_OPENAI] = {
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      baseURL: process.env.AZURE_OPENAI_BASE_URL,
      model: process.env.AZURE_OPENAI_MODEL || 'gpt-4'
    };
  }

  if (Object.keys(config.providers).length === 0) {
    throw new Error(
      'No LLM provider configured. Please set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable.'
    );
  }

  return new LLMManager(config);
}

// Re-export types and providers
export * from './provider.js';
export * from './anthropic-provider.js';
export * from './openai-provider.js';
