import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { TestConfig, TestSuite, TestCase, TestResult, TestStatus, ExecutionState } from './types';
import { TestScheduler } from './scheduler';
import { TestReporter, ConsoleReporter, JsonReporter, JUnitReporter } from './reporters';
import { TestCollector } from './test-collector';
import { TestExecutor } from './test-executor';
import { CoverageCollector } from '../coverage/coverage-collector';
import { PerformanceMonitor } from '../performance/performance-monitor';
import { ChaosEngine } from '../chaos/chaos-engine';
import { PluginManager } from '../plugins/plugin-manager';
import { EnvironmentManager } from '../environments/environment-manager';
import { Logger } from '../core/logger';

export class TestRunner extends EventEmitter {
  private config: TestConfig;
  private scheduler: TestScheduler;
  private reporter: TestReporter;
  private collector: TestCollector;
  private executor: TestExecutor;
  private coverageCollector: CoverageCollector;
  private performanceMonitor: PerformanceMonitor;
  private chaosEngine: ChaosEngine;
  private pluginManager: PluginManager;
  private environmentManager: EnvironmentManager;
  private logger: Logger;
  private state: ExecutionState = ExecutionState.IDLE;
  private workers: Worker[] = [];
  private activeTests = new Set<string>();
  private testResults: Map<string, TestResult> = new Map();
  private startTime: number | null = null;
  private endTime: number | null = null;
  private retryCount = new Map<string, number>();

  constructor(config: TestConfig) {
    super();
    this.config = config;
    this.logger = new Logger({ name: 'TestRunner' });
    this.scheduler = new TestScheduler(config);
    this.collector = new TestCollector(config);
    this.executor = new TestExecutor(config);
    this.coverageCollector = new CoverageCollector(config.coverage);
    this.performanceMonitor = new PerformanceMonitor(config.performance);
    this.chaosEngine = new ChaosEngine(config.chaos);
    this.pluginManager = new PluginManager(config.plugins);
    this.environmentManager = new EnvironmentManager(config.environments);

    this.reporter = this.createReporter();
  }

  /**
   * Create test reporter based on configuration
   */
  private createReporter(): TestReporter {
    const reporters = this.config.reporters || [{ type: 'console' }];
    const reportersList: TestReporter[] = [];

    for (const reporterConfig of reporters) {
      switch (reporterConfig.type) {
        case 'console':
          reportersList.push(new ConsoleReporter(reporterConfig.options));
          break;
        case 'json':
          reportersList.push(new JsonReporter(reporterConfig.output, reporterConfig.options));
          break;
        case 'junit':
          reportersList.push(new JUnitReporter(reporterConfig.output, reporterConfig.options));
          break;
        default:
          // Allow custom reporters
          const CustomReporter = require(reporterConfig.type).default;
          reportersList.push(new CustomReporter(reporterConfig.output, reporterConfig.options));
      }
    }

    // Return a composite reporter if multiple reporters are configured
    if (reportersList.length === 1) {
      return reportersList[0];
    }

    return new CompositeReporter(reportersList);
  }

  /**
   * Run all tests
   */
  async run(): Promise<TestResult[]> {
    this.logger.info('Starting test run...');
    this.startTime = Date.now();
    this.state = ExecutionState.RUNNING;

    try {
      // Emit start event
      this.emit('start', { startTime: this.startTime });

      // Initialize components
      await this.initialize();

      // Collect tests
      const suites = await this.collector.collect();
      this.logger.info(`Collected ${suites.length} test suites`);

      // Process test suites
      const results: TestResult[] = [];
      for (const suite of suites) {
        if (this.state !== ExecutionState.RUNNING) {
          break;
        }

        const suiteResults = await this.runSuite(suite);
        results.push(...suiteResults);

        // Update test results
        suiteResults.forEach(result => {
          this.testResults.set(result.test, result);
          this.emit('test', result);
        });
      }

      // Generate final report
      this.endTime = Date.now();
      this.state = ExecutionState.IDLE;

      const report = this.generateReport(results);
      this.reporter.generate(report);

      // Emit end event
      this.emit('end', {
        endTime: this.endTime,
        duration: this.endTime - this.startTime,
        results
      });

      return results;
    } catch (error) {
      this.logger.error('Test run failed:', error);
      this.state = ExecutionState.ERROR;
      throw error;
    }
  }

  /**
   * Run a specific test suite
   */
  async runSuite(suite: TestSuite): Promise<TestResult[]> {
    this.logger.info(`Running suite: ${suite.name}`);

    const results: TestResult[] = [];
    const schedule = this.scheduler.schedule(suite);

    // Run tests in parallel based on scheduler
    const promises = schedule.map(async (testCase: TestCase) => {
      const result = await this.runTest(testCase);
      results.push(result);
    });

    await Promise.all(promises);

    // Generate suite report
    const suiteReport = this.generateSuiteReport(suite, results);
    this.reporter.generateSuite(suiteReport);

    return results;
  }

  /**
   * Run a single test
   */
  async runTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    const testId = testCase.id;

    this.logger.info(`Running test: ${testCase.name}`);

    try {
      // Check test dependencies
      if (testCase.dependencies) {
        const dependenciesMet = await this.checkDependencies(testCase.dependencies);
        if (!dependenciesMet) {
          return this.createSkippedResult(testCase, 'Dependencies not met');
        }
      }

      // Apply environment overrides
      const environment = await this.environmentManager.getEnvironment(testCase.environment);

      // Initialize test context
      const context = {
        testId,
        testName: testCase.name,
        environment,
        config: testCase.config || this.config,
        pluginManager: this.pluginManager,
        performanceMonitor: this.performanceMonitor,
        chaosEngine: this.chaosEngine
      };

      // Execute test
      const result = await this.executor.execute(testCase, context);

      // Update retry count
      if (result.status === TestStatus.FAIL && testCase.retry && this.retryCount.get(testId) < testCase.retry) {
        this.retryCount.set(testId, (this.retryCount.get(testId) || 0) + 1);
        return this.runTest(testCase);
      }

      const endTime = Date.now();

      // Create test result
      const testResult: TestResult = {
        suite: testCase.suite,
        test: testId,
        status: result.status,
        duration: endTime - startTime,
        startTime,
        endTime,
        error: result.error,
        assertions: result.assertions || [],
        metadata: testCase.metadata,
        performance: result.performance,
        coverage: result.coverage,
        environment: environment?.name,
        retryCount: this.retryCount.get(testId) || 0,
        flaky: this.isFlaky(testCase),
        slow: this.isSlow(endTime - startTime)
      };

      this.testResults.set(testId, testResult);

      return testResult;
    } catch (error) {
      this.logger.error(`Test failed: ${testId}`, error);

      const endTime = Date.now();
      return {
        suite: testCase.suite,
        test: testId,
        status: TestStatus.ERROR,
        duration: endTime - startTime,
        startTime,
        endTime,
        error: {
          message: error instanceof Error ? error.message : String(error),
          type: 'TEST_EXECUTION_ERROR',
          stack: error instanceof Error ? error.stack : undefined
        },
        assertions: [],
        metadata: testCase.metadata,
        environment: (await this.environmentManager.getEnvironment(testCase.environment))?.name
      };
    }
  }

  /**
   * Initialize test runner components
   */
  private async initialize(): Promise<void> {
    this.logger.info('Initializing test runner...');

    // Initialize plugins
    await this.pluginManager.load();

    // Initialize environments
    await this.environmentManager.initialize();

    // Initialize performance monitor
    await this.performanceMonitor.start();

    // Initialize chaos engine
    await this.chaosEngine.initialize();

    // Initialize coverage collector
    await this.coverageCollector.start();

    // Set up signal handlers
    process.on('SIGINT', this.handleShutdown.bind(this));
    process.on('SIGTERM', this.handleShutdown.bind(this));
  }

  /**
   * Check if test dependencies are met
   */
  private async checkDependencies(dependencies: string[]): Promise<boolean> {
    for (const dependency of dependencies) {
      const result = this.testResults.get(dependency);
      if (!result || result.status !== TestStatus.PASS) {
        return false;
      }
    }
    return true;
  }

  /**
   * Create skipped test result
   */
  private createSkippedResult(testCase: TestCase, reason: string): TestResult {
    return {
      suite: testCase.suite,
      test: testCase.id,
      status: TestStatus.SKIPPED,
      duration: 0,
      startTime: Date.now(),
      endTime: Date.now(),
      assertions: [],
      metadata: testCase.metadata,
      environment: (this.environmentManager.getEnvironment(testCase.environment))?.name,
      error: {
        message: reason,
        type: 'SKIPPED'
      }
    };
  }

  /**
   * Check if test is flaky
   */
  private isFlaky(testCase: TestCase): boolean {
    return testCase.metadata?.flaky || false;
  }

  /**
   * Check if test is slow
   */
  private isSlow(duration: number): boolean {
    return duration > 5000; // 5 seconds threshold
  }

  /**
   * Generate test report
   */
  private generateReport(results: TestResult[]): TestReport {
    const stats = this.calculateStats(results);

    return {
      stats,
      results,
      duration: this.endTime! - this.startTime!,
      environment: this.config.environments?.[0]?.name || 'local',
      timestamp: this.startTime!
    };
  }

  /**
   * Generate suite report
   */
  private generateSuiteReport(suite: TestSuite, results: TestResult[]): SuiteReport {
    const stats = this.calculateSuiteStats(results);

    return {
      suite: suite.name,
      stats,
      results,
      duration: Date.now() - this.startTime!,
      timestamp: this.startTime!
    };
  }

  /**
   * Calculate overall test statistics
   */
  private calculateStats(results: TestResult[]): TestStats {
    const total = results.length;
    const passed = results.filter(r => r.status === TestStatus.PASS).length;
    const failed = results.filter(r => r.status === TestStatus.FAIL).length;
    const skipped = results.filter(r => r.status === TestStatus.SKIPPED).length;
    const error = results.filter(r => r.status === TestStatus.ERROR).length;
    const flaky = results.filter(r => r.flaky).length;
    const slow = results.filter(r => r.slow).length;

    const duration = results.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = duration / total || 0;

    return {
      total,
      passed,
      failed,
      skipped,
      error,
      flaky,
      slow,
      passRate: (passed / total) * 100,
      flakyRate: (flaky / total) * 100,
      slowRate: (slow / total) * 100,
      averageDuration,
      minDuration: Math.min(...results.map(r => r.duration)),
      maxDuration: Math.max(...results.map(r => r.duration))
    };
  }

  /**
   * Calculate suite statistics
   */
  private calculateSuiteStats(results: TestResult[]): SuiteStats {
    return this.calculateStats(results);
  }

  /**
   * Handle shutdown signal
   */
  private async handleShutdown(): Promise<void> {
    this.logger.info('Received shutdown signal, gracefully stopping...');
    this.state = ExecutionState.STOPPED;

    try {
      // Cancel running tests
      this.activeTests.clear();

      // Clean up workers
      await Promise.all(this.workers.map(worker => worker.terminate()));

      // Stop monitoring
      await this.performanceMonitor.stop();
      await this.chaosEngine.stop();
      await this.coverageCollector.stop();

      this.logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Stop test execution
   */
  async stop(): Promise<void> {
    this.state = ExecutionState.STOPPED;
    this.logger.info('Test execution stopped');
  }

  /**
   * Pause test execution
   */
  async pause(): Promise<void> {
    this.state = ExecutionState.PAUSED;
    this.logger.info('Test execution paused');
  }

  /**
   * Resume test execution
   */
  async resume(): Promise<void> {
    this.state = ExecutionState.RUNNING;
    this.logger.info('Test execution resumed');
  }

  /**
   * Get current state
   */
  getState(): ExecutionState {
    return this.state;
  }

  /**
   * Get test results
   */
  getResults(): TestResult[] {
    return Array.from(this.testResults.values());
  }

  /**
   * Get test result by test ID
   */
  getResult(testId: string): TestResult | undefined {
    return this.testResults.get(testId);
  }

  /**
   * Clear test results
   */
  clearResults(): void {
    this.testResults.clear();
    this.retryCount.clear();
  }
}

/**
 * Create test runner instance
 */
export function createTestRunner(config: TestConfig): TestRunner {
  return new TestRunner(config);
}

/**
 * Composite reporter for multiple reporters
 */
class CompositeReporter implements TestReporter {
  private reporters: TestReporter[];

  constructor(reporters: TestReporter[]) {
    this.reporters = reporters;
  }

  async generate(report: TestReport): Promise<void> {
    await Promise.all(this.reporters.map(reporter => reporter.generate(report)));
  }

  async generateSuite(suite: SuiteReport): Promise<void> {
    await Promise.all(this.reporters.map(reporter => reporter.generateSuite(suite)));
  }
}

/**
 * Test report interface
 */
export interface TestReport {
  stats: TestStats;
  results: TestResult[];
  duration: number;
  environment: string;
  timestamp: number;
}

/**
 * Suite report interface
 */
export interface SuiteReport {
  suite: string;
  stats: SuiteStats;
  results: TestResult[];
  duration: number;
  timestamp: number;
}

/**
 * Test statistics interface
 */
export interface TestStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  error: number;
  flaky: number;
  slow: number;
  passRate: number;
  flakyRate: number;
  slowRate: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
}

/**
 * Suite statistics interface
 */
export type SuiteStats = TestStats;