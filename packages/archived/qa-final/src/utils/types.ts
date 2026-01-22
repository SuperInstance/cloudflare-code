/**
 * Core type definitions for QA testing framework
 */

// @ts-nocheck
import { Page, APIRequestContext } from '@playwright/test';

// Test configuration types
export interface TestConfig {
  baseUrl: string;
  apiBaseUrl: string;
  timeout: number;
  retries: number;
  parallel: boolean;
  workers?: number;
  reporter?: string[];
  environment: 'development' | 'staging' | 'production';
}

export interface IntegrationTestConfig {
  services: ServiceConfig[];
  database: DatabaseConfig;
  storage: StorageConfig;
  timeout: number;
}

export interface E2ETestConfig {
  baseUrl: string;
  apiKey?: string;
  credentials?: TestCredentials;
  browser: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  slowMo?: number;
}

export interface PerformanceTestConfig {
  targetUrl: string;
  concurrency: number;
  duration: number;
  rampUp: number;
  thresholds: PerformanceThresholds;
}

export interface SecurityTestConfig {
  targetUrl: string;
  scanDepth: 'quick' | 'standard' | 'deep';
  owaspChecks: boolean;
  dependencyScan: boolean;
  secretScan: boolean;
  complianceChecks: string[];
}

export interface ContractTestConfig {
  providerBaseUrl: string;
  consumerVersions: string[];
  pactBrokerUrl?: string;
  publishContracts: boolean;
}

// Service configuration
export interface ServiceConfig {
  name: string;
  baseUrl: string;
  healthCheck: string;
  timeout: number;
  headers?: Record<string, string>;
}

export interface DatabaseConfig {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis';
  connectionString: string;
  poolSize: number;
  timeout: number;
}

export interface StorageConfig {
  type: 'r2' | 's3' | 'azure' | 'gcs';
  bucket: string;
  region: string;
  timeout: number;
}

// Test credentials
export interface TestCredentials {
  username: string;
  password: string;
  email: string;
  apiKey?: string;
}

// Performance thresholds
export interface PerformanceThresholds {
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
}

// Test result types
export interface TestResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'flaky';
  duration: number;
  error?: Error;
  metadata?: Record<string, unknown>;
  screenshots?: string[];
  logs?: string[];
}

export interface TestSuite {
  name: string;
  tests: TestResult[];
  duration: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
}

export interface TestReport {
  suite: string;
  timestamp: Date;
  duration: number;
  suites: TestSuite[];
  summary: TestSummary;
  environment: TestConfig;
  metadata: Record<string, unknown>;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  passRate: number;
  coverage?: CoverageSummary;
}

export interface CoverageSummary {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
}

// Performance test results
export interface PerformanceTestResult {
  name: string;
  timestamp: Date;
  duration: number;
  metrics: PerformanceMetrics;
  thresholds: PerformanceThresholds;
  passed: boolean;
  violations: ThresholdViolation[];
}

export interface PerformanceMetrics {
  requests: {
    total: number;
    success: number;
    failure: number;
  };
  responseTime: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p90: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    bytesPerSecond: number;
  };
  concurrency: {
    min: number;
    max: number;
    mean: number;
  };
  errors: ErrorMetric[];
  latency: LatencyMetric[];
}

export interface ErrorMetric {
  code: string;
  count: number;
  rate: number;
}

export interface LatencyMetric {
  timestamp: Date;
  value: number;
}

export interface ThresholdViolation {
  metric: string;
  expected: number;
  actual: number;
  severity: 'warning' | 'critical';
}

// Security test results
export interface SecurityTestResult {
  name: string;
  timestamp: Date;
  duration: number;
  vulnerabilities: Vulnerability[];
  summary: SecuritySummary;
  passed: boolean;
}

export interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  location: string;
  evidence?: string;
  remediation: string;
  references: string[];
}

export interface SecuritySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
  score: number;
}

// Contract test results
export interface ContractTestResult {
  name: string;
  timestamp: Date;
  consumer: string;
  provider: string;
  interactions: Interaction[];
  passed: boolean;
  errors: ContractError[];
}

export interface Interaction {
  description: string;
  request: RequestSpec;
  response: ResponseSpec;
  passed: boolean;
}

export interface RequestSpec {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ResponseSpec {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ContractError {
  interaction: string;
  message: string;
  expected: unknown;
  actual: unknown;
}

// Test context
export interface TestContext {
  page: Page;
  request: APIRequestContext;
  fixtures: FixtureRegistry;
  config: TestConfig;
  metadata: Map<string, unknown>;
}

export interface FixtureRegistry {
  get<T>(name: string): T;
  set<T>(name: string, value: T): void;
  has(name: string): boolean;
  clear(): void;
}

// Assertions
export interface AssertionOptions {
  timeout?: number;
  message?: string;
  soft?: boolean;
}

export interface Assertable<T> {
  toBe(expected: T, options?: AssertionOptions): void;
  toEqual(expected: T, options?: AssertionOptions): void;
  toMatch(expected: Partial<T>, options?: AssertionOptions): void;
  toContain(expected: T, options?: AssertionOptions): void;
  toThrow(expected?: Error | string, options?: AssertionOptions): void;
  toBeGreaterThan(expected: T, options?: AssertionOptions): void;
  toBeLessThan(expected: T, options?: AssertionOptions): void;
  toBeGreaterThanOrEqual(expected: T, options?: AssertionOptions): void;
  toBeLessThanOrEqual(expected: T, options?: AssertionOptions): void;
  toBeCloseTo(expected: T, precision?: number, options?: AssertionOptions): void;
  toHaveLength(expected: number, options?: AssertionOptions): void;
  toInclude(expected: T, options?: AssertionOptions): void;
  toBeTruthy(options?: AssertionOptions): void;
  toBeFalsy(options?: AssertionOptions): void;
  toBeNull(options?: AssertionOptions): void;
  toBeUndefined(options?: AssertionOptions): void;
  toBeDefined(options?: AssertionOptions): void;
}

// Mock data
export interface MockConfig {
  delay?: number;
  error?: Error;
  response?: unknown;
  status?: number;
  headers?: Record<string, string>;
}

export interface MockServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  reset(): void;
  getEndpoint(path: string): MockEndpoint | undefined;
  addEndpoint(endpoint: MockEndpoint): void;
}

export interface MockEndpoint {
  path: string;
  method: string;
  config: MockConfig;
  calls: Call[];
}

export interface Call {
  timestamp: Date;
  request: RequestSpec;
  response: ResponseSpec;
}

// Utilities
export interface RetryOptions {
  maxAttempts: number;
  delay: number;
  backoff: 'linear' | 'exponential';
  onRetry?: (attempt: number, error: Error) => void;
}

export interface WaitOptions {
  timeout?: number;
  interval?: number;
  message?: string;
}

export interface PollOptions<T> {
  condition: (value: T) => boolean;
  timeout?: number;
  interval?: number;
}

// Dashboard types
export interface DashboardData {
  summary: TestSummary;
  trends: TrendData[];
  performance: PerformanceMetrics;
  security: SecuritySummary;
  coverage: CoverageSummary;
  recentRuns: TestRun[];
}

export interface TrendData {
  date: Date;
  passRate: number;
  duration: number;
  coverage: number;
}

export interface TestRun {
  id: string;
  timestamp: Date;
  suite: string;
  status: 'passed' | 'failed';
  duration: number;
  summary: TestSummary;
}
