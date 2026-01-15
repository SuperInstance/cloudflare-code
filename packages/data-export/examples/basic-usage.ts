import { DataExportSystem } from '../src/index';

// Create an instance of the data export system
const exportSystem = new DataExportSystem({
  memoryLimit: 1024 * 1024 * 100, // 100MB memory limit
  maxConcurrent: 5
});

// Sample data
const userData = [
  { id: 1, name: 'John Doe', email: 'john@example.com', age: 30, department: 'Engineering', salary: 75000 },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25, department: 'Marketing', salary: 65000 },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35, department: 'Engineering', salary: 85000 },
  { id: 4, name: 'Alice Brown', email: 'alice@example.com', age: 28, department: 'Sales', salary: 55000 },
  { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', age: 32, department: 'Marketing', salary: 70000 }
];

async function basicExportExample() {
  console.log('=== Basic Export Example ===');

  try {
    // Export to CSV
    const csvResult = await exportSystem.export(userData, 'csv', {
      includeHeaders: true,
      delimiter: ','
    });
    console.log('CSV Export:', csvResult);
    console.log(`- Format: ${csvResult.format}`);
    console.log(`- Records: ${csvResult.recordCount}`);
    console.log(`- Size: ${(csvResult.size / 1024).toFixed(2)} KB`);
    console.log(`- Path: ${csvResult.path}`);

    // Export to JSON with pretty printing
    const jsonResult = await exportSystem.export(userData, 'json', {
      prettyPrint: true
    });
    console.log('\nJSON Export:', jsonResult);
    console.log(`- Format: ${jsonResult.format}`);
    console.log(`- Records: ${jsonResult.recordCount}`);
    console.log(`- Size: ${(jsonResult.size / 1024).toFixed(2)} KB`);

    // Export to Excel
    const excelResult = await exportSystem.export(userData, 'excel', {
      sheets: ['Employees', 'Details'],
      sheetName: 'Employee Data'
    });
    console.log('\nExcel Export:', excelResult);

  } catch (error) {
    console.error('Export failed:', error);
  }
}

async function batchExportExample() {
  console.log('\n=== Batch Export Example ===');

  try {
    // Create larger dataset
    const largeData = Array(1000).fill(null).map((_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      age: Math.floor(Math.random() * 50) + 20,
      department: ['Engineering', 'Marketing', 'Sales', 'HR'][Math.floor(Math.random() * 4)],
      salary: Math.floor(Math.random() * 100000) + 30000
    }));

    // Batch export with chunking
    const batchResult = await exportSystem.batchExport(largeData, 'csv', {
      chunkSize: 200,
      memoryLimit: 1024 * 1024 * 50,
      retryAttempts: 2,
      retryDelay: 1000
    });

    console.log('Batch Export Results:');
    console.log(`- Total Records: ${batchResult.totalRecords}`);
    console.log(`- Processed Records: ${batchResult.processedRecords}`);
    console.log(`- Chunks: ${batchResult.chunks}`);
    console.log(`- Duration: ${batchResult.duration}ms`);
    console.log(`- Errors: ${batchResult.errors.length}`);

    // Process results
    if (batchResult.results.length > 0) {
      const totalSize = batchResult.results.reduce((sum, result) => sum + result.size, 0);
      console.log(`- Total Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    }

  } catch (error) {
    console.error('Batch export failed:', error);
  }
}

async function dataProcessingExample() {
  console.log('\n=== Data Processing Example ===');

  try {
    // Process data with filtering, transformation, and aggregation
    const processedData = await exportSystem.process(userData, {
      // Filter data
      filters: [
        { field: 'department', operator: 'eq', value: 'Engineering' },
        { field: 'salary', operator: 'gt', value: 70000 }
      ],
      // Transform data
      transformations: [
        { field: 'name', type: 'format', options: { format: 'uppercase' } },
        {
          field: 'salary',
          type: 'calculate',
          options: { expression: '{value} * 1.1' } // 10% raise
        }
      ],
      // Select specific columns
      columns: ['id', 'name', 'department', 'salary'],
      // Aggregate data
      aggregation: {
        type: 'avg',
        field: 'salary'
      }
    });

    console.log('Processed Data:');
    console.log(`- Records: ${processedData.length}`);
    console.log('- Sample record:');
    console.log(JSON.stringify(processedData[0], null, 2));

    // Export processed data
    const result = await exportSystem.export(processedData, 'json', {
      prettyPrint: true
    });
    console.log(`\nExported to: ${result.path}`);

  } catch (error) {
    console.error('Data processing failed:', error);
  }
}

async function scheduledExportExample() {
  console.log('\n=== Scheduled Export Example ===');

  try {
    // Create a daily scheduled export
    const scheduleId = exportSystem.schedule(
      'Daily User Report',
      {
        frequency: 'daily',
        time: '09:00'
      },
      userData
    );

    console.log(`Scheduled export created with ID: ${scheduleId}`);

    // Start the scheduler
    exportSystem.startScheduler();
    console.log('Scheduler started');

    // Get scheduler stats
    const stats = exportSystem.getStats();
    console.log('Scheduler stats:', stats.schedulerStats);

    // Pause a schedule
    exportSystem.pause(scheduleId);
    console.log('Schedule paused');

    // Resume a schedule
    exportSystem.resume(scheduleId);
    console.log('Schedule resumed');

    // List all schedules
    const schedules = exportSystem['scheduler'].listSchedules();
    console.log(`Total schedules: ${schedules.length}`);

  } catch (error) {
    console.error('Scheduled export failed:', error);
  }
}

async function validationExample() {
  console.log('\n=== Data Validation Example ===');

  try {
    // Define a schema for validation
    const userSchema = {
      id: { type: 'number', required: true, min: 1 },
      name: { type: 'string', required: true, minLength: 2 },
      email: { type: 'string', required: true, format: 'email' },
      age: { type: 'number', required: false, min: 18, max: 100 },
      department: { type: 'string', required: true }
    };

    // Valid data
    const validData = await exportSystem.process(userData, { schema: userSchema });
    console.log(`Valid data records: ${validData.length}`);

    // Invalid data
    const invalidData = [
      ...userData,
      { id: 'invalid', name: '', email: 'invalid-email' }, // Invalid types and required fields
      { id: 6, name: 'Valid', email: 'valid@example.com', age: 150 } // Age too high
    ];

    const processedInvalidData = await exportSystem.process(invalidData, { schema: userSchema });
    console.log(`Invalid data records filtered to: ${processedInvalidData.length}`);

  } catch (error) {
    console.error('Validation failed:', error);
  }
}

async function performanceExample() {
  console.log('\n=== Performance Example ===');

  try {
    // Generate large dataset
    const largeDataset = Array(50000).fill(null).map((_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      age: Math.floor(Math.random() * 60) + 18,
      department: ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'][Math.floor(Math.random() * 5)],
      salary: Math.floor(Math.random() * 120000) + 30000,
      joinDate: new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)).toISOString().split('T')[0]
    }));

    console.log(`Generated ${largeDataset.length} records`);

    // Measure processing time
    const startTime = Date.now();

    // Process data
    const processedData = await exportSystem.process(largeDataset, {
      filters: [
        { field: 'department', operator: 'in', value: ['Engineering', 'Marketing'] },
        { field: 'salary', operator: 'gte', value: 60000 }
      ],
      columns: ['id', 'name', 'department', 'salary']
    });

    const processingTime = Date.now() - startTime;
    console.log(`Processing completed in ${processingTime}ms`);
    console.log(`Filtered to ${processedData.length} records`);

    // Measure export time
    const exportStartTime = Date.now();
    const exportResult = await exportSystem.batchExport(processedData, 'csv', {
      chunkSize: 5000,
      memoryLimit: 1024 * 1024 * 100
    });
    const exportTime = Date.now() - exportStartTime;

    console.log(`Export completed in ${exportTime}ms`);
    console.log(`Exported ${exportResult.processedRecords} records in ${exportResult.chunks} chunks`);

    // Calculate processing speed
    const processingSpeed = (processedData.length / (processingTime / 1000)).toFixed(2);
    const exportSpeed = (exportResult.processedRecords / (exportTime / 1000)).toFixed(2);

    console.log(`Processing speed: ${processingSpeed} records/sec`);
    console.log(`Export speed: ${exportSpeed} records/sec`);

  } catch (error) {
    console.error('Performance test failed:', error);
  }
}

async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');

  try {
    // Test with invalid format
    await exportSystem.export(userData, 'invalid-format' as any);
  } catch (error) {
    console.log('Caught expected error for invalid format:', error.message);
  }

  try {
    // Test with empty data
    await exportSystem.export([], 'csv');
  } catch (error) {
    console.log('Error with empty data:', error.message);
  }

  try {
    // Test with invalid processing options
    await exportSystem.process(null as any, {});
  } catch (error) {
    console.log('Error with invalid processing:', error.message);
  }

  try {
    // Test with invalid schedule
    exportSystem.schedule(
      'Invalid Schedule',
      {} as any,
      userData
    );
  } catch (error) {
    console.log('Caught expected error for invalid schedule:', error.message);
  }
}

async function main() {
  console.log('Data Export System Examples\n');

  await basicExportExample();
  await batchExportExample();
  await dataProcessingExample();
  await scheduledExportExample();
  await validationExample();
  await performanceExample();
  await errorHandlingExample();

  console.log('\n=== Cleanup ===');
  await exportSystem.shutdown();
  console.log('Export system shutdown completed');
}

// Run the examples
main().catch(console.error);