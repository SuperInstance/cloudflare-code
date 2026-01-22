/**
 * Environment Management Module for ClaudeFlare Testing Framework
 * Provides environment-specific testing configurations and management
 */

export * from './manager';
export * from './config';
export * from './secrets';
export * from './variables';
export * from './types';

// Main exports for environment management
export { createEnvironmentManager, EnvironmentManager } from './manager';
export { EnvironmentConfig } from './config';
export { SecretManager } from './secrets';
export { VariableManager } from './variables';
export { EnvironmentContext } from './types';