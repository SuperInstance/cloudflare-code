import { DataExportSystem } from '../src/index';
import { Filter, Transformation, Schema, Aggregation } from '../src/types';

// Create advanced export system with custom configuration
const exportSystem = new DataExportSystem({
  memoryLimit: 1024 * 1024 * 200, // 200MB memory limit
  maxConcurrent: 10
});

// Complex dataset with nested data
const complexData = [
  {
    id: 1,
    user: {
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        age: 30
      },
      preferences: {
        theme: 'dark',
        notifications: true,
        language: 'en-US'
      }
    },
    orders: [
      { id: 'ORD-001', amount: 150.00, date: '2023-01-15' },
      { id: 'ORD-002', amount: 75.50, date: '2023-02-20' }
    ],
    totalSpent: 225.50,
    joinDate: '2020-05-10',
    status: 'active',
    tags: ['premium', 'vip', 'early-adopter']
  },
  {
    id: 2,
    user: {
      profile: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        age: 25
      },
      preferences: {
        theme: 'light',
        notifications: false,
        language: 'en-US'
      }
    },
    orders: [
      { id: 'ORD-003', amount: 200.00, date: '2023-01-10' }
    ],
    totalSpent: 200.00,
    joinDate: '2021-03-15',
    status: 'inactive',
    tags: ['standard']
  },
  {
    id: 3,
    user: {
      profile: {
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob@example.com',
        age: 35
      },
      preferences: {
        theme: 'dark',
        notifications: true,
        language: 'es-ES'
      }
    },
    orders: [
      { id: 'ORD-004', amount: 300.00, date: '2023-01-05' },
      { id: 'ORD-005', amount: 450.00, date: '2023-02-10' },
      { id: 'ORD-006', amount: 120.00, date: '2023-03-05' }
    ],
    totalSpent: 870.00,
    joinDate: '2019-08-20',
    status: 'active',
    tags: ['premium', 'vip', 'power-user']
  }
];

async function nestedDataProcessing() {
  console.log('=== Nested Data Processing Example ===');

  // Filter and process nested data
  const filters: Filter[] = [
    { field: 'user.profile.age', operator: 'gte', value: 25 },
    { field: 'status', operator: 'eq', value: 'active' },
    { field: 'totalSpent', operator: 'gt', value: 200 }
  ];

  const transformations: Transformation[] = [
    {
      field: 'user.profile.fullName',
      type: 'calculate',
      options: {
        expression: "'\"' + {value.user.profile.firstName} + ' ' + {value.user.profile.lastName} + '\"'"
      }
    },
    {
      field: 'orderCount',
      type: 'calculate',
      options: {
        expression: '{value.orders.length}'
      }
    },
    {
      field: 'user.preferences.theme',
      type: 'map',
      options: {
        mapping: {
          'dark': 'Dark Mode',
          'light': 'Light Mode'
        }
      }
    }
  ];

  const processedData = await exportSystem.process(complexData, {
    filters,
    transformations,
    columns: ['id', 'user.profile.fullName', 'orderCount', 'user.preferences.theme', 'totalSpent']
  });

  console.log('Processed nested data:');
  processedData.forEach((record, index) => {
    console.log(`\nRecord ${index + 1}:`);
    console.log(JSON.stringify(record, null, 2));
  });

  // Export the processed data
  const result = await exportSystem.export(processedData, 'json', {
    prettyPrint: true
  });
  console.log(`\nExported to: ${result.path}`);
}

async function dataValidationAndQuality() {
  console.log('\n=== Data Validation and Quality Example ===');

  // Comprehensive schema definition
  const comprehensiveSchema: Schema = {
    id: { type: 'number', required: true, min: 1 },
    'user.profile.firstName': { type: 'string', required: true, minLength: 1 },
    'user.profile.lastName': { type: 'string', required: true, minLength: 1 },
    'user.profile.email': { type: 'string', required: true, format: 'email' },
    'user.profile.age': { type: 'number', required: true, min: 18, max: 120 },
    'user.preferences.theme': { type: 'string', required: false, pattern: '^(dark|light|auto)$' },
    'user.preferences.notifications': { type: 'boolean', required: true },
    'user.preferences.language': { type: 'string', required: true, pattern: '^[a-z]{2}-[A-Z]{2}$' },
    orders: { type: 'array', required: true, minLength: 0 },
    'orders.id': { type: 'string', required: true, pattern: '^ORD-[0-9]{3}$' },
    'orders.amount': { type: 'number', required: true, min: 0 },
    'orders.date': { type: 'string', required: true, format: 'iso8601' },
    totalSpent: { type: 'number', required: true, min: 0 },
    joinDate: { type: 'string', required: true, format: 'iso8601' },
    status: { type: 'string', required: true, pattern: '^(active|inactive|pending)$' },
    tags: { type: 'array', required: false }
  };

  try {
    // Validate and process with comprehensive schema
    const processedData = await exportSystem.process(complexData, {
      schema: comprehensiveSchema,
      transformations: [
        {
          field: 'user.profile.fullName',
          type: 'calculate',
          options: {
            expression: "'\"' + {value.user.profile.firstName} + ' ' + {value.user.profile.lastName} + '\"'"
          }
        }
      ]
    });

    console.log(`Valid records: ${processedData.length}`);
    console.log('Sample validated record:');
    console.log(JSON.stringify(processedData[0], null, 2));

  } catch (error) {
    console.error('Validation error:', error);
  }
}

async function complexAggregations() {
  console.log('\n=== Complex Aggregations Example ===');

  // Sample sales data
  const salesData = [
    { region: 'North', product: 'Widget A', sales: 1000, quarter: 'Q1', year: 2023 },
    { region: 'North', product: 'Widget B', sales: 1500, quarter: 'Q1', year: 2023 },
    { region: 'South', product: 'Widget A', sales: 800, quarter: 'Q1', year: 2023 },
    { region: 'South', product: 'Widget C', sales: 1200, quarter: 'Q1', year: 2023 },
    { region: 'North', product: 'Widget A', sales: 1100, quarter: 'Q2', year: 2023 },
    { region: 'North', product: 'Widget B', sales: 1300, quarter: 'Q2', year: 2023 },
    { region: 'South', product: 'Widget A', sales: 900, quarter: 'Q2', year: 2023 },
    { region: 'South', product: 'Widget C', sales: 1400, quarter: 'Q2', year: 2023 }
  ];

  // Multiple aggregations
  const aggregationOptions: Aggregation[] = [
    {
      type: 'group',
      field: 'sales',
      groupBy: ['region', 'product']
    },
    {
      type: 'sum',
      field: 'sales'
    },
    {
      type: 'avg',
      field: 'sales'
    },
    {
      type: 'max',
      field: 'sales'
    },
    {
      type: 'min',
      field: 'sales'
    }
  ];

  try {
    // Process with multiple aggregations
    for (const agg of aggregationOptions) {
      const result = await exportSystem.process(salesData, {
        aggregation: agg
      });

      console.log(`\n${agg.type.toUpperCase()} by ${agg.groupBy?.join(', ') || 'all data'}:`);
      console.log(JSON.stringify(result, null, 2));
    }

    // Complex aggregation with filtering first
    const filteredAndAggregated = await exportSystem.process(salesData, {
      filters: [
        { field: 'sales', operator: 'gte', value: 1000 }
      ],
      aggregation: {
        type: 'group',
        field: 'sales',
        groupBy: ['region']
      }
    });

    console.log('\nFiltered sales (>1000) by region:');
    console.log(JSON.stringify(filteredAndAggregated, null, 2));

  } catch (error) {
    console.error('Aggregation error:', error);
  }
}

async function customTransformations() {
  console.log('\n=== Custom Transformations Example ===');

  const financialData = [
    { id: 1, name: 'Apple Inc.', revenue: 394328000000, profit: 99803000000, employees: 164000, founded: 1976 },
    { id: 2, name: 'Microsoft Corp.', revenue: 211915000000, profit: 72361000000, employees: 221000, founded: 1975 },
    { id: 3, name: 'Alphabet Inc.', revenue: 282836000000, profit: 73795000000, employees: 174014, founded: 1998 },
    { id: 4, name: 'Amazon.com Inc.', revenue: 513983000000, profit: 27220000000, employees: 1584000, founded: 1994 },
    { id: 5, name: 'Tesla Inc.', revenue: 81462000000, profit: 12586000000, employees: 140473, founded: 2003 }
  ];

  const transformations: Transformation[] = [
    // Format large numbers
    { field: 'revenue', type: 'format', options: { format: 'numberFormatter' } },
    { field: 'profit', type: 'format', options: { format: 'numberFormatter' } },

    // Calculate profit margin
    {
      field: 'profitMargin',
      type: 'calculate',
      options: {
        expression: 'Math.round(({value.profit} / {value.revenue}) * 10000) / 100'
      }
    },

    // Calculate revenue per employee
    {
      field: 'revenuePerEmployee',
      type: 'calculate',
      options: {
        expression: 'Math.round({value.revenue} / {value.employees})'
      }
    },

    // Format company age
    {
      field: 'companyAge',
      type: 'calculate',
      options: {
        expression: 'new Date().getFullYear() - {value.founded}'
      }
    },

    // Categorize by size
    {
      field: 'sizeCategory',
      type: 'map',
      options: {
        mapping: {
          '0': 'Unknown',
          '1': 'Very Small (<10 employees)',
          '10': 'Small (10-100 employees)',
          '100': 'Medium (100-1000 employees)',
          '1000': 'Large (1000-10000 employees)',
          '10000': 'Very Large (>10000 employees)'
        }
      }
    }
  ];

  try {
    const processedData = await exportSystem.process(financialData, {
      transformations,
      columns: ['name', 'revenue', 'profit', 'profitMargin', 'revenuePerEmployee', 'companyAge', 'sizeCategory']
    });

    console.log('Financial data with custom transformations:');
    processedData.forEach((company, index) => {
      console.log(`\n${index + 1}. ${company.name}`);
      console.log(`   Revenue: $${(company.revenue / 1000000000).toFixed(2)}B`);
      console.log(`   Profit: $${(company.profit / 1000000000).toFixed(2)}B`);
      console.log(`   Profit Margin: ${company.profitMargin}%`);
      console.log(`   Revenue per Employee: $${company.revenuePerEmployee.toLocaleString()}`);
      console.log(`   Company Age: ${company.companyAge} years`);
      console.log(`   Size Category: ${company.sizeCategory}`);
    });

    // Export to Excel with multiple sheets
    const excelResult = await exportSystem.export(processedData, 'excel', {
      sheets: ['Summary', 'Details'],
      sheetName: 'Financial Analysis'
    });
    console.log(`\nExported to Excel: ${excelResult.path}`);

  } catch (error) {
    console.error('Custom transformation error:', error);
  }
}

async function realTimeMonitoring() {
  console.log('\n=== Real-time Monitoring Example ===');

  // Set up event listeners
  exportSystem.batchExporter.on('job-start', (job) => {
    console.log(`\n🚀 Job started: ${job.name} (${job.id})`);
  });

  exportSystem.batchExporter.on('job-progress', (progress) => {
    const percentage = ((progress.processedRecords / progress.totalRecords) * 100).toFixed(1);
    console.log(`📊 Progress: ${progress.processedRecords}/${progress.totalRecords} (${percentage}%) - Speed: ${progress.speed.toFixed(0)} records/sec`);
  });

  exportSystem.batchExporter.on('chunk-complete', (chunk) => {
    console.log(`✅ Chunk ${chunk.chunkNumber} completed in ${chunk.duration}ms`);
  });

  exportSystem.batchExporter.on('job-complete', (job) => {
    console.log(`🎉 Job completed: ${job.name} - Duration: ${job.endTime!.getTime() - job.startTime!.getTime()}ms`);
  });

  exportSystem.batchExporter.on('job-error', (job) => {
    console.log(`❌ Job failed: ${job.name} - Error: ${job.error}`);
  });

  // Simulate real-time data generation
  const generateRealTimeData = (count: number) => {
    return Array(count).fill(null).map((_, i) => ({
      id: Date.now() + i,
      timestamp: new Date().toISOString(),
      metric: Math.random() * 100,
      value: Math.floor(Math.random() * 1000),
      category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
      source: `sensor-${Math.floor(Math.random() * 10)}`
    }));
  };

  try {
    // Generate and process data in batches
    const totalRecords = 5000;
    const batchSize = 1000;
    const batches = [];

    for (let i = 0; i < totalRecords; i += batchSize) {
      batches.push(generateRealTimeData(Math.min(batchSize, totalRecords - i)));
    }

    console.log(`Generated ${totalRecords} records in ${batches.length} batches`);

    // Process and export each batch
    for (let i = 0; i < batches.length; i++) {
      console.log(`\nProcessing batch ${i + 1}/${batches.length}`);

      // Apply real-time transformations
      const transformedBatch = await exportSystem.process(batches[i], {
        filters: [
          { field: 'metric', operator: 'gt', value: 25 },
          { field: 'value', operator: 'gte', value: 100 }
        ],
        transformations: [
          {
            field: 'qualityScore',
            type: 'calculate',
            options: {
              expression: 'Math.round(({value.metric} + {value.value}) / 2)'
            }
          }
        ],
        columns: ['id', 'timestamp', 'metric', 'value', 'category', 'source', 'qualityScore']
      });

      // Export batch
      const result = await exportSystem.batchExport(transformedBatch, 'csv', {
        chunkSize: 200,
        progressInterval: 500
      });

      console.log(`Batch ${i + 1} exported: ${result.processedRecords} records`);
    }

  } catch (error) {
    console.error('Real-time monitoring error:', error);
  }
}

async function memoryOptimizedExport() {
  console.log('\n=== Memory Optimized Export Example ===');

  // Generate very large dataset
  const largeDatasetSize = 100000; // 100K records
  const largeDataset = Array(largeDatasetSize).fill(null).map((_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    age: Math.floor(Math.random() * 80) + 18,
    salary: Math.floor(Math.random() * 150000) + 30000,
    department: ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'][Math.floor(Math.random() * 5)],
    joinDate: new Date(2015 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)).toISOString().split('T')[0],
    isActive: Math.random() > 0.2,
    lastLogin: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
  }));

  console.log(`Generated ${largeDatasetSize} records`);

  try {
    // Process with memory constraints
    const processedData = await exportSystem.process(largeDataset, {
      filters: [
        { field: 'isActive', operator: 'eq', value: true },
        { field: 'salary', operator: 'gte', value: 50000 },
        { field: 'age', operator: 'between', value: [25, 65] } // Note: this would need custom implementation
      ],
      columns: ['id', 'name', 'email', 'department', 'salary', 'joinDate'],
      transformations: [
        {
          field: 'yearsOfService',
          type: 'calculate',
          options: {
            expression: 'new Date().getFullYear() - new Date({value.joinDate}).getFullYear()'
          }
        }
      ]
    });

    console.log(`Filtered to ${processedData.length} active employees`);

    // Memory-optimized batch export
    const batchResult = await exportSystem.batchExport(processedData, 'parquet', {
      chunkSize: 10000,
      memoryLimit: 1024 * 1024 * 100, // 100MB memory limit
      retryAttempts: 3,
      retryDelay: 2000
    });

    console.log('Memory-optimized export results:');
    console.log(`- Total Records: ${batchResult.totalRecords}`);
    console.log(`- Processed Records: ${batchResult.processedRecords}`);
    console.log(`- Chunks: ${batchResult.chunks}`);
    console.log(`- Duration: ${batchResult.duration}ms`);
    console.log(`- Average Speed: ${(batchResult.processedRecords / (batchResult.duration / 1000)).toFixed(0)} records/sec`);

    if (batchResult.errors.length > 0) {
      console.log(`- Errors: ${batchResult.errors.length}`);
      batchResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.message}`);
      });
    }

  } catch (error) {
    console.error('Memory optimized export error:', error);
  }
}

async function main() {
  console.log('Advanced Data Export System Examples\n');

  await nestedDataProcessing();
  await dataValidationAndQuality();
  await complexAggregations();
  await customTransformations();
  await realTimeMonitoring();
  await memoryOptimizedExport();

  console.log('\n=== Final Cleanup ===');
  await exportSystem.shutdown();
  console.log('Advanced examples completed');
}

// Run the advanced examples
main().catch(console.error);