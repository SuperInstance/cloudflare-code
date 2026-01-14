/**
 * OpenAI LLM Provider Implementation
 */

import OpenAI from 'openai';
import {
  LLMProvider,
  LLMProviderConfig,
  Message,
  CompletionOptions,
  CompletionResult,
  StreamOptions,
  StreamChunk,
  ModelInfo
} from './provider.js';

/**
 * OpenAI-specific configuration
 */
export interface OpenAIConfig extends LLMProviderConfig {
  organization?: string;
  baseURL?: string;
}

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider extends LLMProvider {
  private client: OpenAI;

  constructor(config: OpenAIConfig) {
    super(config);

    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      baseURL: config.baseURL,
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 60000
    });
  }

  /**
   * Generate a completion
   */
  async complete(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    return this.retryWithBackoff(async () => {
      const openaiMessages = this.convertMessages(messages);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: openaiMessages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
        top_p: options?.topP,
        stop: options?.stopSequences,
        functions: options?.functions as any,
        function_call: options?.functionCall as any,
        stream: false
      });

      const choice = response.choices[0];
      const text = choice.message.content ?? '';
      const functionCall = choice.message.function_call;

      return {
        text,
        finishReason: choice.finish_reason as 'stop' | 'length',
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        },
        model: response.model,
        functionCall: functionCall
          ? {
              name: functionCall.name,
              arguments: functionCall.arguments
            }
          : undefined
      };
    });
  }

  /**
   * Generate a streaming completion
   */
  async *stream(
    messages: Message[],
    options?: StreamOptions
  ): AsyncIterable<StreamChunk> {
    const openaiMessages = this.convertMessages(messages);

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      top_p: options?.topP,
      stop: options?.stopSequences,
      functions: options?.functions as any,
      function_call: options?.functionCall as any,
      stream: true
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const finishReason = chunk.choices[0]?.finish_reason;

      if (delta?.content) {
        const chunkData: StreamChunk = {
          text: delta.content
        };
        yield chunkData;

        if (options?.onChunk) {
          options.onChunk(chunkData);
        }
      }

      if (finishReason) {
        yield {
          text: '',
          finishReason: finishReason as 'stop' | 'length'
        };
      }

      if (chunk.usage) {
        yield {
          text: '',
          usage: {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens
          }
        };
      }
    }
  }

  /**
   * Count tokens (using tiktoken approximation)
   */
  countTokens(text: string): number {
    // Rough approximation for OpenAI models
    // In production, you'd use tiktoken library
    return Math.ceil(text.length / 4);
  }

  /**
   * Validate API key
   */
  async validateKey(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get model information
   */
  getModelInfo(): ModelInfo {
    const models: Record<string, ModelInfo> = {
      'gpt-4-turbo-preview': {
        name: 'GPT-4 Turbo',
        provider: 'openai',
        maxTokens: 4096,
        contextWindow: 128000,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: true,
        costPer1kInputTokens: 0.01,
        costPer1kOutputTokens: 0.03
      },
      'gpt-4': {
        name: 'GPT-4',
        provider: 'openai',
        maxTokens: 4096,
        contextWindow: 8192,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: false,
        costPer1kInputTokens: 0.03,
        costPer1kOutputTokens: 0.06
      },
      'gpt-4-32k': {
        name: 'GPT-4 32K',
        provider: 'openai',
        maxTokens: 4096,
        contextWindow: 32768,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: false,
        costPer1kInputTokens: 0.06,
        costPer1kOutputTokens: 0.12
      },
      'gpt-3.5-turbo': {
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        maxTokens: 4096,
        contextWindow: 16385,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: false,
        costPer1kInputTokens: 0.0005,
        costPer1kOutputTokens: 0.0015
      },
      'gpt-3.5-turbo-16k': {
        name: 'GPT-3.5 Turbo 16K',
        provider: 'openai',
        maxTokens: 4096,
        contextWindow: 16385,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: false,
        costPer1kInputTokens: 0.001,
        costPer1kOutputTokens: 0.002
      }
    };

    return (
      models[this.model] ?? {
        name: this.model,
        provider: 'openai',
        maxTokens: 4096,
        contextWindow: 4096,
        supportsStreaming: true,
        supportsFunctionCalling: false,
        supportsVision: false,
        costPer1kInputTokens: 0.001,
        costPer1kOutputTokens: 0.002
      }
    );
  }

  /**
   * Convert messages to OpenAI format
   */
  private convertMessages(
    messages: Message[]
  ): Array<OpenAI.Chat.ChatCompletionMessageParam> {
    return messages.map(m => {
      if (m.role === 'system') {
        return { role: 'system', content: this.extractText(m.content) };
      } else if (m.role === 'user') {
        return { role: 'user', content: this.extractText(m.content) };
      } else {
        return { role: 'assistant', content: this.extractText(m.content) };
      }
    });
  }

  /**
   * Extract text from message content
   */
  private extractText(
    content: string | { type: string; text?: string }[]
  ): string {
    if (typeof content === 'string') {
      return content;
    }

    return content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }
}
