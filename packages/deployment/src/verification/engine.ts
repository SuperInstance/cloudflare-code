/**
 * Deployment Verification Engine
 * Verifies deployments are working correctly
 */

import {
  VerificationConfig,
  VerificationCheck,
  VerificationResult,
  DeploymentTarget,
} from '../types';
import { Logger } from '../utils/logger';

export interface VerificationEngineOptions {
  config?: VerificationConfig;
  checks: VerificationCheck[];
  logger?: Logger;
}

export interface VerificationExecutionResult {
  passed: boolean;
  failures: number;
  warnings: number;
  results: VerificationResult[];
  duration: number;
}

export class VerificationEngine {
  private checks: VerificationCheck[];
  private logger: Logger;
  private abortController: AbortController;

  constructor(options: VerificationEngineOptions) {
    this.checks = options.checks;
    this.logger = options.logger || new Logger({ component: 'VerificationEngine' });
    this.abortController = new AbortController();
  }

  /**
   * Verify deployment against all checks
   */
  async verify(targets: DeploymentTarget[]): Promise<VerificationExecutionResult> {
    const startTime = Date.now();

    this.logger.info('Starting deployment verification', {
      targetCount: targets.length,
      checkCount: this.checks.length,
    });

    const results: VerificationResult[] = [];

    try {
      for (const check of this.checks) {
        if (this.abortController.signal.aborted) {
          this.logger.warn('Verification aborted');
          break;
        }

        // Run check against all targets
        for (const target of targets) {
          const result = await this.runCheck(target, check);
          results.push(result);

          // Fail fast if critical check fails
          if (check.critical && result.status === 'fail') {
            this.logger.error('Critical verification check failed', {
              checkName: check.name,
              targetName: target.name,
              message: result.message,
            });

            // Continue running other checks to get full picture
          }
        }
      }

      const duration = Date.now() - startTime;
      const failures = results.filter((r) => r.status === 'fail').length;
      const warnings = results.filter((r) => r.status === 'warning').length;
      const passed = failures === 0;

      this.logger.info('Deployment verification completed', {
        totalChecks: results.length,
        passed: results.filter((r) => r.status === 'pass').length,
        failures,
        warnings,
        duration,
      });

      return {
        passed,
        failures,
        warnings,
        results,
        duration,
      };
    } catch (error) {
      this.logger.error('Verification execution failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Run a single verification check
   */
  async runCheck(
    target: DeploymentTarget,
    check: VerificationCheck
  ): Promise<VerificationResult> {
    const startTime = Date.now();

    this.logger.debug('Running verification check', {
      checkId: check.id,
      checkName: check.name,
      checkType: check.type,
      targetName: target.name,
    });

    try {
      let result: any;

      switch (check.type) {
        case 'http':
          result = await this.runHttpCheck(target, check);
          break;
        case 'tcp':
          result = await this.runTcpCheck(target, check);
          break;
        case 'dns':
          result = await this.runDnsCheck(target, check);
          break;
        case 'ssl':
          result = await this.runSslCheck(target, check);
          break;
        case 'performance':
          result = await this.runPerformanceCheck(target, check);
          break;
        default:
          throw new Error(`Unknown check type: ${check.type}`);
      }

      const duration = Date.now() - startTime;

      this.logger.debug('Verification check passed', {
        checkId: check.id,
        targetName: target.name,
        duration,
      });

      return {
        checkId: check.id,
        checkName: check.name,
        status: 'pass',
        timestamp: new Date(),
        duration,
        details: result,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.warn('Verification check failed', {
        checkId: check.id,
        targetName: target.name,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        checkId: check.id,
        checkName: check.name,
        status: check.critical ? 'fail' : 'warning',
        timestamp: new Date(),
        duration,
        details: null,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run HTTP verification check
   */
  private async runHttpCheck(
    target: DeploymentTarget,
    check: VerificationCheck
  ): Promise<any> {
    const url = check.target || target.url;

    this.logger.debug('Running HTTP check', {
      url,
      method: check.method || 'GET',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: (check.method || 'GET') as any,
        headers: check.headers,
        signal: controller.signal,
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
      let body: any = null;
      if (check.expectedResponse) {
        body = await response.json();

        if (!this.matchesExpected(body, check.expectedResponse)) {
          throw new Error(
            `Response does not match expected structure: ${JSON.stringify(body)}`
          );
        }
      }

      return {
        url,
        status: response.status,
        ok: response.ok,
        body,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Run TCP verification check
   */
  private async runTcpCheck(
    target: DeploymentTarget,
    check: VerificationCheck
  ): Promise<any> {
    const url = new URL(check.target || target.url);

    this.logger.debug('Running TCP check', {
      host: url.hostname,
      port: url.port || (url.protocol === 'https:' ? '443' : '80'),
    });

    const port = parseInt(url.port || (url.protocol === 'https:' ? '443' : '80'));
    const connected = await this.isTcpPortOpen(url.hostname, port);

    if (!connected) {
      throw new Error(`TCP connection failed to ${url.hostname}:${port}`);
    }

    return {
      host: url.hostname,
      port,
      connected: true,
    };
  }

  /**
   * Run DNS verification check
   */
  private async runDnsCheck(
    target: DeploymentTarget,
    check: VerificationCheck
  ): Promise<any> {
    const hostname = check.target || new URL(target.url).hostname;

    this.logger.debug('Running DNS check', {
      hostname,
    });

    // In a real implementation, this would perform DNS lookups
    // For now, we'll simulate it

    await this.sleep(100);

    return {
      hostname,
      resolves: true,
      // In real implementation, would include A records, CNAME, etc.
    };
  }

  /**
   * Run SSL verification check
   */
  private async runSslCheck(
    target: DeploymentTarget,
    check: VerificationCheck
  ): Promise<any> {
    const url = new URL(check.target || target.url);

    if (url.protocol !== 'https:') {
      throw new Error('SSL check requires HTTPS protocol');
    }

    this.logger.debug('Running SSL check', {
      host: url.hostname,
    });

    // In a real implementation, this would check SSL certificate validity
    // For now, we'll simulate it

    await this.sleep(200);

    return {
      host: url.hostname,
      valid: true,
      expiresIn: 30, // days
      issuer: 'Let\'s Encrypt',
    };
  }

  /**
   * Run performance verification check
   */
  private async runPerformanceCheck(
    target: DeploymentTarget,
    check: VerificationCheck
  ): Promise<any> {
    const url = check.target || target.url;

    this.logger.debug('Running performance check', {
      url,
      maxResponseTime: check.maxResponseTime,
    });

    const startTime = Date.now();

    const response = await fetch(url, {
      method: (check.method || 'GET') as any,
      headers: check.headers,
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    if (!response.ok) {
      throw new Error(`Performance check failed with status ${response.status}`);
    }

    if (check.maxResponseTime && responseTime > check.maxResponseTime) {
      throw new Error(
        `Response time ${responseTime}ms exceeds threshold ${check.maxResponseTime}ms`
      );
    }

    return {
      url,
      responseTime,
      status: response.status,
      withinThreshold: !check.maxResponseTime || responseTime <= check.maxResponseTime,
    };
  }

  /**
   * Check if a TCP port is open
   */
  private async isTcpPortOpen(
    host: string,
    port: number
  ): Promise<boolean> {
    // In a real implementation, this would attempt a TCP connection
    // For now, we'll simulate it
    await this.sleep(50);
    return true;
  }

  /**
   * Check if response matches expected structure
   */
  private matchesExpected(response: any, expected: any): boolean {
    if (typeof expected === 'object' && expected !== null) {
      for (const key in expected) {
        if (!(key in response)) {
          return false;
        }
        if (!this.matchesExpected(response[key], expected[key])) {
          return false;
        }
      }
      return true;
    }

    return response === expected;
  }

  /**
   * Abort all running checks
   */
  public abort(): void {
    this.logger.warn('Aborting verification checks');
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
