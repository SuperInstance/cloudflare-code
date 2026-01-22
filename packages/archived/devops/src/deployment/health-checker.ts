/**
 * Health checker for deployments
 */

import { HealthCheck, HealthStatus } from '../types';
import { Logger } from '../utils/logger';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  responseTime?: number;
  timestamp: Date;
}

export class HealthChecker {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Perform a health check
   */
  async check(healthCheck: HealthCheck, version: string): Promise<HealthCheckResult> {
    const startTime = Date.now();

    this.logger.info('Performing health check', {
      name: healthCheck.name,
      type: healthCheck.type,
      version,
    });

    try {
      let result: HealthCheckResult;

      switch (healthCheck.type) {
        case 'http':
          result = await this.checkHttp(healthCheck, version);
          break;
        case 'tcp':
          result = await this.checkTcp(healthCheck, version);
          break;
        case 'command':
          result = await this.checkCommand(healthCheck, version);
          break;
        case 'custom':
          result = await this.checkCustom(healthCheck, version);
          break;
        default:
          throw new Error(`Unsupported health check type: ${healthCheck.type}`);
      }

      result.responseTime = Date.now() - startTime;
      result.timestamp = new Date();

      this.logger.info('Health check completed', {
        name: healthCheck.name,
        status: result.status,
        responseTime: result.responseTime,
      });

      return result;
    } catch (error: any) {
      return {
        name: healthCheck.name,
        status: HealthStatus.UNHEALTHY,
        message: error.message,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * HTTP health check
   */
  private async checkHttp(
    healthCheck: HealthCheck,
    version: string
  ): Promise<HealthCheckResult> {
    const config = healthCheck.config as any;
    const url = `${config.protocol}://${config.host}${config.port ? ':' + config.port : ''}${config.path}`;

    try {
      const response = await axios.get(url, {
        headers: config.headers || {},
        timeout: healthCheck.timeout,
        validateStatus: () => true, // Don't throw on any status
      });

      const expectedStatus = config.expectedStatus || 200;
      const statusMatch = response.status === expectedStatus;

      let bodyMatch = true;
      if (config.expectedBody) {
        bodyMatch = response.data.includes(config.expectedBody);
      }

      if (statusMatch && bodyMatch) {
        return {
          name: healthCheck.name,
          status: HealthStatus.HEALTHY,
          message: `HTTP ${response.status} OK`,
        };
      } else if (!statusMatch) {
        return {
          name: healthCheck.name,
          status: HealthStatus.UNHEALTHY,
          message: `Expected status ${expectedStatus}, got ${response.status}`,
        };
      } else {
        return {
          name: healthCheck.name,
          status: HealthStatus.UNHEALTHY,
          message: 'Expected body not found in response',
        };
      }
    } catch (error: any) {
      return {
        name: healthCheck.name,
        status: HealthStatus.UNHEALTHY,
        message: `HTTP request failed: ${error.message}`,
      };
    }
  }

  /**
   * TCP health check
   */
  private async checkTcp(
    healthCheck: HealthCheck,
    version: string
  ): Promise<HealthCheckResult> {
    const config = healthCheck.config as any;
    const net = require('net');

    return new Promise((resolve) => {
      const socket = new net.Socket();

      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({
          name: healthCheck.name,
          status: HealthStatus.UNHEALTHY,
          message: 'Connection timeout',
        });
      }, healthCheck.timeout);

      socket.connect(config.port, config.host, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({
          name: healthCheck.name,
          status: HealthStatus.HEALTHY,
          message: 'TCP connection successful',
        });
      });

      socket.on('error', (error: Error) => {
        clearTimeout(timeout);
        resolve({
          name: healthCheck.name,
          status: HealthStatus.UNHEALTHY,
          message: `TCP connection failed: ${error.message}`,
        });
      });
    });
  }

  /**
   * Command health check
   */
  private async checkCommand(
    healthCheck: HealthCheck,
    version: string
  ): Promise<HealthCheckResult> {
    const config = healthCheck.config as any;

    try {
      const { stdout, stderr } = await execAsync(config.command, {
        timeout: healthCheck.timeout,
        env: { ...process.env, ...config.env },
      });

      if (stderr) {
        return {
          name: healthCheck.name,
          status: HealthStatus.DEGRADED,
          message: `Command executed with warnings: ${stderr}`,
        };
      }

      return {
        name: healthCheck.name,
        status: HealthStatus.HEALTHY,
        message: 'Command executed successfully',
      };
    } catch (error: any) {
      return {
        name: healthCheck.name,
        status: HealthStatus.UNHEALTHY,
        message: `Command failed: ${error.message}`,
      };
    }
  }

  /**
   * Custom health check
   */
  private async checkCustom(
    healthCheck: HealthCheck,
    version: string
  ): Promise<HealthCheckResult> {
    const config = healthCheck.config as any;

    try {
      // Dynamic import of custom handler
      const handlerModule = await import(config.handler);
      const handler = handlerModule.default || handlerModule;

      const result = await handler(config.config, version);

      return {
        name: healthCheck.name,
        status: result.healthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        message: result.message,
      };
    } catch (error: any) {
      return {
        name: healthCheck.name,
        status: HealthStatus.UNHEALTHY,
        message: `Custom check failed: ${error.message}`,
      };
    }
  }

  /**
   * Perform multiple health checks with retries
   */
  async checkWithRetry(
    healthCheck: HealthCheck,
    version: string,
    maxRetries: number = 3
  ): Promise<HealthCheckResult> {
    let lastResult: HealthCheckResult | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.check(healthCheck, version);

      if (result.status === HealthStatus.HEALTHY) {
        return result;
      }

      lastResult = result;

      if (attempt < maxRetries) {
        this.logger.info('Health check failed, retrying', {
          name: healthCheck.name,
          attempt,
          maxRetries,
        });
        await this.sleep(healthCheck.interval);
      }
    }

    return lastResult!;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
