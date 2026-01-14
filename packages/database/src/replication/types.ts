/**
 * Database Replication Types
 *
 * Core types for multi-region database replication on Cloudflare D1
 */

export type ReplicationMode = 'async' | 'sync' | 'semi-sync';

export type ConsistencyLevel = 'strong' | 'eventual' | 'causal' | 'read-your-writes' | 'quorum';

export type ReplicationTopology = 'primary-replica' | 'multi-leader' | 'peer-to-peer';

export interface Region {
  id: string;
  name: string;
  endpoint: string;
  primary: boolean;
  latency: number;
  available: boolean;
}

export interface Replica {
  id: string;
  region: Region;
  role: 'primary' | 'replica' | 'arbitrator';
  status: 'online' | 'offline' | 'syncing' | 'lagging';
  lagMs: number;
  lastSync: Date;
}

export interface ReplicationConfig {
  mode: ReplicationMode;
  topology: ReplicationTopology;
  consistency: ConsistencyLevel;
  regions: Region[];
  quorumSize: number;
  heartbeatInterval: number;
  maxLagMs: number;
  retryAttempts: number;
  timeoutMs: number;
}

export interface ReplicationLog {
  id: string;
  sequence: number;
  timestamp: Date;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL';
  table: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  applied: boolean;
}

export interface ReplicationStatus {
  primaryRegion: string;
  replicas: Replica[];
  lagMs: number;
  syncPercentage: number;
  throughput: number;
  errorRate: number;
}

export interface ReplicationMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  replicationLag: number;
  conflicts: number;
  resolutions: number;
}

export interface WriteRequest {
  id: string;
  query: string;
  params: unknown[];
  timestamp: Date;
  consistency: ConsistencyLevel;
  quorum: number;
}

export interface ReadRequest {
  id: string;
  query: string;
  params: unknown[];
  timestamp: Date;
  consistency: ConsistencyLevel;
  regionPreference?: string[];
}

export interface ReplicationResult {
  success: boolean;
  sequence: number;
  regions: string[];
  latencyMs: number;
  error?: Error;
}

export interface ConflictResolution {
  strategy: 'last-write-wins' | 'first-write-wins' | 'merge' | 'custom';
  resolver?: (conflict: DataConflict) => Record<string, unknown>;
}

export interface DataConflict {
  id: string;
  table: string;
  key: string;
  versions: Array<{
    region: string;
    data: Record<string, unknown>;
    timestamp: Date;
    version: number;
  }>;
}

export interface ReplicationCheckpoint {
  sequence: number;
  timestamp: Date;
  regions: Record<string, number>;
}

export interface ReplicationStream {
  id: string;
  source: string;
  destination: string;
  status: 'active' | 'paused' | 'error';
  checkpoint: ReplicationCheckpoint;
  throughput: number;
}
