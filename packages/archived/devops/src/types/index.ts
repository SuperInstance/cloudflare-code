/**
 * Core type definitions for DevOps package
 */

/**
 * Git provider types
 */
export enum GitProvider {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  BITBUCKET = 'bitbucket',
}

/**
 * Environment types
 */
export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

/**
 * Deployment status
 */
export enum DeploymentStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLING_BACK = 'rolling_back',
  ROLLED_BACK = 'rolled_back',
  CANCELLED = 'cancelled',
}

/**
 * Deployment strategy types
 */
export enum DeploymentStrategy {
  BLUE_GREEN = 'blue_green',
  CANARY = 'canary',
  ROLLING = 'rolling',
  RECREATE = 'recreate',
}

/**
 * Health check status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
  UNKNOWN = 'unknown',
}

/**
 * Git repository configuration
 */
export interface GitRepository {
  provider: GitProvider;
  owner: string;
  repo: string;
  branch?: string;
  token: string;
  apiUrl?: string;
}

/**
 * GitOps configuration
 */
export interface GitOpsConfig {
  repository: GitRepository;
  targetPath: string;
  syncInterval?: number;
  autoSync?: boolean;
  pruneResources?: boolean;
  validateOnSync?: boolean;
  driftDetection?: DriftDetectionConfig;
}

/**
 * Drift detection configuration
 */
export interface DriftDetectionConfig {
  enabled: boolean;
  checkInterval: number;
  autoCorrect: boolean;
  correctionStrategy: 'immediate' | 'scheduled' | 'manual';
  ignoreRules?: string[];
}

/**
 * Reconciliation state
 */
export interface ReconciliationState {
  uid: string;
  generation: number;
  observedGeneration: number;
  status: ReconciliationStatus;
  lastAttemptedAt?: Date;
  lastSuccessAt?: Date;
  message?: string;
  conflictResolution?: ConflictResolution;
}

/**
 * Reconciliation status
 */
export enum ReconciliationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  FAILED = 'failed',
  CONFLICT = 'conflict',
}

/**
 * Conflict resolution strategy
 */
export enum ConflictResolution {
  GIT_WINS = 'git_wins',
  CLUSTER_WINS = 'cluster_wins',
  MANUAL = 'manual',
  MERGE = 'merge',
}

/**
 * IaC configuration
 */
export interface IaCConfig {
  type: 'terraform' | 'kubernetes' | 'cloudflare' | 'helm';
  version?: string;
  backend?: BackendConfig;
  providers?: ProviderConfig[];
  variables?: Record<string, any>;
  outputs?: string[];
}

/**
 * Backend configuration for Terraform
 */
export interface BackendConfig {
  type: 's3' | 'gcs' | 'azurerm' | 'consul' | 'local';
  config: Record<string, any>;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  name: string;
  source?: string;
  version?: string;
  configuration: Record<string, any>;
}

/**
 * Terraform module configuration
 */
export interface TerraformModule {
  name: string;
  source: string;
  version?: string;
  variables: Record<string, any>;
  dependsOn?: string[];
}

/**
 * Kubernetes manifest
 */
export interface KubernetesManifest {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: any;
}

/**
 * Cloudflare Worker configuration
 */
export interface CloudflareWorkerConfig {
  name: string;
  script: string;
  bindings?: WorkerBinding[];
  routes?: string[];
  cronTriggers?: CronTrigger[];
  environment?: Record<string, string>;
  kvNamespaces?: string[];
  durableObjects?: DurableObjectConfig[];
}

/**
 * Worker binding types
 */
export interface WorkerBinding {
  type: 'kv' | 'durable_object' | 'r2' | 'secret' | 'wasm' | 'text';
  name: string;
  properties?: Record<string, any>;
}

/**
 * Durable Object configuration
 */
export interface DurableObjectConfig {
  name: string;
  className: string;
  scriptName?: string;
}

/**
 * Cron trigger
 */
export interface CronTrigger {
  cron: string;
  destination?: string;
}

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  id: string;
  environment: Environment;
  strategy: DeploymentStrategy;
  target: DeploymentTarget;
  manifest: any;
  healthChecks?: HealthCheck[];
  rollback?: RollbackConfig;
  notifications?: NotificationConfig[];
  timeout?: number;
}

/**
 * Deployment target
 */
export interface DeploymentTarget {
  type: 'cloudflare_worker' | 'kubernetes' | 'serverless' | 'container';
  provider: string;
  region?: string;
  account?: string;
  namespace?: string;
  service?: string;
}

/**
 * Health check configuration
 */
export interface HealthCheck {
  name: string;
  type: 'http' | 'tcp' | 'command' | 'custom';
  config: HealthCheckConfig;
  interval: number;
  timeout: number;
  threshold: number;
  retries?: number;
}

/**
 * Health check specific configurations
 */
export type HealthCheckConfig =
  | HttpHealthCheck
  | TcpHealthCheck
  | CommandHealthCheck
  | CustomHealthCheck;

export interface HttpHealthCheck {
  protocol: 'http' | 'https';
  host: string;
  port?: number;
  path: string;
  expectedStatus?: number;
  expectedBody?: string;
  headers?: Record<string, string>;
}

export interface TcpHealthCheck {
  host: string;
  port: number;
}

export interface CommandHealthCheck {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface CustomHealthCheck {
  handler: string;
  config?: Record<string, any>;
}

/**
 * Rollback configuration
 */
export interface RollbackConfig {
  enabled: boolean;
  automatic: boolean;
  onFailure?: boolean;
  onDegraded?: boolean;
  timeout?: number;
  retainVersions?: number;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  type: 'slack' | 'email' | 'webhook' | 'pagerduty';
  enabled: boolean;
  events: string[];
  config: Record<string, any>;
}

/**
 * Deployment state
 */
export interface DeploymentState {
  deploymentId: string;
  status: DeploymentStatus;
  phase: DeploymentPhase;
  startTime: Date;
  endTime?: Date;
  currentVersion?: string;
  previousVersion?: string;
  targetVersion: string;
  metrics: DeploymentMetrics;
  error?: ErrorInfo;
}

/**
 * Deployment phases
 */
export enum DeploymentPhase {
  VALIDATION = 'validation',
  PRE_DEPLOYMENT = 'pre_deployment',
  DEPLOYMENT = 'deployment',
  POST_DEPLOYMENT = 'post_deployment',
  VERIFICATION = 'verification',
  CLEANUP = 'cleanup',
  COMPLETE = 'complete',
}

/**
 * Deployment metrics
 */
export interface DeploymentMetrics {
  duration?: number;
  rollbackDuration?: number;
  healthCheckPasses: number;
  healthCheckFailures: number;
  trafficPercentage?: number;
  errorRate?: number;
  latency?: number;
  customMetrics?: Record<string, number>;
}

/**
 * Error information
 */
export interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  retryable: boolean;
}

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  name: Environment;
  displayName: string;
  gitBranch: string;
  variables: EnvironmentVariable[];
  secrets: SecretReference[];
  resources: ResourceQuota;
  promotionPolicy?: PromotionPolicy;
  validationRules?: ValidationRule[];
}

/**
 * Environment variable
 */
export interface EnvironmentVariable {
  name: string;
  value: string;
  encrypted?: boolean;
  required?: boolean;
  defaultValue?: string;
  validation?: VariableValidation;
}

/**
 * Variable validation
 */
export interface VariableValidation {
  pattern?: string;
  min?: number;
  max?: number;
  allowedValues?: string[];
  customValidator?: string;
}

/**
 * Secret reference
 */
export interface SecretReference {
  name: string;
  path: string;
  version?: string;
  required: boolean;
}

/**
 * Resource quota
 */
export interface ResourceQuota {
  cpu?: ResourceLimit;
  memory?: ResourceLimit;
  storage?: ResourceLimit;
  services?: number;
  workers?: number;
}

/**
 * Resource limit
 */
export interface ResourceLimit {
  min: string;
  max: string;
  default: string;
}

/**
 * Promotion policy
 */
export interface PromotionPolicy {
  autoPromote: boolean;
  requireApproval: boolean;
  approvers?: string[];
  testsRequired: boolean;
  minStabilityTime?: number;
  checkMetrics?: boolean;
  metricThresholds?: MetricThreshold[];
}

/**
 * Metric threshold
 */
export interface MetricThreshold {
  name: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  duration: number;
}

/**
 * Validation rule
 */
export interface ValidationRule {
  name: string;
  type: 'schema' | 'custom' | 'policy';
  config: any;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  id: string;
  name: string;
  description?: string;
  stages: PipelineStage[];
  triggers: PipelineTrigger[];
  environment?: Record<string, string>;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

/**
 * Pipeline stage
 */
export interface PipelineStage {
  id: string;
  name: string;
  type: StageType;
  config: any;
  dependsOn?: string[];
  parallel?: boolean;
  condition?: string;
  timeout?: number;
  retries?: number;
}

/**
 * Stage types
 */
export enum StageType {
  BUILD = 'build',
  TEST = 'test',
  DEPLOY = 'deploy',
  VALIDATE = 'validate',
  APPROVAL = 'approval',
  NOTIFY = 'notify',
  CUSTOM = 'custom',
}

/**
 * Pipeline trigger
 */
export interface PipelineTrigger {
  type: 'git' | 'schedule' | 'manual' | 'event';
  config: any;
  enabled: boolean;
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}

/**
 * Pipeline execution
 */
export interface PipelineExecution {
  pipelineId: string;
  executionId: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  stages: StageExecution[];
  variables: Record<string, any>;
  artifacts?: Artifact[];
  error?: ErrorInfo;
}

/**
 * Execution status
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped',
}

/**
 * Stage execution
 */
export interface StageExecution {
  stageId: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  output?: any;
  error?: ErrorInfo;
  duration?: number;
}

/**
 * Artifact
 */
export interface Artifact {
  name: string;
  type: 'docker_image' | 'binary' | 'archive' | 'log' | 'report';
  path: string;
  checksum?: string;
  metadata?: Record<string, any>;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  metrics: MetricConfig[];
  alerts: AlertConfig[];
  dashboards?: DashboardConfig[];
}

/**
 * Metric configuration
 */
export interface MetricConfig {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels?: Record<string, string>;
  buckets?: number[];
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  name: string;
  condition: string;
  severity: 'critical' | 'warning' | 'info';
  notifications: string[];
  cooldown?: number;
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  name: string;
  panels: PanelConfig[];
  refreshInterval?: number;
}

/**
 * Panel configuration
 */
export interface PanelConfig {
  title: string;
  type: 'graph' | 'stat' | 'table' | 'log';
  queries: string[];
  visualization?: any;
}

/**
 * Cost estimation
 */
export interface CostEstimate {
  currency: string;
  total: number;
  breakdown: CostBreakdown[];
  period: 'hourly' | 'daily' | 'monthly';
}

/**
 * Cost breakdown
 */
export interface CostBreakdown {
  resource: string;
  amount: number;
  unit: string;
  quantity: number;
  details?: Record<string, any>;
}

/**
 * Sync operation result
 */
export interface SyncResult {
  success: boolean;
  syncRevision: string;
  resourcesApplied: number;
  resourcesDeleted: number;
  resourcesSkipped: number;
  duration: number;
  error?: string;
  drift?: DriftReport;
}

/**
 * Drift report
 */
export interface DriftReport {
  hasDrift: boolean;
  driftDetectedAt: Date;
  changes: DriftChange[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Drift change
 */
export interface DriftChange {
  resource: string;
  type: 'create' | 'update' | 'delete';
  expected: any;
  actual: any;
  path?: string;
}

/**
 * Durable Object state
 */
export interface DurableObjectState {
  id: string;
  className: string;
  data: any;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Worker execution context
 */
export interface WorkerContext {
  requestId: string;
  timestamp: Date;
  env: any;
  cf?: any;
  waitUntil?: (promise: Promise<any>) => void;
}
