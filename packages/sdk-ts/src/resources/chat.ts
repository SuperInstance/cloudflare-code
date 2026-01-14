/**
 * Chat Completions API
 */

import type {
  ChatCompletionParams,
  ChatCompletionResponse,
  ChatCompletionStreamEvent,
} from '../types/index.js';
import type { ClaudeFlareClient } from '../client.js';
import {
  processStream,
  accumulateStream,
  createSSEStream,
} from '../utils/streaming.js';
import { errorFromResponse } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Chat Completions Resource
 */
export class ChatCompletions {
  constructor(private client: ClaudeFlareClient) {}

  /**
   * Create a chat completion
   */
  async create(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    const url = this.buildUrl(params.stream || false);
    const requestOptions = this.buildRequestOptions(params);

    logger.debug('Creating chat completion', { params, url });

    const startTime = Date.now();

    try {
      const response = await this.client.request('POST', url, requestOptions);

      const duration = Date.now() - startTime;
      logger.logResponse(response.status, duration);

      // Handle streaming response
      if (params.stream && response.body) {
        const result = await accumulateStream(response);
        return {
          id: this.generateId(),
          content: result.content,
          model: params.model || 'claude-3-5-sonnet-20241022',
          provider: params.provider || 'anthropic',
          finishReason: (result.finishReason as any) || 'stop',
          usage: result.usage || {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
          timestamp: Date.now(),
        };
      }

      // Handle non-streaming response
      const data = await response.json();

      if (!response.ok) {
        throw errorFromResponse(response.status, data, this.client.getRequestId(response));
      }

      return data;
    } catch (error) {
      logger.error('Chat completion failed', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Create a streaming chat completion (callback-based)
   */
  async createStream(
    params: ChatCompletionParams,
    onEvent: (event: ChatCompletionStreamEvent) => void
  ): Promise<void> {
    const streamParams = { ...params, stream: true };
    const url = this.buildUrl(true);
    const requestOptions = this.buildRequestOptions(streamParams);

    logger.debug('Creating streaming chat completion', { params: streamParams, url });

    const startTime = Date.now();

    try {
      const response = await this.client.request('POST', url, requestOptions);

      if (!response.ok) {
        const data = await response.json();
        throw errorFromResponse(response.status, data, this.client.getRequestId(response));
      }

      const duration = Date.now() - startTime;
      logger.logResponse(response.status, duration);

      await processStream(response, {
        onEvent,
        onError: (error) => {
          logger.error('Stream error', { error });
          throw error;
        },
        onComplete: () => {
          logger.debug('Stream completed');
        },
      });
    } catch (error) {
      logger.error('Streaming chat completion failed', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Create a streaming chat completion (returns ReadableStream)
   */
  stream(params: ChatCompletionParams): ReadableStream<ChatCompletionStreamEvent> {
    let streamController: ReadableStreamDefaultController<ChatCompletionStreamEvent> | null = null;

    const stream = new ReadableStream<ChatCompletionStreamEvent>({
      async start(controller) {
        streamController = controller;

        const streamParams = { ...params, stream: true };
        const url = this.buildUrl(true);
        const requestOptions = this.buildRequestOptions(streamParams);

        logger.debug('Creating readable stream', { params: streamParams, url });

        try {
          const response = await this.client.request('POST', url, requestOptions);

          if (!response.ok) {
            const data = await response.json();
            throw errorFromResponse(response.status, data, this.client.getRequestId(response));
          }

          const sseStream = createSSEStream(response);

          const reader = sseStream.getReader();

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.close();
              break;
            }

            controller.enqueue(value);
          }
        } catch (error) {
          logger.error('Readable stream error', { error });
          controller.error(error);
        }
      },

      cancel() {
        logger.debug('Stream cancelled');
      },
    });

    return stream;
  }

  /**
   * Build URL for chat completion
   */
  private buildUrl(stream: boolean): string {
    const endpoint = stream ? 'chat/stream' : 'chat';
    return `/${this.client.config.apiVersion}/${endpoint}`;
  }

  /**
   * Build request options
   */
  private buildRequestOptions(params: ChatCompletionParams): RequestInit {
    return {
      body: JSON.stringify({
        messages: params.messages,
        model: params.model,
        provider: params.provider,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: params.stream,
        stop_sequences: params.stopSequences,
        top_k: params.topK,
        top_p: params.topP,
        session_id: params.sessionId,
        metadata: params.metadata,
        tools: params.tools,
        tool_choice: params.toolChoice,
      }),
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Chat API namespace
 */
export class Chat {
  constructor(public completions: ChatCompletions) {}
}
