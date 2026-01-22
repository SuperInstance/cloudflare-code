# @claudeflare/scheduler

Advanced scheduling and cron system for the ClaudeFlare distributed AI coding platform.

## Features

- **Cron Expression Parsing**: Full support for standard 5-part and extended 6-part cron expressions
- **Job Scheduling**: Schedule 100K+ jobs with sub-second accuracy
- **Distributed Execution**: Coordinate job execution across multiple nodes
- **Job Monitoring**: Track execution, status, metrics, and analytics
- **Dependency Management**: Handle complex job dependencies with topological sorting
- **Execution Engine**: Isolated job execution with timeout and resource management
- **Analytics**: Performance metrics, capacity planning, and optimization suggestions

## Installation

```bash
npm install @claudeflare/scheduler
```

## Quick Start

```typescript
import { JobScheduler } from '@claudeflare/scheduler';

// Create a scheduler
const scheduler = new JobScheduler({
  maxConcurrentJobs: 100,
  queueSizeLimit: 10000
});

// Register a job
scheduler.registerJob({
  id: 'daily-backup',
  name: 'Daily Database Backup',
  cronExpression: '0 2 * * *', // 2 AM daily
  handler: async (context) => {
    console.log('Starting backup...');
    // Perform backup logic
    return { success: true, records: 1000 };
  },
  retryPolicy: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 2
  }
});

// Enqueue a job for immediate execution
const jobId = scheduler.enqueueJob('daily-backup');

// Get job status
const job = scheduler.getJob(jobId);
console.log('Job status:', job?.status);

// Shutdown when done
await scheduler.shutdown();
```

## Core Concepts

### Job Definition

A job definition defines what work should be done and when:

```typescript
import { JobPriority, JobStatus } from '@claudeflare/scheduler';

const jobDefinition = {
  id: 'weekly-report',
  name: 'Weekly Analytics Report',
  cronExpression: '0 9 * * 1', // 9 AM every Monday
  priority: JobPriority.HIGH,
  handler: async (context) => {
    // Job logic here
    return { reportUrl: 'https://...' };
  },
  retryPolicy: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2
  },
  timeout: {
    duration: 300000, // 5 minutes
    strategy: 'kill'
  },
  concurrency: {
    maxConcurrent: 5,
    queueStrategy: 'priority'
  }
};
```

### Cron Expressions

The scheduler supports standard cron expressions:

```typescript
import { CronParser } from '@claudeflare/scheduler';

// Validate cron expression
const validation = CronParser.validate('0 9 * * *');
console.log(validation.valid); // true

// Get next execution time
const next = CronParser.nextExecution('0 9 * * *');
console.log(next.timestamp); // Next 9 AM

// Get human-readable description
const description = CronParser.describe('0 9 * * *');
console.log(description.description); // "At 09:00"

// Get multiple next executions
const nextExecutions = CronParser.nextExecutions('0 9 * * *', 5);
console.log(nextExecutions); // Array of next 5 execution times
```

### Job Execution Context

Jobs receive an execution context with information about the current execution:

```typescript
scheduler.registerJob({
  id: 'process-data',
  name: 'Process Data',
  handler: async (context) => {
    console.log('Job ID:', context.job.id);
    console.log('Attempt:', context.attemptNumber);
    console.log('Timeout:', context.timeout);
    console.log('Metadata:', context.metadata);

    // Check for cancellation
    if (context.signal.aborted) {
      throw new Error('Job was cancelled');
    }

    // Log messages
    context.logger.info('Processing started');

    // Your job logic here
    return { processed: 100 };
  }
});
```

### Job Monitoring

Monitor job execution with the built-in monitoring system:

```typescript
import { JobMonitor } from '@claudeflare/scheduler';

const monitor = new JobMonitor({
  retentionDays: 7,
  enableNotifications: true
});

// Track jobs
monitor.trackJob(job);

// Update job status
monitor.updateJobStatus(job.id, JobStatus.RUNNING);

// Add logs
monitor.addLog(job.id, 'info', 'Processing started');

// Get metrics
const metrics = monitor.getSchedulingMetrics();
console.log('Success rate:', metrics.successRate);

// Get notifications
const notifications = monitor.getNotifications(10);
```

### Distributed Scheduling

Coordinate job execution across multiple nodes:

```typescript
import { DistributedCoordinator } from '@claudeflare/scheduler';

const coordinator = new DistributedCoordinator({
  nodeId: 'node-1',
  heartbeatInterval: 5000,
  leaderElectionTimeout: 30000,
  stateSyncInterval: 10000
});

// Start coordinator
await coordinator.start();

// Check if leader
if (coordinator.isNodeLeader()) {
  console.log('This node is the leader');
}

// Get least loaded node
const node = coordinator.getLeastLoadedNode();

// Register callbacks
coordinator.onLeadershipGained(() => {
  console.log('Became leader');
});

coordinator.onJobAssigned((jobId, nodeId) => {
  console.log(`Job ${jobId} assigned to ${nodeId}`);
});
```

### Job Dependencies

Manage complex job dependencies:

```typescript
import { DependencyManager } from '@claudeflare/scheduler';

const dependencyManager = new DependencyManager({
  enableCascade: true,
  maxDepth: 100
});

// Add jobs to graph
dependencyManager.addJob(job1);
dependencyManager.addJob(job2);

// Add dependency
dependencyManager.addDependency('job2', 'job1', 'hard');

// Get execution order
const order = dependencyManager.getExecutionOrder();
console.log('Execution order:', order);

// Check for circular dependencies
const cycles = dependencyManager.detectCircularDependencies();
if (cycles.length > 0) {
  console.error('Circular dependencies detected:', cycles);
}

// Resolve dependencies
const resolution = dependencyManager.resolveDependencies();
console.log('Ready jobs:', resolution.readyJobs);
console.log('Blocked jobs:', resolution.blockedJobs);
```

### Execution Engine

Execute jobs with isolation and resource management:

```typescript
import { ExecutionEngine } from '@claudeflare/scheduler';

const engine = new ExecutionEngine({
  maxConcurrentExecutions: 100,
  defaultTimeout: 300000,
  enableProfiling: true
});

// Execute a job
const result = await engine.executeJob(job, handler, parameters);

if (result.success) {
  console.log('Result:', result.data);
} else {
  console.error('Error:', result.error);
}

// Get execution profile
const profile = engine.getExecutionProfile(job.id);
console.log('Duration:', profile?.duration);
console.log('Memory usage:', profile?.memoryUsage);

// Get statistics
const stats = engine.getStatistics();
console.log('Total executions:', stats.totalExecutions);
console.log('Resource utilization:', stats.resourceUtilization);
```

### Analytics

Analyze scheduling performance and get optimization suggestions:

```typescript
import { SchedulingAnalytics, JobMonitor } from '@claudeflare/scheduler';

const monitor = new JobMonitor();
const analytics = new SchedulingAnalytics(monitor, {
  retentionDays: 30,
  aggregationInterval: 300000
});

// Record executions
analytics.recordExecution(job, result);

// Get performance metrics
const perfMetrics = analytics.getPerformanceMetrics();
console.log('Scheduling accuracy:', perfMetrics.schedulingAccuracy);
console.log('Throughput:', perfMetrics.throughput);

// Get capacity planning
const capacity = analytics.getCapacityPlanning();
console.log('Utilization:', capacity.utilization);
console.log('Recommendations:', capacity.recommendations);

// Get optimization suggestions
const suggestions = analytics.getOptimizationSuggestions();
for (const suggestion of suggestions) {
  console.log(`[${suggestion.priority}] ${suggestion.title}`);
  console.log(`  ${suggestion.description}`);
  console.log(`  Action: ${suggestion.action}`);
}
```

## API Reference

### JobScheduler

Main scheduler class for managing job execution.

#### Constructor

```typescript
new JobScheduler(config?: {
  maxConcurrentJobs?: number;
  queueSizeLimit?: number;
  logger?: Logger;
})
```

#### Methods

- `registerJob<T>(definition: JobDefinition<T>): void` - Register a job definition
- `unregisterJob(jobId: string): void` - Unregister a job definition
- `enqueueJob<T>(definitionId: string, params?: T, metadata?: Record<string, any>): string` - Enqueue a job for execution
- `cancelJob(jobId: string): void` - Cancel a running job
- `getJob(jobId: string): Job | undefined` - Get job by ID
- `getAllJobs(): Job[]` - Get all jobs
- `getRunningJobs(): Job[]` - Get running jobs
- `getStats(): SchedulerStats` - Get scheduler statistics
- `shutdown(): Promise<void>` - Shutdown the scheduler

### CronParser

Parse and validate cron expressions.

#### Static Methods

- `parse(expression: CronExpression): CronParts` - Parse cron expression
- `validate(expression: CronExpression): CronValidationResult` - Validate cron expression
- `nextExecution(expression: CronExpression, from?: Date, timeZone?: string): NextExecution` - Get next execution time
- `nextExecutions(expression: CronExpression, count: number, from?: Date, timeZone?: string): Date[]` - Get multiple next executions
- `describe(expression: CronExpression, timeZone?: string, count?: number): CronDescription` - Get human-readable description

### JobMonitor

Monitor job execution and collect metrics.

#### Constructor

```typescript
new JobMonitor(config?: {
  retentionDays?: number;
  maxHistorySize?: number;
  enableNotifications?: boolean;
  logger?: Logger;
})
```

#### Methods

- `trackJob(job: Job): void` - Track a job
- `updateJobStatus(jobId: string, status: JobStatus, metadata?: Record<string, any>): void` - Update job status
- `addLog(jobId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: Record<string, any>): void` - Add log entry
- `getJobLogs(jobId: string, level?: string): LogEntry[]` - Get job logs
- `getJobHistory(jobDefinitionId: string): ExecutionHistoryEntry[]` - Get job history
- `getJobMetrics(jobDefinitionId: string): JobMetrics | undefined` - Get job metrics
- `getSchedulingMetrics(): SchedulingMetrics` - Get scheduling metrics
- `onStatusChange(jobId: string, callback: (status: JobStatus) => void): void` - Register status change callback

### DistributedCoordinator

Coordinate distributed job execution.

#### Constructor

```typescript
new DistributedCoordinator(config: DistributedCoordinatorConfig)
```

#### Methods

- `start(): Promise<void>` - Start the coordinator
- `stop(): Promise<void>` - Stop the coordinator
- `assignJob(jobId: string, nodeId: string): Promise<void>` - Assign job to node
- `acquireLock(key: string, ttl?: number): Promise<DistributedLock | null>` - Acquire distributed lock
- `releaseLock(key: string): Promise<void>` - Release distributed lock
- `getLeastLoadedNode(): NodeInfo | null` - Get least loaded node
- `getClusterState(): ClusterState` - Get cluster state
- `isNodeLeader(): boolean` - Check if this node is leader

## Best Practices

1. **Set appropriate timeouts**: Always set timeout values based on expected job duration
2. **Use retry policies**: Configure retries for transient failures
3. **Monitor job execution**: Use JobMonitor to track job status and performance
4. **Handle dependencies carefully**: Avoid circular dependencies and keep dependency depth reasonable
5. **Resource management**: Set appropriate concurrency limits to prevent resource exhaustion
6. **Error handling**: Always handle errors in job handlers and provide meaningful error messages
7. **Logging**: Use context.logger for job-specific logging
8. **Cancellation support**: Check context.signal.aborted for long-running operations

## Performance

The scheduler is designed to handle:

- **100K+ scheduled jobs**: Efficient job queuing and execution
- **Sub-second accuracy**: Precise timing for scheduled executions
- **High throughput**: Process thousands of jobs per minute
- **Distributed execution**: Scale horizontally across multiple nodes
- **99.9% on-time execution**: Reliable scheduling with minimal delays

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
