/**
 * Test Runner - Parallel test execution with discovery, filtering, and isolation
 */

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join, basename, relative } from 'path';
import { readFileSync, existsSync } from 'fs';
import pLimit from 'p-limit';
import fastGlob from 'fast-glob';
import micromatch from 'micromatch';
import type {
  TestFunction,
  TestMetadata,
  TestResult,
  TestStatus,
  TestDuration,
  SuiteMetadata,
  SuiteResult,
  RunnerOptions,
  RunResult,
  RunStats,
  HookType,
  HookFunction,
  TestError,
  TestLevel,
} from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Test Discovery
// ============================================================================

export interface TestDiscoveryOptions {
  files: string[];
  pattern?: string;
  exclude?: string[];
  level?: TestLevel;
  tags?: string[];
  grep?: string | RegExp;
}

export interface DiscoveredSuite {
  file: string;
  name: string;
  level: TestLevel;
  tests: DiscoveredTest[];
  hooks: Map<HookType, HookFunction[]>;
  parallel: boolean;
  timeout: number;
}

export interface DiscoveredTest {
  name: string;
  fullName: string;
  level: TestLevel;
  line: number;
  column: number;
  tags: string[];
  timeout: number;
  retries: number;
  skip: boolean;
  only: boolean;
  todo: boolean;
  fn: TestFunction;
}

export class TestDiscovery {
  private cache = new Map<string, DiscoveredSuite>();

  async discover(options: TestDiscoveryOptions): Promise<DiscoveredSuite[]> {
    const files = await this.findTestFiles(options);
    const suites: DiscoveredSuite[] = [];

    for (const file of files) {
      const cached = this.cache.get(file);
      if (cached) {
        suites.push(cached);
        continue;
      }

      const suite = await this.discoverFile(file, options);
      if (suite) {
        this.cache.set(file, suite);
        suites.push(suite);
      }
    }

    return this.filterSuites(suites, options);
  }

  private async findTestFiles(options: TestDiscoveryOptions): Promise<string[]> {
    const patterns = options.files.map(f => {
      const ext = ['.test.ts', '.test.js', '.spec.ts', '.spec.js'];
      if (ext.some(e => f.endsWith(e))) {
        return f;
      }
      return `${f}/**/*.test.ts`;
    });

    const files = await fastGlob(patterns, {
      ignore: options.exclude || [],
      absolute: true,
    });

    return files;
  }

  private async discoverFile(file: string, options: TestDiscoveryOptions): Promise<DiscoveredSuite | null> {
    try {
      const content = readFileSync(file, 'utf-8');
      const ast = this.parseTestFile(content, file);
      return ast;
    } catch (error) {
      console.error(`Failed to discover tests in ${file}:`, error);
      return null;
    }
  }

  private parseTestFile(content: string, file: string): DiscoveredSuite | null {
    // Simple regex-based parsing for test discovery
    // In production, you'd use TypeScript compiler API or a proper parser
    const lines = content.split('\n');
    const tests: DiscoveredTest[] = [];
    let currentDescribe = '';
    let currentLevel: TestLevel = 'unit';
    let currentTimeout = 5000;
    let currentParallel = false;
    let currentTags: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Match describe blocks
      const describeMatch = trimmed.match(/describe(?:\.(.*?))?\s*\(\s*['"`](.*?)['"`]/);
      if (describeMatch) {
        const [, modifier, name] = describeMatch;
        currentDescribe = name;
        currentLevel = this.extractLevel(modifier) || 'unit';
        currentParallel = modifier === 'parallel';
        continue;
      }

      // Match test blocks
      const testMatch = trimmed.match(/(it|test)(?:\.(.*?))?\s*\(\s*['"`](.*?)['"`]/);
      if (testMatch) {
        const [, , modifier, name] = testMatch;
        const skip = modifier === 'skip' || modifier === 'todo';
        const only = modifier === 'only';
        const todo = modifier === 'todo';
        const tags = this.extractTags(line) || currentTags;
        const timeout = this.extractTimeout(line) || currentTimeout;
        const retries = this.extractRetries(line) || 1;

        tests.push({
          name,
          fullName: currentDescribe ? `${currentDescribe} ${name}` : name,
          level: currentLevel,
          line: i + 1,
          column: line.indexOf(name) + 1,
          tags,
          timeout,
          retries,
          skip,
          only,
          todo,
          fn: async () => {}, // Will be filled in by the test worker
        });
      }

      // Extract tags from decorator-like comments
      const tagMatch = trimmed.match(/\/\/\s*@tags?\s+(.*)/);
      if (tagMatch) {
        currentTags = tagMatch[1].split(',').map(t => t.trim());
      }
    }

    if (tests.length === 0) {
      return null;
    }

    return {
      file,
      name: currentDescribe || basename(file),
      level: currentLevel,
      tests,
      hooks: new Map(),
      parallel: currentParallel,
      timeout: currentTimeout,
    };
  }

  private extractLevel(modifier: string | undefined): TestLevel | null {
    if (!modifier) return null;
    if (modifier.includes('unit')) return 'unit';
    if (modifier.includes('integration')) return 'integration';
    if (modifier.includes('e2e')) return 'e2e';
    if (modifier.includes('performance')) return 'performance';
    return null;
  }

  private extractTags(line: string): string[] | null {
    const match = line.match(/@tags?\s+\[([^\]]+)\]/);
    if (!match) return null;
    return match[1].split(',').map(t => t.trim().replace(/['"`]/g, ''));
  }

  private extractTimeout(line: string): number | null {
    const match = line.match(/@timeout\s+(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  private extractRetries(line: string): number | null {
    const match = line.match(/@retries?\s+(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  private filterSuites(suites: DiscoveredSuite[], options: TestDiscoveryOptions): DiscoveredSuite[] {
    let filtered = suites;

    // Filter by pattern
    if (options.pattern) {
      const pattern = new RegExp(options.pattern, 'i');
      filtered = filtered.filter(suite =>
        pattern.test(suite.name) || suite.tests.some(t => pattern.test(t.name))
      );
    }

    // Filter by grep
    if (options.grep) {
      const regex = typeof options.grep === 'string' ? new RegExp(options.grep) : options.grep;
      filtered = filtered.filter(suite =>
        suite.tests.some(test => regex.test(test.fullName))
      );
    }

    // Filter by level
    if (options.level) {
      filtered = filtered.filter(suite => suite.level === options.level);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(suite =>
        suite.tests.some(test =>
          test.tags.some(tag => options.tags!.includes(tag))
        )
      );
    }

    // Filter by only/skip
    const hasOnly = filtered.some(suite => suite.tests.some(t => t.only));
    if (hasOnly) {
      filtered = filtered.map(suite => ({
        ...suite,
        tests: suite.tests.filter(t => t.only),
      })).filter(suite => suite.tests.length > 0);
    }

    filtered = filtered.map(suite => ({
      ...suite,
      tests: suite.tests.filter(t => !t.skip && !t.todo),
    })).filter(suite => suite.tests.length > 0);

    return filtered;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Test Execution
// ============================================================================

export interface ExecutionContext {
  metadata: TestMetadata;
  expect: any;
  skip: (reason?: string) => void;
  only: () => void;
}

export class TestExecutor {
  private timeouts = new Map<string, NodeJS.Timeout>();

  async executeTest(
    test: DiscoveredTest,
    suite: DiscoveredSuite,
    hooks: Map<HookType, HookFunction[]>
  ): Promise<TestResult> {
    const metadata: TestMetadata = {
      id: `${suite.file}:${test.fullName}`,
      name: test.name,
      fullName: test.fullName,
      level: test.level,
      location: {
        file: suite.file,
        line: test.line,
        column: test.column,
      },
      tags: test.tags,
      timeout: test.timeout,
      retries: test.retries,
      skip: test.skip,
      only: test.only,
      todo: test.todo,
    };

    let attempts = 0;
    let lastError: TestError | undefined;
    let flaky = false;

    while (attempts <= test.retries) {
      attempts++;

      const duration: TestDuration = {
        start: Date.now(),
        end: 0,
        elapsed: 0,
      };

      try {
        // Run before hooks
        const beforeEachHooks = hooks.get('beforeEach') || [];
        for (const hook of beforeEachHooks) {
          await hook();
        }

        // Run test with timeout
        await this.runWithTimeout(test.fn, test.timeout, metadata.id);

        duration.end = Date.now();
        duration.elapsed = duration.end - duration.start;

        // Run after hooks
        const afterEachHooks = hooks.get('afterEach') || [];
        for (const hook of afterEachHooks) {
          await hook();
        }

        // Success!
        if (attempts > 1) {
          flaky = true;
        }

        return {
          metadata,
          status: flaky ? 'flaky' : 'passed',
          duration,
          attempts,
          flaky,
        };
      } catch (error) {
        duration.end = Date.now();
        duration.elapsed = duration.end - duration.start;

        lastError = this.parseError(error);
        lastError.actual = (error as any)?.actual;
        lastError.expected = (error as any)?.expected;

        // If we have retries left, try again
        if (attempts <= test.retries) {
          continue;
        }

        // Final attempt failed
        return {
          metadata,
          status: 'failed',
          duration,
          error: lastError,
          attempts,
          flaky: attempts > 1,
        };
      } finally {
        this.clearTimeout(metadata.id);
      }
    }

    // Should never reach here
    throw new Error('Test execution failed unexpectedly');
  }

  private async runWithTimeout(fn: () => unknown, timeout: number, testId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Test timed out after ${timeout}ms`));
      }, timeout);

      this.timeouts.set(testId, timer);

      Promise.resolve()
        .then(() => fn())
        .then(() => {
          this.clearTimeout(testId);
          resolve();
        })
        .catch((error) => {
          this.clearTimeout(testId);
          reject(error);
        });
    });
  }

  private clearTimeout(testId: string): void {
    const timer = this.timeouts.get(testId);
    if (timer) {
      clearTimeout(timer);
      this.timeouts.delete(testId);
    }
  }

  private parseError(error: unknown): TestError {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
      };
    }

    return {
      message: String(error),
    };
  }

  cleanup(): void {
    for (const timer of this.timeouts.values()) {
      clearTimeout(timer);
    }
    this.timeouts.clear();
  }
}

// ============================================================================
// Parallel Test Runner
// ============================================================================

export class TestRunner {
  private discovery: TestDiscovery;
  private executor: TestExecutor;
  private abortController = new AbortController();

  constructor() {
    this.discovery = new TestDiscovery();
    this.executor = new TestExecutor();
  }

  async run(options: RunnerOptions): Promise<RunResult> {
    const startTime = Date.now();

    // Discover tests
    const suites = await this.discovery.discover({
      files: options.files,
      pattern: options.pattern,
      exclude: options.exclude,
      level: options.level,
      tags: options.tag,
      grep: options.grep,
    });

    // Apply sharding if configured
    const shardSuites = this.applySharding(suites, options.shard);

    // Determine concurrency
    const concurrency = options.concurrency || 4;
    const limit = pLimit(concurrency);

    // Execute tests
    const results: SuiteResult[] = [];
    const totalTests = shardSuites.reduce((sum, s) => sum + s.tests.length, 0);
    let completedTests = 0;
    let failedTests = 0;

    // Process suites in parallel based on their parallel setting
    const suitePromises = shardSuites.map((suite) =>
      limit(async () => {
        // Check if we should abort
        if (this.abortController.signal.aborted) {
          return;
        }

        // Bail if too many failures
        if (options.bail && failedTests >= options.bail) {
          return;
        }

        const suiteResult = await this.executeSuite(suite, options);
        results.push(suiteResult);

        completedTests += suiteResult.tests.length;
        failedTests += suiteResult.tests.filter(t => t.status === 'failed').length;

        // Progress reporting
        if (completedTests % 10 === 0) {
          this.reportProgress(completedTests, totalTests);
        }
      })
    );

    await Promise.all(suitePromises);

    // Compile final results
    const allTests = results.flatMap(r => r.tests);
    const stats = this.calculateStats(allTests);

    return {
      suites: results,
      tests: allTests,
      status: stats.failed === 0 ? 'passed' : 'failed',
      duration: {
        start: startTime,
        end: Date.now(),
        elapsed: Date.now() - startTime,
      },
      stats,
    };
  }

  private async executeSuite(
    suite: DiscoveredSuite,
    options: RunnerOptions
  ): Promise<SuiteResult> {
    const suiteMetadata: SuiteMetadata = {
      id: suite.file,
      name: suite.name,
      file: suite.file,
      level: suite.level,
      timeout: suite.timeout,
      parallel: suite.parallel,
      shuffle: false,
    };

    // Run beforeAll hooks
    const beforeAllErrors: TestError[] = [];
    const afterAllErrors: TestError[] = [];
    const beforeEachErrors: TestError[] = [];
    const afterEachErrors: TestError[] = [];

    const beforeAllHooks = suite.hooks.get('beforeAll') || [];
    for (const hook of beforeAllHooks) {
      try {
        await hook();
      } catch (error) {
        beforeAllErrors.push(this.executor.parseError(error));
      }
    }

    // Execute tests
    const testResults: TestResult[] = [];
    const concurrency = suite.parallel ? (options.concurrency || 4) : 1;
    const limit = pLimit(concurrency);

    const testPromises = suite.tests.map((test) =>
      limit(async () => {
        return await this.executor.executeTest(test, suite, suite.hooks);
      })
    );

    const results = await Promise.all(testPromises);
    testResults.push(...results);

    // Run afterAll hooks
    const afterAllHooks = suite.hooks.get('afterAll') || [];
    for (const hook of afterAllHooks) {
      try {
        await hook();
      } catch (error) {
        afterAllErrors.push(this.executor.parseError(error));
      }
    }

    // Determine suite status
    const hasFailures = testResults.some(t => t.status === 'failed');
    const status: TestStatus = hasFailures ? 'failed' : 'passed';

    return {
      metadata: suiteMetadata,
      tests: testResults,
      status,
      duration: {
        start: Date.now(),
        end: Date.now(),
        elapsed: 0,
      },
      beforeAllErrors,
      afterAllErrors,
      beforeEachErrors,
      afterEachErrors,
    };
  }

  private applySharding(
    suites: DiscoveredSuite[],
    shard: { index: number; total: number } | undefined
  ): DiscoveredSuite[] {
    if (!shard) {
      return suites;
    }

    const allTests = suites.flatMap(suite =>
      suite.tests.map(test => ({ suite, test }))
    );

    const shardSize = Math.ceil(allTests.length / shard.total);
    const start = shard.index * shardSize;
    const end = start + shardSize;
    const shardTests = allTests.slice(start, end);

    // Group back by suite
    const suiteMap = new Map<string, DiscoveredSuite>();
    for (const { suite, test } of shardTests) {
      let existing = suiteMap.get(suite.file);
      if (!existing) {
        existing = { ...suite, tests: [] };
        suiteMap.set(suite.file, existing);
      }
      existing.tests.push(test);
    }

    return Array.from(suiteMap.values());
  }

  private calculateStats(tests: TestResult[]): RunStats {
    return {
      total: tests.length,
      passed: tests.filter(t => t.status === 'passed' || t.status === 'flaky').length,
      failed: tests.filter(t => t.status === 'failed').length,
      skipped: tests.filter(t => t.status === 'skipped').length,
      flaky: tests.filter(t => t.flaky).length,
    };
  }

  private reportProgress(completed: number, total: number): void {
    const percentage = ((completed / total) * 100).toFixed(1);
    process.stderr.write(`\rProgress: ${completed}/${total} (${percentage}%)`);
  }

  abort(): void {
    this.abortController.abort();
    this.executor.cleanup();
  }

  clearCache(): void {
    this.discovery.clearCache();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const runner = new TestRunner();
