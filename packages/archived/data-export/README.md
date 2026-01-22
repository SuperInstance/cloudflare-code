# ClaudeFlare Data Export System

A comprehensive data export package for the ClaudeFlare distributed AI coding platform, providing high-performance, memory-efficient data export capabilities with multiple format support, batch processing, advanced filtering, and scheduled exports.

## Features

### 🚀 **High Performance**
- Process 100K+ records per export
- Sub-100ms record processing time
- Memory-efficient chunked processing
- Optimized for Cloudflare environments

### 📊 **Multi-Format Support**
- **CSV**: Custom delimiters, header control
- **JSON**: Pretty printing, compression support
- **Parquet**: Columnar storage with compression
- **Excel**: Multiple sheets, formatting

### 🔧 **Advanced Processing**
- Data filtering with multiple operators
- Data transformations (rename, format, calculate, map)
- Schema validation with comprehensive rules
- Data aggregation and grouping
- Column selection and projection

### 📅 **Scheduled Exports**
- Cron-based scheduling
- Recurring and one-time exports
- Data provider functions
- Export history tracking
- Pause/resume functionality

### 🔄 **Batch Processing**
- Automatic chunking based on memory limits
- Progress tracking and monitoring
- Retry mechanisms with exponential backoff
- Error handling and recovery

### 📈 **Analytics & Monitoring**
- Export performance metrics
- Format usage statistics
- Error reporting
- Memory usage tracking
- Real-time progress updates

## Installation

```bash
npm install @claudeflare/data-export
```

## Quick Start

### Basic Usage

```typescript
import { DataExportSystem } from '@claudeflare/data-export';

// Create export system
const exportSystem = new DataExportSystem({
  memoryLimit: 1024 * 1024 * 100, // 100MB
  maxConcurrent: 5
});

// Sample data
const data = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
];

// Export to CSV
const result = await exportSystem.export(data, 'csv', {
  includeHeaders: true
});

console.log(`Exported ${result.recordCount} records to ${result.path}`);
```

### Batch Export

```typescript
// Large dataset
const largeData = Array(10000).fill(null).map((_, i) => ({
  id: i,
  name: `User ${i}`,
  email: `user${i}@example.com`
}));

// Batch export with chunking
const batchResult = await exportSystem.batchExport(largeData, 'json', {
  chunkSize: 1000,
  memoryLimit: 1024 * 1024 * 50,
  retryAttempts: 2
});

console.log(`Processed ${batchResult.processedRecords} records in ${batchResult.chunks} chunks`);
```

### Data Processing

```typescript
// Process data with filtering and transformation
const processedData = await exportSystem.process(data, {
  filters: [
    { field: 'active', operator: 'eq', value: true },
    { field: 'age', operator: 'gte', value: 25 }
  ],
  transformations: [
    { field: 'name', type: 'format', options: { format: 'uppercase' } },
    { field: 'fullName', type: 'calculate', options: { expression: "'\"' + {value.name} + '\"'" } }
  ],
  columns: ['id', 'fullName', 'email']
});
```

### Scheduled Exports

```typescript
// Create daily scheduled export
const scheduleId = exportSystem.schedule(
  'Daily Report',
  {
    frequency: 'daily',
    time: '09:00'
  },
  data
);

exportSystem.startScheduler();
```

## API Reference

### DataExportSystem

Main class that combines all components.

#### Constructor Options

```typescript
interface DataExportSystemOptions {
  memoryLimit?: number;    // Memory limit in bytes (default: 500MB)
  maxConcurrent?: number; // Max concurrent scheduled jobs (default: 5)
}
```

#### Methods

##### `export(data, format, options?)`

Export data directly to specified format.

```typescript
interface ExportOptions {
  format: 'csv' | 'json' | 'parquet' | 'excel';
  delimiter?: string;        // CSV delimiter (default: ',')
  prettyPrint?: boolean;     // JSON pretty printing (default: false)
  compression?: CompressionType; // Compression type
  sheets?: string[];        // Excel sheet names
  includeHeaders?: boolean;  // Include CSV headers (default: true)
  sheetName?: string;        // Default sheet name
}
```

##### `batchExport(data, format, batchOptions?, exportOptions?)`

Export data in batches with memory management.

```typescript
interface BatchOptions {
  chunkSize: number;         // Records per chunk
  maxChunks?: number;        // Max chunks (optional)
  memoryLimit?: number;      // Memory limit in bytes
  progressInterval?: number; // Progress update interval
  retryAttempts?: number;    // Retry attempts (default: 0)
  retryDelay?: number;       // Delay between retries
}
```

##### `process(data, options?)`

Process data with filtering, transformation, and aggregation.

```typescript
interface ProcessorOptions {
  filters?: Filter[];
  transformations?: Transformation[];
  schema?: Schema;
  columns?: string[];
  aggregation?: Aggregation;
}
```

### Data Filters

Supported filter operators:

```typescript
type FilterOperator =
  | 'eq'      // equals
  | 'ne'      // not equals
  | 'gt'      // greater than
  | 'gte'     // greater than or equals
  | 'lt'      // less than
  | 'lte'     // less than or equals
  | 'in'      // in array
  | 'nin'     // not in array
  | 'contains' // contains string
  | 'startsWith' // starts with
  | 'endsWith';   // ends with
```

### Data Transformations

Available transformation types:

```typescript
type TransformationType =
  | 'rename'     // Rename field
  | 'format'      // Format value (uppercase, lowercase, etc.)
  | 'calculate'   // Calculate new value
  | 'map'         // Map values
  | 'filter'      // Filter array values
  | 'split';      // Split string into array
```

### Scheduling

#### Frequency Options

```typescript
type Frequency =
  | 'once'     // One-time export
  | 'hourly'   // Every hour
  | 'daily'    // Daily at specific time
  | 'weekly'   // Weekly on specific day
  | 'monthly'; // Monthly on specific day
```

#### Schedule Configuration

```typescript
interface ScheduleConfig {
  frequency: Frequency;
  cronExpression?: string;  // Custom cron expression
  time?: string;            // Time (HH:MM format)
  dayOfWeek?: number;      // 0-6 (Sunday-Saturday)
  dayOfMonth?: number;     // 1-31
  timezone?: string;        // Timezone (default: UTC)
}
```

## Advanced Features

### Memory Management

The system automatically manages memory usage:

```typescript
// Monitor memory usage
const memoryUsage = exportSystem.getStats().processorStats.memoryUsage;

// Update memory limits dynamically
exportSystem.updateMemoryLimit(1024 * 1024 * 200); // 200MB
```

### Error Handling

Comprehensive error handling with retry mechanisms:

```typescript
// Handle batch export errors
const batchResult = await exportSystem.batchExport(data, 'csv', {
  retryAttempts: 3,
  retryDelay: 1000
});

if (batchResult.errors.length > 0) {
  console.log(`Encountered ${batchResult.errors.length} errors`);
}
```

### Real-time Monitoring

Monitor export progress in real-time:

```typescript
// Set up event listeners
exportSystem.batchExporter.on('job-start', (job) => {
  console.log(`Export started: ${job.name}`);
});

exportSystem.batchExporter.on('job-progress', (progress) => {
  const percentage = (progress.processedRecords / progress.totalRecords * 100).toFixed(1);
  console.log(`Progress: ${percentage}%`);
});
```

### Schema Validation

Define comprehensive validation rules:

```typescript
const userSchema = {
  id: { type: 'number', required: true, min: 1 },
  name: { type: 'string', required: true, minLength: 2 },
  email: { type: 'string', required: true, format: 'email' },
  age: { type: 'number', required: false, min: 18, max: 120 }
};

// Validate data
const validData = await exportSystem.process(data, { schema: userSchema });
```

## Performance Optimizations

### 1. Chunk Processing

Large datasets are automatically split into manageable chunks:

```typescript
// Automatic chunking based on memory limits
const result = await exportSystem.batchExport(largeData, 'csv', {
  chunkSize: 5000,
  memoryLimit: 1024 * 1024 * 100
});
```

### 2. Stream Processing

For very large datasets, consider streaming:

```typescript
// Process in batches to avoid memory issues
async function processLargeDataset(data: any[], chunkSize = 10000) {
  const results = [];

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const processed = await exportSystem.process(chunk, options);
    results.push(...processed);
  }

  return results;
}
```

### 3. Compression

Reduce file sizes with compression:

```typescript
const compressedResult = await exportSystem.export(data, 'json', {
  compression: 'gzip'
});
```

## Examples

See the `examples/` directory for comprehensive usage examples:

- `basic-usage.ts` - Basic export operations
- `advanced-usage.ts` - Advanced processing and scheduling

## Testing

Run the test suite:

```bash
npm test
```

Run with coverage:

```bash
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure tests pass with 80%+ coverage
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please use the GitHub issue tracker.

## Changelog

### v1.0.0
- Initial release
- Support for CSV, JSON, Parquet, Excel formats
- Batch processing with memory management
- Data filtering and transformation
- Schema validation
- Scheduled exports with cron support
- Comprehensive test suite
- TypeScript support