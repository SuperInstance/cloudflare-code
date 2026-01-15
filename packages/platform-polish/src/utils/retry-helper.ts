import { sleep } from './helpers';

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
  retryableErrors?: string[];
}

export class RetryHelper {
  static async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    let lastError: Error;
    let delay = options.delayMs;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (options.retryableErrors &&
            !options.retryableErrors.includes(error.name)) {
          throw error;
        }

        if (attempt === options.maxAttempts) {
          break;
        }

        await sleep(delay);
        delay = Math.min(delay * options.backoffMultiplier, options.maxDelayMs);
      }
    }

    throw lastError!;
  }

  static withDefaults(options: Partial<RetryOptions> = {}): RetryOptions {
    return {
      maxAttempts: 3,
      delayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 30000,
      retryableErrors: [
        'TimeoutError',
        'NetworkError',
        'ServiceUnavailableError',
        'InternalServerError'
      ],
      ...options
    };
  }
}