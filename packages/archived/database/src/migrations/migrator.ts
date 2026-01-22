/**
 * Migration System
 * Database schema migration tracking and execution
 */

import { DatabaseAdapter } from '../adapters/adapter';
import { MigrationDefinition, MigrationRecord, SchemaChange, SchemaDiff } from '../types';

// ============================================================================
// Migration Manager
// ============================================================================

export class MigrationManager {
  private adapter: DatabaseAdapter;
  private migrationsTable = 'migrations';
  private dryRun = false;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
  }

  // ========================================================================
  // Setup
  // ========================================================================

  async initialize(): Promise<void> {
    const tableExists = await this.adapter.tableExists(this.migrationsTable);

    if (!tableExists) {
      await this.createMigrationsTable();
    }
  }

  private async createMigrationsTable(): Promise<void> {
    const schema = {
      id: { type: 'number', primaryKey: true, autoIncrement: true },
      name: { type: 'string', length: 255, notNull: true },
      batch: { type: 'number', notNull: true },
      executedAt: { type: 'date', notNull: true },
    };

    await this.adapter.createTable(this.migrationsTable, schema);
  }

  // ========================================================================
  // Migration Execution
  // ========================================================================

  async run(migrations: MigrationDefinition[]): Promise<MigrationRecord[]> {
    await this.initialize();

    const executedMigrations = await this.getExecutedMigrations();
    const pendingMigrations = this.filterPendingMigrations(migrations, executedMigrations);

    const batch = await this.getNextBatchNumber();
    const records: MigrationRecord[] = [];

    for (const migration of pendingMigrations) {
      if (!this.dryRun) {
        await this.executeMigration(migration, batch);
      }

      records.push({
        id: '', // Will be set by insert
        name: migration.name,
        batch,
        executedAt: new Date(),
      });
    }

    return records;
  }

  async rollback(options?: { step?: number; batch?: number }): Promise<MigrationRecord[]> {
    await this.initialize();

    let batch: number | undefined;

    if (options?.batch !== undefined) {
      batch = options.batch;
    } else if (options?.step !== undefined) {
      const latestBatches = await this.getLatestBatches(options.step);
      batch = latestBatches;
    } else {
      batch = await this.getLatestBatchNumber();
    }

    if (!batch) {
      return [];
    }

    const migrations = await this.getExecutedMigrations(batch);
    const records: MigrationRecord[] = [];

    for (const migration of migrations.reverse()) {
      if (!this.dryRun) {
        await this.rollbackMigration(migration.name);
      }

      records.push(migration);
    }

    return records;
  }

  async refresh(migrations: MigrationDefinition[]): Promise<MigrationRecord[]> {
    await this.rollback({ batch: await this.getLatestBatchNumber() });
    return this.run(migrations);
  }

  async reset(migrations: MigrationDefinition[]): Promise<MigrationRecord[]> {
    const executed = await this.getExecutedMigrations();
    const records: MigrationRecord[] = [];

    for (const migration of executed.reverse()) {
      if (!this.dryRun) {
        await this.rollbackMigration(migration.name);
      }
      records.push(migration);
    }

    return records;
  }

  // ========================================================================
  // Migration Status
  // ========================================================================

  async status(migrations: MigrationDefinition[]): Promise<{
    pending: string[];
    executed: string[];
  }> {
    await this.initialize();

    const executedMigrations = await this.getExecutedMigrations();
    const executedNames = new Set(executedMigrations.map(m => m.name));

    const pending: string[] = [];
    const executed: string[] = [];

    for (const migration of migrations) {
      if (executedNames.has(migration.name)) {
        executed.push(migration.name);
      } else {
        pending.push(migration.name);
      }
    }

    return { pending, executed };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async executeMigration(migration: MigrationDefinition, batch: number): Promise<void> {
    try {
      await migration.up(this.adapter);

      await this.adapter.insert(this.migrationsTable, {
        name: migration.name,
        batch,
        executedAt: new Date(),
      });
    } catch (error) {
      throw new Error(`Migration ${migration.name} failed: ${error}`);
    }
  }

  private async rollbackMigration(migrationName: string): Promise<void> {
    // Find and execute the down migration
    // This requires access to the migration definitions
    // For now, we'll just remove the record
    await this.adapter.delete(
      this.migrationsTable,
      [{ field: 'name', operator: '=', value: migrationName } as any]
    );
  }

  private filterPendingMigrations(
    migrations: MigrationDefinition[],
    executed: MigrationRecord[]
  ): MigrationDefinition[] {
    const executedNames = new Set(executed.map(m => m.name));

    return migrations.filter(m => !executedNames.has(m.name));
  }

  private async getExecutedMigrations(batch?: number): Promise<MigrationRecord[]> {
    let where: any[] = [];

    if (batch !== undefined) {
      where = [{ field: 'batch', operator: '=', value: batch }];
    }

    const result = await this.adapter.select(this.migrationsTable, {
      where,
      orderBy: [{ field: 'name', direction: 'ASC' }],
    });

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      batch: row.batch,
      executedAt: new Date(row.executedAt),
    }));
  }

  private async getNextBatchNumber(): Promise<number> {
    const result = await this.adapter.select(this.migrationsTable, {
      orderBy: [{ field: 'batch', direction: 'DESC' }],
      limit: 1,
    });

    if (result.rowCount === 0) {
      return 1;
    }

    return result.rows[0].batch + 1;
  }

  private async getLatestBatchNumber(): Promise<number | undefined> {
    const result = await this.adapter.select(this.migrationsTable, {
      orderBy: [{ field: 'batch', direction: 'DESC' }],
      limit: 1,
    });

    if (result.rowCount === 0) {
      return undefined;
    }

    return result.rows[0].batch;
  }

  private async getLatestBatches(count: number): Promise<number[]> {
    const result = await this.adapter.select(this.migrationsTable, {
      orderBy: [{ field: 'batch', direction: 'DESC' }],
    });

    const batches = new Set(result.rows.map((r: any) => r.batch));
    return Array.from(batches).slice(0, count);
  }

  // ========================================================================
  // Dry Run Mode
  // ========================================================================

  enableDryRun(): void {
    this.dryRun = true;
  }

  disableDryRun(): void {
    this.dryRun = false;
  }

  isDryRun(): boolean {
    return this.dryRun;
  }
}

// ============================================================================
// Schema Builder
// ============================================================================

export class SchemaBuilder {
  private adapter: DatabaseAdapter;
  private tableName: string;
  private columns: Record<string, any> = {};
  private indexes: Array<{
    columns: string[];
    options?: { unique?: boolean; name?: string };
  }> = [];
  private foreignKeys: Array<{
    column: string;
    references: { table: string; column: string };
    onDelete?: string;
    onUpdate?: string;
  }> = [];

  constructor(adapter: DatabaseAdapter, tableName: string) {
    this.adapter = adapter;
    this.tableName = tableName;
  }

  // ========================================================================
  // Column Types
  // ========================================================================

  id(columnName = 'id'): SchemaBuilder {
    this.columns[columnName] = {
      type: 'number',
      primaryKey: true,
      autoIncrement: true,
      notNull: true,
    };
    return this;
  }

  string(name: string, length = 255): SchemaBuilder {
    this.columns[name] = { type: 'string', length };
    return this;
  }

  text(name: string): SchemaBuilder {
    this.columns[name] = { type: 'text' };
    return this;
  }

  integer(name: string): SchemaBuilder {
    this.columns[name] = { type: 'number' };
    return this;
  }

  bigint(name: string): SchemaBuilder {
    this.columns[name] = { type: 'bigint' };
    return this;
  }

  boolean(name: string): SchemaBuilder {
    this.columns[name] = { type: 'boolean' };
    return this;
  }

  date(name: string): SchemaBuilder {
    this.columns[name] = { type: 'date' };
    return this;
  }

  dateTime(name: string): SchemaBuilder {
    this.columns[name] = { type: 'datetime' };
    return this;
  }

  timestamp(name: string): SchemaBuilder {
    this.columns[name] = { type: 'timestamp' };
    return this;
  }

  timestamps(): SchemaBuilder {
    this.columns.createdAt = { type: 'date', notNull: true };
    this.columns.updatedAt = { type: 'date', notNull: true };
    return this;
  }

  json(name: string): SchemaBuilder {
    this.columns[name] = { type: 'json' };
    return this;
  }

  binary(name: string): SchemaBuilder {
    this.columns[name] = { type: 'binary' };
    return this;
  }

  decimal(name: string, precision = 10, scale = 2): SchemaBuilder {
    this.columns[name] = { type: 'decimal', precision, scale };
    return this;
  }

  float(name: string): SchemaBuilder {
    this.columns[name] = { type: 'float' };
    return this;
  }

  double(name: string): SchemaBuilder {
    this.columns[name] = { type: 'double' };
    return this;
  }

  enum(name: string, values: string[]): SchemaBuilder {
    this.columns[name] = { type: 'enum', values };
    return this;
  }

  // ========================================================================
  // Column Modifiers
  // ========================================================================

  primary(): SchemaBuilder {
    const lastColumn = Object.keys(this.columns).pop();
    if (lastColumn) {
      this.columns[lastColumn].primaryKey = true;
    }
    return this;
  }

  unique(): SchemaBuilder {
    const lastColumn = Object.keys(this.columns).pop();
    if (lastColumn) {
      this.columns[lastColumn].unique = true;
    }
    return this;
  }

  nullable(): SchemaBuilder {
    const lastColumn = Object.keys(this.columns).pop();
    if (lastColumn) {
      this.columns[lastColumn].nullable = true;
    }
    return this;
  }

  notNull(): SchemaBuilder {
    const lastColumn = Object.keys(this.columns).pop();
    if (lastColumn) {
      this.columns[lastColumn].notNull = true;
    }
    return this;
  }

  default(value: any): SchemaBuilder {
    const lastColumn = Object.keys(this.columns).pop();
    if (lastColumn) {
      this.columns[lastColumn].defaultValue = value;
    }
    return this;
  }

  comment(text: string): SchemaBuilder {
    const lastColumn = Object.keys(this.columns).pop();
    if (lastColumn) {
      this.columns[lastColumn].comment = text;
    }
    return this;
  }

  after(column: string): SchemaBuilder {
    const lastColumn = Object.keys(this.columns).pop();
    if (lastColumn) {
      this.columns[lastColumn].after = column;
    }
    return this;
  }

  // ========================================================================
  // Indexes
  // ========================================================================

  index(columns: string[], options?: { unique?: boolean; name?: string }): SchemaBuilder {
    this.indexes.push({ columns, options });
    return this;
  }

  // ========================================================================
  // Foreign Keys
  // ========================================================================

  foreign(column: string): SchemaBuilder {
    this.foreignKeys.push({ column, references: {} as any });
    return this;
  }

  references(column: string): SchemaBuilder {
    const lastFk = this.foreignKeys[this.foreignKeys.length - 1];
    if (lastFk) {
      lastFk.references.column = column;
    }
    return this;
  }

  on(table: string): SchemaBuilder {
    const lastFk = this.foreignKeys[this.foreignKeys.length - 1];
    if (lastFk) {
      lastFk.references.table = table;
    }
    return this;
  }

  onDelete(action: string): SchemaBuilder {
    const lastFk = this.foreignKeys[this.foreignKeys.length - 1];
    if (lastFk) {
      lastFk.onDelete = action;
    }
    return this;
  }

  onUpdate(action: string): SchemaBuilder {
    const lastFk = this.foreignKeys[this.foreignKeys.length - 1];
    if (lastFk) {
      lastFk.onUpdate = action;
    }
    return this;
  }

  // ========================================================================
  // Execution
  // ========================================================================

  async execute(): Promise<void> {
    await this.adapter.createTable(this.tableName, this.columns);

    // Create indexes
    for (const index of this.indexes) {
      await this.adapter.addIndex(this.tableName, index.columns, index.options);
    }
  }

  toSQL(): string {
    return this.adapter['buildCreateTableSQL'](this.tableName, this.columns);
  }
}

// ============================================================================
// Blueprint Helpers
// ============================================================================

export function createTable(adapter: DatabaseAdapter, tableName: string, callback: (table: SchemaBuilder) => void): Promise<void> {
  const builder = new SchemaBuilder(adapter, tableName);
  callback(builder);
  return builder.execute();
}

export function alterTable(adapter: DatabaseAdapter, tableName: string, callback: (table: SchemaBuilder) => void): Promise<void> {
  const builder = new SchemaBuilder(adapter, tableName);
  callback(builder);
  return adapter.alterTable(tableName, builder['columns']);
}

export function dropTable(adapter: DatabaseAdapter, tableName: string, cascade = false): Promise<void> {
  return adapter.dropTable(tableName, cascade);
}

export function renameTable(adapter: DatabaseAdapter, from: string, to: string): Promise<void> {
  return adapter.execute(`ALTER TABLE ${from} RENAME TO ${to}`);
}

export function hasTable(adapter: DatabaseAdapter, tableName: string): Promise<boolean> {
  return adapter.tableExists(tableName);
}

export function hasColumn(adapter: DatabaseAdapter, tableName: string, columnName: string): Promise<boolean> {
  return adapter.getTableInfo(tableName).then(columns => {
    return columns.some(c => c.name === columnName);
  });
}

// ============================================================================
// Migration Decorators
// ============================================================================

export function Migration(name: string) {
  return function<T extends { new (...args: any[]): any }>(constructor: T) {
    (constructor as any).migrationName = name;
    return constructor;
  };
}

export function Up(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  (target.constructor as any).up = descriptor.value;
}

export function Down(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  (target.constructor as any).down = descriptor.value;
}
