import { createDataImportSystem } from '../src';

async function bulkOperationsExample() {
  const system = createDataImportSystem({
    processorOptions: {
      batchSize: 200,
      enableRealtimeProgress: true,
    },
  });

  // Create test data
  const fs = await import('fs/promises');
  const path = await import('path');
  const testDir = path.join(__dirname, '../test-bulk-data');
  await fs.mkdir(testDir, { recursive: true });

  // Generate test files
  const generateCSV = (fileName: string, count: number, format: 'csv' | 'json') => {
    const filePath = path.join(testDir, fileName);

    if (format === 'csv') {
      const headers = ['id', 'name', 'email', 'department', 'salary'];
      const lines = [headers.join(',')];

      for (let i = 1; i <= count; i++) {
        const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
        const names = ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Williams', 'Charlie Brown'];
        const name = names[Math.floor(Math.random() * names.length)];
        const department = departments[Math.floor(Math.random() * departments.length)];
        const salary = Math.floor(Math.random() * 100000) + 50000;
        lines.push(`${i},"${name}",${name.toLowerCase().replace(' ', '.')}@company.com,${department},${salary}`);
      }

      return fs.writeFile(filePath, lines.join('\n'));
    } else {
      const data = Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@company.com`,
        department: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'][Math.floor(Math.random() * 5)],
        salary: Math.floor(Math.random() * 100000) + 50000,
      }));

      return fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }
  };

  // Create multiple test files
  console.log('📁 Creating test files...');
  await Promise.all([
    generateCSV('employees-1.csv', 5000, 'csv'),
    generateCSV('employees-2.csv', 7500, 'csv'),
    generateCSV('employees-3.json', 3000, 'json'),
    generateCSV('employees-4.csv', 10000, 'csv'),
    generateCSV('employees-5.json', 2000, 'json'),
  ]);

  console.log('✅ Created 5 test files with varying sizes and formats');

  // Define common validation rules
  const validationRules = [
    { field: 'id', type: 'number', required: true },
    { field: 'name', type: 'string', required: true, options: { minLength: 2, maxLength: 100 } },
    { field: 'email', type: 'email', required: true },
    { field: 'department', type: 'string', required: true },
    { field: 'salary', type: 'number', required: true, options: { min: 30000, max: 200000 } },
  ];

  // Define common transformation rules
  const transformationRules = [
    { target: 'employee_id', source: 'id', type: 'mapping' },
    { target: 'full_name', type: 'enrichment', options: { type: 'concat', parts: ['$name'] } },
    { target: 'annual_salary', type: 'enrichment', options: { type: 'concat', parts: ['$salary', ' per year'] } },
    { target: 'normalized_email', type: 'normalization', options: { type: 'lowercase' } },
    { target: 'name', type: 'normalization', options: { type: 'trim' } },
  ];

  // Create bulk operation
  console.log('\n🚀 Creating bulk import operation...');
  const bulkOperation = system.bulkImport([
    {
      path: path.join(testDir, 'employees-1.csv'),
      format: 'csv',
      config: {
        validationRules,
        transformations: transformationRules,
        conflictResolution: 'skip',
      },
    },
    {
      path: path.join(testDir, 'employees-2.csv'),
      format: 'csv',
      config: {
        validationRules,
        conflictResolution: 'overwrite',
      },
    },
    {
      path: path.join(testDir, 'employees-3.json'),
      format: 'json',
      config: {
        validationRules,
        transformations: transformationRules,
        conflictResolution: 'merge',
      },
    },
    {
      path: path.join(testDir, 'employees-4.csv'),
      format: 'csv',
      config: {
        validationRules,
        conflictResolution: 'skip',
      },
    },
    {
      path: path.join(testDir, 'employees-5.json'),
      format: 'json',
      config: {
        validationRules,
        transformations: transformationRules,
        conflictResolution: 'update',
      },
    },
  ]);

  console.log(`📋 Bulk operation created with ${bulkOperation.getOperations().length} operations`);

  // Execute bulk operation
  console.log('\n⚡ Executing bulk operation...');
  const bulkStartTime = performance.now();
  const bulkResult = await bulkOperation.execute(
    system.processor,
    system.transformer,
    system.validator
  );
  const bulkEndTime = performance.now();

  console.log('\n📊 Bulk Operation Results:');
  console.log(`Total operations: ${bulkResult.operationCount}`);
  console.log(`Executed operations: ${bulkResult.executedOperations}`);
  console.log(`Success rate: ${bulkResult.successRate}%`);
  console.log(`Total processing time: ${bulkResult.totalProcessingTime.toFixed(2)}ms`);
  console.log(`Average time per operation: ${(bulkResult.totalProcessingTime / bulkResult.operationCount).toFixed(2)}ms`);
  console.log(`Summary: ${bulkResult.summary}`);

  // Display individual operation results
  console.log('\n📋 Individual Operation Results:');
  bulkResult.results.forEach((result, index) => {
    const operation = bulkOperation.getOperations()[index];
    console.log(`   Operation ${index + 1}: ${operation.type.toUpperCase()} - ${result.success ? '✅' : '❌'}`);
    if (!result.success) {
      console.log(`      Error: ${result.error}`);
    }
  });

  // Process records with custom validation
  console.log('\n🔍 Custom validation processing...');
  const csvContent = 'id,name,email,score\n1,John,john@example.com,95\n2,Jane,jane@example.com,87\n3,Bob,bob@invalid.com,92';
  await fs.writeFile(path.join(testDir, 'validation-test.csv'), csvContent);

  const validationData = [
    { id: 1, name: 'John', email: 'john@example.com', score: 95 },
    { id: 2, name: 'Jane', email: 'jane@example.com', score: 87 },
    { id: 3, name: 'Bob', email: 'bob@invalid.com', score: 92 },
  ];

  const validationBulkOperation = system.bulkImport([]);
  validationBulkOperation.addValidation(validationData, {
    rules: [
      { field: 'email', type: 'email', required: true },
      { field: 'score', type: 'number', required: true, options: { min: 0, max: 100 } },
    ],
  });

  const validationResult = await validationBulkOperation.execute(
    system.processor,
    system.transformer,
    system.validator
  );

  console.log('Validation Results:');
  console.log(`   Success rate: ${validationResult.successRate}%`);
  validationResult.results.forEach((result, index) => {
    console.log(`   Record ${index + 1}: ${result.success ? '✅ Valid' : '❌ Invalid'}`);
    if (!result.success) {
      console.log(`      Errors: ${result.error}`);
    }
  });

  // Process records with custom transformation
  console.log('\n🔄 Custom transformation processing...');
  const transformData = [
    { first_name: 'John', last_name: 'Doe', birth_date: '1990-01-01' },
    { first_name: 'Jane', last_name: 'Smith', birth_date: '1985-05-15' },
    { first_name: 'Bob', last_name: 'Johnson', birth_date: '1992-12-25' },
  ];

  const transformBulkOperation = system.bulkImport([]);
  transformBulkOperation.addTransformation(transformData, {
    rules: [
      { target: 'fullName', type: 'enrichment', options: { type: 'concat', parts: ['$first_name', ' ', '$last_name'] } },
      { target: 'birthDate', type: 'conversion', options: { type: 'date' } },
      { target: 'birthYear', type: 'enrichment', options: { type: 'concat', parts: ['$birthDate', ' year'] } },
    ],
  });

  const transformResult = await transformBulkOperation.execute(
    system.processor,
    system.transformer,
    system.validator
  );

  console.log('Transformation Results:');
  transformResult.results.forEach((result, index) => {
    if (result.success && result.data) {
      console.log(`   Record ${index + 1}:`);
      console.log(`      Original: ${JSON.stringify(transformData[index])}`);
      console.log(`      Transformed: ${JSON.stringify(result.data.transformedRecords?.[0]?.data || result.data)}`);
    }
  });

  // Analyze bulk operation performance
  const analytics = system.analytics.getAnalytics();
  console.log('\n📈 Performance Analytics:');
  console.log(`   Total imports: ${analytics.totalImports}`);
  console.log(`   Successful imports: ${analytics.successfulImports}`);
  console.log(`   Failed imports: ${analytics.failedImports}`);
  console.log(`   Total records processed: ${analytics.totalRecordsProcessed}`);
  console.log(`   Average processing time: ${analytics.averageProcessingTime.toFixed(2)}ms`);

  // Format distribution
  console.log('\n📊 Format Distribution:');
  Object.entries(analytics.formatDistribution).forEach(([format, count]) => {
    console.log(`   ${format.toUpperCase()}: ${count} records`);
  });

  // Error analysis
  const errorAnalysis = system.analytics.getErrorAnalysis();
  if (errorAnalysis.length > 0) {
    console.log('\n❌ Error Analysis:');
    errorAnalysis.slice(0, 5).forEach(error => {
      console.log(`   ${error.errorType}: ${error.frequency} occurrences (${error.percentage.toFixed(1)}%)`);
    });
  }

  // System health
  const health = system.analytics.getHealthMetrics();
  console.log('\n💚 System Health:');
  console.log(`   Health Score: ${health.healthScore}/100`);
  console.log(`   System Load: ${health.systemLoad}%`);
  console.log(`   Memory Usage: ${health.memoryUsage} GB`);
  console.log(`   Error Rate: ${health.errorRate}%`);
  console.log(`   Throughput: ${health.throughput} records/job`);

  // Clean up
  await fs.rm(testDir, { recursive: true, force: true });
  console.log('\n🧹 Cleaned up test files');

  system.cleanup();
}

bulkOperationsExample().catch(console.error);