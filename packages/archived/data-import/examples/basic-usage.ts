import { createDataImportSystem, ImportJob, ValidationRule, TransformationRule } from '../src';

async function basicUsageExample() {
  const system = createDataImportSystem({
    processorOptions: {
      batchSize: 100,
      maxConcurrentJobs: 3,
      enableRealtimeProgress: true,
    },
  });

  // Listen for progress updates
  system.processor.on('jobProgress', ({ jobId, progress }) => {
    console.log(`Job ${jobId}: ${progress.percentage}% complete`);
    console.log(`  Processed: ${progress.processed}/${progress.total}`);
    console.log(`  Success: ${progress.successful} | Failed: ${progress.failed}`);
  });

  // Create a simple CSV content
  const csvContent = `id,name,email,age
1,John Doe,john@example.com,25
2,Jane Smith,jane@example.com,30
3,Bob Johnson,bob@example.com,35
4,Alice Williams,alice@example.com,28`;

  // Write test file
  const fs = await import('fs/promises');
  const path = await import('path');
  const testDir = path.join(__dirname, '../test-data');
  await fs.mkdir(testDir, { recursive: true });
  const filePath = path.join(testDir, 'users.csv');
  await fs.writeFile(filePath, csvContent);

  // Define validation rules
  const validationRules: ValidationRule[] = [
    { field: 'id', type: 'number', required: true },
    { field: 'name', type: 'string', required: true, options: { minLength: 2, maxLength: 50 } },
    { field: 'email', type: 'email', required: true },
    { field: 'age', type: 'number', required: true, options: { min: 18, max: 100 } },
  ];

  // Define transformation rules
  const transformationRules: TransformationRule[] = [
    { target: 'user_id', source: 'id', type: 'mapping' },
    { target: 'full_name', type: 'enrichment', options: { type: 'concat', parts: ['$name'] } },
    { target: 'status', type: 'enrichment', options: { type: 'conditional', condition: '$age >= 30', true: 'senior', false: 'junior' } },
    { target: 'name', type: 'normalization', options: { type: 'trim' } },
    { target: 'email', type: 'normalization', options: { type: 'lowercase' } },
  ];

  // Create import job
  const job: ImportJob = {
    name: 'Users Import',
    source: {
      type: 'file',
      format: 'csv',
      path: filePath,
    },
    config: {
      validationRules,
      transformations: transformationRules,
      conflictResolution: 'skip',
    },
    status: 'pending',
    progress: {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      percentage: 0,
    },
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Start the import
  console.log('Starting import job...');
  const jobId = await system.processor.startJob(job);
  console.log(`Job started with ID: ${jobId}`);

  // Wait for completion
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Check results
  const completedJob = system.processor.getJob(jobId);
  console.log('\nImport completed:');
  console.log(`Status: ${completedJob?.status}`);
  console.log(`Processed: ${completedJob?.progress.processed} records`);
  console.log(`Successful: ${completedJob?.progress.successful} records`);
  console.log(`Failed: ${completedJob?.progress.failed} records`);

  // Display transformed data
  console.log('\nTransformed data:');
  const transformedRecords = completedJob?.metadata?.transformedRecords || [];
  transformedRecords.forEach((record: any, index: number) => {
    console.log(`${index + 1}.`, record.data);
  });

  // Get system analytics
  const analytics = system.analytics.getAnalytics();
  console.log('\nAnalytics:');
  console.log(`Total imports: ${analytics.totalImports}`);
  console.log(`Success rate: ${((analytics.successfulImports / analytics.totalImports) * 100).toFixed(1)}%`);
  console.log(`Average processing time: ${analytics.averageProcessingTime.toFixed(2)}ms`);

  // Clean up
  await fs.rm(testDir, { recursive: true, force: true });
  system.cleanup();
}

basicUsageExample().catch(console.error);