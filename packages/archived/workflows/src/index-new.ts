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

// Enhanced Execution Engine
export {
  EnhancedWorkflowEngine,
  type EnhancedEngineConfig,
  type ExecutionContext as EnhancedExecutionContext,
  type ExecutionPlan,
  type ExecutionMetrics,
  type ExecutionCheckpoint
} from './execution/enhanced-engine';

// Visual Workflow Designer
export {
  WorkflowDesigner,
  type DesignerConfig,
  type NodeTemplate,
  type DragState,
  type SelectionState,
  type ConnectionDraft
} from './designer/designer';

// Action Registry
export { ActionRegistry } from './actions';

// Trigger System
export { TriggerManager } from './triggers';

// Condition Logic
export {
  ConditionEvaluator,
  ConditionBuilder,
  Conditions
} from './conditions';

// Enhanced Condition Evaluator
export {
  EnhancedConditionEvaluator,
  type EvaluationContext,
  type EvaluationResult,
  type Rule,
  type DecisionTree,
  type Expression
} from './conditions/enhanced-evaluator';

// Visual Builder
export { WorkflowBuilder, NodeTemplateRegistry } from './builder';

// Templates
export { TemplateRegistry } from './templates';

// Enhanced Template Library
export {
  EnhancedTemplateLibrary,
  type TemplateLibrary,
  type TemplateMetadata,
  type WorkflowPattern,
  type BestPractice
} from './templates/enhanced-library';

// Task Orchestrator
export {
  TaskOrchestrator,
  TaskPriority,
  TaskExecutionStatus,
  type TaskDefinition,
  type TaskExecution,
  type TaskExecutor,
  type TaskSchedule,
  type OrchestratorConfig
} from './tasks/orchestrator';

// Parallel Executor
export {
  ParallelExecutor,
  Mutex,
  Semaphore,
  Barrier,
  CountdownLatch,
  type ParallelTask,
  type ParallelExecutionConfig,
  type ParallelExecutionResult,
  type ParallelExecutionSummary
} from './parallel/executor';

// Workflow Versioning
export {
  WorkflowVersioningManager,
  type WorkflowVersion,
  type VersionChangeLog,
  type VersionDiff,
  type RollbackPlan,
  type Migration,
  type ABTest,
  type VersionStorage
} from './versioning/manager';

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
  NodeStatus,
  TriggerType,
  ActionType,
  Condition,
  ConditionOperator
} from './types';

// Export DAG utilities
export { DAGManager } from './engine/dag';

// Export action executor
export { ActionExecutor } from './engine/action-executor';

// Export execution logger
export { ExecutionLogger } from './engine/logger';
