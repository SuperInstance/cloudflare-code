/**
 * Migration base class and interfaces for D1 database migrations
 */

export interface MigrationContext {
  db: D1Database;
  env: string;
  dryRun?: boolean;
}

export interface MigrationResult {
  success: boolean;
  version: number;
  name: string;
  direction: 'up' | 'down';
  duration: number;
  error?: string;
  changes?: number;
}

export interface MigrationMetadata {
  version: number;
  name: string;
  description?: string;
  timestamp?: number;
  dependencies?: number[];
}

export type MigrationDirection = 'up' | 'down';

/**
 * Base class for all migrations
 */
export abstract class Migration {
  abstract readonly version: number;
  abstract readonly name: string;
  readonly description?: string;
  readonly dependencies: number[] = [];

  /**
   * Apply migration (upgrade)
   */
  abstract up(context: MigrationContext): Promise<void>;

  /**
   * Rollback migration (downgrade)
   */
  abstract down(context: MigrationContext): Promise<void>;

  /**
   * Validate data after migration (optional)
   */
  async validate?(context: MigrationContext): Promise<boolean>;

  /**
   * Get migration metadata
   */
  getMetadata(): MigrationMetadata {
    return {
      version: this.version,
      name: this.name,
      description: this.description,
      dependencies: this.dependencies
    };
  }

  /**
   * Execute SQL with error handling
   */
  protected async execute(
    context: MigrationContext,
    sql: string,
    params?: unknown[]
  ): Promise<D1Result> {
    if (context.dryRun) {
      console.log(`[DRY RUN] Would execute: ${sql.substring(0, 100)}...`);
      return { meta: { duration: 0, changes: 0 } } as D1Result;
    }

    try {
      const stmt = params ? context.db.prepare(sql).bind(...params) : context.db.prepare(sql);
      return await stmt.run();
    } catch (error) {
      throw new MigrationError(
        `Failed to execute SQL in migration ${this.name}: ${(error as Error).message}`,
        this.version,
        error
      );
    }
  }

  /**
   * Execute multiple SQL statements in a transaction-like manner
   */
  protected async executeBatch(
    context: MigrationContext,
    statements: string[]
  ): Promise<D1Result[]> {
    const results: D1Result[] = [];

    for (const sql of statements) {
      const result = await this.execute(context, sql);
      results.push(result);
    }

    return results;
  }

  /**
   * Check if a table exists
   */
  protected async tableExists(context: MigrationContext, tableName: string): Promise<boolean> {
    const result = await context.db
      .prepare(
        `
        SELECT name FROM sqlite_master
        WHERE type='table' AND name=?
      `
      )
      .bind(tableName)
      .first();

    return !!result;
  }

  /**
   * Check if a column exists
   */
  protected async columnExists(
    context: MigrationContext,
    tableName: string,
    columnName: string
  ): Promise<boolean> {
    const result = await context.db
      .prepare(
        `
        SELECT COUNT(*) as count FROM pragma_table_info(?)
        WHERE name=?
      `
      )
      .bind(tableName, columnName)
      .first();

    return (result?.count as number) > 0;
  }

  /**
   * Get row count from a table
   */
  protected async getRowCount(context: MigrationContext, tableName: string): Promise<number> {
    const result = await context.db
      .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
      .first();

    return (result?.count as number) || 0;
  }
}

/**
 * Migration error class
 */
export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly version: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * SQL-based migration from file content
 */
export class SQLMigration extends Migration {
  constructor(
    public readonly sqlVersion: number,
    public readonly sqlName: string,
    private readonly upSql: string,
    private readonly downSql: string,
    readonly sqlDescription?: string
  ) {
    super();
  }

  get version(): number {
    return this.sqlVersion;
  }

  get name(): string {
    return this.sqlName;
  }

  async up(context: MigrationContext): Promise<void> {
    await this.execute(context, this.upSql);
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, this.downSql);
  }
}

/**
 * Parse migration file content
 */
export interface ParsedMigration {
  metadata: MigrationMetadata;
  upSql: string;
  downSql: string;
}

export function parseMigrationFile(content: string, filename: string): ParsedMigration {
  const lines = content.split('\n');
  const metadata: MigrationMetadata = {
    version: 0,
    name: filename
  };

  let currentSection: 'up' | 'down' | 'none' = 'none';
  const upStatements: string[] = [];
  const downStatements: string[] = [];
  let currentStatement = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Extract metadata
    const versionMatch = trimmed.match(/--\s*@version\s+(\d+)/);
    if (versionMatch) {
      metadata.version = parseInt(versionMatch[1], 10);
      continue;
    }

    const nameMatch = trimmed.match(/--\s*@name\s+(.+)/);
    if (nameMatch) {
      metadata.name = nameMatch[1].trim();
      continue;
    }

    const descMatch = trimmed.match(/--\s*@description\s+(.+)/);
    if (descMatch) {
      metadata.description = descMatch[1].trim();
      continue;
    }

    const depMatch = trimmed.match(/--\s*@depends\s+(.+)/);
    if (depMatch) {
      metadata.dependencies = metadata.dependencies || [];
      const deps = depMatch[1].split(',').map((d) => parseInt(d.trim(), 10));
      metadata.dependencies.push(...deps);
      continue;
    }

    // Section markers
    if (trimmed === '-- up') {
      currentSection = 'up';
      continue;
    }

    if (trimmed === '-- down') {
      if (currentStatement.trim()) {
        if (currentSection === 'up') {
          upStatements.push(currentStatement.trim());
        } else if (currentSection === 'down') {
          downStatements.push(currentStatement.trim());
        }
      }
      currentSection = 'down';
      currentStatement = '';
      continue;
    }

    // Build statements
    if (trimmed && !trimmed.startsWith('--')) {
      currentStatement += line + '\n';

      // Check if statement is complete
      if (trimmed.endsWith(';')) {
        const statement = currentStatement.trim();
        if (statement && statement !== ';') {
          if (currentSection === 'up') {
            upStatements.push(statement);
          } else if (currentSection === 'down') {
            downStatements.push(statement);
          }
        }
        currentStatement = '';
      }
    }
  }

  // Add remaining statement
  if (currentStatement.trim()) {
    const trimmed = currentStatement.trim();
    if (trimmed && trimmed !== ';') {
      if (currentSection === 'up') {
        upStatements.push(trimmed);
      } else if (currentSection === 'down') {
        downStatements.push(trimmed);
      }
    }
  }

  return {
    metadata,
    upSql: upStatements.join('\n'),
    downSql: downStatements.join('\n')
  };
}
