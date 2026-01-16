import type {
  ExecutionContext,
  ExecutionResultData,
  CircuitMetrics,
  CircuitSnapshot,
  CircuitEventListener,
  CircuitEvent,
  WindowDataPoint,
  OperationOptions,
} from '../types/index.js';

import {
  CircuitState,
  CircuitBreakerConfig,
  ExecutionResult,
} from '../types/index.js';
import { SlidingWindow } from '../utils/window.js';
import { MetricsCollector } from '../monitoring/metrics.js';

/**
 * Core Circuit Breaker Engine
 * Implements the state machine and logic for circuit breaking
 */
export class CircuitBreakerEngine {
  private name: string;
  private state: CircuitState;
  private config: CircuitBreakerConfig;
  private window: SlidingWindow;
  private metrics: MetricsCollector;
  private stateChangeListeners: Set<CircuitEventListener>;
  private lastStateChange: number;
  private consecutiveSuccesses: number;
  private consecutiveFailures: number;
  private manualOverride: boolean;
  private activeExecutions: Set<string>;
  private executionIdCounter: number;

  constructor(name: string, config: CircuitBreakerConfig) {
    this.name = name;
    this.config = config;
    this.state = CircuitState.CLOSED;
    this.window = new SlidingWindow(config.thresholds.windowSize);
    this.metrics = new MetricsCollector(name, config.enableMetrics);
    this.stateChangeListeners = new Set();
    this.lastStateChange = Date.now();
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    this.manualOverride = false;
    this.activeExecutions = new Set();
    this.executionIdCounter = 0;
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(
    operation: () => Promise<T>,
    options: OperationOptions<T> = {}
  ): Promise<ExecutionResultData<T>> {
    if (options.skipCircuit) {
      return this.executeDirectly<T>(operation, options);
    }

    const executionId = this.generateExecutionId();
    const context = this.createContext(options);

    this.activeExecutions.add(executionId);

    try {
      // Check if circuit allows execution
      if (!this.allowExecution()) {
        return this.createRejectedResult<T>(context);
      }

      // Execute with timeout
      const result = await this.executeWithTimeout(operation, context, options.timeout);

      // Record result
      this.recordResult(result, context);

      return result;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Check if execution is allowed based on circuit state
   */
  private allowExecution(): boolean {
    if (this.manualOverride) {
      return false;
    }

    const now = Date.now();
    const timeInOpen = now - this.lastStateChange;

    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if timeout has elapsed to attempt half-open
        if (timeInOpen >= this.config.thresholds.timeoutMs) {
          this.transitionTo(CircuitState.HALF_OPEN);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return true;

      case CircuitState.ISOLATED:
        return false;

      default:
        return false;
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    context: ExecutionContext,
    timeout?: number
  ): Promise<ExecutionResultData<T>> {
    const effectiveTimeout = timeout || this.config.operationTimeoutMs || 30000;
    const startTime = Date.now();

    try {
      const result = await this.withTimeout(operation(), effectiveTimeout);

      return {
        status: ExecutionResult.SUCCESS,
        data: result,
        duration: Date.now() - startTime,
        usedFallback: false,
        context,
        timestamp: Date.now(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const isTimeout = duration >= effectiveTimeout;

      return {
        status: isTimeout ? ExecutionResult.TIMEOUT : ExecutionResult.FAILURE,
        error: error as Error,
        duration,
        usedFallback: false,
        context,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Execute operation directly, bypassing circuit breaker
   */
  private async executeDirectly<T>(
    operation: () => Promise<T>,
    options: OperationOptions<T>
  ): Promise<ExecutionResultData<T>> {
    const context = this.createContext(options);
    const startTime = Date.now();

    try {
      const data = await operation();
      return {
        status: ExecutionResult.SUCCESS,
        data,
        duration: Date.now() - startTime,
        usedFallback: false,
        context,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        status: ExecutionResult.FAILURE,
        error: error as Error,
        duration: Date.now() - startTime,
        usedFallback: false,
        context,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Record execution result and update state
   */
  private recordResult<T>(result: ExecutionResultData<T>, _context: ExecutionContext): void {
    const dataPoint: WindowDataPoint = {
      success: result.status === ExecutionResult.SUCCESS,
      duration: result.duration,
      timestamp: result.timestamp,
      error: result.error,
    };

    this.window.add(dataPoint);
    this.metrics.record(result);

    // Update consecutive counters
    if (result.status === ExecutionResult.SUCCESS) {
      this.consecutiveSuccesses++;
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
      this.consecutiveSuccesses = 0;
    }

    // Check if we need to transition states
    this.evaluateStateTransitions();
  }

  /**
   * Evaluate and perform state transitions based on metrics
   */
  private evaluateStateTransitions(): void {
    const metrics = this.getMetrics();

    switch (this.state) {
      case CircuitState.CLOSED:
        if (this.shouldOpenCircuit(metrics)) {
          this.transitionTo(CircuitState.OPEN);
        }
        break;

      case CircuitState.HALF_OPEN:
        if (this.consecutiveSuccesses >= this.config.thresholds.successThreshold) {
          this.transitionTo(CircuitState.CLOSED);
        } else if (this.consecutiveFailures >= 1) {
          this.transitionTo(CircuitState.OPEN);
        }
        break;
    }
  }

  /**
   * Determine if circuit should open
   */
  private shouldOpenCircuit(metrics: CircuitMetrics): boolean {
    const thresholds = this.config.thresholds;

    // Check minimum requests
    if (metrics.totalRequests < thresholds.minRequests) {
      return false;
    }

    // Check error rate
    if (metrics.errorRate >= thresholds.errorRateThreshold) {
      return true;
    }

    // Check slow call rate
    if (metrics.slowCallRate >= thresholds.slowCallRateThreshold) {
      return true;
    }

    // Check failure count
    if (this.consecutiveFailures >= thresholds.failureThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    // Reset counters on state change
    if (newState === CircuitState.CLOSED) {
      this.consecutiveSuccesses = 0;
      this.consecutiveFailures = 0;
      this.window.clear();
    } else if (newState === CircuitState.HALF_OPEN) {
      this.consecutiveSuccesses = 0;
    }

    // Emit event
    this.emitEvent({
      type: 'stateChange',
      circuitName: this.name,
      fromState: oldState,
      toState: newState,
      data: {
        previousState: oldState,
        newState,
        reason: this.getTransitionReason(oldState, newState),
      },
      timestamp: Date.now(),
    });

    // Notify listeners
    this.notifyStateChange(oldState, newState);
  }

  /**
   * Get human-readable reason for state transition
   */
  private getTransitionReason(fromState: CircuitState, toState: CircuitState): string {
    if (fromState === CircuitState.CLOSED && toState === CircuitState.OPEN) {
      return 'Failure threshold exceeded';
    }
    if (fromState === CircuitState.OPEN && toState === CircuitState.HALF_OPEN) {
      return 'Timeout elapsed, testing recovery';
    }
    if (fromState === CircuitState.HALF_OPEN && toState === CircuitState.CLOSED) {
      return 'Recovery successful';
    }
    if (fromState === CircuitState.HALF_OPEN && toState === CircuitState.OPEN) {
      return 'Recovery failed';
    }
    return 'State transition';
  }

  /**
   * Create execution context
   */
  private createContext(options: OperationOptions): ExecutionContext {
    return {
      circuitName: this.name,
      attempt: options.attempt || 1,
      startTime: Date.now(),
      timeout: options.timeout || this.config.operationTimeoutMs || 30000,
      metadata: options.metadata,
    };
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `${this.name}-${Date.now()}-${++this.executionIdCounter}`;
  }

  /**
   * Create rejected result
   */
  private createRejectedResult<T>(context: ExecutionContext): ExecutionResultData<T> {
    return {
      status: ExecutionResult.REJECTED,
      error: new Error('Circuit breaker is open'),
      duration: 0,
      usedFallback: false,
      context,
      timestamp: Date.now(),
    };
  }

  /**
   * Wrap promise with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit metrics
   */
  getMetrics(): CircuitMetrics {
    const windowMetrics = this.window.getMetrics();
    const customMetrics = this.metrics.getMetrics();

    return {
      ...windowMetrics,
      ...customMetrics,
      state: this.state,
      lastStateChange: this.lastStateChange,
      timeInCurrentState: Date.now() - this.lastStateChange,
    };
  }

  /**
   * Manually open the circuit
   */
  open(): void {
    if (this.state !== CircuitState.OPEN) {
      this.manualOverride = true;
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Manually close the circuit
   */
  close(): void {
    this.manualOverride = false;
    if (this.state !== CircuitState.CLOSED) {
      this.transitionTo(CircuitState.CLOSED);
    }
  }

  /**
   * Manually isolate the circuit
   */
  isolate(): void {
    if (this.state !== CircuitState.ISOLATED) {
      this.manualOverride = true;
      this.transitionTo(CircuitState.ISOLATED);
    }
  }

  /**
   * Get circuit snapshot for persistence
   */
  getSnapshot(): CircuitSnapshot {
    return {
      name: this.name,
      state: this.state,
      metrics: this.getMetrics(),
      timestamp: Date.now(),
      version: 1,
    };
  }

  /**
   * Restore circuit from snapshot
   */
  restoreFromSnapshot(snapshot: CircuitSnapshot): void {
    if (snapshot.name !== this.name) {
      throw new Error('Snapshot name mismatch');
    }

    this.state = snapshot.state;
    this.lastStateChange = snapshot.timestamp;
    this.metrics.restore(snapshot.metrics);
  }

  /**
   * Add state change listener
   */
  onStateChange(listener: CircuitEventListener): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: CircuitEvent): void {
    this.stateChangeListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }

  /**
   * Notify state change to listeners
   */
  private notifyStateChange(fromState: CircuitState, toState: CircuitState): void {
    this.stateChangeListeners.forEach((listener) => {
      try {
        listener({
          type: 'stateChange',
          circuitName: this.name,
          fromState,
          toState,
          data: {
            fromState,
            toState,
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  /**
   * Get active execution count
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Check if circuit is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED && this.consecutiveFailures === 0;
  }

  /**
   * Get configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...updates };

    // Update window size if changed
    if (updates.thresholds?.windowSize !== undefined) {
      this.window = new SlidingWindow(updates.thresholds.windowSize);
    }
  }

  /**
   * Reset circuit to initial state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.lastStateChange = Date.now();
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    this.manualOverride = false;
    this.window.clear();
    this.metrics.reset();
  }

  /**
   * Get statistics
   */
  getStats(): Record<string, unknown> {
    return {
      name: this.name,
      state: this.state,
      activeExecutions: this.activeExecutions.size,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      manualOverride: this.manualOverride,
      timeInCurrentState: Date.now() - this.lastStateChange,
      metrics: this.getMetrics(),
    };
  }
}
