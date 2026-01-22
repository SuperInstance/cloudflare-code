/**
 * Core type definitions for the Workflow Automation Engine
 */

import { z } from 'zod';

// ============================================================================
// Base Types
// ============================================================================

export type WorkflowId = string;
export type NodeId = string;
export type ExecutionId = string;
export type TriggerId = string;
export type ActionId = string;
export type TemplateId = string;

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
  ERROR = 'error'
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMED_OUT = 'timed_out',
  RETRYING = 'retrying'
}

export enum NodeStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  CANCELLED = 'cancelled'
}

export enum TriggerType {
  WEBHOOK = 'webhook',
  SCHEDULE = 'schedule',
  EVENT = 'event',
  MANUAL = 'manual'
}

export enum ActionType {
  // Code Actions
  GENERATE_CODE = 'generate_code',
  REVIEW_CODE = 'review_code',
  REFACTOR_CODE = 'refactor_code',
  RUN_TESTS = 'run_tests',
  DEPLOY_CODE = 'deploy_code',

  // Communication Actions
  SEND_SLACK = 'send_slack',
  SEND_EMAIL = 'send_email',
  SEND_DISCORD = 'send_discord',
  SEND_TEAMS = 'send_teams',
  SEND_TELEGRAM = 'send_telegram',

  // GitHub Actions
  CREATE_ISSUE = 'create_issue',
  CREATE_PR = 'create_pr',
  COMMENT_PR = 'comment_pr',
  MERGE_PR = 'merge_pr',
  UPDATE_STATUS = 'update_status',
  CLOSE_ISSUE = 'close_issue',
  FORK_REPO = 'fork_repo',

  // AI Actions
  CHAT_COMPLETION = 'chat_completion',
  CODE_GENERATION = 'code_generation',
  SUMMARIZATION = 'summarization',
  TRANSLATION = 'translation',
  SENTIMENT_ANALYSIS = 'sentiment_analysis',

  // Data Actions
  FETCH_DATA = 'fetch_data',
  TRANSFORM_DATA = 'transform_data',
  FILTER_DATA = 'filter_data',
  AGGREGATE_DATA = 'aggregate_data',
  STORE_DATA = 'store_data',

  // Storage Actions
  KV_GET = 'kv_get',
  KV_SET = 'kv_set',
  KV_DELETE = 'kv_delete',
  R2_UPLOAD = 'r2_upload',
  R2_DOWNLOAD = 'r2_download',
  D1_QUERY = 'd1_query',

  // HTTP Actions
  HTTP_GET = 'http_get',
  HTTP_POST = 'http_post',
  HTTP_PUT = 'http_put',
  HTTP_DELETE = 'http_delete',
  HTTP_PATCH = 'http_patch',

  // Logic Actions
  CONDITION = 'condition',
  LOOP = 'loop',
  PARALLEL = 'parallel',
  WAIT = 'wait',
  SWITCH = 'switch',

  // Utility Actions
  LOG = 'log',
  NOTIFY = 'notify',
  METRIC = 'metric',
  VALIDATE = 'validate',

  // Custom Actions
  CUSTOM = 'custom'
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  IN = 'in',
  NOT_IN = 'not_in',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null',
  MATCHES_REGEX = 'matches_regex',
  IS_EMPTY = 'is_empty',
  IS_NOT_EMPTY = 'is_not_empty'
}

// ============================================================================
// Workflow Definition
// ============================================================================

export interface Workflow {
  id: WorkflowId;
  name: string;
  description: string;
  version: number;
  status: WorkflowStatus;
  nodes: Node[];
  connections: Connection[];
  triggers: Trigger[];
  variables: Variable[];
  settings: WorkflowSettings;
  metadata: WorkflowMetadata;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface Node {
  id: NodeId;
  type: 'trigger' | 'action' | 'condition' | 'loop' | 'parallel' | 'wait';
  actionType?: ActionType;
  name: string;
  description?: string;
  config: NodeConfig;
  position: Position;
  retryConfig?: RetryConfig;
  timeout?: number;
  enabled: boolean;
}

export interface NodeConfig {
  [key: string]: any;
  action?: string;
  parameters?: Record<string, any>;
  conditions?: Condition[];
  branches?: Branch[];
  iterations?: IterationConfig;
  waitTime?: number;
}

export interface Connection {
  id: string;
  sourceNodeId: NodeId;
  targetNodeId: NodeId;
  sourceOutput?: string;
  targetInput?: string;
  condition?: Condition;
}

export interface Position {
  x: number;
  y: number;
}

export interface Branch {
  name: string;
  condition?: Condition;
  nodes: NodeId[];
}

export interface IterationConfig {
  type: 'forEach' | 'while' | 'for' | 'doWhile';
  iterable?: string;
  condition?: Condition;
  start?: number;
  end?: number;
  step?: number;
  maxIterations?: number;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffType: 'linear' | 'exponential' | 'fixed';
  initialDelay: number;
  maxDelay?: number;
  retryOn?: string[];
}

export interface Variable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  value: any;
  defaultValue?: any;
  required: boolean;
  description?: string;
  secret?: boolean;
}

export interface WorkflowSettings {
  timeout?: number;
  maxConcurrentExecutions?: number;
  retryOnFailure?: boolean;
  notifyOnFailure?: boolean;
  notifyOnSuccess?: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableMetrics: boolean;
  enableTracing: boolean;
}

export interface WorkflowMetadata {
  tags?: string[];
  category?: string;
  author?: string;
  documentation?: string;
  estimatedCost?: number;
  estimatedDuration?: number;
}

// ============================================================================
// Triggers
// ============================================================================

export interface Trigger {
  id: TriggerId;
  type: TriggerType;
  name: string;
  description?: string;
  config: TriggerConfig;
  enabled: boolean;
  nodeId: NodeId;
}

export type TriggerConfig =
  | WebhookTriggerConfig
  | ScheduleTriggerConfig
  | EventTriggerConfig
  | ManualTriggerConfig;

export interface WebhookTriggerConfig {
  type: 'webhook';
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  authentication?: WebhookAuth;
  validation?: WebhookValidation;
  source?: 'github' | 'gitlab' | 'custom';
}

export interface WebhookAuth {
  type: 'none' | 'apiKey' | 'bearer' | 'basic' | 'signature';
  credentials?: Record<string, string>;
}

export interface WebhookValidation {
  validateSignature?: boolean;
  secretHeader?: string;
  secret?: string;
}

export interface ScheduleTriggerConfig {
  type: 'schedule';
  scheduleType: 'cron' | 'interval' | 'once';
  cron?: string;
  interval?: number;
  intervalUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
  runAt?: Date;
  timezone?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface EventTriggerConfig {
  type: 'event';
  eventType: string;
  source?: string;
  filters?: Record<string, any>;
  correlationId?: string;
}

export interface ManualTriggerConfig {
  type: 'manual';
  allowedUsers?: string[];
  allowedRoles?: string[];
  requireConfirmation?: boolean;
  parameters?: Record<string, any>;
}

// ============================================================================
// Actions
// ============================================================================

export interface Action {
  id: ActionId;
  type: ActionType;
  name: string;
  description: string;
  category: ActionCategory;
  inputs: ActionInput[];
  outputs: ActionOutput[];
  config?: ActionConfig;
  implementation: ActionImplementation;
}

export type ActionCategory =
  | 'code'
  | 'communication'
  | 'github'
  | 'ai'
  | 'data'
  | 'storage'
  | 'http'
  | 'logic'
  | 'utility'
  | 'custom';

export interface ActionInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file';
  required: boolean;
  description?: string;
  defaultValue?: any;
  validation?: ValidationRule;
}

export interface ActionOutput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file';
  description?: string;
}

export interface ActionConfig {
  timeout?: number;
  retryConfig?: RetryConfig;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  rateLimit?: RateLimit;
}

export interface RateLimit {
  maxRequests: number;
  period: number;
  periodUnit: 'seconds' | 'minutes' | 'hours';
}

export interface ActionImplementation {
  type: 'inline' | 'service' | 'external';
  handler?: string;
  service?: string;
  method?: string;
  url?: string;
  code?: string;
}

export interface ValidationRule {
  type: 'regex' | 'range' | 'enum' | 'custom';
  value?: any;
  message?: string;
}

// ============================================================================
// Conditions
// ============================================================================

export interface Condition {
  id: string;
  operator: ConditionOperator;
  leftOperand: Operand;
  rightOperand?: Operand;
  logicOperator?: 'AND' | 'OR';
  conditions?: Condition[];
}

export type Operand =
  | string
  | number
  | boolean
  | VariableReference
  | FunctionCall;

export interface VariableReference {
  type: 'variable';
  path: string;
  defaultValue?: any;
}

export interface FunctionCall {
  type: 'function';
  name: string;
  arguments: any[];
}

// ============================================================================
// Execution
// ============================================================================

export interface Execution {
  id: ExecutionId;
  workflowId: WorkflowId;
  workflowVersion: number;
  status: ExecutionStatus;
  nodes: NodeExecution[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  input: any;
  output?: any;
  error?: ExecutionError;
  triggeredBy: TriggerInfo;
  metadata: ExecutionMetadata;
}

export interface NodeExecution {
  nodeId: NodeId;
  status: NodeStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  input?: any;
  output?: any;
  error?: ExecutionError;
  retryCount?: number;
  logs?: ExecutionLog[];
}

export interface TriggerInfo {
  type: TriggerType;
  triggerId?: TriggerId;
  source?: string;
  data?: any;
}

export interface ExecutionError {
  code: string;
  message: string;
  stack?: string;
  details?: Record<string, any>;
  node?: NodeId;
}

export interface ExecutionLog {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  node?: NodeId;
  data?: any;
}

export interface ExecutionMetadata {
  correlationId?: string;
  parentExecutionId?: ExecutionId;
  rootExecutionId?: ExecutionId;
  tags?: Record<string, string>;
  cost?: number;
}

// ============================================================================
// Templates
// ============================================================================

export interface Template {
  id: TemplateId;
  name: string;
  description: string;
  category: TemplateCategory;
  workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>;
  parameters: TemplateParameter[];
  documentation?: string;
  tags?: string[];
  icon?: string;
  author?: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TemplateCategory =
  | 'development'
  | 'deployment'
  | 'monitoring'
  | 'communication'
  | 'data'
  | 'integration'
  | 'automation'
  | 'custom';

export interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required: boolean;
  defaultValue?: any;
  validation?: ValidationRule;
}

// ============================================================================
// Visual Builder
// ============================================================================

export interface BuilderState {
  workflow: Workflow;
  selectedNodes: NodeId[];
  selectedConnections: string[];
  zoom: number;
  pan: Position;
  clipboard?: {
    nodes: Node[];
    connections: Connection[];
  };
  history: BuilderHistory;
  validation: ValidationResult;
}

export interface BuilderHistory {
  past: Workflow[];
  present: Workflow;
  future: Workflow[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'node' | 'connection' | 'workflow';
  id: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  type: 'node' | 'connection' | 'workflow';
  id: string;
  message: string;
  severity: 'warning';
}

// ============================================================================
// DAG (Directed Acyclic Graph)
// ============================================================================

export interface DAG {
  nodes: Map<NodeId, Node>;
  edges: Map<NodeId, Set<NodeId>>;
  reverseEdges: Map<NodeId, Set<NodeId>>;
  levels: Map<NodeId, number>;
}

export interface TopologicalSortResult {
  sorted: NodeId[];
  cycles: NodeId[][];
}

export interface ExecutionPlan {
  levels: NodeId[][];
  parallelExecutions: Map<NodeId, Set<NodeId>>;
  dependencies: Map<NodeId, Set<NodeId>>;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const WorkflowStatusSchema = z.enum([
  'draft',
  'active',
  'paused',
  'archived',
  'error'
]);

export const ExecutionStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'timed_out',
  'retrying'
]);

export const TriggerTypeSchema = z.enum([
  'webhook',
  'schedule',
  'event',
  'manual'
]);

export const ActionTypeSchema = z.enum([
  'generate_code',
  'review_code',
  'refactor_code',
  'run_tests',
  'deploy_code',
  'send_slack',
  'send_email',
  'send_discord',
  'send_teams',
  'send_telegram',
  'create_issue',
  'create_pr',
  'comment_pr',
  'merge_pr',
  'update_status',
  'close_issue',
  'fork_repo',
  'chat_completion',
  'code_generation',
  'summarization',
  'translation',
  'sentiment_analysis',
  'fetch_data',
  'transform_data',
  'filter_data',
  'aggregate_data',
  'store_data',
  'kv_get',
  'kv_set',
  'kv_delete',
  'r2_upload',
  'r2_download',
  'd1_query',
  'http_get',
  'http_post',
  'http_put',
  'http_delete',
  'http_patch',
  'condition',
  'loop',
  'parallel',
  'wait',
  'log',
  'notify',
  'metric',
  'validate',
  'custom'
]);

export const ConditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'in',
  'not_in',
  'is_null',
  'is_not_null',
  'matches_regex',
  'is_empty',
  'is_not_empty'
]);
