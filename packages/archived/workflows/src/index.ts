/**
 * ClaudeFlare Workflow Automation Engine
 *
 * A comprehensive workflow automation platform for Cloudflare Workers
 */

// Core types
export * from './types';

// Execution Engine
export {
  WorkflowExecutionEngine,
  type EngineConfig,
  type ExecutionContext
} from './engine';

// Action Registry
export { ActionRegistry } from './actions';

// Trigger System
export { TriggerManager } from './triggers';

// Condition Logic
export { ConditionEvaluator, ConditionBuilder, Conditions } from './conditions';

// Visual Builder
export { WorkflowBuilder, NodeTemplateRegistry } from './builder';

// Templates
export { TemplateRegistry } from './templates';

// Utilities
export { WorkflowValidator, WorkflowSerializer } from './utils';

// Re-export commonly used types for convenience
export type {
  Workflow,
  Execution,
  Node,
  Connection,
  Trigger,
  Action,
  Template,
  WorkflowStatus,
  ExecutionStatus,
  TriggerType,
  ActionType,
  Condition
} from './types';
