/**
 * ClaudeFlare Testing Framework
 * A comprehensive testing solution for ClaudeFlare applications
 */

export * from './core';
export * from './unit';
export * from './integration';
export * from './e2e';
export * from './performance';
export * from './load';
export * from './chaos';
export * from './contract';
export * from './visual';
export * from './security';
export * from './mocks';
export * from './coverage';
export * from './watch';
export * from './cicd';
export * from './isolation';
export * from './snapshot';
export * from './property';
export * from './accessibility';
export * from './i18n';
export * from './ab-testing';
export * from './plugins';
export * from './dashboard';
export * from './environments';

// Main entry point for the testing framework
export { createTestRunner, TestRunner } from './core/test-runner';
export { TestConfig, TestResult, TestSuite, TestCase } from './core/types';
export { TestReporter, ConsoleReporter, JsonReporter, JUnitReporter } from './core/reporters';
export { TestScheduler, ParallelScheduler, SequentialScheduler } from './core/scheduler';