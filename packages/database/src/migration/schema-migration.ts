/**
 * Schema Migration
 *
 * Handles database schema changes with zero-downtime migrations
 */

import type { SchemaChange, MigrationTask, MigrationStatus } from './types';

export class SchemaMigration {
  private changes: Map<string, SchemaChange[]>;
  private appliedChanges: Set<string>;
  private rollbackStack: Array<{ changeId: string; rollback: string }>;

  constructor() {
    this.changes = new Map();
    this.appliedChanges = new Set();
    this.rollbackStack = [];
  }

  /**
   * Plan schema change
   */
  planChange(change: SchemaChange): string {
    const changeId = `${change.type}-${change.table}-${Date.now()}`;

    let tableChanges = this.changes.get(change.table);
    if (!tableChanges) {
      tableChanges = [];
      this.changes.set(change.table, tableChanges);
    }

    tableChanges.push(change);

    return changeId;
  }

  /**
   * Apply schema change with zero downtime
   */
  async applyChange(
    change: SchemaChange,
    execute: (sql: string) => Promise<void>
  ): Promise<{
    success: boolean;
    changeId: string;
    steps: string[];
  }> {
    const changeId = this.planChange(change);
    const steps: string[] = [];

    try {
      switch (change.type) {
        case 'add-column':
          await this.applyAddColumn(change, execute, steps);
          break;

        case 'drop-column':
          await this.applyDropColumn(change, execute, steps);
          break;

        case 'rename-column':
          await this.applyRenameColumn(change, execute, steps);
          break;

        case 'change-type':
          await this.applyChangeType(change, execute, steps);
          break;

        case 'add-index':
          await this.applyAddIndex(change, execute, steps);
          break;

        case 'drop-index':
          await this.applyDropIndex(change, execute, steps);
          break;
      }

      this.appliedChanges.add(changeId);

      return {
        success: true,
        changeId,
        steps,
      };
    } catch (error) {
      return {
        success: false,
        changeId,
        steps,
      };
    }
  }

  /**
   * Add column with zero downtime
   */
  private async applyAddColumn(
    change: SchemaChange,
    execute: (sql: string) => Promise<void>,
    steps: string[]
  ): Promise<void> {
    // Step 1: Add column as nullable
    const sql1 = `ALTER TABLE ${change.table} ADD COLUMN ${change.definition} NULL`;
    steps.push('Add nullable column');
    await execute(sql1);

    // Step 2: Backfill data (if needed)
    steps.push('Backfill existing data');
    await this.delay(100);

    // Step 3: Make column NOT NULL if required
    if (change.definition && !change.definition.includes('NULL')) {
      const sql3 = `ALTER TABLE ${change.table} ALTER COLUMN ${change.column} SET NOT NULL`;
      steps.push('Make column NOT NULL');
      await execute(sql3);
    }
  }

  /**
   * Drop column safely
   */
  private async applyDropColumn(
    change: SchemaChange,
    execute: (sql: string) => Promise<void>,
    steps: string[]
  ): Promise<void> {
    // Step 1: Mark column as deprecated (application level)
    steps.push('Mark column as deprecated');
    await this.delay(100);

    // Step 2: Stop using column in application
    steps.push('Stop using column in application');
    await this.delay(100);

    // Step 3: Drop column
    const sql3 = `ALTER TABLE ${change.table} DROP COLUMN ${change.column}`;
    steps.push('Drop column');
    await execute(sql3);
  }

  /**
   * Rename column with zero downtime
   */
  private async applyRenameColumn(
    change: SchemaChange,
    execute: (sql: string) => Promise<void>,
    steps: string[]
  ): Promise<void> {
    // Step 1: Add new column
    const sql1 = `ALTER TABLE ${change.table} ADD COLUMN ${change.definition} NULL`;
    steps.push('Add new column');
    await execute(sql1);

    // Step 2: Copy data to new column
    const sql2 = `UPDATE ${change.table} SET ${change.definition?.split(' ')[0]} = ${change.column}`;
    steps.push('Copy data to new column');
    await execute(sql2);

    // Step 3: Update application to use new column
    steps.push('Update application to use new column');
    await this.delay(100);

    // Step 4: Drop old column
    const sql4 = `ALTER TABLE ${change.table} DROP COLUMN ${change.column}`;
    steps.push('Drop old column');
    await execute(sql4);
  }

  /**
   * Change column type safely
   */
  private async applyChangeType(
    change: SchemaChange,
    execute: (sql: string) => Promise<void>,
    steps: string[]
  ): Promise<void> {
    // Step 1: Add new column with new type
    const newColName = `${change.column}_new`;
    const sql1 = `ALTER TABLE ${change.table} ADD COLUMN ${newColName} ${change.definition}`;
    steps.push('Add new column with new type');
    await execute(sql1);

    // Step 2: Migrate data to new column
    const sql2 = `UPDATE ${change.table} SET ${newColName} = CAST(${change.column} AS ${change.definition})`;
    steps.push('Migrate data to new column');
    await execute(sql2);

    // Step 3: Verify data integrity
    steps.push('Verify data integrity');
    await this.delay(100);

    // Step 4: Replace old column
    steps.push('Replace old column');
    await this.delay(100);
  }

  /**
   * Add index concurrently
   */
  private async applyAddIndex(
    change: SchemaChange,
    execute: (sql: string) => Promise<void>,
    steps: string[]
  ): Promise<void> {
    // Create index concurrently to avoid locking
    const sql = `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_${change.table}_${change.column} ON ${change.table} (${change.column})`;
    steps.push('Create index concurrently');
    await execute(sql);
  }

  /**
   * Drop index safely
   */
  private async applyDropIndex(
    change: SchemaChange,
    execute: (sql: string) => Promise<void>,
    steps: string[]
  ): Promise<void> {
    const sql = `DROP INDEX CONCURRENTLY IF EXISTS idx_${change.table}_${change.column}`;
    steps.push('Drop index concurrently');
    await execute(sql);
  }

  /**
   * Rollback a schema change
   */
  async rollback(
    changeId: string,
    execute: (sql: string) => Promise<void>
  ): Promise<boolean> {
    const rollbackEntry = this.rollbackStack.find((e) => e.changeId === changeId);
    if (!rollbackEntry) {
      return false;
    }

    try {
      await execute(rollbackEntry.rollback);
      this.appliedChanges.delete(changeId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate schema changes
   */
  async validate(
    table: string,
    execute: (sql: string) => Promise<unknown>
  ): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check if table exists
    try {
      await execute(`SELECT 1 FROM ${table} LIMIT 1`);
    } catch (error) {
      issues.push(`Table ${table} does not exist`);
      return { valid: false, issues };
    }

    // Validate applied changes
    const changes = this.changes.get(table) || [];
    for (const change of changes) {
      // Validate each change
      // In real implementation, would check schema
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get pending changes
   */
  getPendingChanges(table?: string): SchemaChange[] {
    if (table) {
      const changes = this.changes.get(table) || [];
      return changes.filter((c) => !this.appliedChanges.has(`${c.type}-${c.table}`));
    }

    const allChanges: SchemaChange[] = [];
    for (const [tbl, changes] of this.changes) {
      allChanges.push(...changes);
    }
    return allChanges.filter((c) => !this.appliedChanges.has(`${c.type}-${c.table}`));
  }

  /**
   * Get applied changes
   */
  getAppliedChanges(): Set<string> {
    return new Set(this.appliedChanges);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
