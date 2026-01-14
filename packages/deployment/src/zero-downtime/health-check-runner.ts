/**
 * Health Check Runner
 * Executes and monitors health checks during deployment
 */

import { HealthCheck, DeploymentTarget, HealthCheckResult, HealthCheckType } from '../types';
import { Logger } from '../utils/logger';

export interface HealthCheckRunnerOptions {
  healthChecks: HealthCheck[];
  logger?: Logger;
}

export interface HealthCheckExecution {
  check: HealthCheck;
  target: DeploymentTarget;
  startTime: Date;
  endTime?: Date;
  result?: HealthCheckResult;
  error?: Error;
}

export class HealthCheckRunner {
  private healthChecks: HealthCheck[];
  private logger: Logger;
  private abortController: AbortController;

  constructor(options: HealthCheckRunnerOptions) {
    this.healthChecks = options.healthChecks;
    this.logger = options.logger || new Logger({ component: 'HealthCheckRunner' });
    this.abortController = new AbortController();
  }

  /**
   * Run all health checks for a target
   */
  async runChecks(target: DeploymentTarget): Promise<HealthCheckResult[]> {
    this.logger.info('Running health checks for target', {
      targetId: target.id,
      targetName: target.name,
      checkCount: this.healthChecks.length,
    });

    const results: HealthCheckResult[] = [];

    for (const check of this.healthChecks) {
      if (this.abortController.signal.aborted) {
        this.logger.warn('Health check execution aborted');
        break;
      }

      const result = await this.runCheck(target, check);
      results.push(result);
    }

    const passCount = results.filter((r) => r.status === 'pass').length;
    const failCount = results.filter((r) => r.status === 'fail').length;

    this.logger.info('Health checks completed', {
      targetId: target.id,
      total: results.length,
      passed: passCount,
      failed: failCount,
    });

    return results;
  }

  /**
   * Run a single health check
   */
  async runCheck(
    target: DeploymentTarget,
    check: HealthCheck
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    this.logger.debug('Running health check', {
      checkId: check.id,
      checkName: check.name,
      targetId: target.id,
      type: check.type,
    });

    // Retry logic
    for (let attempt = 0; attempt <= check.retries; attempt++) {
      try {
        const result = await this.executeCheck(target, check);
        const responseTime = Date.now() - startTime;

        this.logger.debug('Health check passed', {
          checkId: check.id,
          targetId: target.id,
          attempt,
          responseTime,
        });

        return {
          targetId: target.id,
          checkId: check.id,
          checkName: check.name,
          status: 'pass',
          timestamp: new Date(),
          responseTime,
          message: 'Health check passed',
        };
      } catch (error) {
        lastError = error as Error;

        this.logger.debug('Health check attempt failed', {
          checkId: check.id,
          targetId: target.id,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });

        // Wait before retry
        if (attempt < check.retries) {
          await this.sleep(check.interval);
        }
      }
    }

    // All retries exhausted
    const responseTime = Date.now() - startTime;

    this.logger.warn('Health check failed after all retries', {
      checkId: check.id,
      targetId: target.id,
      retries: check.retries,
    });

    return {
      targetId: target.id,
      checkId: check.id,
      checkName: check.name,
      status: 'fail',
      timestamp: new Date(),
      responseTime,
      message: lastError?.message || 'Health check failed',
    };
  }

  /**
   * Execute a single health check based on its type
   */
  private async executeCheck(
    target: DeploymentTarget,
    check: HealthCheck
  ): Promise<void> {
    switch (check.type) {
      case HealthCheckType.HTTP:
        return this.executeHttpCheck(target, check);
      case HealthCheckType.TCP:
        return this.executeTcpCheck(target, check);
      case HealthCheckType.COMMAND:
        return this.executeCommandCheck(target, check);
      case HealthCheckType.SCRIPT:
        return this.executeScriptCheck(target, check);
      default:
        throw new Error(`Unknown health check type: ${check.type}`);
    }
  }

  /**
   * Execute HTTP health check
   */
  private async executeHttpCheck(
    target: DeploymentTarget,
    check: HealthCheck
  ): Promise<void> {
    const url = check.endpoint || target.healthCheckUrl;
    const path = check.path || '/health';
    const fullUrl = new URL(path, url).toString();

    this.logger.debug('Executing HTTP health check', {
      url: fullUrl,
      expectedStatus: check.expectedStatus,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), check.timeout);

    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'ClaudeFlare-HealthCheck/1.0',
        },
      });

      clearTimeout(timeoutId);

      // Check status code
      if (check.expectedStatus && response.status !== check.expectedStatus) {
        throw new Error(
          `Expected status ${check.expectedStatus}, got ${response.status}`
        );
      }

      if (!response.ok) {
        throw new Error(`HTTP request failed with status ${response.status}`);
      }

      // Check response body if expected
      if (check.expectedBody) {
        const body = await response.text();
        if (!body.includes(check.expectedBody)) {
          throw new Error(
            `Response body does not contain expected text: ${check.expectedBody}`
          );
        }
      }

      this.logger.debug('HTTP health check passed', {
        url: fullUrl,
        status: response.status,
      });
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Health check timeout after ${check.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Execute TCP health check
   */
  private async executeTcpCheck(
    target: DeploymentTarget,
    check: HealthCheck
  ): Promise<void> {
    const url = new URL(check.endpoint || target.healthCheckUrl);
    const port = check.port || parseInt(url.port) || 80;

    this.logger.debug('Executing TCP health check', {
      host: url.hostname,
      port,
    });

    try {
      const connected = await this.isTcpPortOpen(url.hostname, port, check.timeout);

      if (!connected) {
        throw new Error(
          `TCP connection failed to ${url.hostname}:${port}`
        );
      }

      this.logger.debug('TCP health check passed', {
        host: url.hostname,
        port,
      });
    } catch (error) {
      throw new Error(
        `TCP health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute command health check
   */
  private async executeCommandCheck(
    target: DeploymentTarget,
    check: HealthCheck
  ): Promise<void> {
    if (!check.command) {
      throw new Error('Command not specified for command health check');
    }

    this.logger.debug('Executing command health check', {
      command: check.command,
    });

    try {
      // In a real implementation, this would execute the command
      // For now, we'll simulate it
      await this.sleep(100);

      this.logger.debug('Command health check passed', {
        command: check.command,
      });
    } catch (error) {
      throw new Error(
        `Command health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute script health check
   */
  private async executeScriptCheck(
    target: DeploymentTarget,
    check: HealthCheck
  ): Promise<void> {
    if (!check.script) {
      throw new Error('Script not specified for script health check');
    }

    this.logger.debug('Executing script health check', {
      script: check.script,
    });

    try {
      // In a real implementation, this would execute the script
      // For now, we'll simulate it
      await this.sleep(100);

      this.logger.debug('Script health check passed', {
        script: check.script,
      });
    } catch (error) {
      throw new Error(
        `Script health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if a TCP port is open
   */
  private async isTcpPortOpen(
    host: string,
    port: number,
    timeout: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(false);
      }, timeout);

      // In a real implementation, this would attempt a TCP connection
      // For Cloudflare Workers, this would use the connect() API
      // For Node.js, this would use net.createConnection()

      // Simulate connection attempt
      setTimeout(() => {
        clearTimeout(timeoutId);
        resolve(true);
      }, 50);
    });
  }

  /**
   * Abort all running health checks
   */
  public abort(): void {
    this.logger.warn('Aborting health checks');
    this.abortController.abort();
  }

  /**
   * Reset the abort controller
   */
  public reset(): void {
    this.abortController = new AbortController();
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
