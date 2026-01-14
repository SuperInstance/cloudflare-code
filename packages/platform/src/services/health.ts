/**
 * Health Monitoring
 *
 * Comprehensive health monitoring for all platform services.
 */

import type {
  ResourceId,
  ServiceHealth,
  HealthCheckResult,
} from '../types/core';

/**
 * Health monitor configuration
 */
export interface HealthMonitorConfig {
  readonly checkInterval: number;
  readonly timeout: number;
  readonly retries: number;
  readonly alertThreshold: number;
}

/**
 * Health check definition
 */
export interface HealthCheck {
  readonly name: string;
  readonly check: () => Promise<boolean>;
  readonly timeout: number;
  readonly critical: boolean;
}

/**
 * Health monitor
 */
export class HealthMonitor {
  private checks: Map<ResourceId, HealthCheck[]>;
  private results: Map<ResourceId, HealthCheckResult>;
  private config: HealthMonitorConfig;
  private intervalId: ReturnType<typeof setInterval> | null;

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.checks = new Map();
    this.results = new Map();
    this.intervalId = null;

    this.config = {
      checkInterval: 30000,
      timeout: 5000,
      retries: 3,
      alertThreshold: 3,
      ...config,
    };
  }

  /**
   * Register a health check for a service
   */
  registerHealthCheck(serviceId: ResourceId, check: HealthCheck): void {
    if (!this.checks.has(serviceId)) {
      this.checks.set(serviceId, []);
    }

    this.checks.get(serviceId)!.push(check);
  }

  /**
   * Unregister health checks for a service
   */
  unregisterHealthCheck(serviceId: ResourceId): void {
    this.checks.delete(serviceId);
    this.results.delete(serviceId);
  }

  /**
   * Check health of a specific service
   */
  async checkHealth(serviceId: ResourceId): Promise<HealthCheckResult> {
    const checks = this.checks.get(serviceId) || [];
    const results: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      duration?: number;
    }> = [];

    let overallStatus: ServiceHealth = 'healthy' as ServiceHealth;

    for (const check of checks) {
      const startTime = Date.now();

      try {
        const result = await this.withTimeout(
          check.check(),
          check.timeout
        );

        const duration = Date.now() - startTime;
        const status = result ? 'pass' : 'fail';

        results.push({
          name: check.name,
          status,
          duration,
        });

        if (!result && check.critical) {
          overallStatus = 'unhealthy' as ServiceHealth;
        } else if (!result) {
          overallStatus = 'degraded' as ServiceHealth;
        }
      } catch (error) {
        const duration = Date.now() - startTime;

        results.push({
          name: check.name,
          status: 'fail',
          message: error instanceof Error ? error.message : 'Unknown error',
          duration,
        });

        if (check.critical) {
          overallStatus = 'unhealthy' as ServiceHealth;
        } else {
          overallStatus = 'degraded' as ServiceHealth;
        }
      }
    }

    const healthResult: HealthCheckResult = {
      serviceId,
      status: overallStatus,
      checks: results,
      timestamp: Date.now(),
    };

    this.results.set(serviceId, healthResult);

    return healthResult;
  }

  /**
   * Check health of all services
   */
  async checkAllHealth(): Promise<HealthCheckResult[]> {
    const serviceIds = Array.from(this.checks.keys());
    const results: HealthCheckResult[] = [];

    for (const serviceId of serviceIds) {
      const result = await this.checkHealth(serviceId);
      results.push(result);
    }

    return results;
  }

  /**
   * Get latest health check result
   */
  getHealthResult(serviceId: ResourceId): HealthCheckResult | undefined {
    return this.results.get(serviceId);
  }

  /**
   * Get all health check results
   */
  getAllHealthResults(): ReadonlyMap<ResourceId, HealthCheckResult> {
    return this.results;
  }

  /**
   * Start periodic health checks
   */
  start(): void {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(async () => {
      await this.checkAllHealth();
    }, this.config.checkInterval);
  }

  /**
   * Stop periodic health checks
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Get services with unhealthy status
   */
  getUnhealthyServices(): ResourceId[] {
    const unhealthy: ResourceId[] = [];

    for (const [serviceId, result] of this.results.entries()) {
      if (result.status === 'unhealthy') {
        unhealthy.push(serviceId);
      }
    }

    return unhealthy;
  }

  /**
   * Get services with degraded status
   */
  getDegradedServices(): ResourceId[] {
    const degraded: ResourceId[] = [];

    for (const [serviceId, result] of this.results.entries()) {
      if (result.status === 'degraded') {
        degraded.push(serviceId);
      }
    }

    return degraded;
  }

  /**
   * Get health summary
   */
  getSummary(): {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  } {
    const total = this.results.size;
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;

    for (const result of this.results.values()) {
      switch (result.status) {
        case 'healthy':
          healthy++;
          break;
        case 'degraded':
          degraded++;
          break;
        case 'unhealthy':
          unhealthy++;
          break;
      }
    }

    return { total, healthy, degraded, unhealthy };
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Health check timeout after ${timeout}ms`));
      }, timeout);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutHandle!);
      return result;
    } catch (error) {
      clearTimeout(timeoutHandle!);
      throw error;
    }
  }
}

/**
 * Predefined health checks
 */
export const healthChecks = {
  /**
   * HTTP endpoint health check
   */
  http: (
    url: string,
    expectedStatus = 200
  ): HealthCheck => ({
    name: `http-${url}`,
    check: async () => {
      try {
        const response = await fetch(url);
        return response.status === expectedStatus;
      } catch {
        return false;
      }
    },
    timeout: 5000,
    critical: true,
  }),

  /**
   * KV storage health check
   */
  kv: (
    get: (key: string) => Promise<unknown>,
    key: string = '__health_check__'
  ): HealthCheck => ({
    name: 'kv-storage',
    check: async () => {
      try {
        await get(key);
        return true;
      } catch {
        return false;
      }
    },
    timeout: 3000,
    critical: true,
  }),

  /**
   * Durable Object health check
   */
  durableObject: (
    stub: DurableObjectStub,
    method: string
  ): HealthCheck => ({
    name: `durable-object-${method}`,
    check: async () => {
      try {
        await stub[method]();
        return true;
      } catch {
        return false;
      }
    },
    timeout: 5000,
    critical: true,
  }),

  /**
   * Memory health check
   */
  memory: (threshold = 0.9): HealthCheck => ({
    name: 'memory-usage',
    check: async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Cloudflare Workers specific
      const used = typeof performance !== 'undefined'
        ? // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          performance.measureUsedMemory?.() || 0
        : 0;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const limit = typeof performance !== 'undefined'
        ? // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          performance.measureMemory?.() || 128 * 1024 * 1024
        : 128 * 1024 * 1024;

      return used / limit < threshold;
    },
    timeout: 100,
    critical: false,
  }),

  /**
   * Custom function health check
   */
  custom: (
    name: string,
    check: () => Promise<boolean>,
    options: Partial<Pick<HealthCheck, 'timeout' | 'critical'>> = {}
  ): HealthCheck => ({
    name,
    check,
    timeout: options.timeout || 5000,
    critical: options.critical || false,
  }),
};

/**
 * Export singleton instance
 */
export const healthMonitor = new HealthMonitor();
