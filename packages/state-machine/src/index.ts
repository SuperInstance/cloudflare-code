/**
 * ClaudeFlare State Machine Package
 * Advanced state machine and workflow orchestration
 */

// Core types
export type {
  State,
  StateContext,
  Transition,
  Guard,
  Action,
  StateDefinition,
  StateMachineDefinition,
  StateMachineConfig,
  StateTransitionEvent,
  StateMachineEvents,
  StatePath,
  StateMachineSnapshot,
  TransitionMetrics,
  StateStatistics,
  VisualizationOptions,
  TestOptions,
  TestResult,
  TestCoverage,
  DistributedStateConfig,
  StateSyncMessage,
  ConsensusResult,
} from './types/index.js';

export {
  StateMachineError,
  TransitionError,
  GuardError,
  ActionError,
} from './types/index.js';

// Core engine
export {
  StateMachineEngine,
  createStateMachine,
} from './engine/engine.js';

// State manager
export {
  StateManager,
  InMemoryPersistenceAdapter,
  LocalStoragePersistenceAdapter,
} from './state/manager.js';

export type {
  ValidationResult,
  StateChangeRecord,
  StateManagerOptions,
  PersistenceAdapter,
  StateVersion,
  Migration,
  MigrationFunction,
} from './state/manager.js';

// Transition handler
export {
  TransitionHandler,
  TransitionRateLimiter,
  TransitionBatchExecutor,
  createTransitionLogger,
  createMetricsCollector,
  createTransitionValidator,
} from './transitions/handler.js';

export type {
  TransitionHook,
  TransitionHandlerOptions,
  TransitionHandlerMetrics,
  TransitionOptimizationReport,
} from './transitions/handler.js';

// Visualization
export {
  StateVisualizer,
  createAnimatedVisualization,
} from './visualization/visualizer.js';

export type {
  VisualizationData,
  VisualNode,
  VisualEdge,
  VisualLayout,
  NodeStyle,
  EdgeStyle,
} from './visualization/visualizer.js';

// Testing
export {
  StateMachineTester,
  quickTest,
  generateTestCases,
} from './testing/tester.js';

export type {
  TestCase,
  TestStep,
  PathExplorationResult,
  PropertyTestResult,
} from './testing/tester.js';

// Distributed coordination
export {
  DistributedStateCoordinator,
  createDistributedCluster,
} from './distributed/coordinator.js';

export type {
  ClusterNode,
  ReplicationLogEntry,
  CoordinatorOptions,
} from './distributed/coordinator.js';

// Analytics
export { StateMachineAnalytics } from './analytics/analytics.js';

export type {
  TimeSeriesPoint,
  StateDurationStats,
  TransitionFrequency,
  AnomalyResult,
  TrendAnalysis,
  AnalyticsReport,
  PerformanceMetrics,
} from './analytics/analytics.js';

// Utilities
export {
  validateDefinition,
  findUnreachableStates,
  findDeadEndStates,
  detectCycles,
  calculateComplexity,
  optimizeDefinition,
  cloneDefinition,
  mergeDefinitions,
  toJSONSchema,
  generateTransitionTable,
  formatPath,
  comparePaths,
  findShortestPath,
  calculateDepth,
} from './utils/helpers.js';
