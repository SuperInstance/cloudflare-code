/**
 * @claudeflare/scheduler
 *
 * Advanced scheduling and cron system for ClaudeFlare distributed AI coding platform
 *
 * @example
 * ```typescript
 * import { JobScheduler, CronParser, JobMonitor } from '@claudeflare/scheduler';
 *
 * // Create scheduler
 * const scheduler = new JobScheduler();
 *
 * // Register a job
 * scheduler.registerJob({
 *   id: 'daily-report',
 *   name: 'Daily Report Generator',
 *   cronExpression: '0 9 * * *', // 9 AM daily
 *   handler: async (context) => {
 *     console.log('Generating daily report...');
 *     return { success: true };
 *   }
 * });
 *
 * // Start scheduler
 * await scheduler.start();
 * ```
 */

// Core types
export * from './types';

// Cron module
export { CronParser } from './cron/parser';
export type {
  CronExpression,
  CronParts,
  CronValidationResult,
  NextExecution,
  CronDescription,
  ExecutionHistoryEntry,
  TimeZone
} from './types';

// Jobs module
export { JobScheduler } from './jobs/scheduler';
export type {
  Job,
  JobDefinition,
  JobHandler,
  JobStatus,
  JobPriority,
  JobResult,
  JobExecutionContext,
  QueuedJob,
  RetryPolicy,
  TimeoutConfig,
  ConcurrencyConfig,
  Logger
} from './types';

// Distributed module
export { DistributedCoordinator } from './distributed/coordinator';
export type { DistributedCoordinatorConfig } from './distributed/coordinator';

// Monitoring module
export { JobMonitor } from './monitoring/monitor';
export type { JobMonitorConfig, LogEntry, JobMetrics } from './monitoring/monitor';

// Dependencies module
export { DependencyManager } from './dependencies/manager';
export type {
  DependencyManagerConfig,
  TopologicalSortResult,
  DependencyResolutionResult
} from './dependencies/manager';

// Execution module
export { ExecutionEngine } from './execution/executor';
export type {
  ExecutionEngineConfig,
  ExecutionProfile,
  ResourcePool
} from './execution/executor';

// Analytics module
export { SchedulingAnalytics } from './analytics/analytics';
export type {
  AnalyticsConfig,
  TimeSeriesPoint,
  JobPerformanceData,
  ResourceUtilizationData
} from './analytics/analytics';

// Utilities
export * from './utils';
