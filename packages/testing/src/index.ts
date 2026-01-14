/**
 * ClaudeFlare Testing Framework
 *
 * A comprehensive testing framework for the ClaudeFlare distributed AI platform
 * providing unit, integration, E2E, and performance testing capabilities.
 */

// Re-export all types
export * from './types/index.js';

// Test Runner
export { TestRunner, TestDiscovery, TestExecutor, runner } from './runner/runner.js';

// Assertion Library
export {
  MatcherImpl,
  AsyncMatchers,
  ExpectImpl,
  createExpect,
  EqualityUtils,
  DiffUtils,
} from './assertions/matcher.js';

// Mock Framework
export {
  MockFactory,
  ModuleMockFactory,
  KVNamespaceMockFactory,
  R2BucketMockFactory,
  D1DatabaseMockFactory,
  DurableObjectMockFactory,
  TimerMock,
  HTTPMock,
  mockFactory,
  moduleMockFactory,
  kvMockFactory,
  r2MockFactory,
  d1MockFactory,
  durableObjectMockFactory,
  timerMock,
  httpMock,
  mock,
  spyOn,
  mockKV,
  mockR2,
  mockD1,
  mockDurableObject,
  useFakeTimers,
  useRealTimers,
} from './mocking/factory.js';

// Integration Testing
export {
  ServiceFactory,
  TestEnvironmentImpl,
  DatabaseSeeder,
  APITester,
  WorkflowRunner,
  IntegrationTestBuilder,
  DistributedSystemTester,
  serviceFactory,
  databaseSeeder,
  workflowRunner,
  distributedSystemTester,
  createIntegrationTest,
  createAPITester,
} from './integration/framework.js';

// E2E Testing
export {
  BrowserManager,
  PageActionExecutor,
  E2EFlowRunner,
  VisualRegressionTester,
  A11yTester,
  CrossBrowserTester,
  MobileTester,
  E2ETestBuilder,
  MOBILE_VIEWPORTS,
  createE2ETest,
  runE2ETest,
  testA11y,
  testVisualRegression,
  testCrossBrowser,
  testMobile,
} from './e2e/runner.js';

// Performance Testing
export {
  BenchmarkRunner,
  LoadTester,
  LatencyMeasurer,
  ThroughputTester,
  ResourceMonitor,
  PerformanceTestBuilder,
  benchmark,
  loadTest,
  createPerformanceTest,
  measureLatency,
  monitorResources,
} from './performance/runner.js';

// Reporting
export {
  ConsoleReporter,
  HTMLReporter,
  JUnitReporter,
  CoverageReporter,
  FlakyTestDetector,
  TrendAnalyzer,
  GitHubIntegration,
  createReporter,
  createCIIntegration,
} from './reporting/analytics.js';

// Utilities
export * from './utils/helpers.js';
