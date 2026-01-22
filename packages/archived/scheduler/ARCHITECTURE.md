# Scheduler Package Architecture

## Overview

The `@claudeflare/scheduler` package provides a comprehensive, production-ready job scheduling system for the ClaudeFlare distributed AI coding platform. It supports cron-based scheduling, distributed execution, job dependencies, monitoring, and analytics.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     JobScheduler                             │
│  - Job registration and management                          │
│  - Job queuing and execution                                │
│  - Priority handling and concurrency limits                 │
│  - Retry policies and timeout enforcement                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   CronParser                                 │
│  - Parse and validate cron expressions                      │
│  - Calculate next execution times                           │
│  - Generate human-readable descriptions                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                JobMonitor                                   │
│  - Track job execution and status                           │
│  - Collect metrics and logs                                 │
│  - Generate notifications                                   │
│  - Maintain execution history                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│            DistributedCoordinator                           │
│  - Leader election across nodes                             │
│  - Job distribution and load balancing                      │
│  - Distributed locking                                      │
│  - Cluster state synchronization                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              DependencyManager                              │
│  - Build dependency graphs                                  │
│  - Topological sorting                                      │
│  - Detect circular dependencies                             │
│  - Cascade failure handling                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               ExecutionEngine                               │
│  - Isolated job execution                                   │
│  - Resource management                                      │
│  - Timeout enforcement                                      │
│  - Execution profiling                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│             SchedulingAnalytics                             │
│  - Performance metrics                                      │
│  - Capacity planning                                        │
│  - Optimization suggestions                                 │
│  - Trend analysis                                           │
└─────────────────────────────────────────────────────────────┘
```

## Module Details

### 1. Cron Parser (`src/cron/parser.ts`)

**Responsibilities:**
- Parse standard 5-part and extended 6-part cron expressions
- Validate cron expressions
- Calculate next execution times
- Generate human-readable descriptions

**Key Features:**
- Supports wildcards, lists, ranges, and steps
- Time zone aware
- Handles edge cases (leap years, month boundaries)
- Efficient next-execution calculation

**Time Complexity:**
- Parse: O(n) where n is expression length
- Next execution: O(1) average case, O(n) worst case for month/year boundaries

### 2. Job Scheduler (`src/jobs/scheduler.ts`)

**Responsibilities:**
- Register and manage job definitions
- Queue jobs for execution
- Execute jobs with concurrency control
- Handle retries and failures
- Enforce timeouts

**Key Features:**
- Priority-based queuing
- Configurable concurrency limits
- Exponential backoff for retries
- Job cancellation support
- Execution callbacks

**Queue Strategy:**
- FIFO/LIFO/Priority/Weighted queue strategies
- O(log n) insertion and removal using priority queue
- Efficient job lookup using hash map

### 3. Job Monitor (`src/monitoring/monitor.ts`)

**Responsibilities:**
- Track job execution status
- Collect execution metrics
- Maintain execution history
- Generate notifications

**Key Features:**
- Real-time status updates
- Configurable retention periods
- Event callbacks
- Comprehensive logging

**Data Management:**
- In-memory storage for active jobs
- Circular buffer for history (configurable size)
- Automatic cleanup of old data

### 4. Distributed Coordinator (`src/distributed/coordinator.ts`)

**Responsibilities:**
- Leader election
- Job distribution across nodes
- Load balancing
- State synchronization
- Distributed locking

**Key Features:**
- Raft-inspired leader election
- Automatic failover handling
- Health checks and node failure detection
- Lock-based coordination

**Cluster Management:**
- Heartbeat-based health monitoring
- Automatic job redistribution on failure
- Configurable election timeouts

### 5. Dependency Manager (`src/dependencies/manager.ts`)

**Responsibilities:**
- Build dependency graphs
- Topological sorting
- Detect circular dependencies
- Resolve execution order
- Handle cascade failures

**Key Features:**
- Hard and soft dependencies
- Conditional dependencies
- Circular dependency detection
- Depth calculation

**Algorithm:**
- DFS-based topological sort: O(V + E)
- Cycle detection: O(V + E)
- Dependency resolution: O(V + E)

### 6. Execution Engine (`src/execution/executor.ts`)

**Responsibilities:**
- Execute jobs in isolation
- Manage resources
- Enforce timeouts
- Profile executions

**Key Features:**
- Resource pool management
- CPU and memory tracking
- Abort signal support
- Execution profiling

**Resource Management:**
- Pre-execution resource allocation
- Post-execution cleanup
- Configurable resource limits

### 7. Scheduling Analytics (`src/analytics/analytics.ts`)

**Responsibilities:**
- Collect performance metrics
- Calculate statistics
- Generate reports
- Provide optimization suggestions

**Key Features:**
- Time series data collection
- Percentile calculations
- Capacity planning
- Trend analysis

**Metrics:**
- Execution time percentiles (p50, p90, p95, p99)
- Success/failure rates
- Throughput measurements
- Resource utilization

## Data Flow

### Job Execution Flow

```
1. Job Definition Registration
   └─> Validate cron expression
   └─> Store in registry
   └─> Set up scheduling (if cron-based)

2. Job Enqueue
   └─> Check queue size limit
   └─> Add to queue based on priority
   └─> Check dependencies
   └─> Check concurrency limits

3. Job Execution
   └─> Allocate resources
   └─> Create execution context
   └─> Set up timeout
   └─> Execute handler
   └─> Collect result

4. Post-Execution
   └─> Update job status
   └─> Record metrics
   └─> Release resources
   └─> Trigger callbacks
   └─> Process dependent jobs

5. Monitoring & Analytics
   └─> Update metrics
   └─> Generate notifications
   └─> Analyze performance
   └─> Provide insights
```

## Performance Characteristics

### Scalability

- **Job Capacity**: 100K+ scheduled jobs
- **Throughput**: 10K+ jobs/minute (depends on job complexity)
- **Latency**: <1s scheduling accuracy
- **Memory**: O(n) where n is number of active jobs

### Time Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Job enqueue | O(log n) | Priority queue insertion |
| Job execution | O(1) | Handler execution |
| Dependency resolution | O(V + E) | Graph traversal |
| Cron parsing | O(n) | n = expression length |
| Next execution calc | O(1) | Average case |

### Space Complexity

| Component | Complexity | Notes |
|-----------|-----------|-------|
| Job storage | O(n) | n = number of jobs |
| Queue | O(n) | n = queue size |
| Dependency graph | O(V + E) | Vertices + edges |
| History | O(n) | Configurable limit |

## Thread Safety

- **Single-threaded**: Uses async/await for concurrency
- **No shared mutable state**: Each job has isolated context
- **Atomic operations**: State updates are atomic within event loop

## Error Handling

### Job Failures

1. **Immediate failures**: No retry, mark as failed
2. **Retryable failures**: Exponential backoff
3. **Timeout failures**: Abort job, mark as timeout
4. **Dependency failures**: Cascade to dependent jobs

### System Failures

1. **Leader failure**: Automatic re-election
2. **Node failure**: Job redistribution
3. **Network partition**: Quorum-based decisions

## Configuration

### Recommended Settings

```typescript
{
  maxConcurrentJobs: 100,        // Based on CPU cores
  queueSizeLimit: 10000,         // Based on memory
  defaultTimeout: 300000,        // 5 minutes
  heartbeatInterval: 5000,       // 5 seconds
  leaderElectionTimeout: 30000,  // 30 seconds
  stateSyncInterval: 10000,      // 10 seconds
  retentionDays: 7               // 1 week
}
```

### Tuning Guidelines

- **High throughput**: Increase maxConcurrentJobs
- **Low latency**: Reduce queue size limit
- **High reliability**: Increase retry attempts and timeouts
- **Large clusters**: Adjust heartbeat intervals

## Monitoring

### Key Metrics

- Job throughput (jobs/minute)
- Average execution time
- Success rate (%)
- Queue depth
- Resource utilization
- Scheduling accuracy (%)

### Alerts

- High failure rate (>5%)
- Low success rate (<95%)
- Long queue depth (>80% capacity)
- High resource utilization (>90%)
- Scheduling delays (>1s)

## Future Enhancements

1. **Persistent storage**: Durable Object integration
2. **Web UI**: Dashboard for monitoring
3. **Job chaining**: Workflow support
4. **Dynamic scaling**: Auto-scaling based on load
5. **Advanced scheduling**: Calendar-based scheduling
6. **Job versioning**: A/B testing support
7. **Multi-region**: Geographic distribution
8. **Job templates**: Reusable job definitions

## Contributing

When contributing to the scheduler package:

1. Maintain type safety (strict TypeScript)
2. Add comprehensive tests (>80% coverage)
3. Update documentation
4. Follow existing patterns
5. Performance test changes
6. Ensure backward compatibility
