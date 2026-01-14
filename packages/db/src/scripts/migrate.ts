#!/usr/bin/env node
/**
 * CLI script to run migrations
 */

import type { D1Database } from '@cloudflare/workers-types';
import { MigrationRunner } from '../migrations/runner';
import { MigrationStore } from '../migrations/store';
import { ALL_MIGRATIONS } from '../migrations/files';

interface MigrateOptions {
  command: 'up' | 'down' | 'status' | 'validate';
  targetVersion?: number;
  steps?: number;
  env?: string;
  dryRun?: boolean;
}

async function getDatabase(env: string = 'development'): Promise<D1Database> {
  // In a real implementation, this would load from wrangler.toml or environment
  // For now, return a mock that will be replaced by actual D1 binding
  throw new Error(
    'Database binding not configured. Please set up D1_BINDING environment variable or run via wrangler'
  );
}

async function runMigrations(options: MigrateOptions): Promise<void> {
  const env = options.env || process.env.NODE_ENV || 'development';
  const db = await getDatabase(env);

  const context = {
    db,
    env,
    dryRun: options.dryRun
  };

  const store = new MigrationStore(db);
  await store.initialize();

  const runner = new MigrationRunner({
    context,
    store,
    migrations: ALL_MIGRATIONS
  });

  switch (options.command) {
    case 'up': {
      console.log(`🚀 Running migrations in ${env} environment...\n`);

      const results = await runner.up({
        targetVersion: options.targetVersion,
        stopOnError: true
      });

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      console.log(`\n📊 Results:`);
      console.log(`   ✅ Successful: ${successful.length}`);
      console.log(`   ❌ Failed: ${failed.length}`);

      if (failed.length > 0) {
        process.exit(1);
      }
      break;
    }

    case 'down': {
      console.log(`🔄 Rolling back migrations in ${env} environment...\n`);

      const results = await runner.down({
        targetVersion: options.targetVersion,
        steps: options.steps || 1,
        stopOnError: true
      });

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      console.log(`\n📊 Results:`);
      console.log(`   ✅ Successful: ${successful.length}`);
      console.log(`   ❌ Failed: ${failed.length}`);

      if (failed.length > 0) {
        process.exit(1);
      }
      break;
    }

    case 'status': {
      console.log(`📋 Migration status for ${env} environment:\n`);

      const status = await runner.getStatus();
      const validation = await runner.validateState();

      console.log(`Current Version: ${status.current}`);
      console.log(`Applied: ${status.applied.length}`);
      console.log(`Pending: ${status.pending.length}`);
      console.log(`Failed: ${status.failed.length}`);

      if (status.pending.length > 0) {
        console.log(`\n⏳ Pending Migrations:`);
        for (const version of status.pending) {
          const migration = ALL_MIGRATIONS.find((m) => m.version === version);
          console.log(`   v${version} - ${migration?.name || 'Unknown'}`);
        }
      }

      if (status.failed.length > 0) {
        console.log(`\n❌ Failed Migrations:`);
        for (const fail of status.failed) {
          console.log(`   v${fail.version} - ${fail.error}`);
        }
      }

      console.log(`\n📋 Migration Details:`);
      for (const detail of status.details) {
        const statusIcon = detail.status === 'applied' ? '✅' : detail.status === 'failed' ? '❌' : '⏳';
        console.log(`   ${statusIcon} v${detail.version} - ${detail.name} (${detail.status})`);
      }

      if (!validation.valid) {
        console.log(`\n⚠️  Validation Errors:`);
        for (const error of validation.errors) {
          console.log(`   - ${error}`);
        }
      }

      if (!validation.valid) {
        process.exit(1);
      }
      break;
    }

    case 'validate': {
      console.log(`🔍 Validating migration state...\n`);

      const validation = await runner.validateState();

      if (validation.valid) {
        console.log('✅ Migration state is valid');
      } else {
        console.log('❌ Migration state has errors:');
        for (const error of validation.errors) {
          console.log(`   - ${error}`);
        }
        process.exit(1);
      }
      break;
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: migrate <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  up                Apply pending migrations');
  console.log('  down              Rollback migrations');
  console.log('  status            Show migration status');
  console.log('  validate          Validate migration state');
  console.log('');
  console.log('Options:');
  console.log('  --to VERSION      Target version for up/down');
  console.log('  --steps N         Number of steps to rollback (down only)');
  console.log('  --env ENV         Environment (default: development)');
  console.log('  --dry-run         Show what would be done without doing it');
  console.log('');
  console.log('Examples:');
  console.log('  migrate up');
  console.log('  migrate down --steps 1');
  console.log('  migrate up --to 10');
  console.log('  migrate status');
  console.log('  migrate validate --env production');
  process.exit(1);
}

const command = args[0] as 'up' | 'down' | 'status' | 'validate';
const toIndex = args.indexOf('--to');
const stepsIndex = args.indexOf('--steps');
const envIndex = args.indexOf('--env');
const dryRunIndex = args.indexOf('--dry-run');

const options: MigrateOptions = {
  command,
  targetVersion: toIndex !== -1 ? parseInt(args[toIndex + 1], 10) : undefined,
  steps: stepsIndex !== -1 ? parseInt(args[stepsIndex + 1], 10) : undefined,
  env: envIndex !== -1 ? args[envIndex + 1] : undefined,
  dryRun: dryRunIndex !== -1
};

runMigrations(options).catch((error) => {
  console.error('Error running migrations:', error);
  process.exit(1);
});
