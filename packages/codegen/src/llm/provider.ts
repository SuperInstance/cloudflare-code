/**
 * LLM Provider Interface and Base Implementation
 * Supports multiple LLM providers (Anthropic, OpenAI, etc.)
 */

import {
  Message,
  CompletionOptions,
  CompletionResult,
  StreamOptions,
  StreamChunk
} from './types.js';

/**
 * Abstract base class for LLM providers
 */
export abstract class LLMProvider {
  protected apiKey: string;
  protected baseURL?: string;
  protected model: string;
  protected maxRetries: number;
  protected timeout: number;

  constructor(config: LLMProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
    this.model = config.model;
    this.maxRetries = config.maxRetries ?? 3;
    this.timeout = config.timeout ?? 60000;
  }

  /**
   * Generate a completion from the LLM
   */
  abstract complete(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult>;

  /**
   * Generate a streaming completion
   */
  abstract stream(
    messages: Message[],
    options?: StreamOptions
  ): AsyncIterable<StreamChunk>;

  /**
   * Count tokens in a message
   */
  abstract countTokens(text: string): number;

  /**
   * Validate API key
   */
  abstract validateKey(): Promise<boolean>;

  /**
   * Get model information
   */
  abstract getModelInfo(): ModelInfo;

  /**
   * Execute with retry logic
   */
  protected async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.maxRetries
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (this.isNonRetriableError(error)) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is non-retriable
   */
  protected isNonRetriableError(error: unknown): boolean {
    const err = error as { statusCode?: number; code?: string };
    return (
      err.statusCode === 401 ||
      err.statusCode === 403 ||
      err.statusCode === 404 ||
      err.code === 'invalid_api_key' ||
      err.code === 'insufficient_quota'
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create timeout promise
   */
  protected createTimeoutPromise<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), ms);
    });
  }
}

/**
 * LLM Provider Configuration
 */
export interface LLMProviderConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Model information
 */
export interface ModelInfo {
  name: string;
  provider: string;
  maxTokens: number;
  contextWindow: number;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
}

/**
 * LLM Message
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];
}

/**
 * Message content (for multimodal models)
 */
export interface MessageContent {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'url' | 'base64';
    value: string;
  };
}

/**
 * Completion options
 */
export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  stream?: boolean;
  functions?: FunctionDefinition[];
  functionCall?: 'auto' | 'none' | { name: string };
}

/**
 * Completion result
 */
export interface CompletionResult {
  text: string;
  finishReason: 'stop' | 'length' | 'content_filter';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  functionCall?: {
    name: string;
    arguments: string;
  };
}

/**
 * Stream options
 */
export interface StreamOptions extends CompletionOptions {
  onChunk?: (chunk: StreamChunk) => void;
}

/**
 * Stream chunk
 */
export interface StreamChunk {
  text: string;
  finishReason?: 'stop' | 'length' | 'content_filter';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Function definition for function calling
 */
export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
}
