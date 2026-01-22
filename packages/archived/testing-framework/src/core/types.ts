import { TestStatus, TestPriority } from './constants';

/**
 * Test configuration interface
 */
export interface TestConfig {
  /**
   * Test file patterns to run
   */
  pattern?: string[];

  /**
   * Test directory patterns to run
   */
  testDir?: string[];

  /**
   * Files to ignore
   */
  ignore?: string[];

  /**
   * Maximum number of test files running in parallel
   */
  maxParallel?: number;

  /**
   * Maximum number of test suites running in parallel
   */
  maxSuitesParallel?: number;

  /**
   * Enable test coverage
   */
  coverage?: boolean;

  /**
   * Coverage reporter configuration
   */
  coverageReporter?: CoverageReporterConfig;

  /**
   * Watch mode configuration
   */
  watch?: WatchModeConfig;

  /**
   * Test reporter configuration
   */
  reporters?: ReporterConfig[];

  /**
   * Environment variables
   */
  env?: Record<string, string>;

  /**
   * Global setup files
   */
  setupFiles?: string[];

  /**
   * Global teardown files
   */
  teardownFiles?: string[];

  /**
   * Global before/after hooks
   */
  hooks?: TestHooksConfig;

  /**
   * Plugin configuration
   */
  plugins?: PluginConfig[];

  /**
   * Performance configuration
   */
  performance?: PerformanceConfig;

  /**
   * Chaos engineering configuration
   */
  chaos?: ChaosConfig;

  /**
   * Security testing configuration
   */
  security?: SecurityConfig;

  /**
   * Environment specific configuration
   */
  environments?: EnvironmentConfig[];

  /**
   * CI/CD integration configuration
   */
  cicd?: CIConfig;
}

/**
 * Coverage reporter configuration
 */
export interface CoverageReporterConfig {
  enabled: boolean;
  outputDir: string;
  reporters: ('html' | 'lcov' | 'text' | 'json' | 'clover')[];
  exclude?: string[];
  include?: string[];
  threshold?: {
    statements?: number;
    branches?: number;
    functions?: number;
    lines?: number;
  };
}

/**
 * Watch mode configuration
 */
export interface WatchModeConfig {
  enabled: boolean;
  patterns?: string[];
  interval?: number;
  ignore?: string[];
  clearScreen?: boolean;
}

/**
 * Reporter configuration
 */
export interface ReporterConfig {
  type: 'console' | 'json' | 'junit' | 'html' | 'custom';
  output?: string;
  options?: Record<string, any>;
}

/**
 * Test hooks configuration
 */
export interface TestHooksConfig {
  beforeAll?: string[];
  afterAll?: string[];
  beforeEach?: string[];
  afterEach?: string[];
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  enabled: boolean;
  metrics: ('time' | 'memory' | 'cpu' | 'network' | 'custom')[];
  threshold?: Record<string, number>;
  benchmark?: boolean;
}

/**
 * Chaos engineering configuration
 */
export interface ChaosConfig {
  enabled: boolean;
  experiments: ChaosExperiment[];
  rate?: number;
  injection?: 'random' | 'deterministic';
  recovery?: {
    enabled: boolean;
    timeout: number;
  };
}

/**
 * Chaos experiment configuration
 */
export interface ChaosExperiment {
  name: string;
  enabled: boolean;
  type: 'latency' | 'error' | 'timeout' | 'disruption';
  rate: number;
  config?: Record<string, any>;
}

/**
 * Security testing configuration
 */
export interface SecurityConfig {
  enabled: boolean;
  tests: SecurityTest[];
  scanners?: ('xss' | 'sql' | 'csrf' | 'cors' | 'jwt')[];
  threshold?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Security test configuration
 */
export interface SecurityTest {
  name: string;
  enabled: boolean;
  type: 'scan' | 'fuzz' | 'auth';
  config?: Record<string, any>;
}

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  name: string;
  url?: string;
  variables?: Record<string, string>;
  overrides?: TestConfig;
}

/**
 * CI/CD configuration
 */
export interface CIConfig {
  enabled: boolean;
  provider: 'github' | 'gitlab' | 'jenkins' | 'azure';
  config?: Record<string, any>;
}

/**
 * Test suite interface
 */
export interface TestSuite {
  id: string;
  name: string;
  description?: string;
  file?: string;
  path?: string;
  tests: TestCase[];
  metadata?: SuiteMetadata;
  hooks?: TestHooksConfig;
  config?: TestConfig;
  environment?: string;
}

/**
 * Test case interface
 */
export interface TestCase {
  id: string;
  name: string;
  description?: string;
  file?: string;
  line?: number;
  suite: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'load' | 'chaos' | 'contract' | 'visual' | 'security' | 'accessibility' | 'i18n' | 'ab-testing';
  priority: TestPriority;
  status: TestStatus;
  retry?: number;
  timeout?: number;
  hooks?: TestHooksConfig;
  config?: TestConfig;
  metadata?: TestCaseMetadata;
  dependencies?: string[];
  data?: Record<string, any>;
  expected?: ExpectedResult;
  actual?: ActualResult;
  error?: TestError;
  duration?: number;
  timestamp?: number;
}

/**
 * Expected result interface
 */
export interface ExpectedResult {
  status: 'pass' | 'fail' | 'skip' | 'pending';
  value?: any;
  error?: string;
  assertions?: AssertionResult[];
}

/**
 * Actual result interface
 */
export interface ActualResult {
  status: 'pass' | 'fail' | 'skip' | 'pending';
  value?: any;
  error?: string;
  assertions?: AssertionResult[];
}

/**
 * Assertion result interface
 */
export interface AssertionResult {
  status: 'pass' | 'fail';
  message: string;
  expected?: any;
  actual?: any;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
}

/**
 * Test error interface
 */
export interface TestError {
  message: string;
  type: string;
  stack?: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
  code?: string;
  meta?: Record<string, any>;
}

/**
 * Suite metadata interface
 */
export interface SuiteMetadata {
  version?: string;
  author?: string;
  tags?: string[];
  category?: string;
  flaky?: boolean;
  slow?: boolean;
  disabled?: boolean;
  requires?: string[];
  provides?: string[];
}

/**
 * Test case metadata interface
 */
export interface TestCaseMetadata {
  version?: string;
  author?: string;
  tags?: string[];
  category?: string;
  flaky?: boolean;
  slow?: boolean;
  disabled?: boolean;
  requires?: string[];
  provides?: string[];
  parameters?: Record<string, any>;
}

/**
 * Test result interface
 */
export interface TestResult {
  suite: string;
  test: string;
  status: TestStatus;
  duration: number;
  startTime: number;
  endTime: number;
  error?: TestError;
  assertions: AssertionResult[];
  metadata?: TestCaseMetadata;
  performance?: PerformanceMetrics;
  coverage?: CoverageMetrics;
  environment?: string;
  retryCount?: number;
  flaky?: boolean;
  slow?: boolean;
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  time: {
    startTime: number;
    endTime: number;
    duration: number;
    average: number;
    min: number;
    max: number;
    percentile50: number;
    percentile90: number;
    percentile95: number;
    percentile99: number;
  };
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu?: {
    usage: number;
    user: number;
    system: number;
  };
  network?: {
    requests: number;
    bytesIn: number;
    bytesOut: number;
    latency: number;
    errors: number;
  };
}

/**
 * Coverage metrics interface
 */
export interface CoverageMetrics {
  statements: {
    total: number;
    covered: number;
    percentage: number;
  };
  branches: {
    total: number;
    covered: number;
    percentage: number;
  };
  functions: {
    total: number;
    covered: number;
    percentage: number;
  };
  lines: {
    total: number;
    covered: number;
    percentage: number;
  };
  files: Record<string, {
    statements: {
      total: number;
      covered: number;
      percentage: number;
    };
    branches: {
      total: number;
      covered: number;
      percentage: number;
    };
    functions: {
      total: number;
      covered: number;
      percentage: number;
    };
    lines: {
      total: number;
      covered: number;
      percentage: number;
    };
  }>;
}