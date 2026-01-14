/**
 * Advanced usage examples for the scheduler
 */

import {
  JobScheduler,
  JobMonitor,
  DistributedCoordinator,
  DependencyManager,
  SchedulingAnalytics,
  ExecutionEngine,
  CronParser,
  JobPriority,
  JobStatus
} from '../src';

async function distributedSchedulingExample() {
  console.log('=== Distributed Scheduling Example ===\n');

  // Create multiple coordinators (simulating multiple nodes)
  const node1 = new DistributedCoordinator({
    nodeId: 'node-1',
    heartbeatInterval: 5000,
    leaderElectionTimeout: 15000
  });

  const node2 = new DistributedCoordinator({
    nodeId: 'node-2',
    heartbeatInterval: 5000,
    leaderElectionTimeout: 15000
  });

  // Start nodes
  await node1.start();
  await node2.start();

  console.log('Node 1 is leader:', node1.isNodeLeader());
  console.log('Node 2 is leader:', node2.isNodeLeader());

  // Assign jobs
  await node1.assignJob('job-1', 'node-1');
  await node1.assignJob('job-2', 'node-2');

  // Get cluster state
  const clusterState = node1.getClusterState();
  console.log('Cluster nodes:', clusterState.nodes.size);

  // Stop nodes
  await node1.stop();
  await node2.stop();
}

async function analyticsExample() {
  console.log('\n=== Analytics Example ===\n');

  const scheduler = new JobScheduler();
  const monitor = new JobMonitor();
  const analytics = new SchedulingAnalytics(monitor, {
    retentionDays: 30,
    aggregationInterval: 60000
  });

  // Register and execute jobs
  scheduler.registerJob({
    id: 'analytics-job',
    name: 'Analytics Job',
    handler: async () => {
      // Simulate variable execution time
      const duration = Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, duration));
      return { executionTime: duration };
    }
  });

  // Execute multiple jobs
  for (let i = 0; i < 10; i++) {
    const jobId = scheduler.enqueueJob('analytics-job');
    await new Promise((resolve) => setTimeout(resolve, 100));

    const job = scheduler.getJob(jobId);
    if (job) {
      monitor.trackJob(job);
      monitor.updateJobStatus(jobId, JobStatus.COMPLETED);
      analytics.recordExecution(job, job.result!);
    }
  }

  // Get analytics
  const metrics = analytics.getSchedulingMetrics();
  console.log('Scheduling metrics:', metrics);

  const perfMetrics = analytics.getPerformanceMetrics();
  console.log('Performance metrics:', perfMetrics);

  const capacity = analytics.getCapacityPlanning();
  console.log('Capacity planning:', capacity.recommendations);

  const suggestions = analytics.getOptimizationSuggestions();
  console.log('Optimization suggestions:');
  suggestions.forEach((s) => {
    console.log(`  [${s.priority}] ${s.title}`);
  });

  analytics.stop();
  await scheduler.shutdown();
}

async function executionEngineExample() {
  console.log('\n=== Execution Engine Example ===\n');

  const engine = new ExecutionEngine({
    maxConcurrentExecutions: 5,
    defaultTimeout: 5000,
    enableProfiling: true
  });

  const job = {
    id: 'engine-test',
    definitionId: 'test',
    name: 'Engine Test Job',
    status: JobStatus.PENDING as JobStatus,
    priority: JobPriority.NORMAL,
    scheduledTime: new Date(),
    attemptNumber: 1,
    maxAttempts: 3,
    dependencies: [],
    dependentJobs: [],
    metadata: { memoryRequirement: 10, cpuRequirement: 5 },
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const handler = async (context: any) => {
    context.logger.info('Job running in execution engine');
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { result: 'success' };
  };

  // Execute job
  const result = await engine.executeJob(job, handler, { test: 'data' });

  console.log('Execution result:', result.success);
  console.log('Execution time:', result.executionTime);

  // Get execution profile
  const profile = engine.getExecutionProfile(job.id);
  console.log('Profile duration:', profile?.duration);

  // Get statistics
  const stats = engine.getStatistics();
  console.log('Statistics:', stats);

  // Get resource utilization
  const resources = engine.getResourcePoolStatus();
  console.log('Resource utilization:', resources);
}

async function complexDependencyExample() {
  console.log('\n=== Complex Dependencies Example ===\n');

  const dependencyManager = new DependencyManager({
    enableCascade: true,
    maxDepth: 100
  });

  // Create a complex dependency graph
  const jobs = [
    { id: 'a', dependencies: [] },
    { id: 'b', dependencies: ['a'] },
    { id: 'c', dependencies: ['a'] },
    { id: 'd', dependencies: ['b', 'c'] },
    { id: 'e', dependencies: ['d'] }
  ];

  // Add jobs to graph
  for (const jobDef of jobs) {
    const job = {
      id: jobDef.id,
      definitionId: jobDef.id,
      name: `Job ${jobDef.id}`,
      status: JobStatus.PENDING as JobStatus,
      priority: JobPriority.NORMAL,
      scheduledTime: new Date(),
      attemptNumber: 1,
      maxAttempts: 3,
      dependencies: jobDef.dependencies,
      dependentJobs: [],
      metadata: {},
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    dependencyManager.addJob(job);

    for (const dep of jobDef.dependencies) {
      dependencyManager.addDependency(job.id, dep, 'hard');
    }
  }

  // Validate graph
  const validation = dependencyManager.validateGraph();
  console.log('Graph valid:', validation.valid);

  // Get execution order
  const order = dependencyManager.getExecutionOrder();
  console.log('Execution order:', order);

  // Check for circular dependencies
  const cycles = dependencyManager.detectCircularDependencies();
  console.log('Circular dependencies:', cycles.length);

  // Resolve dependencies
  const resolution = dependencyManager.resolveDependencies();
  console.log('Ready jobs:', resolution.readyJobs);
  console.log('Blocked jobs:', resolution.blockedJobs.size);
}

async function prioritySchedulingExample() {
  console.log('\n=== Priority Scheduling Example ===\n');

  const scheduler = new JobScheduler({
    maxConcurrentJobs: 2
  });

  const executionOrder: string[] = [];

  scheduler.registerJob({
    id: 'priority-test',
    name: 'Priority Test Job',
    handler: async (context) => {
      executionOrder.push(context.job.id);
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { success: true };
    }
  });

  // Enqueue jobs with different priorities
  const job1 = scheduler.enqueueJob('priority-test', null, { priority: JobPriority.LOW });
  const job2 = scheduler.enqueueJob('priority-test', null, { priority: JobPriority.HIGH });
  const job3 = scheduler.enqueueJob('priority-test', null, { priority: JobPriority.NORMAL });
  const job4 = scheduler.enqueueJob('priority-test', null, { priority: JobPriority.CRITICAL });

  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log('Execution order:', executionOrder);
  console.log('Stats:', scheduler.getStats());

  await scheduler.shutdown();
}

async function timeoutAndCancellationExample() {
  console.log('\n=== Timeout and Cancellation Example ===\n');

  const scheduler = new JobScheduler();

  scheduler.registerJob({
    id: 'timeout-job',
    name: 'Timeout Job',
    handler: async () => {
      console.log('Job started, will run for 10 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return { success: true };
    },
    timeout: {
      duration: 500,
      strategy: 'kill'
    }
  });

  const jobId = scheduler.enqueueJob('timeout-job');

  await new Promise((resolve) => setTimeout(resolve, 700));

  const job = scheduler.getJob(jobId);
  console.log('Job status after timeout:', job?.status);

  await scheduler.shutdown();
}

async function monitoringExample() {
  console.log('\n=== Advanced Monitoring Example ===\n');

  const scheduler = new JobScheduler();
  const monitor = new JobMonitor({
    retentionDays: 7,
    maxHistorySize: 1000,
    enableNotifications: true
  });

  scheduler.registerJob({
    id: 'monitored-job',
    name: 'Monitored Job',
    handler: async (context) => {
      context.logger.info('Starting work');
      await new Promise((resolve) => setTimeout(resolve, 100));
      context.logger.info('Work completed');
      return { result: 'done' };
    }
  });

  const jobId = scheduler.enqueueJob('monitored-job');

  // Track with callbacks
  const job = scheduler.getJob(jobId);
  if (job) {
    monitor.trackJob(job);

    monitor.onStatusChange(jobId, (status) => {
      console.log(`Status changed to: ${status}`);
    });

    monitor.onComplete(jobId, (result) => {
      console.log('Job completed:', result);
    });
  }

  await new Promise((resolve) => setTimeout(resolve, 200));

  // Get detailed metrics
  const metrics = monitor.getSchedulingMetrics();
  console.log('Detailed metrics:', metrics);

  // Get notifications
  const notifications = monitor.getNotifications(10);
  console.log('Notifications:', notifications.length);

  monitor.stop();
  await scheduler.shutdown();
}

async function runAllExamples() {
  try {
    await distributedSchedulingExample();
    await analyticsExample();
    await executionEngineExample();
    await complexDependencyExample();
    await prioritySchedulingExample();
    await timeoutAndCancellationExample();
    await monitoringExample();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples
if (require.main === module) {
  runAllExamples();
}

export {
  distributedSchedulingExample,
  analyticsExample,
  executionEngineExample,
  complexDependencyExample,
  prioritySchedulingExample,
  timeoutAndCancellationExample,
  monitoringExample
};
