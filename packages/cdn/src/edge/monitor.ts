/**
 * Edge Monitor
 *
 * Monitor edge deployments with health checks and metrics.
 */

import { EventEmitter } from 'events';
import type { IDeploymentResult } from '../types/index.js';

interface IMonitoringConfig {
  checkInterval: number;
  timeout: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
}

interface IHealthCheck {
  deploymentId: string;
  url: string;
  healthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export class EdgeMonitor extends EventEmitter {
  private healthChecks: Map<string, IHealthCheck>;
  private config: IMonitoringConfig;
  private intervals: Map<string, NodeJS.Timeout>;

  constructor(config?: Partial<IMonitoringConfig>) {
    super();

    this.config = {
      checkInterval: config?.checkInterval ?? 60000, // 1 minute
      timeout: config?.timeout ?? 5000, // 5 seconds
      unhealthyThreshold: config?.unhealthyThreshold ?? 3,
      healthyThreshold: config?.healthyThreshold ?? 2
    };

    this.healthChecks = new Map();
    this.intervals = new Map();
  }

  /**
   * Start monitoring deployment
   */
  public startMonitoring(deployment: IDeploymentResult): void {
    const healthCheck: IHealthCheck = {
      deploymentId: deployment.deploymentId,
      url: deployment.url,
      healthy: false,
      lastCheck: new Date(),
      consecutiveFailures: 0,
      consecutiveSuccesses: 0
    };

    this.healthChecks.set(deployment.deploymentId, healthCheck);

    // Start periodic health checks
    const interval = setInterval(async () => {
      await this.performHealthCheck(deployment.deploymentId);
    }, this.config.checkInterval);

    this.intervals.set(deployment.deploymentId, interval);

    // Perform initial check
    this.performHealthCheck(deployment.deploymentId);
  }

  /**
   * Stop monitoring deployment
   */
  public stopMonitoring(deploymentId: string): void {
    const interval = this.intervals.get(deploymentId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(deploymentId);
    }

    this.healthChecks.delete(deploymentId);
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(deploymentId: string): Promise<void> {
    const healthCheck = this.healthChecks.get(deploymentId);
    if (!healthCheck) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(healthCheck.url, {
        signal: controller.signal,
        method: 'HEAD'
      });

      clearTimeout(timeoutId);

      const isHealthy = response.ok;

      healthCheck.lastCheck = new Date();

      if (isHealthy) {
        healthCheck.consecutiveSuccesses++;
        healthCheck.consecutiveFailures = 0;

        if (!healthCheck.healthy && healthCheck.consecutiveSuccesses >= this.config.healthyThreshold) {
          healthCheck.healthy = true;
          this.emit('healthy', deploymentId);
        }
      } else {
        healthCheck.consecutiveFailures++;
        healthCheck.consecutiveSuccesses = 0;

        if (healthCheck.healthy && healthCheck.consecutiveFailures >= this.config.unhealthyThreshold) {
          healthCheck.healthy = false;
          this.emit('unhealthy', deploymentId);
        }
      }

      this.emit('check', deploymentId, isHealthy);
    } catch (error) {
      healthCheck.consecutiveFailures++;
      healthCheck.consecutiveSuccesses = 0;
      healthCheck.lastCheck = new Date();

      if (healthCheck.healthy && healthCheck.consecutiveFailures >= this.config.unhealthyThreshold) {
        healthCheck.healthy = false;
        this.emit('unhealthy', deploymentId);
      }

      this.emit('check', deploymentId, false);
    }
  }

  /**
   * Get health status
   */
  public getHealthStatus(deploymentId: string): IHealthCheck | null {
    return this.healthChecks.get(deploymentId) ?? null;
  }

  /**
   * Get all health statuses
   */
  public getAllHealthStatuses(): IHealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get healthy deployments
   */
  public getHealthyDeployments(): string[] {
    return Array.from(this.healthChecks.values())
      .filter(hc => hc.healthy)
      .map(hc => hc.deploymentId);
  }

  /**
   * Get unhealthy deployments
   */
  public getUnhealthyDeployments(): string[] {
    return Array.from(this.healthChecks.values())
      .filter(hc => !hc.healthy)
      .map(hc => hc.deploymentId);
  }

  /**
   * Get monitoring statistics
   */
  public getStatistics(): {
    total: number;
    healthy: number;
    unhealthy: number;
    avgResponseTime: number;
    uptime: number;
  } {
    const healthChecks = Array.from(this.healthChecks.values());
    const healthy = healthChecks.filter(hc => hc.healthy).length;

    // Simplified statistics
    return {
      total: healthChecks.length,
      healthy,
      unhealthy: healthChecks.length - healthy,
      avgResponseTime: 0,
      uptime: healthChecks.length > 0 ? (healthy / healthChecks.length) * 100 : 0
    };
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }

    this.healthChecks.clear();
    this.intervals.clear();
    this.removeAllListeners();
  }
}

export default EdgeMonitor;
