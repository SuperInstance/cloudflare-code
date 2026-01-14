import {
  RecoveryConfig,
  HealthCheckConfig,
  CircuitState,
  HealthStatus,
} from '../types/index.js';

/**
 * Recovery state
 */
interface RecoveryState {
  /** Whether recovery is in progress */
  inProgress: boolean;
  /** Current attempt number */
  currentAttempt: number;
  /** Start time of recovery */
  startTime: number;
  /** Last attempt time */
  lastAttemptTime: number;
  /** Current traffic percentage (0-100) */
  currentTrafficPercent: number;
  /** Successful checks */
  successfulChecks: number;
  /** Failed checks */
  failedChecks: number;
  /** Recovery history */
  history: RecoveryAttempt[];
}

/**
 * Recovery attempt record
 */
interface RecoveryAttempt {
  /** Attempt number */
  attempt: number;
  /** Timestamp */
  timestamp: number;
  /** Whether it was successful */
  success: boolean;
  /** Duration in ms */
  duration: number;
  /** Traffic percentage */
  trafficPercent: number;
  /** Error if failed */
  error?: Error;
}

/**
 * Recovery strategy result
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  /** New state after recovery */
  newState: CircuitState;
  /** Number of attempts made */
  attempts: number;
  /** Total duration */
  duration: number;
  /** Error if failed */
  error?: Error;
}

/**
 * Health check result
 */
interface HealthCheckResult {
  /** Whether service is healthy */
  healthy: boolean;
  /** Response time in ms */
  responseTime: number;
  /** Error if failed */
  error?: Error;
  /** Timestamp */
  timestamp: number;
}

/**
 * Advanced Recovery Engine
 * Manages automatic recovery with health checks and gradual traffic ramping
 */
export class RecoveryEngine {
  private config: RecoveryConfig;
  private healthCheckConfig: HealthCheckConfig;
  private state: RecoveryState;
  private healthCheckInterval: NodeJS.Timeout | null;
  private recoveryTimeout: NodeJS.Timeout | null;
  private onRecoveryComplete?: (result: RecoveryResult) => void;
  private onHealthCheck?: (result: HealthCheckResult) => void;

  constructor(
    recoveryConfig: RecoveryConfig,
    healthCheckConfig: HealthCheckConfig
  ) {
    this.config = recoveryConfig;
    this.healthCheckConfig = healthCheckConfig;
    this.state = this.createInitialState();
    this.healthCheckInterval = null;
    this.recoveryTimeout = null;
  }

  /**
   * Start recovery process
   */
  async start(
    currentState: CircuitState,
    circuitName: string
  ): Promise<RecoveryResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        newState: currentState,
        attempts: 0,
        duration: 0,
        error: new Error('Recovery is disabled'),
      };
    }

    // Reset state
    this.state = this.createInitialState();
    this.state.inProgress = true;
    this.state.startTime = Date.now();

    // If circuit is open, wait for timeout then attempt half-open
    if (currentState === CircuitState.OPEN) {
      await this.wait(this.config.initialDelayMs);
    }

    // Attempt recovery
    const result = await this.attemptRecovery(currentState, circuitName);

    this.state.inProgress = false;

    if (this.onRecoveryComplete) {
      this.onRecoveryComplete(result);
    }

    return result;
  }

  /**
   * Attempt recovery with strategy
   */
  private async attemptRecovery(
    currentState: CircuitState,
    circuitName: string
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    let currentAttempt = 0;
    let lastError: Error | undefined;

    // Enable gradual ramping if configured
    if (this.config.enableGradualRamping) {
      return await this.gradualRecovery(currentState, circuitName);
    }

    // Standard recovery with exponential backoff
    while (currentAttempt < this.config.maxAttempts) {
      currentAttempt++;
      this.state.currentAttempt = currentAttempt;
      this.state.lastAttemptTime = Date.now();

      // Perform health check
      const healthResult = await this.performHealthCheck();

      if (healthResult.healthy) {
        this.state.successfulChecks++;
        this.recordAttempt(currentAttempt, true, healthResult.responseTime);

        return {
          success: true,
          newState: CircuitState.CLOSED,
          attempts: currentAttempt,
          duration: Date.now() - startTime,
        };
      } else {
        this.state.failedChecks++;
        lastError = healthResult.error;
        this.recordAttempt(currentAttempt, false, healthResult.responseTime, lastError);
      }

      // Wait before next attempt with exponential backoff
      if (currentAttempt < this.config.maxAttempts) {
        const delay = this.calculateBackoff(currentAttempt);
        await this.wait(delay);
      }
    }

    return {
      success: false,
      newState: currentState,
      attempts: currentAttempt,
      duration: Date.now() - startTime,
      error: lastError || new Error('Recovery failed after max attempts'),
    };
  }

  /**
   * Gradual recovery with traffic ramping
   */
  private async gradualRecovery(
    currentState: CircuitState,
    circuitName: string
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    let currentTraffic = this.config.initialTrafficPercent;
    let attempt = 0;

    this.state.currentTrafficPercent = currentTraffic;

    while (attempt < this.config.maxAttempts && currentTraffic <= 100) {
      attempt++;
      this.state.currentAttempt = attempt;
      this.state.lastAttemptTime = Date.now();

      // Perform health check
      const healthResult = await this.performHealthCheck();

      if (healthResult.healthy) {
        this.state.successfulChecks++;
        this.recordAttempt(attempt, true, healthResult.responseTime, currentTraffic);

        // Increase traffic gradually
        currentTraffic = Math.min(
          currentTraffic + this.config.trafficIncrement,
          100
        );
        this.state.currentTrafficPercent = currentTraffic;

        // If at 100% traffic and healthy, recovery complete
        if (currentTraffic >= 100) {
          return {
            success: true,
            newState: CircuitState.CLOSED,
            attempts: attempt,
            duration: Date.now() - startTime,
          };
        }

        // Wait for next ramping step
        await this.wait(this.config.rampingStepDurationMs);
      } else {
        this.state.failedChecks++;
        this.recordAttempt(
          attempt,
          false,
          healthResult.responseTime,
          currentTraffic,
          healthResult.error
        );

        // Rollback on failure
        return {
          success: false,
          newState: CircuitState.OPEN,
          attempts: attempt,
          duration: Date.now() - startTime,
          error: healthResult.error || new Error('Health check failed during ramping'),
        };
      }
    }

    return {
      success: false,
      newState: currentState,
      attempts: attempt,
      duration: Date.now() - startTime,
      error: new Error('Gradual recovery exhausted'),
    };
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<HealthCheckResult> {
    if (!this.healthCheckConfig.enabled) {
      return {
        healthy: true,
        responseTime: 0,
        timestamp: Date.now(),
      };
    }

    const startTime = Date.now();

    try {
      const result = await this.withTimeout(
        this.healthCheckConfig.checker(),
        this.healthCheckConfig.timeoutMs
      );

      return {
        healthy: result,
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error as Error,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const exponentialDelay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    return Math.min(exponentialDelay, this.config.maxDelayMs);
  }

  /**
   * Record recovery attempt
   */
  private recordAttempt(
    attempt: number,
    success: boolean,
    duration: number,
    trafficPercent?: number,
    error?: Error
  ): void {
    this.state.history.push({
      attempt,
      timestamp: Date.now(),
      success,
      duration,
      trafficPercent: trafficPercent || 100,
      error,
    });

    // Keep only last 100 attempts
    if (this.state.history.length > 100) {
      this.state.history.shift();
    }
  }

  /**
   * Wrap promise with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Health check timed out after ${timeoutMs}ms`));
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
   * Wait for specified duration
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create initial recovery state
   */
  private createInitialState(): RecoveryState {
    return {
      inProgress: false,
      currentAttempt: 0,
      startTime: 0,
      lastAttemptTime: 0,
      currentTrafficPercent: 0,
      successfulChecks: 0,
      failedChecks: 0,
      history: [],
    };
  }

  /**
   * Get current recovery state
   */
  getState(): RecoveryState {
    return { ...this.state };
  }

  /**
   * Get recovery status
   */
  getStatus(): HealthStatus {
    if (!this.state.inProgress) {
      return HealthStatus.UNKNOWN;
    }

    if (this.state.successfulChecks > this.state.failedChecks) {
      return HealthStatus.RECOVERING;
    }

    return HealthStatus.UNHEALTHY;
  }

  /**
   * Cancel ongoing recovery
   */
  cancel(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
      this.recoveryTimeout = null;
    }

    this.state.inProgress = false;
  }

  /**
   * Set recovery complete callback
   */
  onRecovery(callback: (result: RecoveryResult) => void): void {
    this.onRecoveryComplete = callback;
  }

  /**
   * Set health check callback
   */
  onHealthCheckResult(callback: (result: HealthCheckResult) => void): void {
    this.onHealthCheck = callback;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RecoveryConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Update health check configuration
   */
  updateHealthCheckConfig(updates: Partial<HealthCheckConfig>): void {
    this.healthCheckConfig = { ...this.healthCheckConfig, ...updates };
  }

  /**
   * Reset recovery state
   */
  reset(): void {
    this.cancel();
    this.state = this.createInitialState();
  }

  /**
   * Get recovery history
   */
  getHistory(): RecoveryAttempt[] {
    return [...this.state.history];
  }

  /**
   * Get recovery statistics
   */
  getStats(): Record<string, unknown> {
    const successfulAttempts = this.state.history.filter((h) => h.success).length;
    const failedAttempts = this.state.history.filter((h) => !h.success).length;

    return {
      inProgress: this.state.inProgress,
      currentAttempt: this.state.currentAttempt,
      currentTrafficPercent: this.state.currentTrafficPercent,
      successfulChecks: this.state.successfulChecks,
      failedChecks: this.state.failedChecks,
      totalAttempts: this.state.history.length,
      successRate:
        this.state.history.length > 0
          ? (successfulAttempts / this.state.history.length) * 100
          : 0,
      averageDuration:
        this.state.history.length > 0
          ? this.state.history.reduce((sum, h) => sum + h.duration, 0) /
            this.state.history.length
          : 0,
      lastAttemptTime: this.state.lastAttemptTime,
    };
  }

  /**
   * Validate recovery configuration
   */
  static validateConfig(config: RecoveryConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.enabled) {
      if (config.initialDelayMs < 0) {
        errors.push('initialDelayMs must be non-negative');
      }

      if (config.maxDelayMs < config.initialDelayMs) {
        errors.push('maxDelayMs must be >= initialDelayMs');
      }

      if (config.backoffMultiplier < 1) {
        errors.push('backoffMultiplier must be >= 1');
      }

      if (config.maxAttempts < 1) {
        errors.push('maxAttempts must be >= 1');
      }

      if (config.enableGradualRamping) {
        if (config.initialTrafficPercent < 0 || config.initialTrafficPercent > 100) {
          errors.push('initialTrafficPercent must be between 0 and 100');
        }

        if (config.trafficIncrement < 0 || config.trafficIncrement > 100) {
          errors.push('trafficIncrement must be between 0 and 100');
        }

        if (config.rampingStepDurationMs < 1000) {
          errors.push('rampingStepDurationMs must be >= 1000');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate health check configuration
   */
  static validateHealthCheckConfig(config: HealthCheckConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.enabled) {
      if (config.intervalMs < 1000) {
        errors.push('intervalMs must be >= 1000');
      }

      if (config.timeoutMs < 100) {
        errors.push('timeoutMs must be >= 100');
      }

      if (config.timeoutMs > config.intervalMs) {
        errors.push('timeoutMs must be <= intervalMs');
      }

      if (config.successThreshold < 1) {
        errors.push('successThreshold must be >= 1');
      }

      if (config.failureThreshold < 1) {
        errors.push('failureThreshold must be >= 1');
      }

      if (typeof config.checker !== 'function') {
        errors.push('checker must be a function');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
