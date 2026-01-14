/**
 * Error utility functions
 */

import { ErrorInfo } from '../types';

/**
 * Extract error information from an error
 */
export function extractErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
      type: 'string',
    };
  }

  if (typeof error === 'object' && error !== null) {
    return {
      name: (error as any).name || 'Error',
      message: (error as any).message || String(error),
      type: (error as any).type || 'object',
    };
  }

  return {
    name: 'Error',
    message: String(error),
    type: typeof error,
  };
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: Error): boolean {
  return (
    error.name === 'NetworkError' ||
    error.name === 'TypeError' ||
    error.message.includes('network') ||
    error.message.includes('fetch')
  );
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: Error): boolean {
  return (
    error.name === 'TimeoutError' ||
    error.message.includes('timeout') ||
    error.message.includes('timed out')
  );
}

/**
 * Check if an error is an abort error
 */
export function isAbortError(error: Error): boolean {
  return (
    error.name === 'AbortError' ||
    error.message.includes('aborted')
  );
}

/**
 * Create an error from error info
 */
export function createErrorFromInfo(info: ErrorInfo): Error {
  const error = new Error(info.message);
  error.name = info.name;
  if (info.stack) {
    error.stack = info.stack;
  }
  return error;
}

/**
 * Serialize error for transport
 */
export function serializeError(error: Error): string {
  return JSON.stringify(extractErrorInfo(error));
}

/**
 * Deserialize error from info
 */
export function deserializeError(data: string): Error {
  const info = JSON.parse(data) as ErrorInfo;
  return createErrorFromInfo(info);
}

/**
 * Get error stack trace
 */
export function getStackTrace(): string {
  const error = new Error();
  return error.stack || '';
}

/**
 * Parse stack trace
 */
export function parseStackTrace(stack: string): Array<{
  functionName: string;
  fileName: string;
  lineNumber: number;
  columnNumber: number;
}> {
  const lines = stack.split('\n');
  const frames: Array<{
    functionName: string;
    fileName: string;
    lineNumber: number;
    columnNumber: number;
  }> = [];

  for (const line of lines) {
    const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
    if (match) {
      const [, functionName, fileName, lineNumber, columnNumber] = match;
      frames.push({
        functionName,
        fileName,
        lineNumber: parseInt(lineNumber, 10),
        columnNumber: parseInt(columnNumber, 10),
      });
    }
  }

  return frames;
}

/**
 * Wrap a function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  onError?: (error: Error) => void
): T {
  return ((...args: any[]) => {
    try {
      const result = fn(...args);

      // Handle promises
      if (result && typeof result.catch === 'function') {
        return result.catch((error: Error) => {
          if (onError) {
            onError(error);
          }
          throw error;
        });
      }

      return result;
    } catch (error) {
      if (onError) {
        onError(error as Error);
      }
      throw error;
    }
  }) as T;
}

/**
 * Retry a function on failure
 */
export async function retryOnError<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: Error | null = null;
  let delay = delayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= backoffMultiplier;
    }
  }

  throw lastError!;
}
