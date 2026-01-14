/**
 * Smoke Test Runner
 * Executes smoke tests after deployment
 */

import {
  SmokeTestConfig,
  SmokeTest,
  TestResult,
  TestMetrics,
  DeploymentTarget,
} from '../types';
import { Logger } from '../utils/logger';

export interface SmokeTestRunnerOptions {
  config: SmokeTestConfig;
  logger?: Logger;
}

export interface SmokeTestExecution {
  test: SmokeTest;
  target: DeploymentTarget;
  startTime: Date;
  endTime?: Date;
  result?: TestResult;
  error?: Error;
}

export class SmokeTestRunner {
  private config: SmokeTestConfig;
  private logger: Logger;
  private abortController: AbortController;

  constructor(options: SmokeTestRunnerOptions) {
    this.config = options.config;
    this.logger = options.logger || new Logger({ component: 'SmokeTestRunner' });
    this.abortController = new AbortController();
  }

  /**
   * Run all smoke tests against targets
   */
  async runTests(targets: DeploymentTarget[]): Promise<TestResult[]> {
    if (!this.config.enabled) {
      this.logger.info('Smoke tests are disabled, skipping');
      return [];
    }

    this.logger.info('Starting smoke tests', {
      targetCount: targets.length,
      testCount: this.config.tests.length,
      parallel: this.config.parallel,
      timeout: this.config.timeout,
    });

    const startTime = Date.now();
    const results: TestResult[] = [];

    try {
      if (this.config.parallel) {
        // Run all tests in parallel
        const testPromises: Promise<TestResult[]>[] = [];

        for (const target of targets) {
          for (const test of this.config.tests) {
            testPromises.push(this.runTestForTarget(target, test));
          }
        }

        const allResults = await Promise.all(testPromises);
        results.push(...allResults.flat());
      } else {
        // Run tests sequentially
        for (const target of targets) {
          for (const test of this.config.tests) {
            if (this.abortController.signal.aborted) {
              this.logger.warn('Smoke test execution aborted');
              break;
            }

            const result = await this.runTestForTarget(target, test);
            results.push(result);

            // Fail fast if critical test fails
            if (test.critical && result.status === 'fail') {
              this.logger.error('Critical smoke test failed', {
                testName: test.name,
                targetName: target.name,
                error: result.message,
              });

              // Continue running other tests unless configured to stop
              break;
            }
          }
        }
      }

      const duration = Date.now() - startTime;

      this.logger.info('Smoke tests completed', {
        totalTests: results.length,
        passed: results.filter((r) => r.status === 'pass').length,
        failed: results.filter((r) => r.status === 'fail').length,
        skipped: results.filter((r) => r.status === 'skip').length,
        duration,
      });

      return results;
    } catch (error) {
      this.logger.error('Smoke test execution failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Run a single test for a target
   */
  async runTestForTarget(
    target: DeploymentTarget,
    test: SmokeTest
  ): Promise<TestResult> {
    const startTime = Date.now();
    let attempt = 0;

    this.logger.debug('Running smoke test', {
      testName: test.name,
      testType: test.type,
      targetName: target.name,
      endpoint: test.endpoint,
    });

    while (attempt <= this.config.retryCount) {
      try {
        // Check if aborted
        if (this.abortController.signal.aborted) {
          return this.createSkippedResult(target, test, startTime);
        }

        // Execute the test
        await this.executeTest(target, test);

        const duration = Date.now() - startTime;

        this.logger.debug('Smoke test passed', {
          testName: test.name,
          targetName: target.name,
          attempt,
          duration,
        });

        return {
          testId: test.id,
          testName: test.name,
          type: test.type,
          status: 'pass',
          duration,
          timestamp: new Date(),
        };
      } catch (error) {
        attempt++;

        this.logger.debug('Smoke test attempt failed', {
          testName: test.name,
          targetName: target.name,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });

        // If this was the last attempt, record the failure
        if (attempt > this.config.retryCount) {
          const duration = Date.now() - startTime;

          this.logger.warn('Smoke test failed after all retries', {
            testName: test.name,
            targetName: target.name,
            retries: this.config.retryCount,
            error: error instanceof Error ? error.message : String(error),
          });

          return {
            testId: test.id,
            testName: test.name,
            type: test.type,
            status: 'fail',
            duration,
            timestamp: new Date(),
            message: error instanceof Error ? error.message : String(error),
            error,
          };
        }

        // Wait before retry
        await this.sleep(1000 * attempt);
      }
    }

    // Should never reach here, but just in case
    return {
      testId: test.id,
      testName: test.name,
      type: test.type,
      status: 'fail',
      duration: 0,
      timestamp: new Date(),
      message: 'Unknown error',
    };
  }

  /**
   * Execute a single test
   */
  private async executeTest(
    target: DeploymentTarget,
    test: SmokeTest
  ): Promise<void> {
    switch (test.type) {
      case 'health':
        return this.executeHealthTest(target, test);
      case 'api':
        return this.executeApiTest(target, test);
      case 'database':
        return this.executeDatabaseTest(target, test);
      case 'cache':
        return this.executeCacheTest(target, test);
      case 'integration':
        return this.executeIntegrationTest(target, test);
      default:
        throw new Error(`Unknown test type: ${test.type}`);
    }
  }

  /**
   * Execute health test
   */
  private async executeHealthTest(
    target: DeploymentTarget,
    test: SmokeTest
  ): Promise<void> {
    const url = new URL(test.endpoint, target.url).toString();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), test.timeout);

    try {
      const response = await fetch(url, {
        method: test.method,
        headers: test.headers,
        body: test.body ? JSON.stringify(test.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status !== test.expectedStatus) {
        throw new Error(
          `Expected status ${test.expectedStatus}, got ${response.status}`
        );
      }

      if (test.expectedResponse) {
        const body = await response.json();
        if (!this.matchesExpected(body, test.expectedResponse)) {
          throw new Error(
            `Response does not match expected structure: ${JSON.stringify(body)}`
          );
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Execute API test
   */
  private async executeApiTest(
    target: DeploymentTarget,
    test: SmokeTest
  ): Promise<void> {
    const url = new URL(test.endpoint, target.url).toString();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), test.timeout);

    try {
      const response = await fetch(url, {
        method: test.method,
        headers: {
          'Content-Type': 'application/json',
          ...test.headers,
        },
        body: test.body ? JSON.stringify(test.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status !== test.expectedStatus) {
        throw new Error(
          `API test failed: expected status ${test.expectedStatus}, got ${response.status}`
        );
      }

      if (test.expectedResponse) {
        const body = await response.json();
        if (!this.matchesExpected(body, test.expectedResponse)) {
          throw new Error(
            `API response does not match expected structure: ${JSON.stringify(body)}`
          );
        }
      }

      this.logger.debug('API test passed', {
        endpoint: test.endpoint,
        status: response.status,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Execute database test
   */
  private async executeDatabaseTest(
    target: DeploymentTarget,
    test: SmokeTest
  ): Promise<void> {
    // In a real implementation, this would:
    // 1. Connect to the database
    // 2. Execute a simple query
    // 3. Verify the response
    // 4. Close the connection

    this.logger.debug('Executing database test', {
      endpoint: test.endpoint,
    });

    // Simulate database test
    await this.sleep(100);

    // For now, just verify the endpoint is accessible
    const response = await fetch(test.endpoint);
    if (!response.ok) {
      throw new Error(`Database health check failed: ${response.status}`);
    }
  }

  /**
   * Execute cache test
   */
  private async executeCacheTest(
    target: DeploymentTarget,
    test: SmokeTest
  ): Promise<void> {
    // In a real implementation, this would:
    // 1. Connect to the cache (Redis, Memcached, etc.)
    // 2. Set a test key
    // 3. Get the test key
    // 4. Verify the value
    // 5. Delete the test key

    this.logger.debug('Executing cache test', {
      endpoint: test.endpoint,
    });

    // Simulate cache test
    await this.sleep(50);

    // For now, just verify the endpoint is accessible
    const response = await fetch(test.endpoint);
    if (!response.ok) {
      throw new Error(`Cache health check failed: ${response.status}`);
    }
  }

  /**
   * Execute integration test
   */
  private async executeIntegrationTest(
    target: DeploymentTarget,
    test: SmokeTest
  ): Promise<void> {
    // Integration tests verify end-to-end functionality
    // This could involve multiple API calls in sequence

    this.logger.debug('Executing integration test', {
      endpoint: test.endpoint,
    });

    const url = new URL(test.endpoint, target.url).toString();

    const response = await fetch(url, {
      method: test.method,
      headers: test.headers,
      body: test.body ? JSON.stringify(test.body) : undefined,
    });

    if (response.status !== test.expectedStatus) {
      throw new Error(
        `Integration test failed: expected status ${test.expectedStatus}, got ${response.status}`
      );
    }

    if (test.expectedResponse) {
      const body = await response.json();
      if (!this.matchesExpected(body, test.expectedResponse)) {
        throw new Error(
          `Integration test response does not match expected structure: ${JSON.stringify(body)}`
        );
      }
    }
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
   * Create a skipped test result
   */
  private createSkippedResult(
    target: DeploymentTarget,
    test: SmokeTest,
    startTime: number
  ): TestResult {
    return {
      testId: test.id,
      testName: test.name,
      type: test.type,
      status: 'skip',
      duration: Date.now() - startTime,
      timestamp: new Date(),
      message: 'Test skipped due to abort',
    };
  }

  /**
   * Calculate test metrics from results
   */
  calculateMetrics(results: TestResult[]): TestMetrics {
    const total = results.length;
    const passed = results.filter((r) => r.status === 'pass').length;
    const failed = results.filter((r) => r.status === 'fail').length;
    const skipped = results.filter((r) => r.status === 'skip').length;

    return {
      total,
      passed,
      failed,
      skipped,
      passRate: total > 0 ? (passed / total) * 100 : 100,
      tests: results,
    };
  }

  /**
   * Abort all running tests
   */
  public abort(): void {
    this.logger.warn('Aborting smoke tests');
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
