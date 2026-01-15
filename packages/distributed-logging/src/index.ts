/**
 * ClaudeFlare Distributed Logging - Ultra-Optimized
 * Lightweight distributed logging solution
 */

export * from './types';

// Core components (minimal exports)
export { LogCollector, createLogCollector } from './collector/collector';
export { LogAggregator, createLogAggregator } from './aggregation/aggregator';
export { LogSearchEngine, createLogSearchEngine } from './search/engine';
export { LogAnalytics, createLogAnalytics } from './analytics/analytics';
export { StorageManager, createStorageManager } from './storage/storage';
export { LogStreamingManager, createLogStreamingManager } from './streaming/streaming';
export { LogMetricsCollector, createLogMetricsCollector } from './metrics/metrics';

// Utilities (consolidated)
export { createLogger } from './utils/logger';
export * from './utils/helpers';

// Main system
export { DistributedLoggingSystem, createDistributedLoggingSystem } from './system';
