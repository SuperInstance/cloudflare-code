/**
 * Task Management Type Definitions
 *
 * This file contains all types related to task creation, execution,
 * tracking, and management in the agent framework.
 */

import type { AgentId, TaskId } from './agent.types';

/**
 * Task status enum
 */
export enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  ASSIGNED = 'assigned',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
  CRITICAL = 4
}

/**
 * Task execution strategy
 */
export enum ExecutionStrategy {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  PIPELINE = 'pipeline',
  FAN_OUT = 'fan_out',
  FAN_IN = 'fan_in',
  MAP_REDUCE = 'map_reduce'
}

/**
 * Base task interface
 */
export interface Task {
  id: TaskId;
  type: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  input: TaskInput;
  output?: TaskOutput;
  error?: TaskError;
  assignedAgent?: AgentId;
  createdBy: AgentId;
  createdAt: number;
  assignedAt?: number;
  startedAt?: number;
  completedAt?: number;
  timeout: number;
  retryPolicy: RetryPolicy;
  dependencies: TaskDependency[];
  metadata: TaskMetadata;
  executionStrategy?: ExecutionStrategy;
  estimatedDuration?: number;
  actualDuration?: number;
  progress: TaskProgress;
}

/**
 * Task input
 */
export interface TaskInput {
  data: Record<string, unknown>;
  schema?: TaskInputSchema;
  validation?: TaskValidation;
}

/**
 * Task input schema
 */
export interface TaskInputSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, TaskInputSchema>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Task validation rules
 */
export interface TaskValidation {
  rules: ValidationRule[];
  strict: boolean;
}

/**
 * Validation rule
 */
export interface ValidationRule {
  field: string;
  type: string;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: unknown[];
  custom?: (value: unknown) => boolean;
}

/**
 * Task output
 */
export interface TaskOutput {
  data: Record<string, unknown>;
  artifacts?: TaskArtifact[];
  metrics?: TaskMetrics;
}

/**
 * Task artifact (files, data, etc.)
 */
export interface TaskArtifact {
  name: string;
  type: string;
  uri: string;
  size?: number;
  hash?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Task metrics
 */
export interface TaskMetrics {
  executionTime: number;
  cpuTime: number;
  memoryUsed: number;
  tokensUsed?: number;
  cost?: number;
  customMetrics?: Record<string, number>;
}

/**
 * Task error information
 */
export interface TaskError {
  code: string;
  message: string;
  stack?: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  occurredAt: number;
}

/**
 * Task retry policy
 */
export interface RetryPolicy {
  maxRetries: number;
  currentRetry: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
  retryAt?: number;
}

/**
 * Task dependency
 */
export interface TaskDependency {
  taskId: TaskId;
  type: 'hard' | 'soft';
  condition?: DependencyCondition;
}

/**
 * Dependency condition
 */
export interface DependencyCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'exists';
  value: unknown;
}

/**
 * Task metadata
 */
export interface TaskMetadata {
  tags: string[];
  category?: string;
  project?: string;
  sessionId?: string;
  userId?: string;
  traceId?: string;
  parentTaskId?: TaskId;
  customFields: Record<string, unknown>;
}

/**
 * Task progress tracking
 */
export interface TaskProgress {
  percentage: number;
  currentStep: string;
  totalSteps: number;
  completedSteps: string[];
  estimatedTimeRemaining?: number;
  lastUpdated: number;
  details?: Record<string, unknown>;
}

/**
 * Task creation parameters
 */
export interface CreateTaskParams {
  type: string;
  name: string;
  description?: string;
  priority?: TaskPriority;
  input: TaskInput;
  timeout?: number;
  retryPolicy?: Partial<RetryPolicy>;
  dependencies?: TaskDependency[];
  metadata?: Partial<TaskMetadata>;
  executionStrategy?: ExecutionStrategy;
  estimatedDuration?: number;
  assignedAgent?: AgentId;
}

/**
 * Task update parameters
 */
export interface UpdateTaskParams {
  status?: TaskStatus;
  output?: TaskOutput;
  error?: TaskError;
  progress?: Partial<TaskProgress>;
  assignedAgent?: AgentId;
}

/**
 * Task query filter
 */
export interface TaskFilter {
  status?: TaskStatus | TaskStatus[];
  type?: string | string[];
  priority?: TaskPriority | TaskPriority[];
  assignedAgent?: AgentId | AgentId[];
  createdBy?: AgentId | AgentId[];
  createdAfter?: number;
  createdBefore?: number;
  tags?: string[];
  parentId?: TaskId;
}

/**
 * Task query options
 */
export interface TaskQueryOptions {
  filter?: TaskFilter;
  sort?: TaskSortOption;
  pagination?: PaginationOptions;
  include?: TaskIncludeOptions;
}

/**
 * Task sort option
 */
export interface TaskSortOption {
  field: 'createdAt' | 'priority' | 'status' | 'estimatedDuration' | 'progress';
  order: 'asc' | 'desc';
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
}

/**
 * Task include options
 */
export interface TaskIncludeOptions {
  includeOutput?: boolean;
  includeError?: boolean;
  includeProgress?: boolean;
  includeDependencies?: boolean;
}

/**
 * Task query result
 */
export interface TaskQueryResult {
  tasks: Task[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Task batch operation
 */
export interface TaskBatchOperation {
  operation: 'create' | 'update' | 'cancel' | 'delete';
  taskIds?: TaskId[];
  tasks?: CreateTaskParams[];
  updates?: UpdateTaskParams[];
}

/**
 * Task batch result
 */
export interface TaskBatchResult {
  successful: TaskId[];
  failed: Array<{ taskId: TaskId; error: string }>;
  totalCount: number;
  successCount: number;
  failureCount: number;
}

/**
 * Task statistics
 */
export interface TaskStats {
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByType: Record<string, number>;
  tasksByPriority: Record<string, number>;
  averageExecutionTime: number;
  successRate: number;
  failureRate: number;
  cancellationRate: number;
  totalExecutionTime: number;
  totalCompletedTasks: number;
  totalFailedTasks: number;
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  taskId: TaskId;
  success: boolean;
  output?: TaskOutput;
  error?: TaskError;
  executionTime: number;
  agentId: AgentId;
  completedAt: number;
}

/**
 * Task workflow
 */
export interface TaskWorkflow {
  id: string;
  name: string;
  description?: string;
  tasks: Task[];
  dependencies: WorkflowDependency[];
  executionStrategy: ExecutionStrategy;
  status: WorkflowStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  metadata: Record<string, unknown>;
}

/**
 * Workflow dependency
 */
export interface WorkflowDependency {
  fromTaskId: TaskId;
  toTaskId: TaskId;
  type: 'hard' | 'soft';
  condition?: DependencyCondition;
}

/**
 * Workflow status
 */
export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Task event
 */
export interface TaskEvent {
  eventId: string;
  taskId: TaskId;
  eventType: TaskEventType;
  timestamp: number;
  data: Record<string, unknown>;
  agentId?: AgentId;
}

/**
 * Task event types
 */
export enum TaskEventType {
  CREATED = 'created',
  ASSIGNED = 'assigned',
  STARTED = 'started',
  PROGRESS_UPDATE = 'progress_update',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  RETRIED = 'retried',
  DEPENDENCY_RESOLVED = 'dependency_resolved'
}

/**
 * Task queue entry
 */
export interface QueuedTask {
  task: Task;
  queuedAt: number;
  priority: TaskPriority;
  estimatedStart?: number;
  waitingForDependencies: TaskId[];
}

/**
 * Task assignment result
 */
export interface TaskAssignmentResult {
  taskId: TaskId;
  agentId: AgentId;
  assigned: boolean;
  reason?: string;
  assignedAt: number;
}
