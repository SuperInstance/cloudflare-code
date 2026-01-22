/**
 * Data Migration Types
 *
 * Core types for data migration between shards and regions
 */

export type MigrationStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'rolled-back';
export type MigrationType = 'reshard' | 'rebalance' | 'region-move' | 'schema-change' | 'bulk-import';

export interface MigrationTask {
  id: string;
  type: MigrationType;
  source: {
    shardId: string;
    region: string;
    table: string;
  };
  target: {
    shardId: string;
    region: string;
    table: string;
  };
  status: MigrationStatus;
  progress: number;
  totalRows: number;
  migratedRows: number;
  failedRows: number;
  startTime?: Date;
  endTime?: Date;
  error?: Error;
  checksums: {
    source: string;
    target: string;
  };
}

export interface MigrationBatch {
  taskId: string;
  batchNumber: number;
  rows: unknown[];
  checksum: string;
  status: MigrationStatus;
}

export interface MigrationPlan {
  tasks: MigrationTask[];
  dependencies: Map<string, string[]>;
  estimatedTime: number;
  estimatedDataMovement: number;
  rollbackPlan: MigrationTask[];
}

export interface ReshardConfig {
  currentShards: string[];
  newShards: string[];
  strategy: 'split' | 'merge' | 'move';
  batchSize: number;
  maxParallelTasks: number;
}

export interface SchemaChange {
  type: 'add-column' | 'drop-column' | 'rename-column' | 'change-type' | 'add-index' | 'drop-index';
  table: string;
  column?: string;
  definition?: string;
  rollback?: string;
}

export interface BulkImportConfig {
  source: {
    type: 'csv' | 'json' | 'database';
    location: string;
  };
  target: {
    shardId: string;
    table: string;
  };
  format: {
    delimiter?: string;
    headers: boolean;
    encoding: string;
  };
  batchSize: number;
  skipErrors: boolean;
}
