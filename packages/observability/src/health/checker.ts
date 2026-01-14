/**
 * Health Check System
 * Provides liveness, readiness, and startup probes with dependency monitoring
 */

import { EventEmitter } from 'eventemitter3';
import {
  HealthCheckResult,
  HealthStatus,
  HealthCheck,
  HealthCheckStatus,
  HealthCheckConfig,
  HealthCheckType,
  HealthIndicator,
  HealthCheckValue
} from '../types';

export class HealthChecker extends EventEmitter {
  private checks: Map<string, HealthCheckConfig> = new Map();
  private results: Map<string, HealthCheckValue> = new Map();
  private dependencies: Map<string, HealthChecker> = new Map();
  private lastCheck = 0;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(private serviceName: string) {
    super();
  }

  registerCheck(config: HealthCheckConfig): void {
    this.checks.set(config.type, config);
    this.emit('check:registered', config);
  }

  unregisterCheck(type: HealthCheckType): boolean {
    const deleted = this.checks.delete(type);
    if (deleted) {
      this.emit('check:unregistered', type);
    }
    return deleted;
  }

  addDependency(name: string, checker: HealthChecker): void {
    this.dependencies.set(name, checker);
  }

  async check(): Promise<HealthCheckResult> {
    const checks: Record<string, HealthCheck> = {};
    let overallStatus: HealthStatus = 'healthy';

    for (const [type, config] of this.checks) {
      const result = await this.runCheck(config);
      checks[type] = result;
      
      if (result.status === 'fail') {
        overallStatus = 'unhealthy';
      } else if (result.status === 'warn' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }

    const healthResult: HealthCheckResult = {
      status: overallStatus,
      checks,
      timestamp: Date.now(),
      version: process.env.APP_VERSION,
    };

    this.lastCheck = healthResult.timestamp;
    this.emit('health:checked', healthResult);

    return healthResult;
  }

  async runCheck(config: HealthCheckConfig): Promise<HealthCheck> {
    const start = Date.now();
    
    if (!config.enabled) {
      return {
        name: config.type,
        status: 'pass',
        duration: 0,
      };
    }

    try {
      const result = await this.executeCheck(config);
      return {
        name: config.type,
        status: result.healthy ? 'pass' : 'fail',
        message: result.message,
        duration: Date.now() - start,
        data: result.data,
      };
    } catch (error) {
      return {
        name: config.type,
        status: 'fail',
        message: (error as Error).message,
        duration: Date.now() - start,
      };
    }
  }

  private async executeCheck(config: HealthCheckConfig): Promise<HealthCheckValue> {
    switch (config.type) {
      case 'liveness':
        return this.checkLiveness(config);
      case 'readiness':
        return this.checkReadiness(config);
      case 'startup':
        return this.checkStartup(config);
      case 'custom':
        return this.checkCustom(config);
      default:
        return { healthy: true, message: 'Unknown check type' };
    }
  }

  private async checkLiveness(config: HealthCheckConfig): Promise<HealthCheckValue> {
    return { healthy: true, message: 'Service is alive', data: {} };
  }

  private async checkReadiness(config: HealthCheckConfig): Promise<HealthCheckValue> {
    const isReady = await this.checkDependencies();
    return {
      healthy: isReady,
      message: isReady ? 'Service is ready' : 'Dependencies not ready',
      data: { dependenciesReady: isReady },
    };
  }

  private async checkStartup(config: HealthCheckConfig): Promise<HealthCheckValue> {
    const uptime = process.uptime();
    const startupTime = parseInt(config.config.startupTime?.toString() || '30');
    const isStarted = uptime > startupTime;
    
    return {
      healthy: isStarted,
      message: isStarted ? 'Service started' : 'Service starting',
      data: { uptime, startupTime },
    };
  }

  private async checkCustom(config: HealthCheckConfig): Promise<HealthCheckValue> {
    const checkFn = config.config.check as (() => Promise<HealthCheckValue>);
    if (typeof checkFn === 'function') {
      return checkFn();
    }
    return { healthy: true, message: 'Custom check passed' };
  }

  private async checkDependencies(): Promise<boolean> {
    for (const [name, checker] of this.dependencies) {
      const result = await checker.check();
      if (result.status !== 'healthy') {
        return false;
      }
    }
    return true;
  }

  startPeriodicChecks(intervalMs: number): void {
    if (this.checkInterval) {
      this.stopPeriodicChecks();
    }

    this.checkInterval = setInterval(async () => {
      try {
        await this.check();
      } catch (error) {
        this.emit('check:error', error);
      }
    }, intervalMs);
  }

  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  getLastCheck(): number {
    return this.lastCheck;
  }

  getChecks(): HealthCheckConfig[] {
    return Array.from(this.checks.values());
  }
}

export class HealthIndicatorRegistry {
  private indicators: Map<string, HealthIndicator> = new Map();

  register(name: string, check: () => Promise<HealthCheckValue>): void {
    this.indicators.set(name, {
      name,
      check,
    });
  }

  unregister(name: string): boolean {
    return this.indicators.delete(name);
  }

  async checkAll(): Promise<Record<string, HealthCheckValue>> {
    const results: Record<string, HealthCheckValue> = {};
    
    for (const [name, indicator] of this.indicators) {
      try {
        results[name] = await indicator.check();
      } catch (error) {
        results[name] = {
          healthy: false,
          message: (error as Error).message,
        };
      }
    }
    
    return results;
  }

  async checkOne(name: string): Promise<HealthCheckValue> {
    const indicator = this.indicators.get(name);
    if (!indicator) {
      return { healthy: false, message: 'Indicator not found' };
    }
    
    try {
      return await indicator.check();
    } catch (error) {
      return {
        healthy: false,
        message: (error as Error).message,
      };
    }
  }

  getIndicators(): string[] {
    return Array.from(this.indicators.keys());
  }
}
