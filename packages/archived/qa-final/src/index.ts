/**
 * ClaudeFlare QA Final Package
 * Comprehensive testing and quality assurance finalization
 */

// @ts-nocheck
// Core testing utilities
export * from './utils/test-helpers';
export * from './utils/assertions';
export * from './utils/mocks';
export * from './utils/fixtures';

// Test runners
export { IntegrationTestRunner } from './integration/runner';
export { E2ETestRunner } from './e2e/runner';
export { PerformanceTestRunner } from './performance/runner';
export { SecurityTestRunner } from './security/runner';
export { ContractTestRunner } from './contract/runner';

// Reporting
export { TestReporter } from './reporting/reporter';
// export { CoverageReporter } from './reporting/coverage';
// export { PerformanceReporter } from './reporting/performance';
// export { SecurityReporter } from './reporting/security';
export { DashboardGenerator } from './reporting/dashboard';

// Types
export * from './utils/types';
