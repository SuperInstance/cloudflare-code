import { DataExportSystem } from '../src/index';

// Create export system
const exportSystem = new DataExportSystem({
  memoryLimit: 1024 * 1024 * 100, // 100MB
  maxConcurrent: 3
});

// Mock data source for demonstration
function generateDailySalesData(): any[] {
  const products = ['Widget A', 'Widget B', 'Widget C', 'Gadget X', 'Gadget Y'];
  const regions = ['North', 'South', 'East', 'West'];
  const data = [];

  for (let i = 0; i < 100; i++) {
    data.push({
      id: Date.now() + i,
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      product: products[Math.floor(Math.random() * products.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      quantity: Math.floor(Math.random() * 100) + 1,
      unitPrice: Math.random() * 100 + 10,
      totalRevenue: 0, // Will be calculated
      salesRep: `Rep-${Math.floor(Math.random() * 10) + 1}`
    });
  }

  // Calculate total revenue
  return data.map(item => ({
    ...item,
    totalRevenue: item.quantity * item.unitPrice
  }));
}

// Async data source for demonstration
async function fetchUserData(): Promise<any[]> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  return [
    {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@company.com',
      department: 'Engineering',
      salary: 95000,
      joinDate: '2020-01-15',
      lastLogin: new Date().toISOString()
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane.smith@company.com',
      department: 'Marketing',
      salary: 75000,
      joinDate: '2021-03-20',
      lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 3,
      name: 'Bob Johnson',
      email: 'bob.johnson@company.com',
      department: 'Sales',
      salary: 85000,
      joinDate: '2019-11-10',
      lastLogin: new Date().toISOString()
    }
  ];
}

async function setupScheduledExports() {
  console.log('Setting up scheduled exports...\n');

  // 1. Daily Sales Report - runs every day at 6:00 AM
  const salesScheduleId = exportSystem.schedule(
    'Daily Sales Report',
    {
      frequency: 'daily',
      time: '06:00'
    },
    generateDailySalesData
  );

  console.log(`✓ Daily Sales Report scheduled: ${salesScheduleId}`);

  // 2. Weekly User Report - runs every Monday at 9:00 AM
  const userScheduleId = exportSystem.schedule(
    'Weekly User Report',
    {
      frequency: 'weekly',
      dayOfWeek: 1, // Monday
      time: '09:00'
    },
    fetchUserData
  );

  console.log(`✓ Weekly User Report scheduled: ${userScheduleId}`);

  // 3. Monthly Performance Report - runs on 1st of month at 10:00 AM
  const performanceScheduleId = exportSystem.schedule(
    'Monthly Performance Report',
    {
      frequency: 'monthly',
      dayOfMonth: 1,
      time: '10:00'
    },
    () => {
      // Generate performance data
      return Array(50).fill(null).map((_, i) => ({
        employeeId: `EMP-${1000 + i}`,
        name: `Employee ${i + 1}`,
        performance: Math.random() * 100,
        reviews: Math.floor(Math.random() * 10) + 1,
        department: ['Engineering', 'Marketing', 'Sales', 'HR'][Math.floor(Math.random() * 4)]
      }));
    }
  );

  console.log(`✓ Monthly Performance Report scheduled: ${performanceScheduleId}`);

  // 4. Hourly System Metrics - runs every hour
  const metricsScheduleId = exportSystem.schedule(
    'Hourly System Metrics',
    {
      frequency: 'hourly'
    },
    () => {
      // Generate system metrics
      return {
        timestamp: new Date().toISOString(),
        memoryUsage: Math.random() * 100,
        cpuUsage: Math.random() * 100,
        activeConnections: Math.floor(Math.random() * 1000),
        errorRate: Math.random() * 0.1,
        throughput: Math.floor(Math.random() * 10000)
      };
    }
  );

  console.log(`✓ Hourly System Metrics scheduled: ${metricsScheduleId}`);

  // 5. One-time Data Backup - runs once
  const backupScheduleId = exportSystem.schedule(
    'Data Backup',
    {
      frequency: 'once'
    },
    generateDailySalesData
  );

  console.log(`✓ One-time Data Backup scheduled: ${backupScheduleId}`);

  return [
    salesScheduleId,
    userScheduleId,
    performanceScheduleId,
    metricsScheduleId,
    backupScheduleId
  ];
}

async function manageSchedules() {
  console.log('\n=== Schedule Management ===');

  const schedules = exportSystem['scheduler'].listSchedules();
  console.log(`Total scheduled exports: ${schedules.length}`);

  schedules.forEach((schedule, index) => {
    console.log(`${index + 1}. ${schedule.name}`);
    console.log(`   ID: ${schedule.id}`);
    console.log(`   Status: ${schedule.status}`);
    console.log(`   Frequency: ${schedule.config.frequency}`);
    console.log(`   Next Run: ${schedule.nextRun?.toLocaleString() || 'N/A'}`);
    console.log(`   Last Run: ${schedule.lastRun?.toLocaleString() || 'N/A'}`);
    console.log(`   History: ${schedule.history.length} exports`);
    console.log('');
  });

  // Pause a schedule
  const allSchedules = exportSystem['scheduler'].listSchedules();
  if (allSchedules.length > 0) {
    const firstSchedule = allSchedules[0];
    console.log(`Pausing schedule: ${firstSchedule.name}`);
    exportSystem.pause(firstSchedule.id);
  }

  // Resume a schedule
  setTimeout(() => {
    if (allSchedules.length > 0) {
      console.log(`Resuming schedule: ${firstSchedule.name}`);
      exportSystem.resume(firstSchedule.id);
    }
  }, 5000);
}

async function demonstrateSchedules() {
  console.log('\n=== Demonstrating Scheduled Exports ===');

  // Set up event listeners
  exportSystem.batchExporter.on('job-start', (job) => {
    console.log(`\n🚀 Started: ${job.name} (${job.id})`);
  });

  exportSystem.batchExporter.on('job-complete', (job) => {
    console.log(`✅ Completed: ${job.name} - Duration: ${job.endTime!.getTime() - job.startTime!.getTime()}ms`);
    console.log(`   Records: ${job.result?.recordCount || 0}`);
    console.log(`   Format: ${job.result?.format || 'N/A'}`);
    console.log(`   Size: ${(job.result?.size || 0) / 1024} KB`);
  });

  exportSystem.batchExporter.on('job-error', (job) => {
    console.log(`❌ Failed: ${job.name} - ${job.error}`);
  });

  // Start the scheduler
  exportSystem.startScheduler();
  console.log('Scheduler started...');

  // Let it run for a while
  await new Promise(resolve => setTimeout(resolve, 30000));

  // Stop the scheduler
  exportSystem.stopScheduler();
  console.log('Scheduler stopped');
}

async function scheduleManagementExample() {
  console.log('\n=== Schedule Management Example ===');

  const scheduleIds = await setupScheduledExports();

  // Get scheduler statistics
  const stats = exportSystem.getStats();
  console.log('Scheduler Statistics:');
  console.log(`- Total Schedules: ${stats.schedulerStats.totalSchedules}`);
  console.log(`- Active Schedules: ${stats.schedulerStats.activeSchedules}`);
  console.log(`- Paused Schedules: ${stats.schedulerStats.pausedSchedules}`);
  console.log(`- Running Jobs: ${stats.schedulerStats.runningJobs}`);
  console.log(`- Memory Usage: ${(stats.schedulerStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);

  // Demonstrate schedule operations
  await manageSchedules();

  // Show individual schedule details
  console.log('\n=== Individual Schedule Details ===');
  for (const scheduleId of scheduleIds) {
    const schedule = exportSystem['scheduler'].getSchedule(scheduleId);
    if (schedule) {
      console.log(`\nSchedule: ${schedule.name}`);
      console.log(`ID: ${schedule.id}`);
      console.log(`Status: ${schedule.status}`);
      console.log(`Data Type: ${typeof schedule.data}`);
      console.log(`Config:`, schedule.config);
      console.log(`Next Run: ${schedule.nextRun?.toLocaleString()}`);
    }
  }

  // Start the scheduler for demonstration
  await demonstrateSchedules();
}

async function exportProcessingExample() {
  console.log('\n=== Export Processing Example ===');

  // Process data before exporting
  const processedData = await exportSystem.process(generateDailySalesData(), {
    filters: [
      { field: 'totalRevenue', operator: 'gt', value: 500 }
    ],
    transformations: [
      {
        field: 'profitMargin',
        type: 'calculate',
        options: {
          expression: 'Math.round(({value.totalRevenue} / (value.quantity * value.unitPrice)) * 10000) / 100'
        }
      },
      {
        field: 'salesRep',
        type: 'format',
        options: {
          format: 'uppercase'
        }
      }
    ],
    aggregation: {
      type: 'group',
      field: 'totalRevenue',
      groupBy: ['region', 'product']
    }
  });

  console.log(`Processed data to ${processedData.length} records with aggregation`);

  // Schedule the processed data export
  const processedScheduleId = exportSystem.schedule(
    'Processed Sales Report',
    {
      frequency: 'daily',
      time: '07:00'
    },
    processedData
  );

  console.log(`✓ Processed sales report scheduled: ${processedScheduleId}`);
}

async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');

  // Schedule with error-prone data function
  const errorScheduleId = exportSystem.schedule(
    'Error-Prone Export',
    {
      frequency: 'hourly'
    },
    async () => {
      // Simulate occasional errors
      if (Math.random() < 0.3) {
        throw new Error('Simulated data fetch error');
      }
      return generateDailySalesData();
    }
  );

  console.log(`✓ Error-prone export scheduled: ${errorScheduleId}`);

  // Set up error listener
  exportSystem.batchExporter.on('job-error', (job) => {
    console.log(`\n🚨 Error occurred in job ${job.name}:`);
    console.log(`   Error: ${job.error}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Records processed: ${job.result?.recordCount || 0}`);
  });

  // Let it run for a while to demonstrate error handling
  await new Promise(resolve => setTimeout(resolve, 15000));
}

async function cleanupAndSummary() {
  console.log('\n=== Cleanup and Summary ===');

  // Get final statistics
  const stats = exportSystem.getStats();
  console.log('Final Statistics:');
  console.log(`- Total Schedules: ${stats.schedulerStats.totalSchedules}`);
  console.log(`- Active Schedules: ${stats.schedulerStats.activeSchedules}`);
  console.log(`- Memory Usage: ${(stats.schedulerStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);

  // List all schedules
  const allSchedules = exportSystem['scheduler'].listSchedules();
  console.log(`\nAll Schedules (${allSchedules.length}):`);
  allSchedules.forEach((schedule, index) => {
    console.log(`${index + 1}. ${schedule.name} - ${schedule.status} (${schedule.id})`);
  });

  // Shutdown the system
  await exportSystem.shutdown();
  console.log('\n✓ Export system shutdown completed');
}

async function main() {
  console.log('ClaudeFlare Data Export - Scheduled Exports Demo\n');

  try {
    await scheduleManagementExample();
    await exportProcessingExample();
    await errorHandlingExample();
    await cleanupAndSummary();

  } catch (error) {
    console.error('Demo failed:', error);
    await exportSystem.shutdown();
  }
}

// Run the demo
main().catch(console.error);