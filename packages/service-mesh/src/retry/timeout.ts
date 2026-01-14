/**
 * Timeout Management
 * Handles timeout policies and execution
 */

import { ServiceError } from '../types';

export interface TimeoutConfig {
  connectionTimeout: number;
  requestTimeout: number;
  idleTimeout: number;
  streamTimeout?: number;
}

export interface TimeoutOptions {
  timeout: number;
  onTimeout?: (duration: number) => void;
  errorMessage?: string;
}

const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  connectionTimeout: 10000, // 10 seconds
  requestTimeout: 30000, // 30 seconds
  idleTimeout: 60000, // 1 minute
  streamTimeout: 300000 // 5 minutes
};

export class TimeoutManager {
  private config: TimeoutConfig;
  private activeTimeouts: Map<string, NodeJS.Timeout>;

  constructor(config: Partial<TimeoutConfig> = {}) {
    this.config = { ...DEFAULT_TIMEOUT_CONFIG, ...config };
    this.activeTimeouts = new Map();
  }

  /**
   * Execute with timeout
   */
  async executeWithTimeout<T>(
    fn: () => Promise<T>,
    options: TimeoutOptions
  ): Promise<T> {
    const { timeout, onTimeout, errorMessage } = options;
    const startTime = Date.now();
    const operationId = this.generateOperationId();

    try {
      const result = await Promise.race([
        fn(),
        this.createTimeoutPromise(timeout, operationId)
      ]);

      return result;
    } catch (error) {
      if (error instanceof TimeoutError) {
        const duration = Date.now() - startTime;

        if (onTimeout) {
          onTimeout(duration);
        }

        throw this.createTimeoutError(timeout, errorMessage);
      }

      throw error;
    } finally {
      this.clearTimeout(operationId);
    }
  }

  /**
   * Execute with connection timeout
   */
  async executeWithConnectionTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return this.executeWithTimeout(fn, {
      timeout: this.config.connectionTimeout,
      errorMessage: 'Connection timeout'
    });
  }

  /**
   * Execute with request timeout
   */
  async executeWithRequestTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return this.executeWithTimeout(fn, {
      timeout: this.config.requestTimeout,
      errorMessage: 'Request timeout'
    });
  }

  /**
   * Execute with idle timeout
   */
  async executeWithIdleTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return this.executeWithTimeout(fn, {
      timeout: this.config.idleTimeout,
      errorMessage: 'Idle timeout'
    });
  }

  /**
   * Execute with stream timeout
   */
  async executeWithStreamTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return this.executeWithTimeout(fn, {
      timeout: this.config.streamTimeout || this.config.requestTimeout,
      errorMessage: 'Stream timeout'
    });
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(timeout: number, operationId: string): Promise<never> {
    return new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        this.activeTimeouts.delete(operationId);
        reject(new TimeoutError(`Operation timed out after ${timeout}ms`));
      }, timeout);

      this.activeTimeouts.set(operationId, timeoutId);
    });
  }

  /**
   * Clear a specific timeout
   */
  private clearTimeout(operationId: string): void {
    const timeoutId = this.activeTimeouts.get(operationId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.activeTimeouts.delete(operationId);
    }
  }

  /**
   * Clear all active timeouts
   */
  clearTimeouts(): void {
    for (const [operationId, timeoutId] of this.activeTimeouts) {
      clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();
  }

  /**
   * Get active timeout count
   */
  getActiveTimeoutCount(): number {
    return this.activeTimeouts.size;
  }

  /**
   * Update timeout configuration
   */
  updateConfig(updates: Partial<TimeoutConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): TimeoutConfig {
    return { ...this.config };
  }

  /**
   * Create timeout error
   */
  private createTimeoutError(timeout: number, message?: string): ServiceError {
    return {
      code: 'TIMEOUT',
      message: message || `Operation timed out after ${timeout}ms`,
      retryable: true
    };
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Custom Timeout Error
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ========================================================================
// Timeout Strategy
// ========================================================================

export class TimeoutStrategy {
  private static readonly DEFAULT_TIMEOUTS = {
    'quick': 1000,
    'short': 5000,
    'medium': 10000,
    'long': 30000,
    'very-long': 60000
  };

  /**
   * Get timeout by strategy name
   */
  static getTimeout(strategy: keyof typeof TimeoutStrategy.DEFAULT_TIMEOUTS | number): number {
    if (typeof strategy === 'number') {
      return strategy;
    }

    return this.DEFAULT_TIMEOUTS[strategy] || this.DEFAULT_TIMEOUTS.medium;
  }

  /**
   * Create timeout options
   */
  static createOptions(
    strategy: keyof typeof TimeoutStrategy.DEFAULT_TIMEOUTS | number,
    customTimeout?: number,
    errorMessage?: string
  ): TimeoutOptions {
    const timeout = customTimeout || this.getTimeout(strategy);

    return {
      timeout,
      errorMessage
    };
  }
}

// ========================================================================
// Timeout Decorator
// ========================================================================

export function timeoutable(timeout: number | TimeoutOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const manager = new TimeoutManager();

    const options: TimeoutOptions = typeof timeout === 'number'
      ? { timeout }
      : timeout;

    descriptor.value = async function (...args: any[]) {
      return manager.executeWithTimeout(
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

// ========================================================================
// Adaptive Timeout
// ========================================================================

export interface AdaptiveTimeoutOptions {
  initialTimeout: number;
  minTimeout: number;
  maxTimeout: number;
  scaleFactor: number;
  historySize: number;
}

export class AdaptiveTimeoutManager {
  private options: AdaptiveTimeoutOptions;
  private history: Array<{ duration: number; success: boolean; timestamp: number }>;
  private currentTimeout: number;

  constructor(options: Partial<AdaptiveTimeoutOptions> = {}) {
    this.options = {
      initialTimeout: 5000,
      minTimeout: 1000,
      maxTimeout: 60000,
      scaleFactor: 1.5,
      historySize: 100,
      ...options
    };

    this.history = [];
    this.currentTimeout = this.options.initialTimeout;
  }

  /**
   * Execute with adaptive timeout
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        fn(),
        this.createTimeoutPromise(this.currentTimeout)
      ]);

      // Record successful execution
      this.recordExecution(Date.now() - startTime, true);

      // Decrease timeout if successful
      this.adjustTimeout(true);

      return result;
    } catch (error) {
      if (error instanceof TimeoutError) {
        // Record timeout
        this.recordExecution(this.currentTimeout, false);

        // Increase timeout
        this.adjustTimeout(false);

        throw this.createTimeoutError(this.currentTimeout);
      }

      // Record failed execution
      this.recordExecution(Date.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Record execution result
   */
  private recordExecution(duration: number, success: boolean): void {
    this.history.push({
      duration,
      success,
      timestamp: Date.now()
    });

    // Keep only recent history
    if (this.history.length > this.options.historySize) {
      this.history.shift();
    }
  }

  /**
   * Adjust timeout based on history
   */
  private adjustTimeout(lastSuccess: boolean): void {
    if (lastSuccess) {
      // Decrease timeout gradually
      this.currentTimeout = Math.max(
        this.options.minTimeout,
        this.currentTimeout / this.options.scaleFactor
      );
    } else {
      // Increase timeout
      this.currentTimeout = Math.min(
        this.options.maxTimeout,
        this.currentTimeout * this.options.scaleFactor
      );
    }
  }

  /**
   * Get current timeout value
   */
  getCurrentTimeout(): number {
    return this.currentTimeout;
  }

  /**
   * Get success rate
   */
  getSuccessRate(): number {
    if (this.history.length === 0) {
      return 1;
    }

    const successful = this.history.filter(h => h.success).length;
    return successful / this.history.length;
  }

  /**
   * Get average execution time
   */
  getAverageExecutionTime(): number {
    if (this.history.length === 0) {
      return 0;
    }

    const total = this.history.reduce((sum, h) => sum + h.duration, 0);
    return total / this.history.length;
  }

  /**
   * Get execution history
   */
  getHistory(): Array<{ duration: number; success: boolean; timestamp: number }> {
    return [...this.history];
  }

  /**
   * Reset timeout to initial value
   */
  reset(): void {
    this.currentTimeout = this.options.initialTimeout;
    this.history = [];
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`Operation timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Create timeout error
   */
  private createTimeoutError(timeout: number): ServiceError {
    return {
      code: 'TIMEOUT',
      message: `Operation timed out after ${timeout}ms`,
      retryable: true
    };
  }
}

// ========================================================================
// Timeout Chain
// ========================================================================

export class TimeoutChain {
  private timeouts: Map<string, number>;
  private executionOrder: string[];

  constructor() {
    this.timeouts = new Map();
    this.executionOrder = [];
  }

  /**
   * Add timeout to chain
   */
  add(name: string, timeout: number): TimeoutChain {
    this.timeouts.set(name, timeout);
    this.executionOrder.push(name);
    return this;
  }

  /**
   * Execute chain of operations with timeouts
   */
  async execute<T>(
    operations: Map<string, () => Promise<T>>
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    for (const name of this.executionOrder) {
      const operation = operations.get(name);

      if (!operation) {
        throw new Error(`Operation '${name}' not found`);
      }

      const timeout = this.timeouts.get(name)!;

      try {
        const result = await Promise.race([
          operation(),
          this.createTimeoutPromise(timeout, name)
        ]);

        results.set(name, result as T);
      } catch (error) {
        if (error instanceof TimeoutError) {
          throw new Error(`Operation '${name}' timed out after ${timeout}ms`);
        }
        throw error;
      }
    }

    return results;
  }

  /**
   * Execute chain in parallel with individual timeouts
   */
  async executeParallel<T>(
    operations: Map<string, () => Promise<T>>
  ): Promise<Map<string, T>> {
    const promises = Array.from(this.executionOrder).map(async (name) => {
      const operation = operations.get(name);

      if (!operation) {
        throw new Error(`Operation '${name}' not found`);
      }

      const timeout = this.timeouts.get(name)!;

      try {
        const result = await Promise.race([
          operation(),
          this.createTimeoutPromise(timeout, name)
        ]);

        return { name, result };
      } catch (error) {
        if (error instanceof TimeoutError) {
          throw new Error(`Operation '${name}' timed out after ${timeout}ms`);
        }
        throw error;
      }
    });

    const results = await Promise.all(promises);
    const resultMap = new Map<string, T>();

    for (const { name, result } of results) {
      resultMap.set(name, result as T);
    }

    return resultMap;
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeout: number, name: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`Operation '${name}' timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Clear all timeouts
   */
  clear(): void {
    this.timeouts.clear();
    this.executionOrder = [];
  }
}
