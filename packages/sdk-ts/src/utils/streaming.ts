/**
 * Streaming utilities for Server-Sent Events (SSE)
 */

import type { ChatCompletionStreamEvent } from '../types/index.js';

export interface StreamOptions {
  onEvent: (event: ChatCompletionStreamEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

/**
 * Parse SSE stream from fetch response
 */
export async function* streamSSEResponse(
  response: Response
): AsyncGenerator<ChatCompletionStreamEvent> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Emit final event
        yield {
          type: 'done',
          done: true,
        };
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || !trimmed.startsWith('data: ')) {
          continue;
        }

        const data = trimmed.slice(6);

        // Check for [DONE] sentinel
        if (data === '[DONE]') {
          yield {
            type: 'done',
            done: true,
          };
          return;
        }

        try {
          const parsed = JSON.parse(data);

          // Convert SSE format to stream event
          if (parsed.content) {
            yield {
              type: 'content',
              content: parsed.content,
            };
          }

          if (parsed.usage) {
            yield {
              type: 'content',
              usage: parsed.usage,
              finishReason: parsed.finish_reason,
            };
          }

          if (parsed.error) {
            yield {
              type: 'error',
              error: parsed.error,
            };
          }
        } catch (e) {
          // Invalid JSON, skip
          console.debug('Failed to parse SSE data:', data);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Process SSE stream with callbacks
 */
export async function processStream(
  response: Response,
  options: StreamOptions
): Promise<void> {
  try {
    for await (const event of streamSSEResponse(response)) {
      options.onEvent(event);

      if (event.type === 'done') {
        options.onComplete?.();
        break;
      }

      if (event.type === 'error' && event.error) {
        options.onError?.(event.error as Error);
        break;
      }
    }
  } catch (error) {
    options.onError?.(error as Error);
  }
}

/**
 * Create a readable stream from SSE generator
 */
export function createSSEStream(
  response: Response
): ReadableStream<ChatCompletionStreamEvent> {
  const generator = streamSSEResponse(response);

  return new ReadableStream<ChatCompletionStreamEvent>({
    async pull(controller) {
      try {
        const { done, value } = await generator.next();

        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      }
    },

    async cancel() {
      // Generator will be garbage collected
    },
  });
}

/**
 * Accumulate stream events into a single response
 */
export async function accumulateStream(
  response: Response
): Promise<{ content: string; usage?: any; finishReason?: string }> {
  let content = '';
  let usage: any;
  let finishReason: string | undefined;

  for await (const event of streamSSEResponse(response)) {
    if (event.type === 'content') {
      if (event.content) content += event.content;
      if (event.usage) usage = event.usage;
      if (event.finishReason) finishReason = event.finishReason;
    }

    if (event.type === 'error' && event.error) {
      throw event.error;
    }

    if (event.type === 'done') {
      break;
    }
  }

  return { content, usage, finishReason };
}

/**
 * Transform stream events
 */
export function transformStream<T>(
  response: Response,
  transformer: (event: ChatCompletionStreamEvent) => T
): ReadableStream<T> {
  const generator = streamSSEResponse(response);

  return new ReadableStream<T>({
    async pull(controller) {
      try {
        const { done, value } = await generator.next();

        if (done) {
          controller.close();
        } else {
          const transformed = transformer(value);
          controller.enqueue(transformed);
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Filter stream events
 */
export function filterStream(
  response: Response,
  predicate: (event: ChatCompletionStreamEvent) => boolean
): ReadableStream<ChatCompletionStreamEvent> {
  const generator = streamSSEResponse(response);

  return new ReadableStream<ChatCompletionStreamEvent>({
    async pull(controller) {
      try {
        let found = false;

        while (!found) {
          const { done, value } = await generator.next();

          if (done) {
            controller.close();
            return;
          }

          if (predicate(value)) {
            controller.enqueue(value);
            found = true;
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Batch stream events
 */
export async function* batchStream(
  response: Response,
  batchSize: number,
  batchDuration: number = 100
): AsyncGenerator<ChatCompletionStreamEvent[]> {
  const generator = streamSSEResponse(response);
  const batch: ChatCompletionStreamEvent[] = [];
  let batchStartTime = Date.now();

  for await (const event of generator) {
    batch.push(event);

    const shouldFlush =
      batch.length >= batchSize ||
      (batch.length > 0 && Date.now() - batchStartTime >= batchDuration);

    if (shouldFlush) {
      yield [...batch];
      batch.length = 0;
      batchStartTime = Date.now();
    }

    if (event.type === 'done') {
      break;
    }
  }

  // Flush remaining events
  if (batch.length > 0) {
    yield batch;
  }
}
