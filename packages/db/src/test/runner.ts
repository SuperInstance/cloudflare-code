/**
 * Migration test runner
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { TestContext, TestSuite, TestResult, TestCase } from './types';
import { MigrationAssertions } from './types';
import type { Migration } from '../migrations/migration';
import type { MigrationContext } from '../migrations/migration';

export interface TestRunnerOptions {
  db: D1Database;
  migration: Migration;
  suites: TestSuite[];
}

export interface TestReport {
  migrationName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  results: TestResult[];
}

/**
 * Test runner for migrations
 */
export class MigrationTestRunner {
  private readonly db: D1Database;
  private readonly migration: Migration;
  private readonly suites: TestSuite[];

  constructor(options: TestRunnerOptions) {
    this.db = options.db;
    this.migration = options.migration;
    this.suites = options.suites;
  }

  /**
   * Run all test suites
   */
  async run(): Promise<TestReport> {
    const startTime = Date.now();
    const results: TestResult[] = [];

    console.log(`\n🧪 Testing Migration: ${this.migration.name} (v${this.migration.version})\n`);

    for (const suite of this.suites) {
      console.log(`  📦 Suite: ${suite.name}`);
      const suiteResults = await this.runSuite(suite);
      results.push(...suiteResults);
    }

    const duration = Date.now() - startTime;
    const passedTests = results.filter((r) => r.passed).length;
    const failedTests = results.filter((r) => !r.passed).length;

    console.log(`\n  📊 Test Results: ${passedTests}/${results.length} passed (${duration}ms)`);

    if (failedTests > 0) {
      console.log(`  ❌ ${failedTests} test(s) failed\n`);
    } else {
      console.log(`  ✅ All tests passed!\n`);
    }

    return {
      migrationName: this.migration.name,
      totalTests: results.length,
      passedTests,
      failedTests,
      duration,
      results
    };
  }

  /**
   * Run a single test suite
   */
  private async runSuite(suite: TestSuite): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const context: TestContext = {
      db: this.db,
      migration: this.migration
    };

    // Setup
    if (suite.setup) {
      try {
        await suite.setup(context);
      } catch (error) {
        console.log(`    ❌ Setup failed: ${error}`);
        return results;
      }
    }

    // Run tests
    for (const testCase of suite.tests) {
      const result = await this.runTest(testCase, context);
      results.push(result);

      if (result.passed) {
        console.log(`    ✅ ${result.name} (${result.duration}ms)`);
      } else {
        console.log(`    ❌ ${result.name}`);
        console.log(`       Error: ${result.error}`);
      }
    }

    // Teardown
    if (suite.teardown) {
      try {
        await suite.teardown(context);
      } catch (error) {
        console.log(`    ⚠️  Teardown warning: ${error}`);
      }
    }

    return results;
  }

  /**
   * Run a single test case
   */
  private async runTest(test: TestCase, context: TestContext): Promise<TestResult> {
    const startTime = Date.now();

    try {
      await test.fn(context);
      return {
        name: test.name,
        passed: true,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: test.name,
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * Helper to run migration tests
 */
export async function testMigration(
  db: D1Database,
  migration: Migration,
  options?: {
    setupSql?: string[];
    teardownSql?: string[];
  }
): Promise<{
  assertions: MigrationAssertions;
  up: () => Promise<void>;
  down: () => Promise<void>;
  test: (testCase: TestCase) => Promise<TestResult>;
}> {
  const context: MigrationContext = {
    db,
    env: 'test'
  };

  const assertions = new MigrationAssertions({ db });

  // Run setup SQL
  if (options?.setupSql) {
    for (const sql of options.setupSql) {
      await db.exec(sql);
    }
  }

  return {
    assertions,

    up: async () => {
      await migration.up(context);
    },

    down: async () => {
      await migration.down(context);
    },

    test: async (testCase) => {
      const startTime = Date.now();
      const testContext: TestContext = { db, migration };

      try {
        await testCase.fn(testContext);
        return {
          name: testCase.name,
          passed: true,
          duration: Date.now() - startTime
        };
      } catch (error) {
        return {
          name: testCase.name,
          passed: false,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        };
      } finally {
        // Run teardown SQL
        if (options?.teardownSql) {
          for (const sql of options.teardownSql) {
            await db.exec(sql);
          }
        }
      }
    }
  };
}
