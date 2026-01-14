/**
 * Agent Framework - Main Index
 *
 * Comprehensive agent framework for multi-agent orchestration,
 * communication, task management, and collaboration patterns.
 */

// Core types
export * from './types';

// Orchestration
export { AgentOrchestrator, LoadBalancingStrategy } from './orchestration/orchestrator';
export type {
  OrchestratorConfig,
  WorkflowContext,
  OrchestratorMetrics,
  OrchestratorEvents
} from './orchestration/orchestrator';

// Communication
export { MessageBroker } from './communication/protocol';
export type {
  MessageBrokerConfig,
  MessageBrokerEvents
} from './communication/protocol';

// Registry
export { AgentRegistry } from './registry/registry';
export type {
  RegistryConfig,
  RegistryStats,
  RegistryEvents
} from './registry/registry';

// Task Management
export { TaskManager } from './tasks/manager';
export type {
  TaskManagerConfig,
  TaskManagerEvents
} from './tasks/manager';

// Lifecycle Management
export { AgentLifecycleManager } from './lifecycle/manager';
export type {
  LifecycleManagerConfig,
  LifecycleManagerEvents
} from './lifecycle/manager';

// Collaboration Patterns
export { CollaborationPatternManager } from './patterns/collaboration';
export type {
  PatternManagerOptions
} from './patterns/collaboration';

// Tools
export { ToolRegistry } from './tools/integration';
export type {
  Tool,
  ToolParameter,
  ToolHandler,
  ToolContext,
  ToolResult,
  ToolInvocation,
  ToolComposition,
  PermissionGrant,
  ToolRegistryConfig,
  ToolRegistryEvents,
  ToolMetrics
} from './tools/integration';

// Utilities
export { Logger, createLogger, consoleLogHandler } from './utils/logger';
export type { LogHandler } from './utils/logger';

export {
  generateId,
  sleep,
  retryWithBackoff,
  parallel,
  chunk,
  debounce,
  throttle,
  deepClone,
  deepMerge,
  calculateBackoff,
  isDefined,
  isEmpty,
  pick,
  omit,
  formatDuration,
  formatBytes,
  now,
  elapsedSince,
  isExpired,
  parseDuration,
  timeout,
  memoize,
  measureTime,
  measureTimeSync
} from './utils/helpers';
