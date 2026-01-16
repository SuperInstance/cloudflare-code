// @ts-nocheck
import { EventEmitter } from 'events';
import axios from 'axios';
import { HealthStatus } from '../types';
import { Logger } from '../utils/logger';
import { sleep } from '../utils/helpers';

export class HealthMonitor extends EventEmitter {
  private logger: Logger;
  private serviceConfigs: any[];
  private healthChecks: Map<string, HealthCheck> = new Map();
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(serviceConfigs: any[]) {
    super();
    this.serviceConfigs = serviceConfigs;
    this.logger = new Logger('HealthMonitor');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Health Monitor is already running');
    }

    this.logger.info('Starting Health Monitor...');

    try {
      // Initialize health checks for all services
      for (const serviceConfig of this.serviceConfigs) {
        await this.initializeHealthCheck(serviceConfig);
      }

      // Start periodic health checks
      this.startPeriodicChecks();

      this.isRunning = true;
      this.logger.info('Health Monitor started successfully');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start Health Monitor', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Health Monitor...');

    try {
      // Stop periodic checks
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      // Stop all health checks
      for (const healthCheck of this.healthChecks.values()) {
        healthCheck.stop();
      }
      this.healthChecks.clear();

      this.isRunning = false;
      this.logger.info('Health Monitor stopped successfully');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error during Health Monitor shutdown', { error });
      throw error;
    }
  }

  async checkServiceHealth(serviceConfig: any): Promise<HealthStatus> {
    const healthCheck = this.healthChecks.get(serviceConfig.id);
    if (!healthCheck) {
      throw new Error(`Health check not found for service: ${serviceConfig.name}`);
    }

    return healthCheck.check();
  }

  async getHealthStatus(serviceId?: string): Promise<HealthStatus | HealthStatus[]> {
    if (serviceId) {
      const healthCheck = this.healthChecks.get(serviceId);
      if (!healthCheck) {
        throw new Error(`Health check not found for service: ${serviceId}`);
      }
      return healthCheck.getLastStatus();
    }

    const statuses: HealthStatus[] = [];
    for (const healthCheck of this.healthChecks.values()) {
      const status = healthCheck.getLastStatus();
      if (status) {
        statuses.push(status);
      }
    }
    return statuses;
  }

  async forceHealthCheck(serviceId: string): Promise<HealthStatus> {
    const healthCheck = this.healthChecks.get(serviceId);
    if (!healthCheck) {
      throw new Error(`Health check not found for service: ${serviceId}`);
    }

    return await healthCheck.check();
  }

  private async initializeHealthCheck(serviceConfig: any): Promise<void> {
    const healthCheck = new HealthCheck(serviceConfig, this.logger);

    healthCheck.on('statusUpdate', (status: HealthStatus) => {
      this.emit('healthUpdate', status);
    });

    await healthCheck.start();
    this.healthChecks.set(serviceConfig.id, healthCheck);
    this.logger.debug(`Initialized health check for service: ${serviceConfig.name}`);
  }

  private startPeriodicChecks(): void {
    // Use the minimum interval from all services
    const minInterval = Math.min(...this.serviceConfigs.map(config => config.healthCheck.interval));

    this.intervalId = setInterval(async () => {
      try {
        for (const healthCheck of this.healthChecks.values()) {
          await healthCheck.check();
        }
      } catch (error) {
        this.logger.error('Periodic health check failed', { error });
      }
    }, minInterval);

    this.logger.debug(`Started periodic health checks with interval: ${minInterval}ms`);
  }

  async getStats(): Promise<any> {
    const stats = {
      totalServices: this.healthChecks.size,
      services: {} as Record<string, any>,
      summary: {
        healthy: 0,
        unhealthy: 0,
        degraded: 0
      }
    };

    for (const [serviceId, healthCheck] of this.healthChecks) {
      const status = healthCheck.getLastStatus();
      if (status) {
        stats.services[serviceId] = {
          service: status.service,
          status: status.status,
          lastCheck: status.lastCheck,
          responseTime: status.responseTime,
          errorRate: status.errorRate,
          uptime: status.uptime
        };

        stats.summary[status.status]++;
      }
    }

    return stats;
  }
}

class HealthCheck extends EventEmitter {
  private serviceConfig: any;
  private logger: Logger;
  private status: HealthStatus | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private isRunning = false;

  constructor(serviceConfig: any, logger: Logger) {
    super();
    this.serviceConfig = serviceConfig;
    this.logger = logger;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Health check is already running');
    }

    this.isRunning = true;
    this.status = this.createInitialStatus();

    // Start periodic checks
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.serviceConfig.healthCheck.interval);

    // Perform initial check
    await this.performHealthCheck();
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isRunning = false;
    this.logger.debug(`Stopped health check for service: ${this.serviceConfig.name}`);
  }

  async check(): Promise<HealthStatus> {
    return await this.performHealthCheck();
  }

  getLastStatus(): HealthStatus | null {
    return this.status;
  }

  private async performHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    let newStatus: HealthStatus;

    try {
      const response = await axios.get(
        `http://${this.serviceConfig.host}:${this.serviceConfig.port}${this.serviceConfig.healthCheck.endpoint}`,
        {
          timeout: this.serviceConfig.healthCheck.timeout
        }
      );

      const responseTime = Date.now() - startTime;

      // Check if service is healthy based on response
      let isHealthy = response.status >= 200 && response.status < 400;
      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

      if (!isHealthy) {
        status = 'unhealthy';
      } else if (responseTime > this.serviceConfig.healthCheck.timeout * 0.8) {
        status = 'degraded';
      }

      newStatus = {
        service: this.serviceConfig.name,
        status,
        lastCheck: new Date(),
        uptime: this.status ? this.status.uptime + 1 : 0,
        responseTime,
        errorRate: status === 'healthy' ? 0 : 100,
        cpuUsage: response.data.cpuUsage || 0,
        memoryUsage: response.data.memoryUsage || 0
      };

      this.consecutiveSuccesses++;
      this.consecutiveFailures = 0;

      // Check if we should upgrade status (e.g., degraded -> healthy)
      if (this.status && this.status.status === 'degraded' && status === 'healthy') {
        if (this.consecutiveSuccesses >= this.serviceConfig.healthCheck.healthyThreshold) {
          newStatus.status = 'healthy';
        }
      }

    } catch (error) {
      this.consecutiveFailures++;
      this.consecutiveSuccesses = 0;

      // Determine status based on consecutive failures
      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

      if (this.consecutiveFailures >= this.serviceConfig.healthCheck.unhealthyThreshold) {
        status = 'unhealthy';
      } else if (this.consecutiveFailures > 0) {
        status = 'degraded';
      }

      newStatus = {
        service: this.serviceConfig.name,
        status,
        lastCheck: new Date(),
        uptime: this.status ? this.status.uptime + 1 : 0,
        responseTime: 0,
        errorRate: 100,
        cpuUsage: 0,
        memoryUsage: 0
      };

      this.logger.debug(`Health check failed for service: ${this.serviceConfig.name}`, {
        error: error.message,
        consecutiveFailures: this.consecutiveFailures
      });
    }

    // Update status
    this.status = newStatus;

    // Emit event if status changed
    if (!this.status || this.status.status !== newStatus.status) {
      this.emit('statusUpdate', newStatus);
    }

    return newStatus;
  }

  private createInitialStatus(): HealthStatus {
    return {
      service: this.serviceConfig.name,
      status: 'healthy',
      lastCheck: new Date(),
      uptime: 0,
      responseTime: 0,
      errorRate: 0,
      cpuUsage: 0,
      memoryUsage: 0
    };
  }
}

// System health monitor
export class SystemHealthMonitor {
  private logger: Logger;
  private metrics: SystemMetrics;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.logger = new Logger('SystemHealthMonitor');
    this.metrics = new SystemMetrics();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('System Health Monitor is already running');
    }

    this.logger.info('Starting System Health Monitor...');

    try {
      // Start metrics collection
      await this.metrics.start();

      // Start periodic system health checks
      this.startSystemChecks();

      this.isRunning = true;
      this.logger.info('System Health Monitor started successfully');
    } catch (error) {
      this.logger.error('Failed to start System Health Monitor', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping System Health Monitor...');

    try {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      await this.metrics.stop();

      this.isRunning = false;
      this.logger.info('System Health Monitor stopped successfully');
    } catch (error) {
      this.logger.error('Error during System Health Monitor shutdown', { error });
      throw error;
    }
  }

  async getSystemHealth(): Promise<any> {
    return {
      timestamp: new Date(),
      status: await this.getOverallStatus(),
      metrics: await this.metrics.getLatestMetrics(),
      recommendations: await this.generateRecommendations()
    };
  }

  private async startSystemChecks(): Promise<void> {
    this.intervalId = setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        this.logger.debug('System health check completed', {
          status: health.status,
          cpu: health.metrics.cpu,
          memory: health.metrics.memory
        });

        // Alert on critical issues
        if (health.status === 'critical') {
          this.logger.error('System health critical - immediate attention required', health);
        }
      } catch (error) {
        this.logger.error('System health check failed', { error });
      }
    }, 30000); // Every 30 seconds
  }

  private async getOverallStatus(): Promise<'healthy' | 'degraded' | 'unhealthy' | 'critical'> {
    const metrics = await this.metrics.getLatestMetrics();

    if (metrics.cpu > 90 || metrics.memory > 90) {
      return 'critical';
    }

    if (metrics.cpu > 80 || metrics.memory > 80) {
      return 'unhealthy';
    }

    if (metrics.cpu > 60 || metrics.memory > 60) {
      return 'degraded';
    }

    return 'healthy';
  }

  private async generateRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    const metrics = await this.metrics.getLatestMetrics();

    if (metrics.cpu > 80) {
      recommendations.push('High CPU usage detected. Consider scaling up resources or optimizing application performance.');
    }

    if (metrics.memory > 80) {
      recommendations.push('High memory usage detected. Check for memory leaks or consider increasing memory allocation.');
    }

    if (metrics.diskUsage > 80) {
      recommendations.push('High disk usage detected. Consider cleaning up temporary files or increasing disk space.');
    }

    if (metrics.networkLoad > 80) {
      recommendations.push('High network load detected. Consider implementing caching or load balancing.');
    }

    return recommendations;
  }
}

class SystemMetrics {
  private isRunning = false;
  private metrics: any = {
    cpu: 0,
    memory: 0,
    diskUsage: 0,
    networkLoad: 0,
    timestamp: new Date()
  };

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.collectMetrics();
    setInterval(() => this.collectMetrics(), 5000);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  async collectMetrics(): Promise<void> {
    try {
      // In a real implementation, this would use system libraries
      // For now, we'll simulate metrics
      this.metrics = {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        diskUsage: Math.random() * 100,
        networkLoad: Math.random() * 100,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Failed to collect system metrics', error);
    }
  }

  async getLatestMetrics(): Promise<any> {
    return this.metrics;
  }
}

// Event emitter interface
export interface HealthMonitorEvents {
  healthUpdate: (status: HealthStatus) => void;
  started: () => void;
  stopped: () => void;
}

// Extend HealthMonitor with EventEmitter functionality
export interface HealthMonitor extends NodeJS.EventEmitter {
  on(event: 'healthUpdate', listener: (status: HealthStatus) => void): this;
  on(event: 'started', listener: () => void): this;
  on(event: 'stopped', listener: () => void): this;

  emit(event: 'healthUpdate', status: HealthStatus): boolean;
  emit(event: 'started'): boolean;
  emit(event: 'stopped'): boolean;
}