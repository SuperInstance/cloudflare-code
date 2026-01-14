#!/usr/bin/env node
/**
 * CLI script to create a new migration
 */

import * as fs from 'fs';
import * as path from 'path';

interface CreateMigrationOptions {
  name: string;
  description?: string;
  dependencies?: number[];
}

const MIGRATION_TEMPLATE = `/**
 * Migration {{VERSION}}: {{NAME}}
 */

import { Migration, MigrationContext } from '../migration';

export class {{CLASS_NAME}}Migration extends Migration {
  readonly version = {{VERSION}};
  readonly name = '{{NAME}}';
  readonly description = '{{DESCRIPTION}}';
  readonly dependencies = {{DEPENDENCIES}};

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      \`
      -- Add your UP migration SQL here
    \`
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      \`
      -- Add your DOWN migration SQL here
    \`
    );
  }

  async validate(context: MigrationContext): Promise<boolean> {
    // Add validation logic here
    return true;
  }
}
`;

function toClassName(name: string): string {
  return name
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

async function getNextVersion(migrationsDir: string): Promise<number> {
  const files = fs.readdirSync(migrationsDir);
  const versions = files
    .filter((f) => f.match(/^\d+_.*\.ts$/))
    .map((f) => parseInt(f.split('_')[0], 10))
    .filter((v) => !isNaN(v));

  return versions.length > 0 ? Math.max(...versions) + 1 : 1;
}

async function createMigration(options: CreateMigrationOptions): Promise<void> {
  const migrationsDir = path.join(__dirname, '../migrations/files');

  // Ensure migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const version = await getNextVersion(migrationsDir);
  const className = toClassName(options.name);
  const fileName = `${String(version).padStart(3, '0')}_${options.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ts`;
  const filePath = path.join(migrationsDir, fileName);

  // Check if file already exists
  if (fs.existsSync(filePath)) {
    console.error(`Error: Migration file ${fileName} already exists`);
    process.exit(1);
  }

  // Generate migration content
  const content = MIGRATION_TEMPLATE
    .replace(/{{VERSION}}/g, version.toString())
    .replace(/{{NAME}}/g, options.name)
    .replace(/{{CLASS_NAME}}/g, className)
    .replace(/{{DESCRIPTION}}/g, options.description || `Migration for ${options.name}`)
    .replace(
      /{{DEPENDENCIES}}/g,
      options.dependencies ? `[${options.dependencies.join(', ')}]` : '[]'
    );

  // Write migration file
  fs.writeFileSync(filePath, content, 'utf-8');

  console.log(`✅ Created migration: ${fileName}`);
  console.log(`   Version: ${version}`);
  console.log(`   Name: ${options.name}`);
  console.log(`   Class: ${className}Migration`);
  console.log(`   Path: ${filePath}`);
  console.log('\n📝 Next steps:');
  console.log(`   1. Edit ${fileName} to add your migration logic`);
  console.log(`   2. Run tests to verify: npm test -- migration.test`);
  console.log(`   3. Apply migration: npm run migrate:up`);
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: create-migration <name> [options]');
  console.log('');
  console.log('Arguments:');
  console.log('  name              Name of the migration (required)');
  console.log('');
  console.log('Options:');
  console.log('  --description     Description of the migration');
  console.log('  --depends         Comma-separated list of dependency versions');
  console.log('');
  console.log('Examples:');
  console.log('  create-migration add_user_preferences');
  console.log('  create-migration add_user_preferences --description "Add user preferences table"');
  console.log('  create-migration add_user_settings --depends 1,2,3');
  process.exit(1);
}

const name = args[0];
const descriptionIndex = args.indexOf('--description');
const dependsIndex = args.indexOf('--depends');

const options: CreateMigrationOptions = {
  name,
  description: descriptionIndex !== -1 ? args[descriptionIndex + 1] : undefined,
  dependencies:
    dependsIndex !== -1
      ? args[dependsIndex + 1]?.split(',').map((v) => parseInt(v.trim(), 10))
      : undefined
};

createMigration(options).catch((error) => {
  console.error('Error creating migration:', error);
  process.exit(1);
});
