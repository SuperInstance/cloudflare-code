/**
 * Schema diff tools for comparing database schemas
 */

import type {
  DatabaseSchema,
  SchemaDiff,
  TableDefinition,
  ColumnDefinition,
  IndexDefinition
} from './types';

export class SchemaDiffer {
  /**
   * Compare two schemas and generate diff
   */
  compare(fromSchema: DatabaseSchema, toSchema: DatabaseSchema): SchemaDiff {
    const fromTableMap = new Map(fromSchema.tables.map((t) => [t.name, t]));
    const toTableMap = new Map(toSchema.tables.map((t) => [t.name, t]));

    const addedTables: string[] = [];
    const droppedTables: string[] = [];
    const modifiedTables: SchemaDiff['modifiedTables'] = [];
    const addedIndexes: Array<{ table: string; index: string }> = [];
    const droppedIndexes: Array<{ table: string; index: string }> = [];

    // Find added and dropped tables
    for (const tableName of toTableMap.keys()) {
      if (!fromTableMap.has(tableName)) {
        addedTables.push(tableName);
      }
    }

    for (const tableName of fromTableMap.keys()) {
      if (!toTableMap.has(tableName)) {
        droppedTables.push(tableName);
      }
    }

    // Find modified tables
    for (const tableName of toTableMap.keys()) {
      if (fromTableMap.has(tableName)) {
        const fromTable = fromTableMap.get(tableName)!;
        const toTable = toTableMap.get(tableName)!;

        const tableDiff = this.compareTables(fromTable, toTable);
        if (
          tableDiff.addedColumns.length > 0 ||
          tableDiff.droppedColumns.length > 0 ||
          tableDiff.modifiedColumns.length > 0
        ) {
          modifiedTables.push(tableDiff);
        }

        // Check index changes
        for (const idx of toTable.indexes || []) {
          const hasIndex = fromTable.indexes?.some((i) => i.name === idx.name);
          if (!hasIndex) {
            addedIndexes.push({ table: tableName, index: idx.name });
          }
        }

        for (const idx of fromTable.indexes || []) {
          const hasIndex = toTable.indexes?.some((i) => i.name === idx.name);
          if (!hasIndex) {
            droppedIndexes.push({ table: tableName, index: idx.name });
          }
        }
      }
    }

    return {
      addedTables,
      droppedTables,
      modifiedTables,
      addedIndexes,
      droppedIndexes
    };
  }

  /**
   * Compare two table definitions
   */
  private compareTables(
    from: TableDefinition,
    to: TableDefinition
  ): {
    name: string;
    addedColumns: string[];
    droppedColumns: string[];
    modifiedColumns: Array<{
      name: string;
      from: ColumnDefinition;
      to: ColumnDefinition;
    }>;
  } {
    const fromColMap = new Map(from.columns.map((c) => [c.name, c]));
    const toColMap = new Map(to.columns.map((c) => [c.name, c]));

    const addedColumns: string[] = [];
    const droppedColumns: string[] = [];
    const modifiedColumns: Array<{
      name: string;
      from: ColumnDefinition;
      to: ColumnDefinition;
    }> = [];

    // Find added and dropped columns
    for (const colName of toColMap.keys()) {
      if (!fromColMap.has(colName)) {
        addedColumns.push(colName);
      }
    }

    for (const colName of fromColMap.keys()) {
      if (!toColMap.has(colName)) {
        droppedColumns.push(colName);
      }
    }

    // Find modified columns
    for (const colName of toColMap.keys()) {
      if (fromColMap.has(colName)) {
        const fromCol = fromColMap.get(colName)!;
        const toCol = toColMap.get(colName)!;

        if (!this.columnsEqual(fromCol, toCol)) {
          modifiedColumns.push({
            name: colName,
            from: fromCol,
            to: toCol
          });
        }
      }
    }

    return {
      name: to.name,
      addedColumns,
      droppedColumns,
      modifiedColumns
    };
  }

  /**
   * Compare two column definitions
   */
  private columnsEqual(a: ColumnDefinition, b: ColumnDefinition): boolean {
    return (
      a.name === b.name &&
      a.type === b.type &&
      a.nullable === b.nullable &&
      a.defaultValue === b.defaultValue &&
      a.autoIncrement === b.autoIncrement &&
      a.primaryKey === b.primaryKey &&
      a.unique === b.unique &&
      JSON.stringify(a.references) === JSON.stringify(b.references)
    );
  }

  /**
   * Generate SQL statements to apply diff
   */
  generateMigrationSQL(diff: SchemaDiff): string[] {
    const statements: string[] = [];

    // Drop tables
    for (const tableName of diff.droppedTables) {
      statements.push(`DROP TABLE IF EXISTS ${tableName};`);
    }

    // Drop indexes
    for (const idx of diff.droppedIndexes) {
      statements.push(`DROP INDEX IF EXISTS ${idx.index};`);
    }

    // Add tables
    for (const tableName of diff.addedTables) {
      // This would need the full table definition
      // For now, we'll add a placeholder
      statements.push(`-- CREATE TABLE ${tableName} ...`);
    }

    // Modify tables
    for (const tableDiff of diff.modifiedTables) {
      for (const colName of tableDiff.droppedColumns) {
        statements.push(`ALTER TABLE ${tableDiff.name} DROP COLUMN ${colName};`);
      }

      for (const col of tableDiff.modifiedColumns) {
        const newCol = col.to;
        const def = this.columnDefinitionToString(newCol);
        statements.push(`ALTER TABLE ${tableDiff.name} ALTER COLUMN ${def};`);
      }

      for (const colName of tableDiff.addedColumns) {
        // This would need the column definition
        statements.push(`ALTER TABLE ${tableDiff.name} ADD COLUMN ${colName} ...;`);
      }
    }

    // Add indexes
    for (const idx of diff.addedIndexes) {
      // This would need the full index definition
      statements.push(`-- CREATE INDEX ${idx.index} ON ${idx.table} ...`);
    }

    return statements;
  }

  /**
   * Convert column definition to SQL string
   */
  private columnDefinitionToString(col: ColumnDefinition): string {
    let def = `${col.name} ${col.type}`;

    if (col.primaryKey) {
      def += ' PRIMARY KEY';
    }

    if (col.autoIncrement) {
      def += ' AUTOINCREMENT';
    }

    if (!col.nullable) {
      def += ' NOT NULL';
    }

    if (col.unique) {
      def += ' UNIQUE';
    }

    if (col.defaultValue !== undefined) {
      def += ` DEFAULT ${this.formatValue(col.defaultValue)}`;
    }

    if (col.references) {
      def += ` REFERENCES ${col.references.table}(${col.references.column})`;
      if (col.references.onDelete) {
        def += ` ON DELETE ${col.references.onDelete}`;
      }
      if (col.references.onUpdate) {
        def += ` ON UPDATE ${col.references.onUpdate}`;
      }
    }

    if (col.check) {
      def += ` CHECK (${col.check})`;
    }

    return def;
  }

  /**
   * Format value for SQL
   */
  private formatValue(value: string | number | boolean | null): string {
    if (value === null) {
      return 'NULL';
    }

    if (typeof value === 'string') {
      return `'${value}'`;
    }

    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }

    return String(value);
  }

  /**
   * Generate human-readable diff report
   */
  generateReport(diff: SchemaDiff): string {
    const lines: string[] = [];

    if (diff.addedTables.length > 0) {
      lines.push('\nAdded Tables:');
      for (const table of diff.addedTables) {
        lines.push(`  + ${table}`);
      }
    }

    if (diff.droppedTables.length > 0) {
      lines.push('\nDropped Tables:');
      for (const table of diff.droppedTables) {
        lines.push(`  - ${table}`);
      }
    }

    if (diff.modifiedTables.length > 0) {
      lines.push('\nModified Tables:');
      for (const table of diff.modifiedTables) {
        lines.push(`  ~ ${table.name}`);

        if (table.addedColumns.length > 0) {
          lines.push(`    Added columns: ${table.addedColumns.join(', ')}`);
        }

        if (table.droppedColumns.length > 0) {
          lines.push(`    Dropped columns: ${table.droppedColumns.join(', ')}`);
        }

        if (table.modifiedColumns.length > 0) {
          lines.push('    Modified columns:');
          for (const col of table.modifiedColumns) {
            lines.push(`      - ${col.name}`);
          }
        }
      }
    }

    if (diff.addedIndexes.length > 0) {
      lines.push('\nAdded Indexes:');
      for (const idx of diff.addedIndexes) {
        lines.push(`  + ${idx.index} ON ${idx.table}`);
      }
    }

    if (diff.droppedIndexes.length > 0) {
      lines.push('\nDropped Indexes:');
      for (const idx of diff.droppedIndexes) {
        lines.push(`  - ${idx.index} ON ${idx.table}`);
      }
    }

    return lines.join('\n');
  }
}
