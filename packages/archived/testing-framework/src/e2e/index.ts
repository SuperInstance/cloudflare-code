/**
 * End-to-End Testing Module for ClaudeFlare Testing Framework
 * Provides browser automation and E2E testing capabilities
 */

export * from './browser';
export * from './pages';
export * from './elements';
export * from './actions';
export * from './assertions';
export * from './runner';
export * from './reporter';

// Main exports for E2E testing
export { createE2ETestRunner, E2ETestRunner } from './runner';
export { BrowserManager } from './browser';
export { Page } from './pages';
export { Element } from './elements';
export { UserActions } from './actions';
export { E2EAssertions } from './assertions';
export { E2EReporter } from './reporter';