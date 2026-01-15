/**
 * Integration Testing Module for ClaudeFlare Testing Framework
 * Provides comprehensive testing for multi-service applications
 */

export * from './scenarios';
export * from './services';
export * from './network';
export * from './database';
export * from './messaging';
export * from './load';
export * from './data';
export * from './assertions';
export * from './mocks';
export * from './runner';

// Main exports for integration testing
export { createIntegrationTestRunner, IntegrationTestRunner } from './runner';
export { createScenario } from './scenarios';
export { createServiceTest } from './services';
export { NetworkTester } from './network';
export { DatabaseTester } from './database';
export { MessagingTester } from './messaging';
export { createLoadTest } from './load';
export { createDataTest } from './data';
export { assertIntegration } from './assertions';
export { mockService } from './mocks';

// Test helpers
export { wait, retry, timeout } from './helpers';
export { HealthChecker } from './health';
export { CircuitBreaker } from './circuit-breaker';
export { MetricsCollector } from './metrics';