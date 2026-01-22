/**
 * Test status constants
 */
export enum TestStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASS = 'pass',
  FAIL = 'fail',
  SKIPPED = 'skipped',
  TIMEOUT = 'timeout',
  ERROR = 'error'
}

/**
 * Test priority constants
 */
export enum TestPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

/**
 * Test type constants
 */
export const TestTypes = {
  UNIT: 'unit',
  INTEGRATION: 'integration',
  E2E: 'e2e',
  PERFORMANCE: 'performance',
  LOAD: 'load',
  CHAOS: 'chaos',
  CONTRACT: 'contract',
  VISUAL: 'visual',
  SECURITY: 'security',
  ACCESSIBILITY: 'accessibility',
  I18N: 'i18n',
  AB_TESTING: 'ab-testing'
} as const;

/**
 * Test reporter types
 */
export const ReporterTypes = {
  CONSOLE: 'console',
  JSON: 'json',
  JUNIT: 'junit',
  HTML: 'html',
  CUSTOM: 'custom'
} as const;

/**
 * Coverage reporter types
 */
export const CoverageReporterTypes = {
  HTML: 'html',
  LCOV: 'lcov',
  TEXT: 'text',
  JSON: 'json',
  CLOVER: 'clover'
} as const;

/**
 * Chaos experiment types
 */
export const ChaosExperimentTypes = {
  LATENCY: 'latency',
  ERROR: 'error',
  TIMEOUT: 'timeout',
  DISRUPTION: 'disruption'
} as const;

/**
 * Security test types
 */
export const SecurityTestTypes = {
  SCAN: 'scan',
  FUZZ: 'fuzz',
  AUTH: 'auth'
} as const;

/**
 * Security scanner types
 */
export const SecurityScannerTypes = {
  XSS: 'xss',
  SQL: 'sql',
  CSRF: 'csrf',
  CORS: 'cors',
  JWT: 'jwt'
} as const;

/**
 * Environment names
 */
export const EnvironmentNames = {
  LOCAL: 'local',
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TESTING: 'testing'
} as const;

/**
 * CI provider types
 */
export const CIProviderTypes = {
  GITHUB: 'github',
  GITLAB: 'gitlab',
  JENKINS: 'jenkins',
  AZURE: 'azure'
} as const;

/**
 * Performance metric types
 */
export const PerformanceMetricTypes = {
  TIME: 'time',
  MEMORY: 'memory',
  CPU: 'cpu',
  NETWORK: 'network',
  CUSTOM: 'custom'
} as const;

/**
 * Test assertion types
 */
export const AssertionTypes = {
  EQUALS: 'equals',
  NOT_EQUALS: 'not-equals',
  TRUTHY: 'truthy',
  FALSY: 'falsy',
  NULL: 'null',
  NOT_NULL: 'not-null',
  UNDEFINED: 'undefined',
  DEFINED: 'defined',
  INSTANCE_OF: 'instance-of',
  NOT_INSTANCE_OF: 'not-instance-of',
  GREATER_THAN: 'greater-than',
  GREATER_THAN_OR_EQUAL: 'greater-than-or-equal',
  LESS_THAN: 'less-than',
  LESS_THAN_OR_EQUAL: 'less-than-or-equal',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not-contains',
  MATCHES: 'matches',
  NOT_MATCHES: 'not-matches',
  THROWS: 'throws',
  NOT_THROWS: 'not-throws',
  RESOLVES: 'resolves',
  REJECTS: 'rejects',
  APPROXIMATELY: 'approximately',
  SAME: 'same',
  NOT_SAME: 'not-same',
  CLOSE_TO: 'close-to',
  ARRAY_CONTAINS: 'array-contains',
  ARRAY_NOT_CONTAINS: 'array-not-contains',
  OBJECT_CONTAINS_KEY: 'object-contains-key',
  OBJECT_NOT_CONTAINS_KEY: 'object-not-contains-key'
} as const;

/**
 * Test file patterns
 */
export const TestPatterns = {
  JEST: ['**/__tests__/**/*', '**/*.test.{js,ts,jsx,tsx}'],
  VITEST: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
  PLAYWRIGHT: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
  CUSTOM: ['**/*.{test,spec}.{js,ts,jsx,tsx}']
} as const;

/**
 * Default configuration values
 */
export const DefaultConfig = {
  MAX_PARALLEL: 4,
  MAX_SUITES_PARALLEL: 2,
  COVERAGE_THRESHOLD: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80
  },
  WATCH_INTERVAL: 1000,
  DEFAULT_TIMEOUT: 5000,
  MAX_RETRIES: 3,
  CHAOS_RATE: 0.1,
  SECURITY_THRESHOLD: {
    critical: 0,
    high: 5,
    medium: 10,
    low: 20
  },
  PERFORMANCE_THRESHOLD: {
    time: 5000,
    memory: 100 * 1024 * 1024,
    cpu: 80
  }
} as const;

/**
 * Test execution states
 */
export enum ExecutionState {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  ERROR = 'error'
}

/**
 * Test scheduler types
 */
export const SchedulerTypes = {
  PARALLEL: 'parallel',
  SEQUENTIAL: 'sequential',
  PRIORITY: 'priority',
  ADAPTIVE: 'adaptive'
} as const;

/**
 * Test isolation types
 */
export const IsolationTypes = {
  NONE: 'none',
  SUITE: 'suite',
  TEST: 'test',
  PROCESS: 'process'
} as const;

/**
 * Mock service types
 */
export const MockServiceTypes = {
  HTTP: 'http',
  HTTPS: 'https',
  WEBSOCKET: 'websocket',
  GRPC: 'grpc',
  REST: 'rest',
  GRAPHQL: 'graphql'
} as const;

/**
 * Visual testing comparison methods
 */
export const VisualComparisonMethods = {
  PIXEL: 'pixel',
  PERCEPTUAL: 'perceptual',
  COLOR: 'color',
  LAYOUT: 'layout'
} as const;

/**
 * A/B testing strategies
 */
export const ABTestingStrategies = {
  RANDOM: 'random',
  USER_ID: 'user-id',
  IP_ADDRESS: 'ip-address',
  DEVICE_TYPE: 'device-type',
  GEOLOCATION: 'geolocation',
  SESSION: 'session'
} as const;

/**
 * Accessibility standards
 */
export const AccessibilityStandards = {
  WCAG_2_1: 'wcag-2-1',
  WCAG_2_2: 'wcag-2-2',
  WCAG_3: 'wcag-3',
  SECTION_508: 'section-508',
  ARIA: 'aria'
} as const;