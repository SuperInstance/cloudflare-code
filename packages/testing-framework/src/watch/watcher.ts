/**
 * File Watcher
 * Watches files for changes and triggers test runs
 */

import {
  WatchConfig,
  WatchEvent,
  WatchSession,
  WatchHook,
  WatchFilter,
  WatchReport
} from './types';
import { Logger } from '../core/logger';
import { TestRunner } from '../core/test-runner';
import { glob } from 'glob';
import { EventEmitter } from 'events';
import { existsSync, statSync } from 'fs';
import { debounce } from './utils';

export class FileWatcher extends EventEmitter {
  private config: WatchConfig;
  private logger: Logger;
  private testRunner: TestRunner;
  private session: WatchSession;
  private hooks: Map<string, WatchHook[]> = new Map();
  private filters: WatchFilter[] = [];
  private chokidar: any;
  private isWatching = false;
  private pendingRun: boolean = false;
  private lastChangeTime = 0;
  private debounceTimer: any;
  private report: WatchReport;

  constructor(config: WatchConfig, testRunner: TestRunner) {
    super();
    this.config = config;
    this.logger = new Logger('FileWatcher');
    this.testRunner = testRunner;
    this.initializeSession();
    this.initializeFilters();
    this.initializeHooks();
    this.report = this.initializeReport();
  }

  /**
   * Start watching files
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      this.logger.warn('Watcher is already running');
      return;
    }

    try {
      // Load chokidar dynamically
      const chokidar = await import('chokidar');
      this.chokidar = chokidar;

      this.logger.info('Starting file watcher...');

      // Execute before watch hooks
      await this.executeHooks('beforeWatch');

      // Initialize watcher
      const watcher = this.chokidar.watch(this.config.watch, {
        ignored: this.config.ignore,
        usePolling: this.config.watchOptions.usePolling,
        interval: this.config.watchOptions.interval,
        awaitWriteFinish: this.config.watchOptions.awaitWriteFinish,
        followSymlinks: this.config.watchOptions.followSymlinks,
        ignoreInitial: this.config.watchOptions.ignoreInitial
      });

      // Set up event handlers
      watcher.on('ready', () => {
        this.logger.info(`Watching ${this.session.totalFilesWatched} files`);
        this.session.status = 'running';
        this.emit('ready');
      });

      watcher.on('add', (path: string, stats: any) => {
        this.handleEvent({ type: 'add', path, stats, timestamp: Date.now() });
      });

      watcher.on('change', (path: string, stats: any) => {
        this.handleEvent({ type: 'change', path, stats, timestamp: Date.now() });
      });

      watcher.on('unlink', (path: string) => {
        this.handleEvent({ type: 'unlink', path, timestamp: Date.now() });
      });

      watcher.on('addDir', (path: string) => {
        this.handleEvent({ type: 'addDir', path, timestamp: Date.now() });
      });

      watcher.on('unlinkDir', (path: string) => {
        this.handleEvent({ type: 'unlinkDir', path, timestamp: Date.now() });
      });

      watcher.on('error', (error: any) => {
        this.handleEvent({ type: 'error', path: 'unknown', timestamp: Date.now(), stats: error });
      });

      this.isWatching = true;

      // Start initial test run if autoRun is enabled
      if (this.config.autoRun) {
        await this.runTests();
      }
    } catch (error) {
      this.logger.error(`Failed to start watcher: ${error}`);
      throw error;
    }
  }

  /**
   * Stop watching files
   */
  async stop(): Promise<void> {
    if (!this.isWatching) {
      this.logger.warn('Watcher is not running');
      return;
    }

    try {
      this.logger.info('Stopping file watcher...');

      // Execute stop hooks
      await this.executeHooks('onStop');

      if (this.chokidar && this.chokidar.default) {
        const watcher = this.chokidar.default;
        watcher.close();
      }

      this.isWatching = false;
      this.session.status = 'stopped';
      this.emit('stopped');
    } catch (error) {
      this.logger.error(`Failed to stop watcher: ${error}`);
      throw error;
    }
  }

  /**
   * Handle file system events
   */
  private handleEvent(event: WatchEvent): void {
    if (!this.shouldProcessEvent(event)) {
      return;
    }

    this.report.events.push(event);
    this.report.filteredEvents.push(event);
    this.session.totalFilesWatched++;

    // Execute change hook
    this.executeHooks('onChange', event).catch(error => {
      this.logger.error(`Change hook failed: ${error}`);
    });

    if (this.config.verbose) {
      this.logger.info(`File ${event.type}: ${event.path}`);
    }

    // Debounce test runs
    this.scheduleRun();
  }

  /**
   * Schedule a test run
   */
  private scheduleRun(): void {
    const now = Date.now();

    // Update last change time
    this.lastChangeTime = now;

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Schedule new test run
    const runDelay = this.config.debounce.delay;

    this.debounceTimer = setTimeout(() => {
      const timeSinceLastChange = Date.now() - this.lastChangeTime;

      if (timeSinceLastChange >= runDelay) {
        this.runTests();
      } else {
        // Reschedule if more changes are happening
        this.scheduleRun();
      }
    }, runDelay);
  }

  /**
   * Run tests
   */
  private async runTests(): Promise<void> {
    if (this.pendingRun || !this.isWatching) {
      return;
    }

    this.pendingRun = true;

    try {
      this.logger.info('Running tests...');
      this.session.isRunning = true;

      // Execute before run hooks
      await this.executeHooks('beforeRun');

      // Clear screen if enabled
      if (this.config.clearScreen) {
        this.clearScreen();
      }

      // Find test files
      const testFiles = await this.findTestFiles();

      if (testFiles.length === 0) {
        this.logger.warn('No test files found');
        return;
      }

      // Run tests
      const startTime = Date.now();
      const result = await this.testRunner.run({
        files: testFiles,
        parallel: this.config.tests.run.parallel,
        maxWorkers: this.config.tests.run.maxWorkers,
        failFast: this.config.tests.run.failFast,
        reporter: this.config.tests.run.reporter,
        environment: this.config.tests.run.environment,
        env: this.config.tests.run.env
      });

      const duration = Date.now() - startTime;

      // Store run result
      const runResult: WatchRunResult = {
        passed: result.success,
        total: result.total,
        failed: result.failures,
        skipped: result.skipped,
        duration,
        files: testFiles,
        coverage: result.coverage,
        errors: result.errors,
        warnings: result.warnings
      };

      this.session.results.push(runResult);
      this.session.lastRun = Date.now();
      this.session.totalRuns++;

      // Execute after run hooks
      await this.executeHooks('afterRun', undefined, runResult);

      // Update metrics
      this.updateMetrics(runResult);

      // Log results
      this.logRunResult(runResult);

      this.session.isRunning = false;
      this.pendingRun = false;
    } catch (error) {
      this.logger.error(`Test run failed: ${error}`);
      this.session.errors.push(error as string);

      // Execute error hooks
      await this.executeHooks('onError', undefined, undefined, error as Error);

      this.session.isRunning = false;
      this.pendingRun = false;
    }
  }

  /**
   * Find test files based on pattern
   */
  private async findTestFiles(): Promise<string[]> {
    const patterns = [
      this.config.tests.pattern,
      ...this.config.tests.extensions.map(ext => `**/*${ext}`)
    ];

    const testFiles: string[] = [];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        ignore: this.config.ignore,
        absolute: true
      });
      testFiles.push(...files);
    }

    // Remove duplicates and sort
    return [...new Set(testFiles)].sort();
  }

  /**
   * Check if an event should be processed
   */
  private shouldProcessEvent(event: WatchEvent): boolean {
    // Check filters
    for (const filter of this.filters) {
      const regex = new RegExp(filter.pattern);
      if (regex.test(event.path)) {
        if (filter.type === 'exclude') {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Execute hooks of a specific type
   */
  private async executeHooks(
    type: string,
    event?: WatchEvent,
    result?: WatchRunResult,
    error?: Error
  ): Promise<void> {
    const hooks = this.hooks.get(type) || [];

    for (const hook of hooks.sort((a, b) => a.priority - b.priority)) {
      try {
        if (hook.async) {
          await hook.handler(event, result);
        } else {
          hook.handler(event, result);
        }
      } catch (hookError) {
        this.logger.error(`Hook ${hook.name} failed: ${hookError}`);
      }
    }
  }

  /**
   * Initialize session
   */
  private initializeSession(): void {
    this.session = {
      id: `watch-${Date.now()}`,
      startTime: Date.now(),
      totalRuns: 0,
      totalFilesWatched: 0,
      currentFiles: [],
      isRunning: false,
      results: [],
      status: 'idle',
      errors: []
    };
  }

  /**
   * Initialize filters
   */
  private initializeFilters(): void {
    // Add default ignore patterns
    const defaultIgnores = [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.git/**',
      '**/build/**'
    ];

    this.config.ignore = [...defaultIgnores, ...this.config.ignore];

    // Create exclude filters
    for (const ignorePattern of this.config.ignore) {
      this.filters.push({
        pattern: ignorePattern,
        type: 'exclude',
        reason: 'Configured ignore pattern'
      });
    }

    // Create include filters for watch patterns
    for (const watchPattern of this.config.watch) {
      this.filters.push({
        pattern: watchPattern,
        type: 'include',
        reason: 'Configured watch pattern'
      });
    }
  }

  /**
   * Initialize hooks
   */
  private initializeHooks(): void {
    if (this.config.hooks) {
      const hookConfigs = [
        { type: 'beforeWatch', config: this.config.hooks.beforeWatch },
        { type: 'beforeRun', config: this.config.hooks.beforeRun },
        { type: 'afterRun', config: this.config.hooks.afterRun },
        { type: 'onChange', config: this.config.hooks.onChange },
        { type: 'onError', config: this.config.hooks.onError },
        { type: 'onStop', config: this.config.hooks.onStop }
      ];

      for (const hookConfig of hookConfigs) {
        if (hookConfig.config) {
          this.addHook({
            name: hookConfig.config,
            type: hookConfig.type as any,
            handler: this.createHookHandler(hookConfig.config),
            async: true,
            priority: 0
          });
        }
      }
    }
  }

  /**
   * Create hook handler from function name
   */
  private createHookHandler(functionName: string): any {
    // In a real implementation, this would load the function from the user's code
    return async (event?: WatchEvent, result?: WatchRunResult) => {
      if (this.config.verbose) {
        this.logger.info(`Executing hook: ${functionName}`);
      }
    };
  }

  /**
   * Initialize report
   */
  private initializeReport(): WatchReport {
    return {
      session: this.session,
      metrics: {
        filesPerSecond: 0,
        runsPerMinute: 0,
        averageRunTime: 0,
        successRate: 0,
        failureCount: 0,
        lastRunTime: 0,
        memoryUsage: {
          used: 0,
          total: 0,
          percentage: 0
        }
      },
      events: [],
      filteredEvents: [],
      triggers: {
        fileChanges: 0,
        manualRuns: 0,
        hookTriggers: 0
      },
      performance: {
        eventProcessingTime: 0,
        testExecutionTime: 0,
        totalTime: 0
      },
      summary: {
        totalFiles: 0,
        watchedFiles: 0,
        testFiles: 0
      }
    };
  }

  /**
   * Update metrics
   */
  private updateMetrics(result: WatchRunResult): void {
    const metrics = this.report.metrics;

    // Calculate runs per minute
    const minutesSinceStart = (Date.now() - this.session.startTime) / 60000;
    metrics.runsPerMinute = this.session.totalRuns / minutesSinceStart;

    // Calculate average run time
    const totalRunTime = this.session.results.reduce((sum, r) => sum + r.duration, 0);
    metrics.averageRunTime = totalRunTime / this.session.totalRuns;

    // Calculate success rate
    const successfulRuns = this.session.results.filter(r => r.passed).length;
    metrics.successRate = this.session.totalRuns > 0 ?
      (successfulRuns / this.session.totalRuns) * 100 : 0;

    // Calculate failure count
    metrics.failureCount = this.session.results.filter(r => !r.passed).length;

    // Update last run time
    metrics.lastRunTime = result.duration;

    // Update memory usage
    const usedMemory = process.memoryUsage();
    metrics.memoryUsage = {
      used: usedMemory.heapUsed,
      total: usedMemory.heapTotal,
      percentage: (usedMemory.heapUsed / usedMemory.heapTotal) * 100
    };
  }

  /**
   * Log run result
   */
  private logRunResult(result: WatchRunResult): void {
    const status = result.passed ? '✓' : '✗';
    const icon = result.passed ? '🟢' : '🔴';

    console.log(`\n${icon} Test Results ${status}`);
    console.log(`┌─────────────────────────────────────────────────────────────┐`);
    console.log(`│ Tests:      ${result.total.toString().padStart(5)}  | Passed: ${(result.total - result.failed).toString().padStart(5)} | Failed: ${result.failed.toString().padStart(5)} | Skipped: ${result.skipped.toString().padStart(5)} │`);
    console.log(`│ Duration:   ${result.duration.toString().padStart(5)}ms  | Files:  ${result.files.length.toString().padStart(5)}         │`);
    console.log(`└─────────────────────────────────────────────────────────────┘`);

    if (result.coverage) {
      console.log(`📊 Coverage: ${(result.coverage.summary.lines.percentage || 0).toFixed(1)}%`);
    }

    if (!result.passed && result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => {
        console.log(`   ${error}`);
      });
    }
  }

  /**
   * Clear screen
   */
  private clearScreen(): void {
    console.clear();
    if (this.config.verbose) {
      console.log('🔄 Running tests...\n');
    }
  }

  /**
   * Add a custom hook
   */
  public addHook(hook: WatchHook): void {
    if (!this.hooks.has(hook.type)) {
      this.hooks.set(hook.type, []);
    }
    this.hooks.get(hook.type)!.push(hook);
  }

  /**
   * Remove a hook
   */
  public removeHook(hookName: string, type?: string): void {
    if (type) {
      const hooks = this.hooks.get(type);
      if (hooks) {
        this.hooks.set(type, hooks.filter(h => h.name !== hookName));
      }
    } else {
      for (const [type, hooks] of this.hooks) {
        this.hooks.set(type, hooks.filter(h => h.name !== hookName));
      }
    }
  }

  /**
   * Get current session
   */
  public getSession(): WatchSession {
    return this.session;
  }

  /**
   * Get report
   */
  public getReport(): WatchReport {
    return this.report;
  }

  /**
   * Trigger manual test run
   */
  public async triggerRun(): Promise<void> {
    this.report.triggers.manualRuns++;
    await this.runTests();
  }

  /**
   * Pause watching
   */
  public pause(): void {
    if (this.isWatching) {
      this.isWatching = false;
      this.session.status = 'paused';
    }
  }

  /**
   * Resume watching
   */
  public resume(): void {
    if (!this.isWatching) {
      this.isWatching = true;
      this.session.status = 'running';
    }
  }
}