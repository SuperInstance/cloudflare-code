// Core Circuit Breaker
export { CircuitBreaker } from './circuit-breaker.js';
export { CircuitBreakerEngine } from './breaker/engine.js';

// Fault Detection
export { FaultDetector } from './fault/detector.js';
export type { FaultDetectionResult, DetectedIssue, FaultDetectorConfig } from './fault/detector.js';

// Fallback Management
export { FallbackManager } from './fallback/manager.js';

// Recovery
export { RecoveryEngine } from './recovery/engine.js';
export type { RecoveryResult } from './recovery/engine.js';

// Monitoring
export { MetricsCollector } from './monitoring/metrics.js';

// Analytics
export { AnalyticsCollector } from './analytics/collector.js';

// Configuration
export {
  getDefaultConfig,
  getDefaultHealthCheckConfig,
  getDefaultRecoveryConfig,
  validateConfig,
  mergeConfig,
  PRESETS,
  ConfigBuilder,
  createConfigBuilder,
} from './config/index.js';

// Types
export type {
  CircuitState,
  ExecutionResult,
  FallbackPriority,
  HealthStatus,
  ThresholdConfig,
  CircuitBreakerConfig,
  ExecutionContext,
  ExecutionResultData,
  FallbackFunction,
  FallbackConfig,
  CircuitMetrics,
  HealthCheckConfig,
  RecoveryConfig,
  WindowDataPoint,
  PredictiveModel,
  AnalyticsEvent,
  CircuitSnapshot,
  StorageAdapter,
  CircuitEventListener,
  CircuitEvent,
  OperationOptions,
} from './types/index.js';

// Utilities
export { SlidingWindow } from './utils/window.js';
