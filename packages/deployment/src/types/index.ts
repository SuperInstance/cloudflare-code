// @ts-nocheck
/**
 * Core type definitions for the deployment automation system
 */

import { z } from 'zod';

// ============================================================================
// Deployment Configuration Types
// ============================================================================

export enum DeploymentStrategy {
  ZERO_DOWNTIME = 'zero-downtime',
  BLUE_GREEN = 'blue-green',
  CANARY = 'canary',
  ROLLING = 'rolling',
}

export enum DeploymentStatus {
  PENDING = 'pending',
  PREPARING = 'preparing',
  DEPLOYING = 'deploying',
  VALIDATING = 'validating',
  TESTING = 'testing',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLING_BACK = 'rolling_back',
  ROLLED_BACK = 'rolled_back',
}

export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PREPRODUCTION = 'preproduction',
  PRODUCTION = 'production',
}

export enum HealthCheckType {
  HTTP = 'http',
  TCP = 'tcp',
  COMMAND = 'command',
  SCRIPT = 'script',
}

export enum TrafficSplitMode {
  PERCENTAGE = 'percentage',
  HEADER = 'header',
  COOKIE = 'cookie',
  IP = 'ip',
  GEO = 'geo',
}

// ============================================================================
// Core Interfaces
// ============================================================================

export interface DeploymentConfig {
  id: string;
  strategy: DeploymentStrategy;
  environment: Environment;
  version: string;
  previousVersion?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface DeploymentTarget {
  id: string;
  name: string;
  region?: string;
  zone?: string;
  url: string;
  healthCheckUrl: string;
  maxInstances: number;
  minInstances: number;
  currentInstances: number;
}

export interface HealthCheck {
  id: string;
  name: string;
  type: HealthCheckType;
  endpoint?: string;
  port?: number;
  path?: string;
  interval: number;
  timeout: number;
  threshold: number;
  retries: number;
  expectedStatus?: number;
  expectedBody?: string;
  command?: string;
  script?: string;
}

export interface SmokeTestConfig {
  enabled: boolean;
  parallel: boolean;
  timeout: number;
  retryCount: number;
  tests: SmokeTest[];
}

export interface SmokeTest {
  id: string;
  name: string;
  type: 'health' | 'api' | 'database' | 'cache' | 'integration';
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  expectedStatus: number;
  expectedResponse?: any;
  timeout: number;
  critical: boolean;
}

export interface DeploymentMetrics {
  deploymentId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: DeploymentStatus;
  targets: TargetMetrics[];
  healthChecks: HealthCheckMetrics;
  tests: TestMetrics;
  traffic: TrafficMetrics;
  errors: ErrorMetric[];
}

export interface TargetMetrics {
  targetId: string;
  targetName: string;
  instancesDeployed: number;
  instancesHealthy: number;
  instancesFailed: number;
  percentage: number;
}

export interface HealthCheckMetrics {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  checks: HealthCheckResult[];
}

export interface HealthCheckResult {
  targetId: string;
  checkId: string;
  checkName: string;
  status: 'pass' | 'fail' | 'skip';
  timestamp: Date;
  responseTime: number;
  message?: string;
}

export interface TestMetrics {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  tests: TestResult[];
}

export interface TestResult {
  testId: string;
  testName: string;
  type: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  timestamp: Date;
  message?: string;
  error?: any;
}

export interface TrafficMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
}

export interface ErrorMetric {
  timestamp: Date;
  targetId: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  context?: Record<string, any>;
}

// ============================================================================
// Zero-Downtime Deployment Types
// ============================================================================

export interface ZeroDowntimeConfig {
  batchSize: number;
  batchInterval: number;
  healthCheckInterval: number;
  healthCheckTimeout: number;
  gracePeriod: number;
  shutdownTimeout: number;
  maxRetries: number;
  rollbackOnError: boolean;
  preDeploymentHooks?: string[];
  postDeploymentHooks?: string[];
}

export interface RollingBatch {
  batchNumber: number;
  totalBatches: number;
  targets: DeploymentTarget[];
  status: 'pending' | 'deploying' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  error?: string;
}

// ============================================================================
// Blue-Green Deployment Types
// ============================================================================

export interface BlueGreenConfig {
  blueEnvironment: string;
  greenEnvironment: string;
  switchMode: 'immediate' | 'gradual' | 'manual';
  validationTimeout: number;
  autoRollback: boolean;
  rollbackTimeout: number;
  keepOldVersion: boolean;
  ttlOldVersion?: number;
  preSwitchHooks?: string[];
  postSwitchHooks?: string[];
}

export interface EnvironmentStatus {
  environment: string;
  version: string;
  status: 'active' | 'inactive' | 'switching';
  health: 'healthy' | 'unhealthy' | 'unknown';
  url: string;
  lastUpdated: Date;
}

export interface TrafficSwitch {
  fromEnvironment: string;
  toEnvironment: string;
  startTime: Date;
  endTime?: Date;
  status: 'in-progress' | 'completed' | 'failed' | 'rolled-back';
  percentage: number;
}

// ============================================================================
// Canary Deployment Types
// ============================================================================

export interface CanaryConfig {
  stages: CanaryStage[];
  autoPromote: boolean;
  autoRollback: boolean;
  rollbackThreshold: number;
  monitoringWindow: number;
  metricsCheckInterval: number;
  successCriteria: SuccessCriteria;
  rollbackCriteria: RollbackCriteria;
}

export interface CanaryStage {
  name: string;
  percentage: number;
  duration: number;
  minSuccessRate: number;
  maxErrorRate: number;
  checks: string[];
  autoPromote: boolean;
}

export interface SuccessCriteria {
  minSuccessRate: number;
  maxErrorRate: number;
  maxResponseTime: number;
  minHealthScore: number;
  customChecks?: Record<string, any>;
}

export interface RollbackCriteria {
  maxErrorRate: number;
  minSuccessRate: number;
  maxResponseTime: number;
  minHealthScore: number;
  errorSpikeThreshold: number;
  customChecks?: Record<string, any>;
}

export interface CanaryStatus {
  currentStage: number;
  totalStages: number;
  currentPercentage: number;
  startTime: Date;
  stageStartTime: Date;
  metrics: CanaryMetrics;
  status: 'running' | 'paused' | 'completed' | 'rolled-back' | 'failed';
}

export interface CanaryMetrics {
  requests: number;
  errors: number;
  successRate: number;
  errorRate: number;
  averageResponseTime: number;
  healthScore: number;
  customMetrics?: Record<string, number>;
}

// ============================================================================
// Verification Types
// ============================================================================

export interface VerificationConfig {
  enabled: boolean;
  timeout: number;
  retryCount: number;
  checkInterval: number;
  checks: VerificationCheck[];
}

export interface VerificationCheck {
  id: string;
  name: string;
  type: 'http' | 'tcp' | 'dns' | 'ssl' | 'performance';
  target: string;
  method?: string;
  headers?: Record<string, string>;
  expectedStatus?: number;
  expectedResponse?: any;
  maxResponseTime?: number;
  minSuccessRate?: number;
  critical: boolean;
}

export interface VerificationResult {
  checkId: string;
  checkName: string;
  status: 'pass' | 'fail' | 'warning';
  timestamp: Date;
  duration: number;
  details: any;
  message?: string;
}

// ============================================================================
// Pipeline Types
// ============================================================================

export interface PipelineConfig {
  name: string;
  description: string;
  stages: PipelineStage[];
  triggers: PipelineTrigger[];
  notifications: NotificationConfig[];
  rollbackPolicy: RollbackPolicy;
}

export interface PipelineStage {
  id: string;
  name: string;
  type: 'build' | 'test' | 'deploy' | 'verify' | 'notify';
  config: any;
  dependencies: string[];
  continueOnError: boolean;
  timeout: number;
}

export interface PipelineTrigger {
  type: 'git' | 'schedule' | 'manual' | 'event';
  config: any;
}

export interface NotificationConfig {
  type: 'slack' | 'email' | 'webhook' | 'pagerduty';
  events: string[];
  config: any;
}

export interface RollbackPolicy {
  autoRollback: boolean;
  rollbackTimeout: number;
  maxRetries: number;
  backupRetention: number;
}

// ============================================================================
// GitOps Types
// ============================================================================

export interface GitOpsConfig {
  provider: 'github' | 'gitlab' | 'bitbucket';
  repository: string;
  branch: string;
  path: string;
  webhookUrl?: string;
  syncInterval: number;
  autoSync: boolean;
  pruneResources: boolean;
}

export interface GitOpsSyncStatus {
  lastSync: Date;
  syncStatus: 'synced' | 'out-of-sync' | 'unknown';
  commit: string;
  author: string;
  message: string;
  diverged: boolean;
}

// ============================================================================
// Rollback Types
// ============================================================================

export interface RollbackConfig {
  deploymentId: string;
  targetVersion: string;
  rollbackStrategy: 'immediate' | 'gradual' | 'manual';
  timeout: number;
  backupData: boolean;
  verifyAfterRollback: boolean;
  notifyOnRollback: boolean;
}

export interface RollbackResult {
  rollbackId: string;
  status: 'in-progress' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  previousVersion: string;
  currentVersion: string;
  errors: string[];
}

// ============================================================================
// Monitoring Types
// ============================================================================

export interface MonitoringConfig {
  enabled: boolean;
  interval: number;
  retention: number;
  metrics: MetricConfig[];
  alerts: AlertConfig[];
}

export interface MetricConfig {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  description: string;
  labels: string[];
}

export interface AlertConfig {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  notifications: string[];
}

// ============================================================================
// Schema Validations
// ============================================================================

export const DeploymentConfigSchema = z.object({
  id: z.string().uuid(),
  strategy: z.nativeEnum(DeploymentStrategy),
  environment: z.nativeEnum(Environment),
  version: z.string().semver(),
  previousVersion: z.string().semver().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().min(1),
});

export const HealthCheckSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: z.nativeEnum(HealthCheckType),
  endpoint: z.string().url().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  path: z.string().optional(),
  interval: z.number().int().positive(),
  timeout: z.number().int().positive(),
  threshold: z.number().int().min(1),
  retries: z.number().int().min(0),
  expectedStatus: z.number().int().min(100).max(599).optional(),
  expectedBody: z.string().optional(),
  command: z.string().optional(),
  script: z.string().optional(),
});

export const SmokeTestSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(['health', 'api', 'database', 'cache', 'integration']),
  endpoint: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  expectedStatus: z.number().int().min(100).max(599),
  expectedResponse: z.any().optional(),
  timeout: z.number().int().positive(),
  critical: z.boolean(),
});

export const CanaryConfigSchema = z.object({
  stages: z.array(z.object({
    name: z.string().min(1),
    percentage: z.number().min(0).max(100),
    duration: z.number().int().positive(),
    minSuccessRate: z.number().min(0).max(100),
    maxErrorRate: z.number().min(0).max(100),
    checks: z.array(z.string()),
    autoPromote: z.boolean(),
  })).min(1),
  autoPromote: z.boolean(),
  autoRollback: z.boolean(),
  rollbackThreshold: z.number().min(0).max(100),
  monitoringWindow: z.number().int().positive(),
  metricsCheckInterval: z.number().int().positive(),
  successCriteria: z.object({
    minSuccessRate: z.number().min(0).max(100),
    maxErrorRate: z.number().min(0).max(100),
    maxResponseTime: z.number().positive(),
    minHealthScore: z.number().min(0).max(100),
    customChecks: z.record(z.any()).optional(),
  }),
  rollbackCriteria: z.object({
    maxErrorRate: z.number().min(0).max(100),
    minSuccessRate: z.number().min(0).max(100),
    maxResponseTime: z.number().positive(),
    minHealthScore: z.number().min(0).max(100),
    errorSpikeThreshold: z.number().min(0),
    customChecks: z.record(z.any()).optional(),
  }),
});
