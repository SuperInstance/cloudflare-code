/**
 * Utility functions for the fine-tuning system
 */

import type { Hyperparameters, TrainingJob, Dataset, ModelMetrics } from '../types';

// ============================================================================
// Math Utilities
// ============================================================================

export class MathUtils {
  /**
   * Calculate mean of array
   */
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate median of array
   */
  static median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate standard deviation
   */
  static stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  /**
   * Calculate percentile
   */
  static percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Clamp value between min and max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Linear interpolation
   */
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Map value from one range to another
   */
  static map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  }

  /**
   * Exponential moving average
   */
  static ema(values: number[], alpha: number = 0.5): number[] {
    if (values.length === 0) return [];
    const result: number[] = [values[0]];
    for (let i = 1; i < values.length; i++) {
      result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
    }
    return result;
  }
}

// ============================================================================
// Time Utilities
// ============================================================================

export class TimeUtils {
  /**
   * Format duration in milliseconds to human readable string
   */
  static formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Format timestamp to ISO string
   */
  static formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  /**
   * Parse duration string to milliseconds
   */
  static parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([dhms])$/);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'm': return value * 60 * 1000;
      case 's': return value * 1000;
      default: return 0;
    }
  }

  /**
   * Get time ago string
   */
  static timeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 1000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }
}

// ============================================================================
// Token Utilities
// ============================================================================

export class TokenUtils {
  /**
   * Estimate token count (rough approximation)
   */
  static estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate token count for messages
   */
  static estimateMessageTokens(messages: Array<{ role: string; content: string }>): number {
    let total = 0;
    for (const message of messages) {
      // Add tokens for role and content
      total += this.estimateTokens(message.role);
      total += this.estimateTokens(message.content);
      // Add overhead for formatting
      total += 4;
    }
    return total;
  }

  /**
   * Truncate text to max tokens
   */
  static truncateToTokens(text: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= maxTokens) return text;

    const ratio = maxTokens / estimatedTokens;
    const maxLength = Math.floor(text.length * ratio);
    return text.substring(0, maxLength);
  }

  /**
   * Count tokens by splitting on whitespace and punctuation
   */
  static countTokens(text: string): number {
    // Split on whitespace and punctuation
    const tokens = text.split(/[\s\s]+/).filter(t => t.length > 0);
    return tokens.length;
  }
}

// ============================================================================
// Validation Utilities
// ============================================================================

export class ValidationUtils {
  /**
   * Validate email address
   */
  static isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * Validate URL
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate UUID
   */
  static isValidUuid(uuid: string): boolean {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
  }

  /**
   * Validate API key format
   */
  static isValidApiKey(key: string): boolean {
    // Basic validation: at least 20 characters, alphanumeric with some special chars
    return key.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(key);
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '')
      .substring(0, 1000);
  }
}

// ============================================================================
// Hyperparameter Utilities
// ============================================================================

export class HyperparameterUtils {
  /**
   * Validate hyperparameters
   */
  static validate(hyperparams: Hyperparameters): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (hyperparams.learningRate <= 0 || hyperparams.learningRate > 1) {
      errors.push('Learning rate must be between 0 and 1');
    }

    if (hyperparams.batchSize < 1 || hyperparams.batchSize > 1024) {
      errors.push('Batch size must be between 1 and 1024');
    }

    if (hyperparams.epochs < 1 || hyperparams.epochs > 1000) {
      errors.push('Epochs must be between 1 and 1000');
    }

    if (hyperparams.loraR !== undefined && (hyperparams.loraR < 1 || hyperparams.loraR > 256)) {
      errors.push('LoRA r must be between 1 and 256');
    }

    if (hyperparams.loraAlpha !== undefined && (hyperparams.loraAlpha < 1)) {
      errors.push('LoRA alpha must be at least 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get default hyperparameters
   */
  static getDefaults(): Hyperparameters {
    return {
      learningRate: 0.0001,
      batchSize: 32,
      epochs: 3,
      warmupSteps: 100,
      weightDecay: 0.01,
      gradientAccumulationSteps: 1,
      maxGradNorm: 1.0,
    };
  }

  /**
   * Merge hyperparameters with defaults
   */
  static mergeWithDefaults(userParams: Partial<Hyperparameters>): Hyperparameters {
    return {
      ...this.getDefaults(),
      ...userParams,
    };
  }

  /**
   * Suggest hyperparameters based on dataset size
   */
  static suggestForDataset(datasetSize: number): Hyperparameters {
    let batchSize = 32;
    let epochs = 3;
    let learningRate = 0.0001;

    if (datasetSize < 1000) {
      batchSize = 16;
      epochs = 5;
      learningRate = 0.0001;
    } else if (datasetSize < 10000) {
      batchSize = 32;
      epochs = 3;
      learningRate = 0.0001;
    } else {
      batchSize = 64;
      epochs = 2;
      learningRate = 0.00005;
    }

    return {
      learningRate,
      batchSize,
      epochs,
      warmupSteps: Math.floor(datasetSize / batchSize / 10),
      weightDecay: 0.01,
      gradientAccumulationSteps: 1,
      maxGradNorm: 1.0,
    };
  }
}

// ============================================================================
// Progress Utilities
// ============================================================================`

export class ProgressUtils {
  /**
   * Calculate progress percentage
   */
  static calculatePercentage(current: number, total: number): number {
    if (total === 0) return 0;
    return Math.min(100, Math.max(0, (current / total) * 100));
  }

  /**
   * Estimate time remaining
   */
  static estimateEta(
    current: number,
    total: number,
    elapsed: number
  ): number {
    if (current === 0) return 0;
    const rate = current / elapsed;
    const remaining = total - current;
    return remaining / rate;
  }

  /**
   * Calculate training speed (steps/second)
   */
  static calculateSpeed(steps: number, elapsed: number): number {
    if (elapsed === 0) return 0;
    return steps / (elapsed / 1000);
  }

  /**
   * Format progress bar
   */
  static formatProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    return '[' + '='.repeat(filled) + ' '.repeat(empty) + ']';
  }
}

// ============================================================================
// Metrics Utilities
// ============================================================================

export class MetricsUtils {
  /**
   * Calculate improvement percentage
   */
  static calculateImprovement(oldValue: number, newValue: number, lowerIsBetter: boolean = true): number {
    if (oldValue === 0) return 0;
    const change = ((newValue - oldValue) / oldValue) * 100;
    return lowerIsBetter ? -change : change;
  }

  /**
   * Determine if improvement is significant
   */
  static isSignificant(
    baseline: number,
    current: number,
    threshold: number = 0.05
  ): boolean {
    const change = Math.abs((current - baseline) / baseline);
    return change >= threshold;
  }

  /**
   * Smooth metrics using moving average
   */
  static smoothMetrics(
    values: number[],
    windowSize: number
  ): number[] {
    const smoothed: number[] = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = values.slice(start, i + 1);
      smoothed.push(MathUtils.mean(window));
    }
    return smoothed;
  }

  /**
   * Find best metric value
   */
  static findBest(
    values: number[],
    lowerIsBetter: boolean = true
  ): { value: number; index: number } {
    let bestIndex = 0;
    let bestValue = values[0];

    for (let i = 1; i < values.length; i++) {
      if (lowerIsBetter) {
        if (values[i] < bestValue) {
          bestValue = values[i];
          bestIndex = i;
        }
      } else {
        if (values[i] > bestValue) {
          bestValue = values[i];
          bestIndex = i;
        }
      }
    }

    return { value: bestValue, index: bestIndex };
  }

  /**
   * Calculate metrics summary
   */
  static summarize(values: number[]): {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
    p25: number;
    p75: number;
    p95: number;
    p99: number;
  } {
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      mean: MathUtils.mean(values),
      median: MathUtils.median(values),
      stdDev: MathUtils.stdDev(values),
      p25: MathUtils.percentile(values, 25),
      p75: MathUtils.percentile(values, 75),
      p95: MathUtils.percentile(values, 95),
      p99: MathUtils.percentile(values, 99),
    };
  }
}

// ============================================================================
// Error Utilities
// ============================================================================

export class ErrorUtils {
  /**
   * Create standardized error response
   */
  static createErrorResponse(
    message: string,
    code: string = 'INTERNAL_ERROR',
    details?: any
  ): { success: false; error: any } {
    return {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: any): boolean {
    const retryableCodes = [
      'RATE_LIMIT_EXCEEDED',
      'TEMPORARY_FAILURE',
      'SERVICE_UNAVAILABLE',
      'TIMEOUT',
    ];

    if (error?.code && retryableCodes.includes(error.code)) {
      return true;
    }

    // Retry on network errors
    if (error?.message?.includes('ECONNRESET')) {
      return true;
    }

    return false;
  }

  /**
   * Extract error message
   */
  static getErrorMessage(error: any): string {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    return 'An unknown error occurred';
  }

  /**
   * Wrap error with context
   */
  static wrapError(error: any, context: string): Error {
    const message = `${context}: ${this.getErrorMessage(error)}`;
    const wrapped = new Error(message);
    wrapped.stack = error?.stack || wrapped.stack;
    return wrapped;
  }
}

// ============================================================================
// Async Utilities
// ============================================================================

export class AsyncUtils {
  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry async function with exponential backoff
   */
  static async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number;
      initialDelay?: number;
      maxDelay?: number;
      backoffMultiplier?: number;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
    } = options;

    let lastError: any;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts) {
          throw error;
        }

        if (!ErrorUtils.isRetryable(error)) {
          throw error;
        }

        await this.sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }

    throw lastError;
  }

  /**
   * Execute tasks with concurrency limit
   */
  static async parallel<T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number = 5
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const task of tasks) {
      const promise = task().then(result => {
        results.push(result);
      });

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex(p => p === promise),
          1
        );
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Timeout a promise
   */
  static withTimeout<T>(
    promise: Promise<T>,
    timeout: number,
    errorMessage: string = 'Operation timed out'
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeout)
      ),
    ]);
  }
}

// ============================================================================
// String Utilities
// ============================================================================

export class StringUtils {
  /**
   * Generate random ID
   */
  static randomId(length: number = 16): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Slugify string
   */
  static slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Truncate string with ellipsis
   */
  static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Capitalize first letter
   */
  static capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Convert camelCase to snake_case
   */
  static camelToSnake(text: string): string {
    return text.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert snake_case to camelCase
   */
  static snakeToCamel(text: string): string {
    return text.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}
