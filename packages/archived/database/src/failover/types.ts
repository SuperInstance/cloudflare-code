/**
 * Failover and Recovery Types
 *
 * Core types for automatic failover and disaster recovery
 */

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'failed';
export type FailoverState = 'active' | 'failing-over' | 'recovered' | 'maintenance';
export type RecoveryMode = 'automatic' | 'manual' | 'semi-automatic';

export interface NodeInfo {
  id: string;
  region: string;
  role: 'primary' | 'replica' | 'arbiter';
  status: HealthStatus;
  lastHeartbeat: Date;
  endpoint: string;
  priority: number;
}

export interface HealthCheck {
  nodeId: string;
  timestamp: Date;
  status: HealthStatus;
  latency: number;
  errorRate: number;
  details: Record<string, unknown>;
}

export interface FailoverConfig {
  heartbeatInterval: number;
  failureThreshold: number;
  recoveryThreshold: number;
  electionTimeout: number;
  automaticFailover: boolean;
  recoveryMode: RecoveryMode;
  maxRetries: number;
  retryDelay: number;
  dataSyncThreshold: number;
}

export interface FailoverEvent {
  id: string;
  type: 'failure' | 'recovery' | 'election' | 'manual';
  nodeId: string;
  timestamp: Date;
  reason: string;
  actions: string[];
  completed: boolean;
}

export interface RecoveryPlan {
  nodeId: string;
  steps: RecoveryStep[];
  estimatedTime: number;
  dataSyncRequired: boolean;
  rollbackPlan: RecoveryStep[];
}

export interface RecoveryStep {
  id: string;
  description: string;
  action: () => Promise<void>;
  timeout: number;
  retryable: boolean;
  completed: boolean;
}

export interface ElectionResult {
  leaderId: string;
  term: number;
  votes: Map<string, boolean>;
  timestamp: Date;
}

export interface BackupInfo {
  id: string;
  nodeId: string;
  timestamp: Date;
  size: number;
  type: 'full' | 'incremental';
  location: string;
  checksum: string;
}

export interface PointInTimeRecovery {
  timestamp: Date;
  sequence: number;
  available: boolean;
}

export interface FailoverMetrics {
  totalFailovers: number;
  totalRecoveries: number;
  avgFailoverTime: number;
  avgRecoveryTime: number;
  dataLossEvents: number;
  currentTerm: number;
}
