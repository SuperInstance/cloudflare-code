/**
 * Anthropic Claude LLM Provider Implementation
 */

import Anthropic from '@anthropic-ai/sdk';
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
 * Anthropic-specific configuration
 */
export interface AnthropicConfig extends LLMProviderConfig {
  baseURL?: string;
  apiVersion?: string;
  dangerousAllowBrowser?: boolean;
}

/**
 * Anthropic Claude provider implementation
 */
export class AnthropicProvider extends LLMProvider {
  private client: Anthropic;

  constructor(config: AnthropicConfig) {
    super(config);

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 60000,
      dangerouslyAllowBrowser: config.dangerousAllowBrowser ?? false
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
      const systemMessage = this.extractSystemMessage(messages);
      const chatMessages = this.filterChatMessages(messages);

      const response = await this.client.messages.create({
        model: this.model,
        messages: chatMessages,
        system: systemMessage,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
        top_p: options?.topP,
        top_k: options?.topK,
        stop_sequences: options?.stopSequences,
        stream: false
      });

      const text = this.extractTextFromResponse(response);

      return {
        text,
        finishReason: response.stop_reason as 'stop' | 'length',
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        },
        model: response.model
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
    const systemMessage = this.extractSystemMessage(messages);
    const chatMessages = this.filterChatMessages(messages);

    const stream = await this.client.messages.create({
      model: this.model,
      messages: chatMessages,
      system: systemMessage,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      top_p: options?.topP,
      top_k: options?.topK,
      stop_sequences: options?.stopSequences,
      stream: true
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        yield {
          text: chunk.delta.text,
          finishReason: undefined
        };
      } else if (chunk.type === 'message_stop') {
        yield {
          text: '',
          finishReason: chunk.stop_reason as 'stop' | 'length'
        };
      } else if (chunk.type === 'message_delta') {
        yield {
          text: '',
          usage: {
            promptTokens: chunk.usage.input_tokens,
            completionTokens: chunk.usage.output_tokens,
            totalTokens:
              chunk.usage.input_tokens + chunk.usage.output_tokens
          }
        };
      }

      if (options?.onChunk) {
        options.onChunk({
          text: chunk.type === 'content_block_delta' ? chunk.delta.text : '',
          finishReason: undefined
        });
      }
    }
  }

  /**
   * Count tokens (approximate)
   */
  countTokens(text: string): number {
    // Anthropic uses a different tokenizer, but we can approximate
    // Roughly 4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Validate API key
   */
  async validateKey(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10
      });
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
      'claude-3-opus-20240229': {
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        maxTokens: 4096,
        contextWindow: 200000,
        supportsStreaming: true,
        supportsFunctionCalling: false,
        supportsVision: true,
        costPer1kInputTokens: 0.015,
        costPer1kOutputTokens: 0.075
      },
      'claude-3-sonnet-20240229': {
        name: 'Claude 3 Sonnet',
        provider: 'anthropic',
        maxTokens: 4096,
        contextWindow: 200000,
        supportsStreaming: true,
        supportsFunctionCalling: false,
        supportsVision: true,
        costPer1kInputTokens: 0.003,
        costPer1kOutputTokens: 0.015
      },
      'claude-3-haiku-20240307': {
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        maxTokens: 4096,
        contextWindow: 200000,
        supportsStreaming: true,
        supportsFunctionCalling: false,
        supportsVision: true,
        costPer1kInputTokens: 0.00025,
        costPer1kOutputTokens: 0.00125
      },
      'claude-2.1': {
        name: 'Claude 2.1',
        provider: 'anthropic',
        maxTokens: 4096,
        contextWindow: 200000,
        supportsStreaming: true,
        supportsFunctionCalling: false,
        supportsVision: false,
        costPer1kInputTokens: 0.008,
        costPer1kOutputTokens: 0.024
      },
      'claude-2.0': {
        name: 'Claude 2.0',
        provider: 'anthropic',
        maxTokens: 4096,
        contextWindow: 100000,
        supportsStreaming: true,
        supportsFunctionCalling: false,
        supportsVision: false,
        costPer1kInputTokens: 0.008,
        costPer1kOutputTokens: 0.024
      }
    };

    return (
      models[this.model] ?? {
        name: this.model,
        provider: 'anthropic',
        maxTokens: 4096,
        contextWindow: 200000,
        supportsStreaming: true,
        supportsFunctionCalling: false,
        supportsVision: false,
        costPer1kInputTokens: 0.003,
        costPer1kOutputTokens: 0.015
      }
    );
  }

  /**
   * Extract system message from messages array
   */
  private extractSystemMessage(messages: Message[]): string | undefined {
    const systemMsg = messages.find(m => m.role === 'system');
    if (!systemMsg) return undefined;

    if (typeof systemMsg.content === 'string') {
      return systemMsg.content;
    }

    // Extract text from content array
    const textParts = systemMsg.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
    return textParts || undefined;
  }

  /**
   * Filter out system messages and convert to Anthropic format
   */
  private filterChatMessages(messages: Message[]): Array<{
    role: 'user' | 'assistant';
    content: string;
  }> {
    return messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: this.extractTextContent(m.content)
      }));
  }

  /**
   * Extract text from message content
   */
  private extractTextContent(
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

  /**
   * Extract text from Anthropic response
   */
  private extractTextFromResponse(response: Anthropic.Messages.Message): string {
    if (response.content[0]?.type === 'text') {
      return response.content[0].text;
    }
    return '';
  }
}
