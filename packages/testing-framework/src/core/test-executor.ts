import { Worker } from 'worker_threads';
import { TestContext, TestConfig, TestCase, TestResult, TestStatus } from './types';
import { Logger } from './logger';
import { CoverageCollector } from '../coverage/coverage-collector';
import { PerformanceMonitor } from '../performance/performance-monitor';
import { ChaosEngine } from '../chaos/chaos-engine';
import { ModuleLoader } from './module-loader';

export class TestExecutor {
  private config: TestConfig;
  private logger: Logger;
  private moduleLoader: ModuleLoader;
  private coverageCollector?: CoverageCollector;
  private performanceMonitor?: PerformanceMonitor;
  private chaosEngine?: ChaosEngine;
  private workerPool: Worker[] = [];
  private activeWorkers = new Map<string, Worker>();

  constructor(config: TestConfig) {
    this.config = config;
    this.logger = new Logger({ name: 'TestExecutor' });
    this.moduleLoader = new ModuleLoader();

    // Initialize monitoring components if enabled
    if (config.coverage) {
      this.coverageCollector = new CoverageCollector(config.coverage);
    }

    if (config.performance) {
      this.performanceMonitor = new PerformanceMonitor(config.performance);
    }

    if (config.chaos) {
      this.chaosEngine = new ChaosEngine(config.chaos);
    }
  }

  /**
   * Execute a test case
   */
  async execute(testCase: TestCase, context: TestContext): Promise<TestExecutionResult> {
    const startTime = Date.now();
    const testId = testCase.id;

    this.logger.info(`Executing test: ${testCase.name}`);

    try {
      // Set up test environment
      await this.setupTestEnvironment(testCase, context);

      // Apply chaos engineering if enabled
      if (this.chaosEngine && this.chaosEngine.isEnabled()) {
        await this.chaosEngine.injectChaos(testCase, context);
      }

      // Execute test in worker thread
      const result = await this.executeInWorker(testCase, context);

      // Collect coverage if enabled
      if (this.coverageCollector && testCase.type === 'unit') {
        const coverage = await this.coverageCollector.collect();
        result.coverage = coverage;
      }

      // Collect performance metrics if enabled
      if (this.performanceMonitor) {
        const metrics = await this.performanceMonitor.getMetrics();
        result.performance = metrics;
      }

      // Check for test flakiness
      if (testCase.metadata?.flaky) {
        this.logger.warn(`Test ${testId} is marked as flaky, result may vary`);
      }

      // Validate test result
      this.validateTestResult(result, testCase);

      return result;
    } catch (error) {
      this.logger.error(`Test execution failed for ${testId}:`, error);

      return {
        status: TestStatus.ERROR,
        assertions: [],
        error: {
          message: error instanceof Error ? error.message : String(error),
          type: 'TEST_EXECUTION_ERROR',
          stack: error instanceof Error ? error.stack : undefined
        },
        performance: this.performanceMonitor?.getSnapshot()
      };
    } finally {
      // Clean up test environment
      await this.cleanupTestEnvironment(testCase, context);

      // Release worker
      this.releaseWorker(testId);
    }
  }

  /**
   * Execute test in worker thread
   */
  private async executeInWorker(testCase: TestCase, context: TestContext): Promise<TestExecutionResult> {
    const worker = this.getWorkerForTest(testCase);
    const testId = testCase.id;

    try {
      // Send test to worker
      const message = {
        type: 'execute',
        testCase,
        context: {
          ...context,
          config: this.sanitizeConfig(context.config)
        }
      };

      const result = await new Promise<TestExecutionResult>((resolve, reject) => {
        const timeout = testCase.timeout || this.config.watch?.interval || 5000;

        // Set up timeout handler
        const timeoutHandler = setTimeout(() => {
          reject(new Error(`Test ${testId} timed out after ${timeout}ms`));
        }, timeout);

        // Set up message handler
        const messageHandler = (response: any) => {
          clearTimeout(timeoutHandler);
          worker.off('message', messageHandler);
          worker.off('error', errorHandler);
          resolve(response.result);
        };

        // Set up error handler
        const errorHandler = (error: any) => {
          clearTimeout(timeoutHandler);
          worker.off('message', messageHandler);
          worker.off('error', errorHandler);
          reject(error);
        };

        worker.on('message', messageHandler);
        worker.on('error', errorHandler);

        // Send test message
        worker.postMessage(message);
      });

      return result;
    } catch (error) {
      this.logger.error(`Worker execution failed for ${testId}:`, error);
      throw error;
    }
  }

  /**
   * Get worker for test execution
   */
  private getWorkerForTest(testCase: TestCase): Worker {
    // Check if there's an available worker
    const availableWorker = this.findAvailableWorker();

    if (availableWorker) {
      return availableWorker;
    }

    // Create new worker if pool is not full
    if (this.workerPool.length < (this.config.maxParallel || 4)) {
      const worker = this.createWorker();
      this.workerPool.push(worker);
      return worker;
    }

    // Wait for worker to become available
    return this.waitForAvailableWorker(testCase);
  }

  /**
   * Find available worker
   */
  private findAvailableWorker(): Worker | null {
    for (const worker of this.workerPool) {
      if (!this.activeWorkers.has(worker.threadId.toString())) {
        return worker;
      }
    }
    return null;
  }

  /**
   * Create new worker
   */
  private createWorker(): Worker {
    const worker = new Worker(this.getWorkerScript(), {
      workerData: {
        config: this.config
      }
    });

    // Handle worker errors
    worker.on('error', (error) => {
      this.logger.error(`Worker error:`, error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        this.logger.error(`Worker stopped with exit code ${code}`);
      }
    });

    return worker;
  }

  /**
   * Wait for available worker
   */
  private async waitForAvailableWorker(testCase: TestCase): Promise<Worker> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const worker = this.findAvailableWorker();
        if (worker) {
          clearInterval(checkInterval);
          resolve(worker);
        }
      }, 100);

      // Set timeout
      setTimeout(() => {
        clearInterval(checkInterval);
        this.logger.warn(`No worker available for test ${testCase.id}`);
      }, 10000);
    });
  }

  /**
   * Release worker
   */
  private releaseWorker(testId: string): void {
    // Find and release worker associated with test
    // This is simplified - in practice you'd need to track workers more carefully
    const workerIndex = this.workerPool.findIndex(worker =>
      worker.threadId.toString() === testId
    );

    if (workerIndex !== -1) {
      const worker = this.workerPool[workerIndex];
      this.activeWorkers.delete(worker.threadId.toString());
      this.logger.debug(`Released worker for test ${testId}`);
    }
  }

  /**
   * Set up test environment
   */
  private async setupTestEnvironment(testCase: TestCase, context: TestContext): Promise<void> {
    this.logger.debug(`Setting up environment for test ${testCase.id}`);

    // Load setup files if configured
    if (this.config.setupFiles) {
      for (const setupFile of this.config.setupFiles) {
        try {
          const setupModule = await this.moduleLoader.load(setupFile);
          if (setupModule.setup) {
            await setupModule.setup(context);
          }
        } catch (error) {
          this.logger.error(`Failed to load setup file ${setupFile}:`, error);
        }
      }
    }

    // Execute global before hooks
    if (this.config.hooks?.beforeAll) {
      for (const hook of this.config.hooks.beforeAll) {
        try {
          const hookModule = await this.moduleLoader.load(hook);
          if (hookModule.beforeAll) {
            await hookModule.beforeAll(context);
          }
        } catch (error) {
          this.logger.error(`Failed to execute beforeAll hook ${hook}:`, error);
        }
      }
    }
  }

  /**
   * Clean up test environment
   */
  private async cleanupTestEnvironment(testCase: TestCase, context: TestContext): Promise<void> {
    this.logger.debug(`Cleaning up environment for test ${testCase.id}`);

    // Execute global after hooks
    if (this.config.hooks?.afterAll) {
      for (const hook of this.config.hooks.afterAll) {
        try {
          const hookModule = await this.moduleLoader.load(hook);
          if (hookModule.afterAll) {
            await hookModule.afterAll(context);
          }
        } catch (error) {
          this.logger.error(`Failed to execute afterAll hook ${hook}:`, error);
        }
      }
    }

    // Execute test-specific hooks
    if (testCase.hooks?.afterAll) {
      for (const hook of testCase.hooks.afterAll) {
        try {
          const hookModule = await this.moduleLoader.load(hook);
          if (hookModule.afterAll) {
            await hookModule.afterAll(context);
          }
        } catch (error) {
          this.logger.error(`Failed to execute test afterAll hook ${hook}:`, error);
        }
      }
    }
  }

  /**
   * Validate test result
   */
  private validateTestResult(result: TestExecutionResult, testCase: TestCase): void {
    // Validate assertions
    if (result.assertions && result.assertions.length > 0) {
      const failedAssertions = result.assertions.filter(a => a.status === 'fail');

      if (failedAssertions.length > 0) {
        result.status = TestStatus.FAIL;
        this.logger.debug(`Test ${testCase.id} has ${failedAssertions.length} failed assertions`);
      }
    }

    // Validate expected result if provided
    if (testCase.expected) {
      if (result.status !== testCase.expected.status) {
        result.error = {
          message: `Expected status ${testCase.expected.status} but got ${result.status}`,
          type: 'TEST_STATUS_MISMATCH'
        };
        result.status = TestStatus.FAIL;
      }
    }
  }

  /**
   * Get worker script path
   */
  private getWorkerScript(): string {
    return `${process.cwd()}/dist/worker.js`;
  }

  /**
   * Sanitize configuration for worker thread
   */
  private sanitizeConfig(config: TestConfig): TestConfig {
    const sanitized = { ...config };

    // Remove non-serializable properties
    delete sanitized.watch;
    delete sanitized.plugins;
    delete sanitized.environments;

    // Convert functions to strings if needed
    sanitized.setupFiles = sanitized.setupFiles?.map(file => {
      if (typeof file === 'function') {
        return file.toString();
      }
      return file;
    });

    return sanitized;
  }

  /**
   * Stop all workers
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping test executor...');

    // Terminate all workers
    await Promise.all(
      this.workerPool.map(worker => worker.terminate())
    );

    this.workerPool = [];
    this.activeWorkers.clear();

    this.logger.info('Test executor stopped');
  }

  /**
   * Get worker pool statistics
   */
  getWorkerStats(): WorkerStats {
    return {
      total: this.workerPool.length,
      active: this.activeWorkers.size,
      available: this.workerPool.length - this.activeWorkers.size
    };
  }
}

/**
 * Test execution result interface
 */
export interface TestExecutionResult {
  status: TestStatus;
  assertions?: AssertionResult[];
  error?: TestError;
  performance?: PerformanceMetrics;
  coverage?: CoverageMetrics;
}

/**
 * Worker statistics interface
 */
export interface WorkerStats {
  total: number;
  active: number;
  available: number;
}

/**
 * Assertion result interface
 */
export interface AssertionResult {
  status: 'pass' | 'fail';
  message: string;
  expected?: any;
  actual?: any;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
}

/**
 * Test error interface
 */
export interface TestError {
  message: string;
  type: string;
  stack?: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  time: {
    startTime: number;
    endTime: number;
    duration: number;
    average: number;
    min: number;
    max: number;
    percentile50: number;
    percentile90: number;
    percentile95: number;
    percentile99: number;
  };
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu?: {
    usage: number;
    user: number;
    system: number;
  };
  network?: {
    requests: number;
    bytesIn: number;
    bytesOut: number;
    latency: number;
    errors: number;
  };
}

/**
 * Coverage metrics interface
 */
export interface CoverageMetrics {
  statements: {
    total: number;
    covered: number;
    percentage: number;
  };
  branches: {
    total: number;
    covered: number;
    percentage: number;
  };
  functions: {
    total: number;
    covered: number;
    percentage: number;
  };
  lines: {
    total: number;
    covered: number;
    percentage: number;
  };
  files: Record<string, {
    statements: {
      total: number;
      covered: number;
      percentage: number;
    };
    branches: {
      total: number;
      covered: number;
      percentage: number;
    };
    functions: {
      total: number;
      covered: number;
      percentage: number;
    };
    lines: {
      total: number;
      covered: number;
      percentage: number;
    };
  }>;
}