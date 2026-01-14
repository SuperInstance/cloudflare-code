/**
 * Type definitions for ClaudeFlare Testing Framework
 */

import type { WorkerEntrypoint } from 'cloudflare:workers';

// ============================================================================
// Core Test Types
// ============================================================================

export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'flaky';

export type TestLevel = 'unit' | 'integration' | 'e2e' | 'performance';

export interface TestLocation {
  file: string;
  line: number;
  column: number;
}

export interface TestDuration {
  start: number;
  end: number;
  elapsed: number;
}

export interface TestMetadata {
  id: string;
  name: string;
  fullName: string;
  level: TestLevel;
  location: TestLocation;
  tags: string[];
  timeout: number;
  retries: number;
  skip: boolean;
  only: boolean;
  todo: boolean;
}

export interface TestResult {
  metadata: TestMetadata;
  status: TestStatus;
  duration: TestDuration;
  error?: TestError;
  attempts: number;
  flaky: boolean;
  coverage?: TestCoverage;
}

export interface TestError {
  message: string;
  stack?: string;
  actual?: unknown;
  expected?: unknown;
  diff?: string;
}

export interface TestCoverage {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
}

// ============================================================================
// Test Suite Types
// ============================================================================

export interface SuiteMetadata {
  id: string;
  name: string;
  file: string;
  level: TestLevel;
  timeout: number;
  parallel: boolean;
  shuffle: boolean;
}

export interface SuiteResult {
  metadata: SuiteMetadata;
  tests: TestResult[];
  status: TestStatus;
  duration: TestDuration;
  beforeAllErrors: TestError[];
  afterAllErrors: TestError[];
  beforeEachErrors: TestError[];
  afterEachErrors: TestError[];
}

// ============================================================================
// Hook Types
// ============================================================================

export type HookType = 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach';

export interface HookOptions {
  timeout?: number;
}

export type HookFunction = () => void | Promise<void>;

// ============================================================================
// Test Context Types
// ============================================================================

export interface TestContext {
  readonly metadata: TestMetadata;
  readonly expect: Expect;
  skip: (reason?: string) => void;
  only: () => void;
  todo: (reason?: string) => void;
}

export interface SuiteContext {
  readonly metadata: SuiteMetadata;
  describe: (name: string, fn: () => void) => void;
  it: (name: string, fn: TestFunction) => void;
  beforeAll: (fn: HookFunction, options?: HookOptions) => void;
  afterAll: (fn: HookFunction, options?: HookOptions) => void;
  beforeEach: (fn: HookFunction, options?: HookOptions) => void;
  afterEach: (fn: HookFunction, options?: HookOptions) => void;
}

// ============================================================================
// Expect Types
// ============================================================================

export interface Expect {
  <T>(actual: T, customMessage?: string): Assertion<T>;
  extend(matchers: Record<string, CustomMatcher>): void;
  assertions(expected: number): void;
  hasAssertions(): void;
  addSnapshotSerializer(serializer: SnapshotSerializer): void;
}

export interface Assertion<T> {
  toBe(expected: T): void;
  toEqual(expected: T): void;
  toStrictEqual(expected: T): void;
  toMatch(expected: string | RegExp): void;
  toMatchObject(expected: Partial<T>): void;
  toHaveProperty(path: string | string[], value?: unknown): void;
  toContain(expected: unknown): void;
  toContainEqual(expected: unknown): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toBeNaN(): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toBeCloseTo(expected: number, precision?: number): void;
  toThrow(expected?: string | RegExp | ErrorConstructor): void;
  toThrowError(expected?: string | RegExp | ErrorConstructor): void;
  toBeInstanceOf(expected: Function): void;
  toHaveLength(expected: number): void;
  toHaveBeenCalled(): void;
  toHaveBeenCalledTimes(expected: number): void;
  toHaveBeenCalledWith(...args: unknown[]): void;
  toHaveBeenCalledExpecting(...args: unknown[]): void;
  toMatchSnapshot(partial?: string): void;
  toMatchInlineSnapshot(snapshot?: string): void;
  toThrowMatchingSnapshot(partial?: string): void;
  resolves: AssertionPromises<T>;
  rejects: AssertionPromises<T>;
  not: Assertion<T> & Omit<NegatedAssertion<T>, 'not'>;
}

export interface AssertionPromises<T> {
  toBe(expected: T): Promise<void>;
  toEqual(expected: T): Promise<void>;
  toStrictEqual(expected: T): Promise<void>;
  toMatch(expected: string | RegExp): Promise<void>;
  toMatchObject(expected: Partial<T>): Promise<void>;
  toThrow(expected?: string | RegExp | ErrorConstructor): Promise<void>;
  toThrowError(expected?: string | RegExp | ErrorConstructor): Promise<void>;
}

export interface NegatedAssertion<T> {
  toBe(expected: T): void;
  toEqual(expected: T): void;
  toStrictEqual(expected: T): void;
  toMatch(expected: string | RegExp): void;
  toMatchObject(expected: Partial<T>): void;
  toHaveProperty(path: string | string[], value?: unknown): void;
  toContain(expected: unknown): void;
  toContainEqual(expected: unknown): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toBeNaN(): void;
  toThrow(expected?: string | RegExp | ErrorConstructor): void;
  toThrowError(expected?: string | RegExp | ErrorConstructor): void;
  toBeInstanceOf(expected: Function): void;
  toHaveLength(expected: number): void;
  toHaveBeenCalled(): void;
  toMatchSnapshot(partial?: string): void;
  toMatchInlineSnapshot(snapshot?: string): void;
}

export interface CustomMatcher {
  (this: MatcherContext, ...args: unknown[]): CustomMatcherResult | Promise<CustomMatcherResult>;
}

export interface MatcherContext {
  equals: (a: unknown, b: unknown) => boolean;
  isNot: boolean;
  utils: MatcherUtils;
}

export interface MatcherUtils {
  diff: (a: unknown, b: unknown) => string | null;
}

export interface CustomMatcherResult {
  pass: boolean;
  message: () => string;
}

export interface SnapshotSerializer {
  test: (value: unknown) => boolean;
  serialize: (value: unknown, indentation: string) => string;
}

// ============================================================================
// Test Function Types
// ============================================================================

export type TestFunction = (ctx: TestContext) => void | Promise<void>;

export type TestDefinition = {
  fn: TestFunction;
  metadata: Partial<TestMetadata>;
};

// ============================================================================
// Runner Options
// ============================================================================

export interface RunnerOptions {
  files: string[];
  pattern?: string;
  exclude?: string[];
  level?: TestLevel;
  tag?: string[];
  parallel?: boolean;
  concurrency?: number;
  timeout?: number;
  retries?: number;
  bail?: number;
  grep?: string | RegExp;
  shard?: {
    index: number;
    total: number;
  };
  watch?: boolean;
  coverage?: boolean;
  reporters?: Reporter[];
  outputDir?: string;
}

// ============================================================================
// Reporter Types
// ============================================================================

export interface Reporter {
  name: string;
  init?(options: Record<string, unknown>): void | Promise<void>;
  onTestStart?(metadata: TestMetadata): void | Promise<void>;
  onTestResult?(result: TestResult): void | Promise<void>;
  onSuiteStart?(metadata: SuiteMetadata): void | Promise<void>;
  onSuiteResult?(result: SuiteResult): void | Promise<void>;
  onRunStart?(suites: SuiteMetadata[]): void | Promise<void>;
  onRunEnd?(results: RunResult): void | Promise<void>;
  onError?(error: Error): void | Promise<void>;
}

export interface RunResult {
  suites: SuiteResult[];
  tests: TestResult[];
  status: TestStatus;
  duration: TestDuration;
  stats: RunStats;
}

export interface RunStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  coverage?: TestCoverage;
}

// ============================================================================
// Mock Types
// ============================================================================

export interface MockFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): ReturnType<T> extends Promise<infer U> ? Promise<U> : ReturnType<T>;
  _isMock: true;
  _mock: {
    calls: Parameters<T>[];
    results: Array<{ type: 'return' | 'throw'; value: unknown }>;
    instances: unknown[];
    contexts: unknown[];
  };
  getMockName(): string;
  mockName(name: string): void;
  mockImplementation(fn: T): MockFunction<T>;
  mockImplementationOnce(fn: T): MockFunction<T>;
  mockReturnValue(value: ReturnType<T>): MockFunction<T>;
  mockReturnValueOnce(value: ReturnType<T>): MockFunction<T>;
  mockResolvedValue(value: Awaited<ReturnType<T>>): MockFunction<T>;
  mockResolvedValueOnce(value: Awaited<ReturnType<T>>): MockFunction<T>;
  mockRejectedValue(error: unknown): MockFunction<T>;
  mockRejectedValueOnce(error: unknown): MockFunction<T>;
  returnThis(): MockFunction<T>;
  clearMock(): void;
  resetMock(): void;
  restoreMocks(): void;
}

export type Mock<T> = T extends (...args: infer A) => infer R
  ? MockFunction<(...args: A) => R>
  : T;

export interface ModuleMock {
  [key: string]: unknown;
}

// ============================================================================
// Service Mock Types
// ============================================================================

export interface KVNamespaceMock {
  get(key: string): Promise<string | null>;
  get(key: string, type: 'text'): Promise<string | null>;
  get(key: string, type: 'json'): Promise<unknown | null>;
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  get(key: string, type: 'stream'): Promise<ReadableStream | null>;
  put(key: string, value: string | ReadableStream | ArrayBuffer): Promise<void>;
  put(key: string, value: unknown, options?: KVNamespacePutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult>;
  getWithMetadata<Metadata = unknown>(
    key: string,
    options?: Partial<KVCachePolicy>
  ): Promise<{ value: string | null; metadata: Metadata | null }>;
}

export interface R2BucketMock {
  put(key: string, value: R2PutValue, options?: R2PutOptions): Promise<R2Object>;
  get(key: string): Promise<R2Object | R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

export interface D1DatabaseMock {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface DurableObjectMock {
  id: DurableObjectId;
  stub: DurableObjectStub;
  storage: DurableObjectStorageMock;
  state: DurableObjectStateMock;
}

export interface DurableObjectStorageMock {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(options?: DurableObjectStorageListOptions): Promise<string[]>;
  getAlarm(): Promise<Date | null>;
  setAlarm(time: Date | number): Promise<void>;
  deleteAlarm(): Promise<void>;
  transaction<T>(closure: (txn: DurableObjectStorageTransaction) => Promise<T>): Promise<T>;
}

// ============================================================================
// Performance Testing Types
// ============================================================================

export interface BenchmarkOptions {
  iterations?: number;
  warmup?: number;
  duration?: number;
  setup?: () => void | Promise<void>;
  teardown?: () => void | Promise<void>;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

export interface LoadTestOptions {
  concurrency: number;
  requests: number;
  rampUp?: number;
  duration?: number;
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface LoadTestResult {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  duration: number;
  requestsPerSecond: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  errorRates: Record<string, number>;
}

// ============================================================================
// Integration Testing Types
// ============================================================================

export interface ServiceConfig {
  name: string;
  type: 'worker' | 'durable-object' | 'kv' | 'r2' | 'd1' | 'queue';
  config: Record<string, unknown>;
}

export interface TestEnvironment {
  services: Map<string, unknown>;
  env: Record<string, string>;
  bindings: Record<string, unknown>;
  setup(): Promise<void>;
  teardown(): Promise<void>;
  getService<T = unknown>(name: string): T;
  getBinding<T = unknown>(name: string): T;
}

// ============================================================================
// E2E Testing Types
// ============================================================================

export interface E2ETestOptions {
  browser?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  viewport?: { width: number; height: number };
  contextOptions?: Record<string, unknown>;
  baseURL?: string;
}

export interface PageAction {
  type: 'click' | 'fill' | 'select' | 'hover' | 'navigate' | 'waitFor' | 'screenshot' | 'assert';
  selector?: string;
  value?: string;
  options?: Record<string, unknown>;
}

export interface E2ETestFlow {
  name: string;
  url: string;
  actions: PageAction[];
  assertions?: PageAction[];
}

// ============================================================================
// Coverage Types
// ============================================================================

export interface CoverageOptions {
  include: string[];
  exclude: string[];
  reporter: string[];
  thresholds?: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
}

export interface CoverageReport {
  files: Record<string, FileCoverage>;
  totals: TestCoverage;
  thresholdMet: boolean;
}

export interface FileCoverage {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
  path: string;
}

// ============================================================================
// CI/CD Integration Types
// ============================================================================

export interface CIConfig {
  provider: 'github' | 'gitlab' | 'circleci' | 'jenkins' | 'azure' | 'bitbucket';
  token?: string;
  apiUrl?: string;
  runId?: string;
  jobId?: string;
}

export interface CIIntegration {
  detect(): boolean;
  getConfig(): CIConfig | null;
  uploadResults(results: RunResult): Promise<void>;
  uploadCoverage(coverage: CoverageReport): Promise<void>;
  commentOnPR(comment: string): Promise<void>;
}
