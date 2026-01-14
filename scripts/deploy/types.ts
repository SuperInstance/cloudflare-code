/**
 * Deployment Type Definitions for ClaudeFlare
 * Provides comprehensive type safety for deployment operations
 */

/**
 * Supported deployment environments
 */
export type Environment = 'development' | 'staging' | 'production';

/**
 * Deployment regions for Cloudflare Workers
 */
export type DeploymentRegion =
  | 'wnam'  // North America West
  | 'enam'  // North America East
  | 'weur'  // Europe West
  | 'eeur'  // Europe East
  | 'apac'  // Asia Pacific
  | 'latam' // Latin America
  | 'oc'    // Oceania
  | 'afr'   // Africa
  | 'me'    // Middle East
  | 'global'; // All regions

/**
 * Resource types in Cloudflare
 */
export type ResourceType = 'worker' | 'kv' | 'r2' | 'd1' | 'durable-object' | 'queue';

/**
 * Deployment status
 */
export type DeploymentStatus =
  | 'pending'
  | 'building'
  | 'uploading'
  | 'deploying'
  | 'verifying'
  | 'success'
  | 'failed'
  | 'rolled-back';

/**
 * Rollback strategies
 */
export type RollbackStrategy = 'immediate' | 'gradual' | 'manual';

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency: number;
  timestamp: Date;
  errors: string[];
  warnings: string[];
  region?: DeploymentRegion;
}

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  environment: Environment;
  regions: DeploymentRegion[];
  zeroDowntime: boolean;
  rolloutPercentage: number;
  healthCheckTimeout: number;
  maxRetries: number;
  skipTests: boolean;
  skipVerification: boolean;
  dryRun: boolean;
  verbose: boolean;
}

/**
 * Worker deployment options
 */
export interface WorkerDeploymentOptions {
  name: string;
  scriptPath: string;
  compatibilityDate: string;
  compatibilityFlags: string[];
  bindings: Binding[];
  limits: WorkerLimits;
  routes: RouteConfig[];
  cronTriggers: CronTrigger[];
}

/**
 * Worker resource limits
 */
export interface WorkerLimits {
  cpuMs: number;
  memory: number;
  maxRequestsPerSecond: number;
}

/**
 * Binding configuration
 */
export interface Binding {
  type: 'kv' | 'r2' | 'd1' | 'durable-object' | 'queue' | 'secret' | 'variable';
  name: string;
  namespace_id?: string;
  bucket_name?: string;
  database_id?: string;
  class_name?: string;
  queue_name?: string;
  value?: string;
}

/**
 * Route configuration
 */
export interface RouteConfig {
  pattern: string;
  zoneName?: string;
  zoneId?: string;
}

/**
 * Cron trigger configuration
 */
export interface CronTrigger {
  schedule: string;
  handler: string;
}

/**
 * KV namespace configuration
 */
export interface KVNamespaceConfig {
  id?: string;
  title?: string;
  binding: string;
  preview_id?: string;
}

/**
 * R2 bucket configuration
 */
export interface R2BucketConfig {
  name: string;
  binding: string;
  location?: 'default' | 'eur' | 'apac' | 'wnam' | 'enam';
  versioning?: boolean;
  lifecycleRules?: R2LifecycleRule[];
}

/**
 * R2 lifecycle rule
 */
export interface R2LifecycleRule {
  id: string;
  prefix?: string;
  expirationDays?: number;
  noncurrentExpirationDays?: number;
}

/**
 * D1 database configuration
 */
export interface D1DatabaseConfig {
  name: string;
  binding: string;
  databaseId?: string;
  migrationsPath?: string;
}

/**
 * Durable Object configuration
 */
export interface DurableObjectConfig {
  name: string;
  className: string;
  scriptPath: string;
  bindings: Binding[];
  locations: DeploymentRegion[];
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  name: string;
  binding: string;
  batchSize?: number;
  maxWaitTime?: number;
  maxRetries?: number;
  deadLetterQueue?: string;
}

/**
 * Secret configuration
 */
export interface SecretConfig {
  name: string;
  value: string;
  environment: Environment;
  required: boolean;
  encrypted: boolean;
}

/**
 * Deployment manifest
 */
export interface DeploymentManifest {
  version: string;
  timestamp: Date;
  environment: Environment;
  deployments: ResourceDeployment[];
  checksums: Map<string, string>;
  rollbackVersion?: string;
}

/**
 * Individual resource deployment
 */
export interface ResourceDeployment {
  type: ResourceType;
  name: string;
  status: DeploymentStatus;
  region?: DeploymentRegion;
  version?: string;
  url?: string;
  error?: string;
}

/**
 * Deployment metrics
 */
export interface DeploymentMetrics {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  totalResources: number;
  deployedResources: number;
  failedResources: number;
  regions: DeploymentRegion[];
  healthChecks: HealthCheckResult[];
  errorRate: number;
  avgLatency: number;
}

/**
 * Verification result
 */
export interface VerificationResult {
  success: boolean;
  checks: VerificationCheck[];
  timestamp: Date;
  environment: Environment;
  overallScore: number;
}

/**
 * Individual verification check
 */
export interface VerificationCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  duration: number;
  region?: DeploymentRegion;
}

/**
 * Rollback configuration
 */
export interface RollbackConfig {
  strategy: RollbackStrategy;
  targetVersion: string;
  backupData: boolean;
  verifyAfterRollback: boolean;
  maxRollbackTime: number;
}

/**
 * Staged rollout configuration
 */
export interface StagedRolloutConfig {
  stages: RolloutStage[];
  healthCheckInterval: number;
  failureThreshold: number;
  autoRollback: boolean;
}

/**
 * Individual rollout stage
 */
export interface RolloutStage {
  percentage: number;
  duration: number;
  regions: DeploymentRegion[];
  healthCheckRequired: boolean;
}

/**
 * Deployment event
 */
export interface DeploymentEvent {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
  resource?: string;
  region?: DeploymentRegion;
  details?: Record<string, unknown>;
}

/**
 * Bundle size limits
 */
export interface BundleSizeLimits {
  maxSize: number;
  warningSize: number;
  gzipWarningSize: number;
}

/**
 * Pre-deployment check result
 */
export interface PreDeploymentCheckResult {
  passed: boolean;
  checks: PreDeploymentCheck[];
  warnings: string[];
  errors: string[];
}

/**
 * Individual pre-deployment check
 */
export interface PreDeploymentCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  critical: boolean;
}

/**
 * Backup configuration
 */
export interface BackupConfig {
  enabled: boolean;
  type: 'full' | 'incremental';
  retentionDays: number;
  storageLocation: string;
  includeSecrets: boolean;
  includeData: boolean;
}

/**
 * Deployment context passed between functions
 */
export interface DeploymentContext {
  config: DeploymentConfig;
  manifest: DeploymentManifest;
  metrics: DeploymentMetrics;
  events: DeploymentEvent[];
  logger: Logger;
}

/**
 * Logger interface
 */
export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  success(message: string, ...args: unknown[]): void;
}

/**
 * Wrangler CLI response wrapper
 */
export interface WranglerResponse<T> {
  success: boolean;
  result?: T;
  error?: string;
}

/**
 * Cloudflare API response
 */
export interface CloudflareAPIResponse<T> {
  success: boolean;
  errors: CloudflareError[];
  messages: string[];
  result?: T;
}

/**
 * Cloudflare error format
 */
export interface CloudflareError {
  code: number;
  message: string;
  chain?: CloudflareError[];
}

/**
 * Deployment progress callback
 */
export type ProgressCallback = (event: DeploymentEvent) => void;

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  retries: number;
  endpoints: string[];
  expectedStatusCodes: number[];
  maxLatency: number;
  regions: DeploymentRegion[];
}

/**
 * Resource provisioning result
 */
export interface ProvisionResult {
  success: boolean;
  resourceId?: string;
  resourceUrl?: string;
  error?: string;
  warnings: string[];
}

/**
 * Environment-specific configuration
 */
export interface EnvironmentConfig {
  name: Environment;
  accountId: string;
  apiUrl: string;
  workersDev: boolean;
  routes: RouteConfig[];
  vars: Record<string, string>;
  kvNamespaces: KVNamespaceConfig[];
  r2Buckets: R2BucketConfig[];
  d1Databases: D1DatabaseConfig[];
  durableObjects: DurableObjectConfig[];
  queues: QueueConfig[];
}

/**
 * Zero-downtime deployment state
 */
export interface ZeroDowntimeState {
  currentVersion: string;
  targetVersion: string;
  rolloutPercentage: number;
  activeRegions: DeploymentRegion[];
  pendingRegions: DeploymentRegion[];
  healthHistory: HealthCheckResult[];
}
