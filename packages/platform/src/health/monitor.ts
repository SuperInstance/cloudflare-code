// @ts-nocheck
/**
 * Health Monitor
 *
 * Comprehensive health monitoring with auto-recovery,
 * degradation detection, and circuit breaker coordination.
 */

import type { HealthCheckResult, HealthStatus, HealthCheckOptions } from '../types/core';

import { delay, retry, debounce } from '../utils/helpers';

/**
 * Health check definition
 */
export interface HealthCheck {
  readonly name: string;
  readonly check: () => Promise<HealthCheckResult | { status: HealthStatus; details?: Record<string, unknown> }>;
  readonly interval?: number;
  readonly timeout?: number;
  readonly retryAttempts?: number;
  readonly retryDelay?: number;
  readonly critical?: boolean;
  readonly dependencies?: string[];
  readonly enabled?: boolean;
}

/**
 * Health monitor options
 */
export interface HealthMonitorOptions {
  readonly checkInterval?: number;
  readonly timeout?: number;
  readonly retryAttempts?: number;
  readonly retryDelay?: number;
  readonly autoRecovery?: boolean;
  readonly degradationThreshold?: number;
  readonly circuitBreakerThreshold?: number;
  readonly alertThreshold?: number;
}

/**
 * Health statistics
 */
interface HealthStatistics {
  readonly totalChecks: number;
  readonly successfulChecks: number;
  readonly failedChecks: number;
  readonly degradedChecks: number;
  readonly averageResponseTime: number;
  readonly lastCheckTime: number;
  readonly uptime: number;
  readonly downtime: number;
}

/**
 * Service health state
 */
interface ServiceHealthState {
  readonly name: string;
  status: HealthStatus;
  lastCheck: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  statistics: HealthStatistics;
  circuitOpen: boolean;
  circuitOpenedAt?: number;
  degradedSince?: number;
}

/**
 * Recovery action
 */
interface RecoveryAction {
  readonly name: string;
  readonly condition: (state: ServiceHealthState) => boolean;
  readonly action: () => Promise<void>;
  readonly maxAttempts?: number;
  readonly attemptDelay?: number;
}

/**
 * Health monitor implementation
 */
export class HealthMonitor {
  private checks: Map<string, HealthCheck>;
  private states: Map<string, ServiceHealthState>;
  private recoveryActions: Map<string, RecoveryAction[]>;
  private options: Required<HealthMonitorOptions>;
  private intervals: Map<string, ReturnType<typeof setInterval>>;
  private disposed: boolean;
  private globalHealthStatus: HealthStatus;
  private lastGlobalCheck: number;

  constructor(options: HealthMonitorOptions = {}) {
    this.checks = new Map();
    this.states = new Map();
    this.recoveryActions = new Map();
    this.intervals = new Map();
    this.disposed = false;
    this.globalHealthStatus = 'healthy';
    this.lastGlobalCheck = 0;

    this.options = {
      checkInterval: options.checkInterval || 30000,
      timeout: options.timeout || 10000,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      autoRecovery: options.autoRecovery ?? true,
      degradationThreshold: options.degradationThreshold || 0.5,
      circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
      alertThreshold: options.alertThreshold || 0.8,
    };
  }

  /**
   * Initialize the health monitor
   */
  async initialize(options?: HealthMonitorOptions): Promise<void> {
    if (options) {
      this.options = { ...this.options, ...options };
    }

    // Start background health checks
    await this.startBackgroundChecks();
  }

  /**
   * Register a health check
   */
  registerCheck(name: string, check: HealthCheck): void {
    this.assertNotDisposed();

    this.checks.set(name, {
      ...check,
      name,
      enabled: check.enabled ?? true,
    });

    // Initialize state
    this.states.set(name, {
      name,
      status: 'healthy',
      lastCheck: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      statistics: {
        totalChecks: 0,
        successfulChecks: 0,
        failedChecks: 0,
        degradedChecks: 0,
        averageResponseTime: 0,
        lastCheckTime: 0,
        uptime: 0,
        downtime: 0,
      },
      circuitOpen: false,
    });

    // Start interval check if configured
    if (check.interval) {
      this.startIntervalCheck(name, check);
    }
  }

  /**
   * Unregister a health check
   */
  unregisterCheck(name: string): void {
    this.assertNotDisposed();

    this.checks.delete(name);
    this.states.delete(name);
    this.recoveryActions.delete(name);

    // Stop interval check
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
  }

  /**
   * Register a recovery action
   */
  registerRecoveryAction(checkName: string, action: RecoveryAction): void {
    this.assertNotDisposed();

    if (!this.recoveryActions.has(checkName)) {
      this.recoveryActions.set(checkName, []);
    }

    this.recoveryActions.get(checkName)!.push(action);
  }

  /**
   * Check a specific health check
   */
  async check(name: string): Promise<HealthCheckResult> {
    this.assertNotDisposed();

    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check ${name} not found`);
    }

    if (!check.enabled) {
      return {
        name,
        status: 'healthy',
        message: 'Health check disabled',
        timestamp: Date.now(),
      };
    }

    // Check circuit breaker
    const state = this.states.get(name)!;
    if (state.circuitOpen) {
      const circuitOpenDuration = Date.now() - (state.circuitOpenedAt || Date.now());
      const circuitHalfOpenAfter = this.options.checkInterval * 3;

      // Try to close circuit after timeout
      if (circuitOpenDuration > circuitHalfOpenAfter) {
        state.circuitOpen = false;
        state.circuitOpenedAt = undefined;
      } else {
        return {
          name,
          status: 'unhealthy',
          message: 'Circuit breaker is open',
          timestamp: Date.now(),
          details: {
            circuitOpen: true,
            circuitOpenDuration,
          },
        };
      }
    }

    // Perform health check with retry
    const startTime = Date.now();
    let result: HealthCheckResult;
    let attempts = 0;

    try {
      result = await retry(
        async () => {
          attempts++;
          const checkResult = await Promise.race([
            check.check(),
            delay(this.options.timeout).then(() => {
              throw new Error('Health check timeout');
            }),
          ]);

          return {
            name,
            status: checkResult.status,
            message: (checkResult as any).message,
            details: checkResult.details,
            timestamp: Date.now(),
          };
        },
        {
          attempts: check.retryAttempts || this.options.retryAttempts,
          delay: check.retryDelay || this.options.retryDelay,
        }
      );
    } catch (error) {
      result = {
        name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }

    const duration = Date.now() - startTime;

    // Update state
    await this.updateState(name, result, duration, attempts);

    // Check for degradation
    await this.checkDegradation(name);

    // Attempt recovery if needed
    if (result.status !== 'healthy' && this.options.autoRecovery) {
      await this.attemptRecovery(name);
    }

    return result;
  }

  /**
   * Check all registered health checks
   */
  async checkAll(): Promise<HealthCheckResult[]> {
    this.assertNotDisposed();

    const results: HealthCheckResult[] = [];

    for (const name of this.checks.keys()) {
      try {
        const result = await this.check(name);
        results.push(result);
      } catch (error) {
        results.push({
          name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        });
      }
    }

    // Update global health status
    this.updateGlobalHealthStatus(results);

    return results;
  }

  /**
   * Get health status for a specific check
   */
  getStatus(name: string): ServiceHealthState | undefined {
    return this.states.get(name);
  }

  /**
   * Get all health statuses
   */
  getAllStatuses(): Map<string, ServiceHealthState> {
    return new Map(this.states);
  }

  /**
   * Get global health status
   */
  getGlobalStatus(): {
    status: HealthStatus;
    timestamp: number;
    checks: {
      total: number;
      healthy: number;
      degraded: number;
      unhealthy: number;
    };
  } {
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;

    for (const state of this.states.values()) {
      if (state.status === 'healthy') healthy++;
      else if (state.status === 'degraded') degraded++;
      else unhealthy++;
    }

    return {
      status: this.globalHealthStatus,
      timestamp: this.lastGlobalCheck,
      checks: {
        total: this.states.size,
        healthy,
        degraded,
        unhealthy,
      },
    };
  }

  /**
   * Get health statistics for a check
   */
  getStatistics(name: string): HealthStatistics | undefined {
    const state = this.states.get(name);
    return state?.statistics;
  }

  /**
   * Get health report
   */
  async getReport(): Promise<{
    timestamp: number;
    globalStatus: HealthStatus;
    checks: Array<{
      name: string;
      status: HealthStatus;
      statistics: HealthStatistics;
      circuitOpen: boolean;
      lastCheck: number;
    }>;
    summary: {
      total: number;
      healthy: number;
      degraded: number;
      unhealthy: number;
      uptime: number;
      averageResponseTime: number;
    };
  }> {
    const results = await this.checkAll();

    const checks = Array.from(this.states.entries()).map(([name, state]) => ({
      name,
      status: state.status,
      statistics: state.statistics,
      circuitOpen: state.circuitOpen,
      lastCheck: state.lastCheck,
    }));

    let totalUptime = 0;
    let totalResponseTime = 0;
    let count = 0;

    for (const state of this.states.values()) {
      totalUptime += state.statistics.uptime;
      totalResponseTime += state.statistics.averageResponseTime;
      count++;
    }

    return {
      timestamp: Date.now(),
      globalStatus: this.globalHealthStatus,
      checks,
      summary: {
        total: this.states.size,
        healthy: checks.filter((c) => c.status === 'healthy').length,
        degraded: checks.filter((c) => c.status === 'degraded').length,
        unhealthy: checks.filter((c) => c.status === 'unhealthy').length,
        uptime: count > 0 ? totalUptime / count : 0,
        averageResponseTime: count > 0 ? totalResponseTime / count : 0,
      },
    };
  }

  /**
   * Reset health state for a check
   */
  async reset(name: string): Promise<void> {
    const state = this.states.get(name);
    if (state) {
      state.status = 'healthy';
      state.consecutiveFailures = 0;
      state.consecutiveSuccesses = 0;
      state.circuitOpen = false;
      state.circuitOpenedAt = undefined;
      state.degradedSince = undefined;
    }
  }

  /**
   * Reset all health states
   */
  async resetAll(): Promise<void> {
    for (const name of this.states.keys()) {
      await this.reset(name);
    }
  }

  /**
   * Manually open circuit breaker for a check
   */
  openCircuit(name: string): void {
    const state = this.states.get(name);
    if (state) {
      state.circuitOpen = true;
      state.circuitOpenedAt = Date.now();
    }
  }

  /**
   * Manually close circuit breaker for a check
   */
  closeCircuit(name: string): void {
    const state = this.states.get(name);
    if (state) {
      state.circuitOpen = false;
      state.circuitOpenedAt = undefined;
    }
  }

  /**
   * Dispose of health monitor
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Clear all intervals
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }

    this.intervals.clear();
    this.checks.clear();
    this.states.clear();
    this.recoveryActions.clear();
  }

  private async startBackgroundChecks(): Promise<void> {
    // Run global health check periodically
    setInterval(
      debounce(async () => {
        await this.checkAll();
      }, 1000),
      this.options.checkInterval
    );
  }

  private startIntervalCheck(name: string, check: HealthCheck): void {
    const interval = setInterval(async () => {
      try {
        await this.check(name);
      } catch (error) {
        console.error(`Error in interval check ${name}:`, error);
      }
    }, check.interval || this.options.checkInterval);

    this.intervals.set(name, interval);
  }

  private async updateState(
    name: string,
    result: HealthCheckResult,
    duration: number,
    attempts: number
  ): Promise<void> {
    const state = this.states.get(name)!;
    const now = Date.now();

    state.lastCheck = now;
    state.status = result.status;

    // Update statistics
    const stats = state.statistics;
    stats.totalChecks++;
    stats.lastCheckTime = now;

    if (result.status === 'healthy') {
      stats.successfulChecks++;
      state.consecutiveSuccesses++;
      state.consecutiveFailures = 0;
      stats.uptime += duration;
    } else if (result.status === 'degraded') {
      stats.degradedChecks++;
    } else {
      stats.failedChecks++;
      state.consecutiveFailures++;
      state.consecutiveSuccesses = 0;
      stats.downtime += duration;

      // Check if circuit breaker should open
      if (
        state.consecutiveFailures >= this.options.circuitBreakerThreshold
      ) {
        state.circuitOpen = true;
        state.circuitOpenedAt = now;
      }
    }

    // Update average response time
    stats.averageResponseTime =
      (stats.averageResponseTime * (stats.totalChecks - 1) + duration) /
      stats.totalChecks;
  }

  private async checkDegradation(name: string): Promise<void> {
    const state = this.states.get(name);
    if (!state) return;

    const stats = state.statistics;
    const failureRate = stats.failedChecks / stats.totalChecks;

    // Check if service is degraded
    if (
      failureRate > this.options.degradationThreshold &&
      state.status !== 'unhealthy'
    ) {
      state.status = 'degraded';

      if (!state.degradedSince) {
        state.degradedSince = Date.now();
      }
    } else if (failureRate < this.options.degradationThreshold * 0.5) {
      // Clear degradation if failure rate drops significantly
      state.degradedSince = undefined;
    }
  }

  private async attemptRecovery(name: string): Promise<void> {
    const state = this.states.get(name);
    const actions = this.recoveryActions.get(name);

    if (!state || !actions || actions.length === 0) {
      return;
    }

    for (const action of actions) {
      // Check if recovery action should be triggered
      if (action.condition(state)) {
        try {
          console.log(`Attempting recovery action ${action.name} for ${name}`);
          await action.action();

          // Reset failures on successful recovery
          state.consecutiveFailures = 0;

          break;
        } catch (error) {
          console.error(
            `Recovery action ${action.name} failed for ${name}:`,
            error
          );
        }
      }
    }
  }

  private updateGlobalHealthStatus(results: HealthCheckResult[]): void {
    this.lastGlobalCheck = Date.now();

    let unhealthyCount = 0;
    let degradedCount = 0;

    for (const result of results) {
      if (result.status === 'unhealthy') {
        unhealthyCount++;
      } else if (result.status === 'degraded') {
        degradedCount++;
      }
    }

    const total = results.length;
    const unhealthyRate = total > 0 ? unhealthyCount / total : 0;
    const degradedRate = total > 0 ? degradedCount / total : 0;

    if (unhealthyRate > 0.5) {
      this.globalHealthStatus = 'unhealthy';
    } else if (degradedRate > 0.3 || unhealthyRate > 0) {
      this.globalHealthStatus = 'degraded';
    } else {
      this.globalHealthStatus = 'healthy';
    }
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('HealthMonitor has been disposed');
    }
  }
}

/**
 * Create default health checks
 */
export function createDefaultHealthChecks(): Record<
  string,
  Omit<HealthCheck, 'name'>
> {
  return {
    memory: {
      check: async () => {
        if (
          typeof performance !== 'undefined' &&
          (performance as any).memory
        ) {
          const memory = (performance as any).memory;
          const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

          return {
            status: usage > 0.9 ? 'degraded' : usage > 0.95 ? 'unhealthy' : 'healthy',
            details: {
              usage: usage * 100,
              used: memory.usedJSHeapSize,
              total: memory.jsHeapSizeLimit,
            },
          };
        }

        return { status: 'healthy' };
      },
      interval: 30000,
      critical: true,
    },

    cpu: {
      check: async () => {
        // CPU monitoring would be implemented based on environment
        return { status: 'healthy' };
      },
      interval: 30000,
    },

    latency: {
      check: async () => {
        const start = Date.now();
        await delay(1);
        const duration = Date.now() - start;

        return {
          status: duration > 100 ? 'degraded' : 'healthy',
          details: { latency: duration },
        };
      },
      interval: 10000,
    },

    connections: {
      check: async () => {
        // Connection pool monitoring
        return { status: 'healthy' };
      },
      interval: 30000,
    },
  };
}

/**
 * Create a health monitor with default checks
 */
export function createHealthMonitor(
  options?: HealthMonitorOptions
): HealthMonitor {
  const monitor = new HealthMonitor(options);
  const defaultChecks = createDefaultHealthChecks();

  for (const [name, check] of Object.entries(defaultChecks)) {
    monitor.registerCheck(name, { ...check, name });
  }

  return monitor;
}
