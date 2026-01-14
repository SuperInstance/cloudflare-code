/**
 * Complete Data Pipeline Example
 * Demonstrates a full ETL workflow with all components
 */

import {
  // Ingestion
  RestApiIngestor,
  type RestApiConfig,

  // Stream processing
  StreamBuilder,
  filter,
  map,
  tumblingWindow,

  // Batch processing
  BatchManager,
  BatchJobBuilder,

  // Transformation
  transform,
  CommonTransforms,

  // Quality
  PredefinedRules,
  QualityManager,
  DataQualityValidator,

  // Orchestration
  workflow,
  PipelineManager,
  createMonitoringConfig
} from '../src';

// ============================================================================
// Example 1: Simple ETL Pipeline
// ============================================================================

async function simpleETL() {
  console.log('=== Simple ETL Pipeline ===\n');

  // 1. Extract data from API
  const apiConfig: RestApiConfig = {
    url: 'https://jsonplaceholder.typicode.com/users',
    method: 'GET',
    pagination: {
      type: 'none'
    }
  };

  const ingestor = new RestApiIngestor({
    id: 'users-api',
    config: apiConfig
  });

  console.log('Fetching data from API...');
  const events = await ingestor.fetch();
  console.log(`Fetched ${events.length} records\n`);

  // 2. Transform data
  console.log('Transforming data...');
  const transformed = await transform()
    .project('id', 'name', 'email', 'phone')
    .rename({ name: 'fullName', email: 'emailAddress' })
    .normalize({ type: 'lowercase', field: 'email' })
    .compute('domain', 'record.email.split("@")[1]')
    .execute(events.map(e => e.value));

  console.log(`Transformed ${transformed.length} records\n`);

  // 3. Validate quality
  console.log('Validating data quality...');
  const validator = new DataQualityValidator({
    enabled: true,
    rules: [
      PredefinedRules.requiredField('id'),
      PredefinedRules.requiredField('fullName'),
      PredefinedRules.email('email')
    ],
    actions: ['quarantine']
  });

  const validationResults = await validator.validateRecords(transformed);
  const validCount = validationResults.filter(r => r.valid).length;
  console.log(`Validation complete: ${validCount}/${validationResults.length} passed\n`);

  // 4. In a real scenario, you would write to a destination here
  console.log('ETL Pipeline complete!');
}

// ============================================================================
// Example 2: Real-time Stream Processing
// ============================================================================

async function streamProcessing() {
  console.log('\n=== Stream Processing Pipeline ===\n');

  // Simulate a stream of events
  async function* eventStream() {
    const events = [
      { type: 'click', userId: 1, page: '/home' },
      { type: 'click', userId: 2, page: '/about' },
      { type: 'view', userId: 1, page: '/products' },
      { type: 'click', userId: 3, page: '/contact' },
      { type: 'view', userId: 2, page: '/home' }
    ];

    for (const event of events) {
      yield {
        key: `event-${Date.now()}`,
        value: event,
        timestamp: new Date()
      };

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Process stream with filters and aggregations
  const pipeline = new StreamBuilder()
    .from(eventStream())
    .filter(event => event.value.type === 'click')
    .map(event => ({
      ...event,
      processed: true,
      timestamp: new Date()
    }));

  console.log('Processing stream...\n');

  for await (const event of pipeline.execute()) {
    console.log(`Processed: ${JSON.stringify(event.value)}`);
  }

  console.log('\nStream processing complete!');
}

// ============================================================================
// Example 3: Batch Processing with Scheduling
// ============================================================================

async function batchProcessing() {
  console.log('\n=== Batch Processing Pipeline ===\n');

  const manager = new BatchManager();

  // Create a batch job
  const job = new BatchJobBuilder()
    .name('Daily User Sync')
    .source({
      id: 'user-db',
      type: 'postgresql',
      config: {
        connectionString: 'postgresql://localhost/users',
        query: 'SELECT * FROM users WHERE updated_at > $1',
        params: [new Date(Date.now() - 86400000)]
      }
    })
    .addTransform({
      id: 'transform-users',
      type: 'normalize',
      config: {
        operations: [
          { field: 'email', operation: 'lowercase' },
          { field: 'name', operation: 'trim' }
        ]
      }
    })
    .destination({
      id: 'warehouse',
      type: 'postgresql',
      config: {
        connectionString: 'postgresql://localhost/warehouse',
        query: 'INSERT INTO users_dim VALUES ($1, $2, $3)'
      }
    })
    .schedule({
      type: 'cron',
      expression: '0 2 * * *', // 2 AM daily
      timezone: 'UTC'
    })
    .build();

  manager.createJob(job);
  manager.start();

  console.log('Batch job scheduled');
  console.log('Job ID:', job.id);

  // Trigger job manually for demo
  console.log('\nTriggering job...');
  await manager.triggerJob(job.id);

  console.log('Batch processing complete!');

  manager.stop();
}

// ============================================================================
// Example 4: Data Quality Pipeline
// ============================================================================

async function qualityPipeline() {
  console.log('\n=== Data Quality Pipeline ===\n');

  // Sample data with quality issues
  const records = [
    { id: 1, name: 'Alice', email: 'alice@example.com', age: 30 },
    { id: 2, name: 'Bob', email: 'bob@example.com', age: 25 },
    { id: 3, name: '', email: 'invalid-email', age: -5 }, // Quality issues
    { id: 4, name: 'Charlie', email: 'charlie@example.com', age: 35 }
  ];

  console.log(`Processing ${records.length} records...\n`);

  // Set up quality rules
  const qualityConfig = {
    enabled: true,
    rules: [
      PredefinedRules.requiredField('id'),
      PredefinedRules.requiredField('name'),
      PredefinedRules.email('email'),
      PredefinedRules.range('age', 0, 120)
    ],
    actions: ['quarantine'] as any
  };

  const manager = new QualityManager(qualityConfig);
  const result = await manager.process(records);

  console.log('Quality Report:');
  console.log(`  Valid: ${result.valid.length}`);
  console.log(`  Invalid: ${result.invalid.length}`);
  console.log(`  Quarantined: ${result.quarantined.length}\n`);

  // Show validation details
  console.log('Valid records:', result.valid.length);
  console.log('Issues found:');

  for (const validationResult of result.validationResults) {
    if (!validationResult.valid) {
      console.log(`  - ${validationResult.ruleName}:`);
      for (const violation of validationResult.violations) {
        console.log(`    * ${violation.message}`);
      }
    }
  }
}

// ============================================================================
// Example 5: Complete Workflow Orchestration
// ============================================================================

async function workflowOrchestration() {
  console.log('\n=== Workflow Orchestration ===\n');

  // Define a complete ETL workflow
  const etlWorkflow = workflow()
    .id('complete-etl')
    .name('Complete ETL Workflow')
    .description('Extract, transform, and load user data')
    .addSource('api-source', {
      type: 'rest-api',
      url: 'https://api.example.com/users',
      method: 'GET'
    })
    .addTransform('validate', {
      type: 'validate',
      config: {
        schema: {
          type: 'json-schema',
          definition: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              email: { type: 'string' }
            },
            required: ['id', 'name', 'email']
          }
        }
      }
    })
    .addTransform('enrich', {
      type: 'enrich',
      config: {
        source: 'reference-data',
        mappings: {
          region: 'user.region',
          tier: 'customer.tier'
        }
      }
    })
    .addTransform('quality-check', {
      type: 'validate',
      config: {
        rules: [
          { field: 'email', condition: 'record.email.includes("@")' }
        ]
      }
    })
    .addDestination('warehouse', {
      type: 'postgresql',
      connectionString: 'postgresql://localhost/warehouse',
      table: 'users'
    })
    .addEdge('api-source', 'validate')
    .addEdge('validate', 'enrich')
    .addEdge('enrich', 'quality-check')
    .addEdge('quality-check', 'warehouse', 'output.valid === true')
    .build();

  console.log('Workflow created:');
  console.log(`  ID: ${etlWorkflow.id}`);
  console.log(`  Nodes: ${etlWorkflow.nodes.length}`);
  console.log(`  Edges: ${etlWorkflow.edges.length}\n`);

  // Set up monitoring
  const monitoringConfig = createMonitoringConfig(
    true,
    [
      { name: 'pipeline.records', type: 'counter' },
      { name: 'pipeline.errors', type: 'counter' },
      { name: 'pipeline.duration', type: 'histogram' }
    ],
    [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        condition: 'pipeline.errors > 100',
        threshold: 100,
        window: 60000,
        actions: [
          { type: 'log', config: {} },
          { type: 'webhook', config: { url: 'https://hooks.example.com/alert' } }
        ]
      }
    ]
  );

  const pipelineManager = new PipelineManager(monitoringConfig);
  pipelineManager.registerWorkflow(etlWorkflow);

  // Register event handlers
  pipelineManager.on('pipeline.started', (event) => {
    console.log(`Pipeline started: ${event.pipelineId}`);
  });

  pipelineManager.on('pipeline.completed', (event) => {
    console.log(`Pipeline completed: ${event.pipelineId}`);
    const data = event.data as any;
    console.log(`  Duration: ${data.duration}ms`);
    console.log(`  Status: ${data.status}`);
  });

  console.log('Starting workflow execution...\n');

  try {
    const result = await pipelineManager.start('complete-etl', {
      startDate: new Date().toISOString()
    });

    console.log('Workflow execution result:');
    console.log(`  Execution ID: ${result.executionId}`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Nodes executed: ${result.nodeExecutions}`);
  } catch (error) {
    console.error('Workflow failed:', error);
  }

  console.log('\nWorkflow orchestration complete!');
}

// ============================================================================
// Example 6: Advanced Stream Processing with Windows
// ============================================================================

async function advancedStreamProcessing() {
  console.log('\n=== Advanced Stream Processing ===\n');

  // Generate clickstream events
  async function* clickstream() {
    const events = [
      { userId: 1, action: 'click', page: '/home', value: 10 },
      { userId: 2, action: 'view', page: '/products', value: 5 },
      { userId: 1, action: 'click', page: '/cart', value: 20 },
      { userId: 3, action: 'click', page: '/home', value: 10 },
      { userId: 2, action: 'click', page: '/checkout', value: 50 },
      { userId: 1, action: 'purchase', page: '/success', value: 100 },
      { userId: 3, action: 'view', page: '/about', value: 5 }
    ];

    for (const event of events) {
      yield {
        key: `event-${event.userId}-${Date.now()}`,
        value: event,
        timestamp: new Date()
      };

      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  console.log('Processing clickstream with tumbling windows...\n');

  let windowCount = 0;
  const pipeline = new StreamBuilder()
    .from(clickstream())
    .filter(event => event.value.action === 'click')
    .tumblingWindow(150); // 150ms windows

  for await (const window of pipeline.execute()) {
    windowCount++;
    const events = window.events;
    const totalValue = events.reduce((sum, e) => sum + (e.value.value || 0), 0);

    console.log(`Window ${windowCount}:`);
    console.log(`  Events: ${events.length}`);
    console.log(`  Total value: ${totalValue}`);
    console.log(`  Users: ${[...new Set(events.map(e => e.value.userId))].join(', ')}`);
    console.log('');
  }

  console.log('Stream processing complete!');
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  try {
    await simpleETL();
    await streamProcessing();
    await batchProcessing();
    await qualityPipeline();
    await workflowOrchestration();
    await advancedStreamProcessing();

    console.log('\n=== All Examples Complete! ===');
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Export examples
export {
  simpleETL,
  streamProcessing,
  batchProcessing,
  qualityPipeline,
  workflowOrchestration,
  advancedStreamProcessing,
  runAllExamples
};

// Run examples if executed directly
if (require.main === module) {
  runAllExamples();
}
