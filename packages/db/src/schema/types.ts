/**
 * Schema types and interfaces for D1 database
 */

export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  nullable?: boolean;
  defaultValue?: string | number | boolean | null;
  autoIncrement?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  check?: string;
  collate?: string;
  references?: {
    table: string;
    column: string;
    onDelete?: ReferenceAction;
    onUpdate?: ReferenceAction;
  };
}

export type ColumnType =
  | 'INTEGER'
  | 'REAL'
  | 'TEXT'
  | 'BLOB'
  | 'ANY'
  | 'NUMERIC'
  | 'BOOLEAN'
  | 'DATETIME'
  | 'JSON'
  | 'UUID';

export type ReferenceAction = 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'SET DEFAULT';

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
  where?: string;
  type?: 'BTREE' | 'HASH';
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  indexes?: IndexDefinition[];
  checkConstraints?: string[];
  comment?: string;
}

export interface ForeignKeyDefinition {
  name: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  onDelete?: ReferenceAction;
  onUpdate?: ReferenceAction;
}

export interface SchemaSnapshot {
  version: number;
  timestamp: number;
  tables: TableDefinition[];
}

export interface SchemaDiff {
  addedTables: string[];
  droppedTables: string[];
  modifiedTables: Array<{
    name: string;
    addedColumns: string[];
    droppedColumns: string[];
    modifiedColumns: Array<{
      name: string;
      from: ColumnDefinition;
      to: ColumnDefinition;
    }>;
  }>;
  addedIndexes: Array<{ table: string; index: string }>;
  droppedIndexes: Array<{ table: string; index: string }>;
}

export interface ConstraintDefinition {
  name: string;
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
  table?: string;
  columns?: string[];
  checkExpression?: string;
  referenceTable?: string;
  referenceColumn?: string;
  onDelete?: ReferenceAction;
  onUpdate?: ReferenceAction;
}

export interface TriggerDefinition {
  name: string;
  table: string;
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  events: Array<'INSERT' | 'UPDATE' | 'DELETE'>;
  condition?: string;
  body: string;
}

export interface ViewDefinition {
  name: string;
  query: string;
  columns?: string[];
}

export interface DatabaseSchema {
  tables: TableDefinition[];
  views?: ViewDefinition[];
  triggers?: TriggerDefinition[];
}
