/**
 * Core type definitions for the scheduler package
 */

import { DurableObjectStorage } from '@cloudflare/workers-types';

/**
 * Cron expression parts
 */
export interface CronParts {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

/**
 * Cron expression with optional seconds and optional fields
 */
export type CronExpression = string;

/**
 * Time zone specification
 */
export type TimeZone = string;

/**
 * Job priority levels
 */
export enum JobPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  DEFERRED = 4
}

/**
 * Job status
 */
export enum JobStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  RETRYING = 'retrying'
}

/**
 * Job execution result
 */
export interface JobResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  executionTime: number;
  startedAt: Date;
  completedAt: Date;
  attemptNumber: number;
}

/**
 * Job retry policy
 */
export interface RetryPolicy {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

/**
 * Job timeout configuration
 */
export interface TimeoutConfig {
  duration: number;
  strategy: 'kill' | 'notify' | 'escalate';
  onTimeout?: (job: Job) => void | Promise<void>;
}

/**
 * Job concurrency limits
 */
export interface ConcurrencyConfig {
  maxConcurrent: number;
  perGroup?: Record<string, number>;
  queueStrategy: 'fifo' | 'lifo' | 'priority' | 'weighted';
}

/**
 * Job definition
 */
export interface JobDefinition<T = any> {
  id: string;
  name: string;
  handler: JobHandler<T>;
  cronExpression?: CronExpression;
  schedule?: CronExpression;
  priority?: JobPriority;
  retryPolicy?: RetryPolicy;
  timeout?: TimeoutConfig;
  concurrency?: ConcurrencyConfig;
  dependencies?: string[];
  metadata?: Record<string, any>;
  enabled?: boolean;
  timeZone?: TimeZone;
  maxExecutionTime?: number;
  tags?: string[];
}

/**
 * Job handler function
 */
export type JobHandler<T = any> = (context: JobExecutionContext<T>) => Promise<T> | T;

/**
 * Job execution context
 */
export interface JobExecutionContext<T = any> {
  job: Job<T>;
  attemptNumber: number;
  startTime: Date;
  timeout: number;
  storage?: DurableObjectStorage;
  logger: Logger;
  signal: AbortSignal;
  metadata: Record<string, any>;
}

/**
 * Job instance
 */
export interface Job<T = any> {
  id: string;
  definitionId: string;
  name: string;
  status: JobStatus;
  priority: JobPriority;
  scheduledTime: Date;
  startedAt?: Date;
  completedAt?: Date;
  executionTime?: number;
  result?: JobResult<T>;
  error?: Error;
  attemptNumber: number;
  maxAttempts: number;
  nextRetryTime?: Date;
  dependencies: string[];
  dependentJobs: string[];
  metadata: Record<string, any>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Job queue entry
 */
export interface QueuedJob {
  job: Job;
  queuedAt: Date;
  priority: JobPriority;
  scheduledTime: Date;
  estimatedWaitTime?: number;
}

/**
 * Dependency relationship
 */
export interface Dependency {
  jobId: string;
  dependsOn: string;
  type: 'hard' | 'soft';
  condition?: (result: JobResult) => boolean;
}

/**
 * Dependency graph
 */
export interface DependencyGraph {
  nodes: Map<string, Job>;
  edges: Map<string, Set<string>>;
  reverseEdges: Map<string, Set<string>>;
}

/**
 * Distributed node information
 */
export interface NodeInfo {
  id: string;
  address: string;
  port: number;
  lastHeartbeat: Date;
  status: 'active' | 'inactive' | 'draining';
  capabilities: string[];
  load: number;
  scheduledJobs: number;
  runningJobs: number;
}

/**
 * Cluster state
 */
export interface ClusterState {
  nodes: Map<string, NodeInfo>;
  leader: string | null;
  term: number;
  jobs: Map<string, Job>;
  queues: Map<string, QueuedJob[]>;
}

/**
 * Lock information
 */
export interface DistributedLock {
  key: string;
  owner: string;
  acquiredAt: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Scheduling metrics
 */
export interface SchedulingMetrics {
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  averageExecutionTime: number;
  successRate: number;
  throughput: number;
  queueDepth: number;
  nodeUtilization: number;
}

/**
 * Execution statistics
 */
export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  retriedExecutions: number;
  timeoutExecutions: number;
  cancelledExecutions: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  percentileExecutionTime: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  executionsByHour: Map<number, number>;
  executionsByDay: Map<string, number>;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  schedulingAccuracy: number;
  schedulingLatency: number;
  executionLatency: number;
  queueWaitTime: number;
  resourceUtilization: number;
  throughput: number;
  errorRate: number;
  retryRate: number;
}

/**
 * Capacity planning data
 */
export interface CapacityPlanning {
  currentCapacity: number;
  projectedCapacity: number;
  utilization: number;
  projectedUtilization: number;
  recommendations: string[];
  scalingEvents: ScalingEvent[];
}

/**
 * Scaling event
 */
export interface ScalingEvent {
  timestamp: Date;
  type: 'scale-up' | 'scale-down';
  reason: string;
  fromNodes: number;
  toNodes: number;
}

/**
 * Job notification
 */
export interface JobNotification {
  jobId: string;
  jobName: string;
  type: 'started' | 'completed' | 'failed' | 'timeout' | 'retrying';
  timestamp: Date;
  message: string;
  metadata?: Record<string, any>;
  recipients?: string[];
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  type: 'scheduling' | 'execution' | 'resource' | 'dependency';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  effort: string;
  action: string;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  maxConcurrentJobs: number;
  queueSizeLimit: number;
  defaultPriority: JobPriority;
  defaultTimeout: number;
  defaultRetryPolicy: RetryPolicy;
  enableDistributed: boolean;
  enableMonitoring: boolean;
  enableAnalytics: boolean;
  clusterSize: number;
  leaderElectionTimeout: number;
  heartbeatInterval: number;
  stateSyncInterval: number;
  timeZone: TimeZone;
}

/**
 * Cron validation result
 */
export interface CronValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedExpression?: string;
}

/**
 * Next execution calculation
 */
export interface NextExecution {
  timestamp: Date;
  originalExpression: CronExpression;
  normalizedExpression: CronExpression;
  timeZone: TimeZone;
  previousExecution?: Date;
}

/**
 * Execution history entry
 */
export interface ExecutionHistoryEntry {
  jobId: string;
  jobName: string;
  executionTime: Date;
  scheduledTime: Date;
  completedAt: Date;
  status: JobStatus;
  duration: number;
  attemptNumber: number;
  node: string;
  result?: JobResult;
}

/**
 * Human-readable cron description
 */
export interface CronDescription {
  expression: CronExpression;
  description: string;
  nextExecutions: Date[];
  previousExecutions: Date[];
  timeZone: TimeZone;
}

/**
 * Custom schedule
 */
export interface CustomSchedule {
  type: 'interval' | 'once' | 'custom';
  interval?: number;
  at?: Date;
  condition?: () => boolean | Promise<boolean>;
  timezone?: TimeZone;
}

/**
 * Job group configuration
 */
export interface JobGroup {
  id: string;
  name: string;
  jobs: string[];
  concurrencyLimit?: number;
  priority?: JobPriority;
  metadata?: Record<string, any>;
}
