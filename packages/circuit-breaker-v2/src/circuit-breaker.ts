import {
  CircuitBreakerConfig,
  CircuitState,
  ExecutionResultData,
  ExecutionResult,
  CircuitMetrics,
  CircuitSnapshot,
  CircuitEvent,
  CircuitEventListener,
  OperationOptions,
  HealthCheckConfig,
  RecoveryConfig,
  FallbackConfig,
  HealthStatus,
} from './types/index.js';
import { CircuitBreakerEngine } from './breaker/engine.js';
import { FaultDetector, FaultDetectionResult, FaultDetectorConfig } from './fault/detector.js';
import { FallbackManager } from './fallback/manager.js';
import { RecoveryEngine } from './recovery/engine.js';
import { AnalyticsCollector } from './analytics/collector.js';
import { mergeConfig, getDefaultHealthCheckConfig, getDefaultRecoveryConfig } from './config/index.js';

/**
 * Main Circuit Breaker class
 * Orchestrates all components for advanced circuit breaking
 */
export class CircuitBreaker {
  private engine: CircuitBreakerEngine;
  private faultDetector: FaultDetector;
  private fallbackManager: FallbackManager;
  private recoveryEngine: RecoveryEngine;
  private analytics: AnalyticsCollector;
  private eventListeners: Set<CircuitEventListener>;
  private healthCheckConfig: HealthCheckConfig;
  private recoveryInProgress: boolean;

  constructor(config: CircuitBreakerConfig) {
    // Merge with defaults
    const mergedConfig = mergeConfig(config);
    this.engine = new CircuitBreakerEngine(mergedConfig.name, mergedConfig);

    // Initialize fault detector
    const faultConfig: FaultDetectorConfig = {
      enablePredictive: mergedConfig.enablePredictiveDetection,
      anomalyThreshold: 0.7,
      patternWindowSize: 100,
      minConfidence: 0.6,
      learningRate: 0.1,
      enableTrendAnalysis: true,
      trendThreshold: 0.3,
    };
    this.faultDetector = new FaultDetector(faultConfig);

    // Initialize fallback manager
    this.fallbackManager = new FallbackManager();

    // Initialize recovery engine
    this.recoveryEngine = new RecoveryEngine(
      getDefaultRecoveryConfig(),
      getDefaultHealthCheckConfig(async () => this.engine.isHealthy())
    );

    // Initialize analytics
    this.analytics = new AnalyticsCollector(mergedConfig.name);

    this.eventListeners = new Set();
    this.healthCheckConfig = getDefaultHealthCheckConfig(async () => this.engine.isHealthy());
    this.recoveryInProgress = false;

    // Subscribe to engine events
    this.engine.onStateChange((event) => this.handleEngineEvent(event));
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(
    operation: () => Promise<T>,
    options: OperationOptions<T> = {}
  ): Promise<T> {
    let result: ExecutionResultData<T>;

    // Perform fault detection before execution
    const metrics = this.engine.getMetrics();
    const faultResult = this.faultDetector.detect(metrics, this.engine.getState());

    if (faultResult.faultDetected && this.engine.getConfig().enablePredictiveDetection) {
      // Record prediction event
      this.analytics.recordEvent({
        type: 'prediction',
        circuitName: this.engine.getConfig().name,
        timestamp: Date.now(),
        data: faultResult as any,
      });

      // Consider opening circuit proactively
      if (faultResult.failureProbability > 0.8) {
        this.engine.open();
      }
    }

    // Execute operation
    result = await this.engine.execute(operation, options);

    // Handle failures with fallbacks
    if (result.status !== ExecutionResult.SUCCESS && !result.usedFallback) {
      const fallbackResult = await this.fallbackManager.execute(
        result.context,
        result.error,
        options.fallbacks
      );

      if (fallbackResult.status === ExecutionResult.FALLBACK_SUCCESS) {
        result = fallbackResult;
      }
    }

    // Record analytics
    this.analytics.recordExecution(result);

    // Emit event
    this.emitEvent({
      type: 'stateChange' as any,
      circuitName: this.engine.getConfig().name,
      data: result as any,
      timestamp: Date.now(),
    });

    // Check if recovery should be triggered
    if (result.status === ExecutionResult.FAILURE && this.shouldTriggerRecovery()) {
      this.triggerRecovery();
    }

    // Return data or throw error
    if (result.status === ExecutionResult.SUCCESS || result.status === ExecutionResult.FALLBACK_SUCCESS) {
      return result.data as T;
    }

    throw result.error || new Error('Operation failed');
  }

  /**
   * Register a fallback handler
   */
  registerFallback<T>(fallback: FallbackConfig<T>): void {
    this.fallbackManager.register(fallback);
  }

  /**
   * Unregister a fallback handler
   */
  unregisterFallback(name: string): void {
    this.fallbackManager.unregister(name);
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.engine.getState();
  }

  /**
   * Get circuit metrics
   */
  getMetrics(): CircuitMetrics {
    return this.engine.getMetrics();
  }

  /**
   * Get health status
   */
  getHealthStatus(): HealthStatus {
    const state = this.engine.getState();
    const metrics = this.engine.getMetrics();

    if (state === CircuitState.CLOSED && metrics.errorRate < 5) {
      return HealthStatus.HEALTHY;
    } else if (state === CircuitState.HALF_OPEN || this.recoveryInProgress) {
      return HealthStatus.RECOVERING;
    } else if (state === CircuitState.OPEN) {
      return HealthStatus.UNHEALTHY;
    } else {
      return HealthStatus.DEGRADED;
    }
  }

  /**
   * Get fault detection result
   */
  detectFaults(): FaultDetectionResult {
    const metrics = this.engine.getMetrics();
    return this.faultDetector.detect(metrics, this.engine.getState());
  }

  /**
   * Get analytics data
   */
  getAnalytics(): Record<string, unknown> {
    return this.analytics.getSummary();
  }

  /**
   * Manually open the circuit
   */
  open(): void {
    this.engine.open();
    this.analytics.recordEvent({
      type: 'manual_state_change',
      circuitName: this.engine.getConfig().name,
      timestamp: Date.now(),
      data: { action: 'open' },
    });
  }

  /**
   * Manually close the circuit
   */
  close(): void {
    this.engine.close();
    this.analytics.recordEvent({
      type: 'manual_state_change',
      circuitName: this.engine.getConfig().name,
      timestamp: Date.now(),
      data: { action: 'close' },
    });
  }

  /**
   * Manually isolate the circuit
   */
  isolate(): void {
    this.engine.isolate();
    this.analytics.recordEvent({
      type: 'manual_state_change',
      circuitName: this.engine.getConfig().name,
      timestamp: Date.now(),
      data: { action: 'isolate' },
    });
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.engine.reset();
    this.faultDetector.reset();
    this.fallbackManager.clearCache();
    this.analytics.reset();
  }

  /**
   * Get circuit snapshot
   */
  getSnapshot(): CircuitSnapshot {
    return this.engine.getSnapshot();
  }

  /**
   * Restore from snapshot
   */
  restoreFromSnapshot(snapshot: CircuitSnapshot): void {
    this.engine.restoreFromSnapshot(snapshot);
  }

  /**
   * Add event listener
   */
  on(listener: CircuitEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CircuitBreakerConfig>): void {
    this.engine.updateConfig(updates);
  }

  /**
   * Update health check configuration
   */
  updateHealthCheckConfig(config: Partial<HealthCheckConfig>): void {
    this.healthCheckConfig = { ...this.healthCheckConfig, ...config };
    this.recoveryEngine.updateHealthCheckConfig(this.healthCheckConfig);
  }

  /**
   * Update recovery configuration
   */
  updateRecoveryConfig(config: Partial<RecoveryConfig>): void {
    this.recoveryEngine.updateConfig(config);
  }

  /**
   * Enable or disable fallbacks
   */
  setFallbacksEnabled(enabled: boolean): void {
    this.fallbackManager.setEnabled(enabled);
  }

  /**
   * Enable or disable fallback caching
   */
  setFallbackCacheEnabled(enabled: boolean): void {
    this.fallbackManager.setCacheEnabled(enabled);
  }

  /**
   * Get fallback statistics
   */
  getFallbackStats(name?: string): Record<string, unknown> | Map<string, unknown> {
    if (name) {
      return this.fallbackManager.getStats(name) as any || {};
    }
    return this.fallbackManager.getAllStats() as any;
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): Record<string, unknown> {
    return {
      circuit: this.engine.getStats(),
      health: {
        status: this.getHealthStatus(),
        checks: this.recoveryEngine.getStats(),
      },
      faults: this.faultDetector.getLastPrediction(),
      fallbacks: Object.fromEntries(this.fallbackManager.getAllStats()),
      analytics: this.analytics.getSummary(),
    };
  }

  /**
   * Handle engine events
   */
  private handleEngineEvent(event: CircuitEvent): void {
    // Emit to external listeners
    this.emitEvent(event);

    // Trigger recovery on state change to OPEN
    if (event.toState === CircuitState.OPEN) {
      this.triggerRecovery();
    }
  }

  /**
   * Determine if recovery should be triggered
   */
  private shouldTriggerRecovery(): boolean {
    const config = this.recoveryEngine['config'];
    return config.enabled && !this.recoveryInProgress;
  }

  /**
   * Trigger recovery process
   */
  private async triggerRecovery(): Promise<void> {
    if (this.recoveryInProgress) return;

    this.recoveryInProgress = true;

    try {
      const result = await this.recoveryEngine.start(
        this.engine.getState(),
        this.engine.getConfig().name
      );

      this.analytics.recordEvent({
        type: 'recovery',
        circuitName: this.engine.getConfig().name,
        timestamp: Date.now(),
        data: result as any,
      });

      if (result.success) {
        this.engine.close();
      }

      this.emitEvent({
        type: 'recovery',
        circuitName: this.engine.getConfig().name,
        data: result as any,
        timestamp: Date.now(),
      });
    } finally {
      this.recoveryInProgress = false;
    }
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: CircuitEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }

  /**
   * Export metrics for monitoring systems
   */
  exportMetrics(): string {
    const metrics = this.engine.getMetrics();
    const stats = this.getStats();

    return JSON.stringify({
      circuit: this.engine.getConfig().name,
      state: this.engine.getState(),
      health: this.getHealthStatus(),
      metrics,
      stats,
      timestamp: Date.now(),
    }, null, 2);
  }

  /**
   * Create a circuit breaker instance with preset configuration
   */
  static create(config: CircuitBreakerConfig): CircuitBreaker {
    return new CircuitBreaker(config);
  }

  /**
   * Create with critical preset
   */
  static createCritical(name: string): CircuitBreaker {
    return new CircuitBreaker({
      name,
      thresholds: {
        failureThreshold: 3,
        successThreshold: 3,
        timeoutMs: 30000,
        windowSize: 50,
        minRequests: 5,
        errorRateThreshold: 30,
        slowCallThreshold: 500,
        slowCallRateThreshold: 20,
      },
      enableMetrics: true,
      enablePredictiveDetection: true,
      enableAdaptiveThresholds: true,
      enablePersistence: false,
    });
  }

  /**
   * Create with lenient preset
   */
  static createLenient(name: string): CircuitBreaker {
    return new CircuitBreaker({
      name,
      thresholds: {
        failureThreshold: 10,
        successThreshold: 2,
        timeoutMs: 120000,
        windowSize: 200,
        minRequests: 20,
        errorRateThreshold: 70,
        slowCallThreshold: 2000,
        slowCallRateThreshold: 50,
      },
      enableMetrics: true,
      enablePredictiveDetection: false,
      enablePersistence: false,
    });
  }
}
