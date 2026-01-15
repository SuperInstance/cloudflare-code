import { createDataImportSystem } from '../src';

async function scheduledImportExample() {
  const system = createDataImportSystem({
    processorOptions: {
      batchSize: 500,
      enableLogging: true,
    },
    schedulingOptions: {
      enableLogging: true,
    },
    enableAnalytics: true,
  });

  // Listen for scheduled job events
  system.scheduler.on('scheduledJobCreated', (job) => {
    console.log(`✅ Scheduled job created: ${job.id} - ${job.metadata.description || 'No description'}`);
    console.log(`   Next run: ${job.nextRun?.toLocaleString()}`);
  });

  system.scheduler.on('scheduledJobStarted', (data) => {
    console.log(`🚀 Scheduled job started: ${data.jobId} (Run #${data.runCount})`);
  });

  system.scheduler.on('scheduledJobCompleted', (job) => {
    console.log(`✅ Scheduled job completed: ${job.jobId}`);
    if (job.maxRunsReached) {
      console.log(`   Maximum runs (${job.maxRuns}) reached - removing job`);
    }
  });

  system.scheduler.on('scheduledJobFailed', (data) => {
    console.log(`❌ Scheduled job failed: ${data.jobId}`);
    console.log(`   Error: ${data.error.message}`);
  });

  // Create test files
  const fs = await import('fs/promises');
  const path = await import('path');
  const testDir = path.join(__dirname, '../test-scheduled-data');
  await fs.mkdir(testDir, { recursive: true });

  // Create sample data generator
  const generateSampleData = (count: number) => {
    const lines = ['id,name,email,department,salary'];
    for (let i = 1; i <= count; i++) {
      const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
      const names = ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Williams', 'Charlie Brown'];
      const name = names[Math.floor(Math.random() * names.length)];
      const department = departments[Math.floor(Math.random() * departments.length)];
      const salary = Math.floor(Math.random() * 100000) + 50000;
      lines.push(`${i},${name.toLowerCase().replace(' ', '.')}@company.com,${department},${salary}`);
    }
    return lines.join('\n');
  };

  // Generate sample files
  await fs.writeFile(path.join(testDir, 'employees-1.csv'), generateSampleData(1000));
  await fs.writeFile(path.join(testDir, 'employees-2.csv'), generateSampleData(1500));
  await fs.writeFile(path.join(testDir, 'employees-3.csv'), generateSampleData(2000));

  console.log('📁 Created sample employee data files');

  // Schedule different types of imports

  // 1. Daily import at 2 AM
  const dailyJob = await system.importFile(path.join(testDir, 'employees-1.csv'), 'csv');
  const dailyScheduleId = system.scheduleImport(
    path.join(testDir, 'employees-1.csv'),
    '0 2 * * *',
    'csv',
    {
      description: 'Daily employee data import at 2 AM',
      tags: ['daily', 'employees'],
      maxRuns: 30,
    }
  );
  console.log(`📅 Daily import scheduled: ${dailyScheduleId}`);

  // 2. Weekly import every Monday at 9 AM
  const weeklyScheduleId = system.scheduleImport(
    path.join(testDir, 'employees-2.csv'),
    '0 9 * * 1',
    'csv',
    {
      description: 'Weekly summary import every Monday',
      tags: ['weekly', 'summary'],
    }
  );
  console.log(`📅 Weekly import scheduled: ${weeklyScheduleId}`);

  // 3. Hourly import for testing
  const hourlyScheduleId = system.scheduleImport(
    path.join(testDir, 'employees-3.csv'),
    '0 * * * *',
    'csv',
    {
      description: 'Hourly test import',
      tags: ['hourly', 'test'],
      maxRuns: 5,
    }
  );
  console.log(`📅 Hourly import scheduled: ${hourlyScheduleId}`);

  // Display scheduled jobs
  console.log('\n📋 Scheduled Jobs:');
  const scheduledJobs = system.scheduler.getScheduledJobs();
  scheduledJobs.forEach(job => {
    console.log(`   - ${job.id}: ${job.cronExpression}`);
    console.log(`     Enabled: ${job.enabled} | Next run: ${job.nextRun?.toLocaleString()}`);
    console.log(`     Runs: ${job.runCount}/${job.maxRuns || '∞'}`);
    console.log(`     Description: ${job.metadata.description || 'None'}`);
  });

  // Wait for some scheduled jobs to run
  console.log('\n⏳ Waiting for scheduled jobs to run...');
  await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes

  // Display scheduler statistics
  const schedulerStats = system.scheduler.getSchedulerStats();
  console.log('\n📊 Scheduler Statistics:');
  console.log(`   Total scheduled jobs: ${schedulerStats.totalScheduledJobs}`);
  console.log(`   Enabled jobs: ${schedulerStats.enabledScheduledJobs}`);
  console.log(`   Disabled jobs: ${schedulerStats.disabledScheduledJobs}`);
  console.log(`   Running jobs: ${schedulerStats.runningScheduledJobs}`);
  console.log(`   Total runs: ${schedulerStats.totalRuns}`);
  console.log(`   Failed runs: ${schedulerStats.failedRuns}`);

  // Display next upcoming runs
  if (schedulerStats.nextRunScheduledJobs.length > 0) {
    console.log('\n⏰ Next scheduled runs:');
    schedulerStats.nextRunScheduledJobs.slice(0, 3).forEach(job => {
      console.log(`   - ${job.id}: ${job.nextRun?.toLocaleString()}`);
    });
  }

  // Demonstrate job management
  console.log('\n🔧 Managing scheduled jobs:');

  // Enable/disable a job
  console.log(`Disabling daily schedule...`);
  const disabled = system.scheduler.disableScheduledJob(dailyScheduleId);
  console.log(`Disabled: ${disabled}`);

  // Update cron expression
  console.log(`Updating hourly schedule to run every 30 minutes...`);
  const updated = system.scheduler.updateCronExpression(hourlyScheduleId, '*/30 * * * *');
  console.log(`Updated: ${updated}`);

  // Re-enable the job
  console.log(`Re-enabling daily schedule...`);
  const reenabled = system.scheduler.enableScheduledJob(dailyScheduleId);
  console.log(`Re-enabled: ${reenabled}`);

  // Clean up test files
  await fs.rm(testDir, { recursive: true, force: true });
  console.log('\n🧹 Cleaned up test files');

  system.cleanup();
}

scheduledImportExample().catch(console.error);