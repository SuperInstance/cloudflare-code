/**
 * Schema builder for creating table definitions programmatically
 */

import type {
  TableDefinition,
  ColumnDefinition,
  IndexDefinition,
  ColumnType,
  ReferenceAction
} from './types';

export class SchemaBuilder {
  private tables: Map<string, TableBuilder> = new Map();

  /**
   * Create or get a table builder
   */
  table(name: string): TableBuilder {
    if (!this.tables.has(name)) {
      this.tables.set(name, new TableBuilder(name));
    }
    return this.tables.get(name)!;
  }

  /**
   * Build all table definitions
   */
  build(): TableDefinition[] {
    return Array.from(this.tables.values()).map((tb) => tb.build());
  }

  /**
   * Generate CREATE TABLE SQL
   */
  toSQL(): string[] {
    const statements: string[] = [];

    for (const table of this.tables.values()) {
      statements.push(table.toSQL());
    }

    return statements;
  }
}

export class TableBuilder {
  private columns: ColumnDefinition[] = [];
  private indexes: IndexDefinition[] = [];
  private checkConstraints: string[] = [];
  private comment?: string;
  private primaryKeys: string[] = [];

  constructor(private readonly name: string) {}

  /**
   * Add a column to the table
   */
  column(
    name: string,
    type: ColumnType,
    options: Partial<ColumnDefinition> = {}
  ): TableBuilder {
    const col: ColumnDefinition = {
      name,
      type,
      nullable: options.nullable ?? false,
      defaultValue: options.defaultValue,
      autoIncrement: options.autoIncrement ?? false,
      primaryKey: options.primaryKey ?? false,
      unique: options.unique ?? false,
      check: options.check,
      collate: options.collate,
      references: options.references
    };

    this.columns.push(col);

    if (col.primaryKey) {
      this.primaryKeys.push(name);
    }

    return this;
  }

  /**
   * Add integer column
   */
  integer(name: string, options: Partial<ColumnDefinition> = {}): TableBuilder {
    return this.column(name, 'INTEGER', options);
  }

  /**
   * Add text column
   */
  text(name: string, options: Partial<ColumnDefinition> = {}): TableBuilder {
    return this.column(name, 'TEXT', options);
  }

  /**
   * Add real/double column
   */
  real(name: string, options: Partial<ColumnDefinition> = {}): TableBuilder {
    return this.column(name, 'REAL', options);
  }

  /**
   * Add blob column
   */
  blob(name: string, options: Partial<ColumnDefinition> = {}): TableBuilder {
    return this.column(name, 'BLOB', options);
  }

  /**
   * Add boolean column (stored as INTEGER)
   */
  boolean(name: string, options: Partial<ColumnDefinition> = {}): TableBuilder {
    return this.column(name, 'BOOLEAN', options);
  }

  /**
   * Add datetime column (stored as TEXT or INTEGER)
   */
  datetime(name: string, options: Partial<ColumnDefinition> = {}): TableBuilder {
    return this.column(name, 'DATETIME', options);
  }

  /**
   * Add JSON column (stored as TEXT)
   */
  json(name: string, options: Partial<ColumnDefinition> = {}): TableBuilder {
    return this.column(name, 'JSON', options);
  }

  /**
   * Add UUID column (stored as TEXT)
   */
  uuid(name: string, options: Partial<ColumnDefinition> = {}): TableBuilder {
    return this.column(name, 'UUID', options);
  }

  /**
   * Add auto-incrementing ID column
   */
  id(name: string = 'id'): TableBuilder {
    return this.column(name, 'INTEGER', {
      primaryKey: true,
      autoIncrement: true,
      nullable: false
    });
  }

  /**
   * Add foreign key reference
   */
  foreignKey(
    column: string,
    refTable: string,
    refColumn: string,
    options: {
      onDelete?: ReferenceAction;
      onUpdate?: ReferenceAction;
    } = {}
  ): TableBuilder {
    const col = this.columns.find((c) => c.name === column);
    if (col) {
      col.references = {
        table: refTable,
        column: refColumn,
        onDelete: options.onDelete,
        onUpdate: options.onUpdate
      };
    }
    return this;
  }

  /**
   * Add timestamp columns (created_at, updated_at)
   */
  timestamps(): TableBuilder {
    this.column('created_at', 'DATETIME', {
      nullable: false,
      defaultValue: 'CURRENT_TIMESTAMP'
    });

    this.column('updated_at', 'DATETIME', {
      nullable: false,
      defaultValue: 'CURRENT_TIMESTAMP'
    });

    return this;
  }

  /**
   * Add soft delete column (deleted_at)
   */
  softDeletes(): TableBuilder {
    this.column('deleted_at', 'DATETIME', { nullable: true });
    return this;
  }

  /**
   * Add index
   */
  index(
    name: string,
    columns: string[],
    options: { unique?: boolean; where?: string } = {}
  ): TableBuilder {
    this.indexes.push({
      name,
      columns,
      unique: options.unique ?? false,
      where: options.where
    });
    return this;
  }

  /**
   * Add unique index
   */
  unique(name: string, columns: string[], options?: { where?: string }): TableBuilder {
    return this.index(name, columns, { ...options, unique: true });
  }

  /**
   * Add check constraint
   */
  check(constraint: string): TableBuilder {
    this.checkConstraints.push(constraint);
    return this;
  }

  /**
   * Add comment
   */
  setComment(comment: string): TableBuilder {
    this.comment = comment;
    return this;
  }

  /**
   * Build table definition
   */
  build(): TableDefinition {
    return {
      name: this.name,
      columns: [...this.columns],
      indexes: this.indexes.length > 0 ? [...this.indexes] : undefined,
      checkConstraints: this.checkConstraints.length > 0 ? [...this.checkConstraints] : undefined,
      comment: this.comment
    };
  }

  /**
   * Generate CREATE TABLE SQL
   */
  toSQL(): string {
    const lines: string[] = [];

    // Table comment
    if (this.comment) {
      lines.push(`-- Table: ${this.name}`);
      lines.push(`-- ${this.comment}`);
    }

    // Create table
    lines.push(`CREATE TABLE IF NOT EXISTS ${this.name} (`);

    // Columns
    const columnDefs = this.columns.map((col) => this.columnToSQL(col));
    lines.push('  ' + columnDefs.join(',\n  '));

    // Check constraints
    if (this.checkConstraints.length > 0) {
      lines.push(
        ', ' + this.checkConstraints.map((c) => `CHECK (${c})`).join(', ')
      );
    }

    // Primary key (if composite)
    if (this.primaryKeys.length > 1) {
      lines.push(`, PRIMARY KEY (${this.primaryKeys.join(', ')})`);
    }

    lines.push(');');

    // Indexes
    for (const idx of this.indexes) {
      const unique = idx.unique ? 'UNIQUE ' : '';
      const where = idx.where ? ` WHERE ${idx.where}` : '';
      lines.push(
        `CREATE ${unique}INDEX IF NOT EXISTS ${idx.name} ON ${this.name} (${idx.columns.join(', ')})${where};`
      );
    }

    return lines.join('\n');
  }

  /**
   * Convert column definition to SQL
   */
  private columnToSQL(col: ColumnDefinition): string {
    let sql = `${col.name} ${col.type}`;

    if (col.primaryKey) {
      sql += ' PRIMARY KEY';
    }

    if (col.autoIncrement) {
      sql += ' AUTOINCREMENT';
    }

    if (!col.nullable) {
      sql += ' NOT NULL';
    }

    if (col.unique && !col.primaryKey) {
      sql += ' UNIQUE';
    }

    if (col.defaultValue !== undefined) {
      sql += ` DEFAULT ${this.formatValue(col.defaultValue)}`;
    }

    if (col.references) {
      sql += ` REFERENCES ${col.references.table}(${col.references.column})`;

      if (col.references.onDelete) {
        sql += ` ON DELETE ${col.references.onDelete}`;
      }

      if (col.references.onUpdate) {
        sql += ` ON UPDATE ${col.references.onUpdate}`;
      }
    }

    if (col.check) {
      sql += ` CHECK (${col.check})`;
    }

    if (col.collate) {
      sql += ` COLLATE ${col.collate}`;
    }

    return sql;
  }

  /**
   * Format value for SQL
   */
  private formatValue(value: string | number | boolean | null): string {
    if (value === null) {
      return 'NULL';
    }

    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }

    return String(value);
  }
}
