#!/usr/bin/env node
/**
 * CLI script to compare database schemas
 */

import type { D1Database } from '@cloudflare/workers-types';
import { SchemaSnapshotManager, SchemaDiffer } from '../schema';

interface SchemaDiffOptions {
  fromVersion?: number;
  toVersion?: number;
  format: 'text' | 'json' | 'sql';
  env?: string;
}

async function getDatabase(env: string = 'development'): Promise<D1Database> {
  // In a real implementation, this would load from wrangler.toml or environment
  throw new Error(
    'Database binding not configured. Please set up D1_BINDING environment variable or run via wrangler'
  );
}

async function generateSchemaDiff(options: SchemaDiffOptions): Promise<void> {
  const env = options.env || process.env.NODE_ENV || 'development';
  const db = await getDatabase(env);

  const snapshotManager = new SchemaSnapshotManager(db);
  const differ = new SchemaDiffer();

  // Get snapshots
  let fromSchema, toSchema;

  if (options.fromVersion) {
    const snapshot = await snapshotManager.loadSnapshot(options.fromVersion);
    if (!snapshot) {
      console.error(`Error: Snapshot for version ${options.fromVersion} not found`);
      process.exit(1);
    }
    fromSchema = { tables: snapshot.tables };
  } else {
    const latest = await snapshotManager.loadLatestSnapshot();
    if (!latest) {
      console.error('Error: No snapshots found');
      process.exit(1);
    }
    fromSchema = { tables: latest.tables };
  }

  if (options.toVersion) {
    const snapshot = await snapshotManager.loadSnapshot(options.toVersion);
    if (!snapshot) {
      console.error(`Error: Snapshot for version ${options.toVersion} not found`);
      process.exit(1);
    }
    toSchema = { tables: snapshot.tables };
  } else {
    // Capture current schema
    const current = await snapshotManager.capture(0);
    toSchema = { tables: current.tables };
  }

  // Generate diff
  const diff = differ.compare(fromSchema, toSchema);

  // Output based on format
  switch (options.format) {
    case 'json':
      console.log(JSON.stringify(diff, null, 2));
      break;

    case 'sql':
      const sqlStatements = differ.generateMigrationSQL(diff);
      console.log('-- Schema Diff SQL');
      console.log(`-- From version: ${options.fromVersion || 'latest'}`);
      console.log(`-- To version: ${options.toVersion || 'current'}\n`);
      console.log(sqlStatements.join('\n'));
      break;

    case 'text':
    default:
      console.log('📊 Schema Difference Report');
      console.log(`From: ${options.fromVersion || 'latest snapshot'}`);
      console.log(`To: ${options.toVersion || 'current database'}\n`);

      const report = differ.generateReport(diff);
      console.log(report);

      if (
        diff.addedTables.length === 0 &&
        diff.droppedTables.length === 0 &&
        diff.modifiedTables.length === 0 &&
        diff.addedIndexes.length === 0 &&
        diff.droppedIndexes.length === 0
      ) {
        console.log('\n✅ No differences found - schemas are identical');
      }
      break;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: schema-diff [options]');
  console.log('');
  console.log('Options:');
  console.log('  --from VERSION    From version (default: latest snapshot)');
  console.log('  --to VERSION      To version (default: current database)');
  console.log('  --format FORMAT   Output format: text, json, sql (default: text)');
  console.log('  --env ENV         Environment (default: development)');
  console.log('');
  console.log('Examples:');
  console.log('  schema-diff');
  console.log('  schema-diff --from 1 --to 5');
  console.log('  schema-diff --format json');
  console.log('  schema-diff --format sql --to 10');
  process.exit(1);
}

const fromIndex = args.indexOf('--from');
const toIndex = args.indexOf('--to');
const formatIndex = args.indexOf('--format');
const envIndex = args.indexOf('--env');

const options: SchemaDiffOptions = {
  fromVersion: fromIndex !== -1 ? parseInt(args[fromIndex + 1], 10) : undefined,
  toVersion: toIndex !== -1 ? parseInt(args[toIndex + 1], 10) : undefined,
  format: (formatIndex !== -1 ? args[formatIndex + 1] : 'text') as 'text' | 'json' | 'sql',
  env: envIndex !== -1 ? args[envIndex + 1] : undefined
};

generateSchemaDiff(options).catch((error) => {
  console.error('Error generating schema diff:', error);
  process.exit(1);
});
