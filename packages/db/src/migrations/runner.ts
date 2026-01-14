/**
 * Migration runner for executing database migrations
 */

import { Migration, MigrationContext, MigrationResult, MigrationError } from './migration';
import { MigrationStore } from './store';

export interface MigrationRunnerOptions {
  context: MigrationContext;
  store: MigrationStore;
  migrations: Migration[];
  validateAfterRun?: boolean;
  stopOnError?: boolean;
  targetVersion?: number;
}

export interface MigrationPlan {
  version: number;
  name: string;
  direction: 'up' | 'down';
  dependencies?: number[];
}

export interface RunnerState {
  currentVersion: number;
  pendingMigrations: number[];
  appliedMigrations: number[];
}

/**
 * Migration runner with dependency resolution and execution
 */
export class MigrationRunner {
  private readonly migrations: Map<number, Migration>;
  private readonly store: MigrationStore;
  private readonly context: MigrationContext;

  constructor(options: MigrationRunnerOptions) {
    this.migrations = new Map();
    for (const migration of options.migrations) {
      this.migrations.set(migration.version, migration);
    }
    this.store = options.store;
    this.context = options.context;
  }

  /**
   * Get current runner state
   */
  async getState(): Promise<RunnerState> {
    const currentVersion = await this.store.getCurrentVersion();
    const appliedMigrations = await this.store.getAppliedMigrations();
    const allVersions = Array.from(this.migrations.keys()).sort((a, b) => a - b);
    const pendingMigrations = allVersions.filter((v) => !appliedMigrations.includes(v));

    return {
      currentVersion,
      pendingMigrations,
      appliedMigrations
    };
  }

  /**
   * Create migration plan for upgrading
   */
  async createUpPlan(targetVersion?: number): Promise<MigrationPlan[]> {
    const state = await this.getState();
    const plan: MigrationPlan[] = [];

    const versionsToApply = targetVersion
      ? state.pendingMigrations.filter((v) => v <= targetVersion)
      : state.pendingMigrations;

    for (const version of versionsToApply) {
      const migration = this.migrations.get(version);
      if (!migration) {
        throw new MigrationError(`Migration ${version} not found`, version);
      }

      // Check dependencies
      if (migration.dependencies.length > 0) {
        for (const dep of migration.dependencies) {
          if (!state.appliedMigrations.includes(dep)) {
            throw new MigrationError(
              `Migration ${version} depends on ${dep} which is not applied`,
              version
            );
          }
        }
      }

      plan.push({
        version: migration.version,
        name: migration.name,
        direction: 'up',
        dependencies: migration.dependencies
      });
    }

    return plan.sort((a, b) => a.version - b.version);
  }

  /**
   * Create migration plan for downgrading
   */
  async createDownPlan(targetVersion?: number): Promise<MigrationPlan[]> {
    const state = await this.getState();
    const plan: MigrationPlan[] = [];

    const versionsToRollback = targetVersion
      ? state.appliedMigrations.filter((v) => v > targetVersion)
      : [state.currentVersion];

    // Sort in descending order to rollback in reverse
    for (const version of versionsToRollback.sort((a, b) => b - a)) {
      const migration = this.migrations.get(version);
      if (!migration) {
        throw new MigrationError(`Migration ${version} not found`, version);
      }

      // Check if other migrations depend on this one
      for (const [otherVersion, otherMigration] of this.migrations) {
        if (
          otherMigration.dependencies.includes(version) &&
          state.appliedMigrations.includes(otherVersion)
        ) {
          throw new MigrationError(
            `Cannot rollback ${version}: migration ${otherVersion} depends on it`,
            version
          );
        }
      }

      plan.push({
        version: migration.version,
        name: migration.name,
        direction: 'down'
      });
    }

    return plan;
  }

  /**
   * Run migrations up
   */
  async up(options?: { targetVersion?: number; stopOnError?: boolean }): Promise<MigrationResult[]> {
    const plan = await this.createUpPlan(options?.targetVersion);
    const results: MigrationResult[] = [];
    const stopOnError = options?.stopOnError ?? true;

    console.log(`\n📊 Migration Plan: ${plan.length} migration(s) to apply\n`);

    for (const step of plan) {
      const result = await this.runStep(step);
      results.push(result);

      if (!result.success && stopOnError) {
        console.error(`\n❌ Migration failed: ${step.name} (v${step.version})`);
        console.error(`   Error: ${result.error}\n`);
        break;
      }
    }

    return results;
  }

  /**
   * Run migrations down
   */
  async down(options?: {
    targetVersion?: number;
    steps?: number;
    stopOnError?: boolean;
  }): Promise<MigrationResult[]> {
    const plan = await this.createDownPlan(options?.targetVersion);
    const results: MigrationResult[] = [];
    const stopOnError = options?.stopOnError ?? true;

    // Limit steps if specified
    const limitedPlan = options?.steps ? plan.slice(0, options.steps) : plan;

    console.log(`\n📊 Rollback Plan: ${limitedPlan.length} migration(s) to rollback\n`);

    for (const step of limitedPlan) {
      const result = await this.runStep(step);
      results.push(result);

      if (!result.success && stopOnError) {
        console.error(`\n❌ Rollback failed: ${step.name} (v${step.version})`);
        console.error(`   Error: ${result.error}\n`);
        break;
      }
    }

    return results;
  }

  /**
   * Run a single migration step
   */
  private async runStep(step: MigrationPlan): Promise<MigrationResult> {
    const migration = this.migrations.get(step.version);
    if (!migration) {
      return {
        success: false,
        version: step.version,
        name: step.name,
        direction: step.direction,
        duration: 0,
        error: 'Migration not found'
      };
    }

    const startTime = Date.now();
    console.log(
      `  ⏭️  [${step.direction.toUpperCase()}] v${step.version} - ${step.name}...`
    );

    try {
      // Record start
      await this.store.recordStart({
        version: migration.version,
        name: migration.name,
        direction: step.direction,
        startedAt: Date.now()
      });

      // Execute migration
      if (step.direction === 'up') {
        await migration.up(this.context);
      } else {
        await migration.down(this.context);
      }

      const duration = Date.now() - startTime;

      // Validate if available
      if (step.direction === 'up' && migration.validate) {
        const isValid = await migration.validate(this.context);
        if (!isValid) {
          throw new MigrationError('Validation failed after migration', migration.version);
        }
      }

      // Record completion
      await this.store.recordComplete({
        version: migration.version,
        name: migration.name,
        direction: step.direction,
        duration,
        completedAt: Date.now()
      });

      console.log(`  ✅ Completed in ${duration}ms\n`);

      return {
        success: true,
        version: migration.version,
        name: migration.name,
        direction: step.direction,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Record failure
      await this.store.recordFailure({
        version: migration.version,
        name: migration.name,
        direction: step.direction,
        error: errorMessage,
        failedAt: Date.now()
      });

      return {
        success: false,
        version: migration.version,
        name: migration.name,
        direction: step.direction,
        duration,
        error: errorMessage
      };
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    current: number;
    applied: number[];
    pending: number[];
    failed: Array<{ version: number; error: string }>;
    details: Array<{
      version: number;
      name: string;
      status: 'applied' | 'pending' | 'failed';
      appliedAt?: number;
    }>;
  }> {
    const state = await this.getState();
    const failed = await this.store.getFailedMigrations();

    const details = Array.from(this.migrations.values())
      .sort((a, b) => a.version - b.version)
      .map((migration) => {
        const isApplied = state.appliedMigrations.includes(migration.version);
        const isFailed = failed.some((f) => f.version === migration.version);

        return {
          version: migration.version,
          name: migration.name,
          status: (isFailed ? 'failed' : isApplied ? 'applied' : 'pending') as
            | 'applied'
            | 'pending'
            | 'failed'
        };
      });

    return {
      current: state.currentVersion,
      applied: state.appliedMigrations,
      pending: state.pendingMigrations,
      failed,
      details
    };
  }

  /**
   * Validate migration state consistency
   */
  async validateState(): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    const state = await this.getState();

    // Check for gaps in applied migrations
    const sortedApplied = [...state.appliedMigrations].sort((a, b) => a - b);
    for (let i = 1; i < sortedApplied.length; i++) {
      const prev = sortedApplied[i - 1];
      const curr = sortedApplied[i];

      // Check if there's a gap
      const exists = this.migrations.has(curr);
      if (exists && curr - prev > 1) {
        const hasMissing = Array.from(
          { length: curr - prev - 1 },
          (_, idx) => prev + 1 + idx
        ).some((v) => this.migrations.has(v));

        if (hasMissing) {
          errors.push(
            `Gap in applied migrations: ${prev} to ${curr} (missing intermediate migrations)`
          );
        }
      }
    }

    // Check dependency satisfaction
    for (const version of state.appliedMigrations) {
      const migration = this.migrations.get(version);
      if (migration?.dependencies) {
        for (const dep of migration.dependencies) {
          if (!state.appliedMigrations.includes(dep)) {
            errors.push(
              `Migration ${version} is applied but dependency ${dep} is not`
            );
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
