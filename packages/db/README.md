# @claudeflare/db

Database migration and schema management system for ClaudeFlare D1 databases.

## Features

- **Migration Framework**: Versioned database migrations with up/down support
- **Schema Management**: Schema versioning, snapshots, and diff tools
- **Rollback Support**: Safe rollback with dependency tracking
- **Data Seeding**: Environment-aware seed data management
- **Migration Testing**: Comprehensive testing utilities and assertions
- **Schema Diff**: Compare schemas and generate migration SQL
- **Transaction Safety**: Built-in error handling and validation
- **CLI Tools**: Easy-to-use command-line interface

## Installation

```bash
npm install @claudeflare/db
```

## Quick Start

### Running Migrations

```typescript
import { MigrationRunner, MigrationStore, ALL_MIGRATIONS } from '@claudeflare/db';

const context = { db: env.DB, env: 'production' };
const store = new MigrationStore(env.DB);
await store.initialize();

const runner = new MigrationRunner({
  context,
  store,
  migrations: ALL_MIGRATIONS
});

// Apply pending migrations
await runner.up();

// Check status
const status = await runner.getStatus();
console.log(status);
```

### Creating Migrations

```bash
npm run migrate:create add_user_preferences
```

This creates a new migration file:

```typescript
import { Migration, MigrationContext } from '@claudeflare/db';

export class AddUserPreferencesMigration extends Migration {
  readonly version = 25;
  readonly name = 'add_user_preferences';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(context, `
      CREATE TABLE user_preferences (
        user_id INTEGER PRIMARY KEY,
        preferences JSON DEFAULT '{}',
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE user_preferences;`);
  }
}
```

### Seeding Data

```typescript
import { SeedRunner, getSeedersForEnvironment } from '@claudeflare/db';

const seeders = getSeedersForEnvironment('development');
const runner = new SeedRunner({
  context: { db, env: 'development' },
  seeders
});

await runner.run();
```

## CLI Commands

### Migration Commands

```bash
# Apply pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Rollback specific number of migrations
npm run migrate:down -- --steps 3

# Migrate to specific version
npm run migrate:up -- --to 10

# Show migration status
npm run migrate:status

# Validate migration state
npm run migrate:validate
```

### Seeder Commands

```bash
# Run all seeders
npm run seed

# List available seeders
npm run seed -- list

# Run specific seeders
npm run seed -- run --seeder users --seeder feature_flags
```

### Schema Commands

```bash
# Compare current schema with latest snapshot
npm run schema:diff

# Compare specific versions
npm run schema:diff -- --from 1 --to 5

# Generate SQL diff
npm run schema:diff -- --format sql

# Output as JSON
npm run schema:diff -- --format json
```

## Migration Categories

The package includes 24 migrations covering:

### Users & Authentication (v1-4)
- Users table with authentication fields
- Sessions for user login management
- API keys for programmatic access
- Organizations for team management

### AI Interactions (v5-8)
- Conversations for AI chat history
- Messages for conversation logs
- Agent tasks for async AI operations
- Code reviews for AI-powered analysis

### Configuration (v9-11)
- Feature flags for dynamic configuration
- Experiments for A/B testing
- Rate limits for API throttling

### Monitoring (v12-15)
- Metrics for analytics
- Logs for application logging
- Alerts for monitoring
- Traces for distributed tracing

### Cache & Search (v16-18)
- Cache entries for caching
- Embeddings for vector storage
- Vector indexes for similarity search

### Additional (v19-24)
- Projects for user projects
- Deployments for project deployments
- Webhooks for event notifications
- Notifications for user notifications
- Audit logs for compliance
- Scheduled tasks for cron jobs

## Testing

### Testing Migrations

```typescript
import { testMigration, MigrationAssertions } from '@claudeflare/db';

const { assertions, up, down } = await testMigration(db, migration);

// Run up migration
await up();

// Assert tables exist
await assertions.assertTableExists('users');
await assertions.assertColumnExists('users', 'email');

// Run down migration
await down();
```

### Predefined Test Suites

```typescript
import {
  createTableTestSuite,
  createMigrationTestSuite,
  MigrationTestRunner
} from '@claudeflare/db';

const suite = createMigrationTestSuite(migration);
const runner = new MigrationTestRunner({ db, migration, suites: [suite] });
await runner.run();
```

## Schema Management

### Creating Snapshots

```typescript
import { SchemaSnapshotManager } from '@claudeflare/db';

const manager = new SchemaSnapshotManager(db);

// Capture current schema
const snapshot = await manager.capture(1);

// Load snapshot
const loaded = await manager.loadSnapshot(1);
```

### Schema Diffing

```typescript
import { SchemaDiffer } from '@claudeflare/db';

const differ = new SchemaDiffer();
const diff = differ.compare(fromSchema, toSchema);

// Generate report
console.log(differ.generateReport(diff));

// Generate SQL
const sql = differ.generateMigrationSQL(diff);
```

## API Reference

### Migration Class

Base class for all migrations.

```typescript
abstract class Migration {
  abstract readonly version: number;
  abstract readonly name: string;
  readonly description?: string;
  readonly dependencies: number[];

  abstract up(context: MigrationContext): Promise<void>;
  abstract down(context: MigrationContext): Promise<void>;
  async validate?(context: MigrationContext): Promise<boolean>;
}
```

### Migration Runner

Executes migrations with dependency resolution.

```typescript
class MigrationRunner {
  async up(options?: { targetVersion?: number }): Promise<MigrationResult[]>;
  async down(options?: { targetVersion?: number; steps?: number }): Promise<MigrationResult[]>;
  async getStatus(): Promise<MigrationStatus>;
  async validateState(): Promise<ValidationResult>;
}
```

### Schema Builder

Build database schemas programmatically.

```typescript
const builder = new SchemaBuilder();
builder.table('users')
  .id()
  .text('email')
  .text('name')
  .timestamps();

const sql = builder.toSQL();
```

## License

MIT
