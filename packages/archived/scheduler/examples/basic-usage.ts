/**
 * Basic usage examples for the scheduler
 */

import { JobScheduler, CronParser, JobMonitor } from '../src';

async function basicExample() {
  console.log('=== Basic Scheduler Example ===\n');

  // Create a scheduler
  const scheduler = new JobScheduler({
    maxConcurrentJobs: 10,
    queueSizeLimit: 100
  });

  // Register a simple job
  scheduler.registerJob({
    id: 'greet',
    name: 'Greeting Job',
    handler: async (context) => {
      const name = context.metadata.name || 'World';
      console.log(`Hello, ${name}!`);
      return { message: `Hello, ${name}!` };
    }
  });

  // Enqueue the job
  const jobId = scheduler.enqueueJob('greet', null, { name: 'Claude' });

  // Wait for execution
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Check job status
  const job = scheduler.getJob(jobId);
  console.log(`Job status: ${job?.status}`);
  console.log(`Job result:`, job?.result);

  await scheduler.shutdown();
}

async function cronExample() {
  console.log('\n=== Cron Scheduling Example ===\n');

  // Validate cron expression
  const validation = CronParser.validate('0 9 * * *');
  console.log('Cron validation:', validation.valid);

  // Get next execution times
  const nextExecutions = CronParser.nextExecutions('0 9 * * *', 5);
  console.log('Next 5 executions:');
  nextExecutions.forEach((date, i) => {
    console.log(`  ${i + 1}. ${date.toISOString()}`);
  });

  // Get human-readable description
  const description = CronParser.describe('0 9 * * *');
  console.log(`\nDescription: ${description.description}`);
}

async function retryExample() {
  console.log('\n=== Retry Policy Example ===\n');

  const scheduler = new JobScheduler();

  let attempts = 0;

  scheduler.registerJob({
    id: 'flaky-job',
    name: 'Flaky Job',
    handler: async () => {
      attempts++;
      console.log(`Attempt ${attempts}`);
      if (attempts < 3) {
        throw new Error('Not yet!');
      }
      return { success: true, attempts };
    },
    retryPolicy: {
      maxRetries: 5,
      initialDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2
    }
  });

  const jobId = scheduler.enqueueJob('flaky-job');

  // Wait for retries
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const job = scheduler.getJob(jobId);
  console.log(`Final status: ${job?.status}`);
  console.log(`Total attempts: ${job?.attemptNumber}`);

  await scheduler.shutdown();
}

async function monitoredJobExample() {
  console.log('\n=== Monitored Job Example ===\n');

  const scheduler = new JobScheduler();
  const monitor = new JobMonitor({
    retentionDays: 7,
    enableNotifications: true
  });

  scheduler.registerJob({
    id: 'monitored-task',
    name: 'Monitored Task',
    handler: async (context) => {
      context.logger.info('Task started');
      context.logger.info('Task in progress');
      context.logger.info('Task completed');
      return { result: 'done' };
    }
  });

  const jobId = scheduler.enqueueJob('monitored-task');

  // Track job in monitor
  const job = scheduler.getJob(jobId);
  if (job) {
    monitor.trackJob(job);
    monitor.updateJobStatus(jobId, 'running' as any);
  }

  await new Promise((resolve) => setTimeout(resolve, 100));

  if (job) {
    monitor.updateJobStatus(jobId, 'completed' as any);
  }

  // Get metrics
  const metrics = monitor.getSchedulingMetrics();
  console.log('Metrics:', metrics);

  // Get logs
  const logs = monitor.getJobLogs(jobId);
  console.log('Logs:', logs);

  monitor.stop();
  await scheduler.shutdown();
}

async function dependencyExample() {
  console.log('\n=== Job Dependencies Example ===\n');

  const scheduler = new JobScheduler();

  // Register jobs with dependencies
  scheduler.registerJob({
    id: 'fetch-data',
    name: 'Fetch Data',
    handler: async () => {
      console.log('Fetching data...');
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { records: 100 };
    }
  });

  scheduler.registerJob({
    id: 'process-data',
    name: 'Process Data',
    handler: async () => {
      console.log('Processing data...');
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { processed: 100 };
    },
    dependencies: ['fetch-data']
  });

  scheduler.registerJob({
    id: 'save-results',
    name: 'Save Results',
    handler: async () => {
      console.log('Saving results...');
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { saved: true };
    },
    dependencies: ['process-data']
  });

  // Execute jobs in order
  const job1 = scheduler.enqueueJob('fetch-data');
  await new Promise((resolve) => setTimeout(resolve, 200));

  const job2 = scheduler.enqueueJob('process-data');
  await new Promise((resolve) => setTimeout(resolve, 200));

  const job3 = scheduler.enqueueJob('save-results');
  await new Promise((resolve) => setTimeout(resolve, 200));

  console.log('All jobs completed!');

  await scheduler.shutdown();
}

async function runAllExamples() {
  try {
    await basicExample();
    await cronExample();
    await retryExample();
    await monitoredJobExample();
    await dependencyExample();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples
if (require.main === module) {
  runAllExamples();
}

export {
  basicExample,
  cronExample,
  retryExample,
  monitoredJobExample,
  dependencyExample
};
