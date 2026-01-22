# @claudeflare/pipelines

Enterprise-grade data pipeline and ETL system for ClaudeFlare on Cloudflare Workers.

## Features

### Data Ingestion
- **REST APIs**: Fetch data from RESTful APIs with pagination, rate limiting, and authentication
- **GraphQL APIs**: Query GraphQL endpoints with variables and authentication
- **Webhooks**: Handle incoming webhooks with signature validation
- **Server-Sent Events (SSE)**: Stream real-time data from SSE endpoints
- **Databases**: Ingest from PostgreSQL, MySQL, MongoDB, Redis, Cloudflare D1, and KV
- **Files**: Parse CSV, JSON, Parquet, Avro, and XML files

### Stream Processing
- **Real-time Transformations**: Map, filter, aggregate, and join streaming data
- **Windowing**: Tumbling, sliding, and session windows for time-based analysis
- **Aggregations**: Count, sum, average, min, max, and custom aggregations
- **Fluent API**: Chain operations with a clean, readable syntax

### Batch Processing
- **Cron Scheduling**: Schedule jobs with cron expressions
- **Parallel Execution**: Process batches concurrently with configurable limits
- **MapReduce**: Distributed data processing framework
- **Error Handling**: Comprehensive error handling and retry logic

### Data Transformation
- **Transformation DSL**: Fluent domain-specific language for transformations
- **Schema Evolution**: Handle schema changes with compatibility checking
- **Data Validation**: Validate against JSON Schema, Avro, or custom schemas
- **Common Transforms**: Pre-built transformations for common operations

### Data Quality
- **Quality Rules**: Define and enforce data quality rules
- **Anomaly Detection**: Statistical and rule-based anomaly detection
- **Data Profiling**: Profile data to understand its characteristics
- **Quarantine**: Isolate invalid records for review

### Pipeline Orchestration
- **Workflow Engine**: Define complex workflows with dependencies
- **Monitoring**: Real-time metrics and alerting
- **Health Checks**: System health monitoring
- **Event Handlers**: React to pipeline events

## Installation

```bash
npm install @claudeflare/pipelines
```

## Quick Start

### Data Ingestion

```typescript
import { RestApiIngestor, DataIngestorFactory } from '@claudeflare/pipelines';

// Fetch data from REST API
const ingestor = new RestApiIngestor({
  id: 'api-source',
  config: {
    url: 'https://api.example.com/data',
    method: 'GET',
    pagination: {
      type: 'offset',
      pageSize: 100
    }
  }
});

const events = await ingestor.fetch();
```

### Stream Processing

```typescript
import { StreamBuilder, filter, map, tumblingWindow } from '@claudeflare/pipelines';

// Build a stream processing pipeline
const pipeline = new StreamBuilder()
  .from(asyncIterable)
  .filter(event => event.value.status === 'active')
  .map(event => ({ ...event, processed: true }))
  .execute();

for await (const event of pipeline) {
  console.log(event);
}
```

### Batch Processing

```typescript
import { BatchManager, BatchJobBuilder } from '@claudeflare/pipelines';

const manager = new BatchManager();

const job = new BatchJobBuilder()
  .name('Daily ETL')
  .source(dataSource)
  .destination(dataDestination)
  .schedule({
    type: 'cron',
    expression: '0 2 * * *' // 2 AM daily
  })
  .build();

manager.createJob(job);
manager.start();
```

### Data Transformation

```typescript
import { transform } from '@claudeflare/pipelines';

const result = await transform()
  .filter('record.status === "active"')
  .project('id', 'name', 'email')
  .rename({ name: 'fullName', email: 'emailAddress' })
  .normalize(
    { type: 'lowercase', field: 'email' },
    { type: 'trim', field: 'name' }
  )
  .execute(data);
```

### Data Quality

```typescript
import { PredefinedRules, QualityManager } from '@claudeflare/pipelines';

const config = {
  enabled: true,
  rules: [
    PredefinedRules.requiredField('id'),
    PredefinedRules.email('email'),
    PredefinedRules.positive('age')
  ],
  actions: ['drop', 'quarantine']
};

const manager = new QualityManager(config);
const result = await manager.process(records);
```

### Pipeline Orchestration

```typescript
import { workflow, PipelineManager } from '@claudeflare/pipelines';

// Define workflow
const wf = workflow()
  .id('etl-workflow')
  .name('ETL Pipeline')
  .addSource('source', { type: 'rest-api', url: '...' })
  .addTransform('transform', { operations: [...] })
  .addDestination('destination', { type: 'database', ... })
  .addEdge('source', 'transform')
  .addEdge('transform', 'destination')
  .build();

// Execute workflow
const manager = new PipelineManager(monitoringConfig);
manager.registerWorkflow(wf);

const result = await manager.start('etl-workflow');
```

## Architecture

```
@claudeflare/pipelines
├── src/
│   ├── ingestion/       # Data ingestion from various sources
│   ├── streaming/       # Stream processing engine
│   ├── batch/           # Batch processing with scheduling
│   ├── transform/       # Data transformation DSL
│   ├── quality/         # Data quality validation
│   ├── orchestration/   # Workflow orchestration
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
└── tests/               # Test files
```

## API Reference

### Data Ingestion

#### `RestApiIngestor`
Fetch data from REST APIs with support for pagination, rate limiting, and authentication.

**Methods:**
- `fetch(): Promise<StreamEvent[]>` - Fetch all data
- `stream(): AsyncGenerator<StreamEvent>` - Stream data
- `cancel(): void` - Cancel ongoing requests

#### `GraphQLIngestor`
Fetch data from GraphQL APIs.

#### `WebhookIngestor`
Handle incoming webhook requests.

#### `SSEIngestor`
Connect to Server-Sent Events streams.

### Stream Processing

#### `StreamBuilder`
Fluent API for building stream processing pipelines.

**Methods:**
- `from(source): StreamBuilder` - Set data source
- `filter(predicate): StreamBuilder` - Filter events
- `map(mapper): StreamBuilder` - Transform events
- `aggregate(aggregations): StreamBuilder` - Aggregate events
- `execute(): AsyncGenerator<StreamEvent>` - Execute pipeline

#### Operations
- `filter()` - Filter events by predicate
- `map()` - Transform events
- `groupBy()` - Group events by key
- `tumblingWindow()` - Apply tumbling time windows
- `slidingWindow()` - Apply sliding time windows
- `join()` - Join multiple streams

### Batch Processing

#### `BatchManager`
Manage and execute batch processing jobs.

**Methods:**
- `createJob(config): BatchJob` - Create a new job
- `start(): void` - Start the scheduler
- `stop(): void` - Stop the scheduler
- `triggerJob(jobId): Promise<void>` - Trigger job manually

#### `BatchJobBuilder`
Build batch job configurations.

### Data Transformation

#### `transform()`
Create a transformation pipeline.

**Methods:**
- `map(script): TransformDSL` - Transform records
- `filter(condition): TransformDSL` - Filter records
- `project(...fields): TransformDSL` - Select fields
- `rename(mapping): TransformDSL` - Rename fields
- `aggregate(...aggs): TransformDSL` - Aggregate records
- `execute(data): Promise<unknown[]>` - Execute transformation

#### `SchemaRegistry`
Manage data schemas with versioning.

#### `SchemaMigrator`
Migrate data between schema versions.

### Data Quality

#### `DataQualityValidator`
Validate data against quality rules.

#### `AnomalyDetectionEngine`
Detect anomalies in data.

#### `DataProfiler`
Profile data to understand its characteristics.

#### `PredefinedRules`
Common quality rule templates.

### Pipeline Orchestration

#### `PipelineManager`
Manage complete pipeline lifecycle.

**Methods:**
- `registerWorkflow(workflow): void` - Register a workflow
- `start(workflowId, input): Promise<Result>` - Start workflow
- `stop(executionId): void` - Stop execution
- `getStatus(executionId): Status` - Get execution status

#### `PipelineMonitor`
Monitor pipeline execution and metrics.

#### `WorkflowBuilder`
Build workflow definitions.

## Configuration

### Pipeline Configuration

```typescript
interface PipelineConfig {
  id: string;
  name: string;
  version: string;
  sources: DataSource[];
  transforms: TransformConfig[];
  destinations: DataDestination[];
  schedule?: ScheduleConfig;
  quality?: QualityConfig;
  monitoring?: MonitoringConfig;
}
```

### Data Source Configuration

```typescript
interface DataSource {
  id: string;
  type: DataSourceType;
  config: DataSourceConfig;
  schema?: DataSchema;
  batching?: BatchingConfig;
}
```

## Examples

### ETL Pipeline

```typescript
import {
  RestApiIngestor,
  StreamBuilder,
  transform,
  BatchManager,
  PredefinedRules
} from '@claudeflare/pipelines';

// 1. Ingest data
const ingestor = new RestApiIngestor({
  id: 'api-source',
  config: {
    url: 'https://api.example.com/users',
    pagination: { type: 'page', pageSize: 100 }
  }
});

const data = await ingestor.fetch();

// 2. Transform data
const transformed = await transform()
  .filter('record.status === "active"')
  .project('id', 'name', 'email')
  .normalize({ type: 'lowercase', field: 'email' })
  .execute(data);

// 3. Validate quality
const validator = new DataQualityValidator({
  enabled: true,
  rules: [
    PredefinedRules.requiredField('id'),
    PredefinedRules.email('email')
  ],
  actions: ['quarantine']
});

const validation = await validator.validateRecords(transformed);

// 4. Load to destination
// ... write to destination
```

### Real-time Stream Processing

```typescript
import { StreamBuilder, tumblingWindow, filter } from '@claudeflare/pipelines';

const pipeline = new StreamBuilder()
  .from(eventStream)
  .filter(event => event.value.type === 'click')
  .tumblingWindow(60000) // 1-minute windows
  .execute();

for await (const window of pipeline) {
  console.log('Window aggregation:', window);
}
```

## Performance Considerations

- **Batching**: Use appropriate batch sizes for your data volume
- **Concurrency**: Configure parallel processing based on your resources
- **Memory**: Monitor memory usage for large datasets
- **Indexes**: Ensure proper indexing on database sources

## Error Handling

```typescript
try {
  const result = await ingestor.fetch();
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Handle rate limiting
  } else if (error.code === 'AUTHENTICATION_FAILED') {
    // Handle auth errors
  }
}
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
