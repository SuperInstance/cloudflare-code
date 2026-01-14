/**
 * Seed data types and interfaces
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface SeedContext {
  db: D1Database;
  env: string;
  dryRun?: boolean;
}

export interface SeedResult {
  success: boolean;
  name: string;
  tableName: string;
  rowsInserted: number;
  duration: number;
  error?: string;
}

export interface SeedMetadata {
  name: string;
  description?: string;
  tableName: string;
  order?: number;
  dependsOn?: string[];
}

export type SeedData<T = Record<string, any>> = Array<T>;

/**
 * Base class for all seeders
 */
export abstract class Seeder<T = Record<string, any>> {
  abstract readonly name: string;
  abstract readonly tableName: string;
  readonly description?: string;
  readonly order: number = 0;
  readonly dependsOn: string[] = [];

  /**
   * Get seed data
   */
  abstract data(context: SeedContext): Promise<SeedData<T>>;

  /**
   * Run the seeder
   */
  async run(context: SeedContext): Promise<SeedResult> {
    const startTime = Date.now();

    try {
      const data = await this.data(context);
      let rowsInserted = 0;

      if (context.dryRun) {
        console.log(`[DRY RUN] Would insert ${data.length} rows into ${this.tableName}`);
        return {
          success: true,
          name: this.name,
          tableName: this.tableName,
          rowsInserted: data.length,
          duration: Date.now() - startTime
        };
      }

      // Clear existing data if requested
      await this.beforeSeed(context);

      // Insert seed data
      for (const row of data) {
        await this.insertRow(context, row);
        rowsInserted++;
      }

      // Run after seed hooks
      await this.afterSeed(context);

      return {
        success: true,
        name: this.name,
        tableName: this.tableName,
        rowsInserted,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        name: this.name,
        tableName: this.tableName,
        rowsInserted: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Insert a single row
   */
  protected async insertRow(context: SeedContext, row: T): Promise<void> {
    const keys = Object.keys(row);
    const values = Object.values(row);
    const placeholders = keys.map(() => '?').join(', ');

    const sql = `
      INSERT INTO ${this.tableName} (${keys.join(', ')})
      VALUES (${placeholders})
    `;

    await context.db.prepare(sql).bind(...values).run();
  }

  /**
   * Hook before seeding (override to clear table, etc.)
   */
  protected async beforeSeed(_context: SeedContext): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Hook after seeding (override for post-processing)
   */
  protected async afterSeed(_context: SeedContext): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Get metadata
   */
  getMetadata(): SeedMetadata {
    return {
      name: this.name,
      description: this.description,
      tableName: this.tableName,
      order: this.order,
      dependsOn: this.dependsOn
    };
  }
}
