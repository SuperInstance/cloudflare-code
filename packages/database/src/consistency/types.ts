/**
 * Consistency Model Types
 *
 * Core types for various database consistency models
 */

export type ConsistencyModel =
  | 'strong'
  | 'eventual'
  | 'causal'
  | 'read-your-writes'
  | 'quorum'
  | 'session'
  | 'monotonic';

export interface ConsistencyConfig {
  model: ConsistencyModel;
  quorumSize: number;
  readQuorum: number;
  writeQuorum: number;
  timeout: number;
  maxStaleness: number;
}

export interface ReadOperation {
  id: string;
  query: string;
  params: unknown[];
  consistency: ConsistencyModel;
  timestamp: Date;
  sessionId?: string;
  vectorClock?: Map<string, number>;
}

export interface WriteOperation {
  id: string;
  query: string;
  params: unknown[];
  consistency: ConsistencyModel;
  timestamp: Date;
  sessionId?: string;
  vectorClock?: Map<string, number>;
}

export interface ReadResult<T> {
  data: T;
  version: number;
  timestamp: Date;
  stale: boolean;
  fromRegion: string;
  consistency: ConsistencyModel;
}

export interface WriteResult {
  success: boolean;
  version: number;
  replicatedTo: string[];
  latency: number;
}

export interface QuorumResult<T> {
  consensus: boolean;
  data: T | null;
  votes: number;
  required: number;
  responses: Array<{
    region: string;
    data: T;
    version: number;
  }>;
}

export interface VectorClock {
  clock: Map<string, number>;
  timestamp: number;
}

export interface SessionState {
  id: string;
  lastWriteTime: Date;
  lastReadTime: Date;
  writtenVersions: Set<string>;
  readVersions: Set<string>;
}

export interface ConsistencyViolation {
  type: 'stale-read' | 'lost-update' | 'non-repeatable-read' | 'phantom-read';
  expected: unknown;
  actual: unknown;
  operation: string;
  timestamp: Date;
}

export interface ConsistencyCheck {
  check(): Promise<boolean>;
  enforce(): Promise<void>;
}
