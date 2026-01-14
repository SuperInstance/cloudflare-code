#!/usr/bin/env node
/**
 * CLI script to run seeders
 */

import type { D1Database } from '@cloudflare/workers-types';
import { SeedRunner } from '../seeds/runner';
import { getSeedersForEnvironment } from '../seeds';

interface SeedOptions {
  command: 'run' | 'list';
  specific?: string[];
  env?: string;
  dryRun?: boolean;
}

async function getDatabase(env: string = 'development'): Promise<D1Database> {
  // In a real implementation, this would load from wrangler.toml or environment
  throw new Error(
    'Database binding not configured. Please set up D1_BINDING environment variable or run via wrangler'
  );
}

async function runSeeds(options: SeedOptions): Promise<void> {
  const env = options.env || process.env.NODE_ENV || 'development';
  const db = await getDatabase(env);

  const context = {
    db,
    env,
    dryRun: options.dryRun
  };

  const seeders = getSeedersForEnvironment(env);

  const runner = new SeedRunner({
    context,
    seeders,
    stopOnError: true
  });

  switch (options.command) {
    case 'list': {
      console.log(`📋 Available seeders for ${env} environment:\n`);

      const status = runner.getStatus();

      for (const seeder of status) {
        console.log(`  🌱 ${seeder.name}`);
        console.log(`     Table: ${seeder.tableName}`);
        if (seeder.description) {
          console.log(`     Description: ${seeder.description}`);
        }
        if (seeder.dependsOn.length > 0) {
          console.log(`     Depends on: ${seeder.dependsOn.join(', ')}`);
        }
        console.log('');
      }
      break;
    }

    case 'run': {
      console.log(`🌱 Seeding database in ${env} environment...\n`);

      const results = await runner.run({
        specific: options.specific,
        stopOnError: true
      });

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      console.log(`\n📊 Results:`);
      console.log(`   ✅ Successful: ${successful.length}`);
      console.log(`   ❌ Failed: ${failed.length}`);

      if (failed.length > 0) {
        console.log('\n❌ Failed seeders:');
        for (const result of failed) {
          console.log(`   - ${result.name}: ${result.error}`);
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
  console.log('Usage: seed <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  run               Run seeders');
  console.log('  list              List available seeders');
  console.log('');
  console.log('Options:');
  console.log('  --seeder NAME     Run specific seeder (can be used multiple times)');
  console.log('  --env ENV         Environment (default: development)');
  console.log('  --dry-run         Show what would be done without doing it');
  console.log('');
  console.log('Examples:');
  console.log('  seed run');
  console.log('  seed run --seeder users --seeder feature_flags');
  console.log('  seed list');
  console.log('  seed run --env production --seeder feature_flags');
  process.exit(1);
}

const command = args[0] as 'run' | 'list';
const seederIndices: number[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--seeder') {
    seederIndices.push(i);
  }
}
const envIndex = args.indexOf('--env');
const dryRunIndex = args.indexOf('--dry-run');

const options: SeedOptions = {
  command,
  specific:
    seederIndices.length > 0
      ? seederIndices.map((i) => args[i + 1])
      : undefined,
  env: envIndex !== -1 ? args[envIndex + 1] : undefined,
  dryRun: dryRunIndex !== -1
};

runSeeds(options).catch((error) => {
  console.error('Error running seeders:', error);
  process.exit(1);
});
