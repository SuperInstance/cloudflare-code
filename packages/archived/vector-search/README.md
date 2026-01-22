# @claudeflare/vector-search

Advanced vector search and retrieval for the ClaudeFlare distributed AI platform.

## Features

- **High-Performance Indexing**
  - HNSW (Hierarchical Navigable Small World) for sub-10ms search
  - IVF (Inverted File Index) for large-scale datasets
  - Product Quantization (PQ) for compression
  - Scalar and Binary quantization

- **Advanced Search Capabilities**
  - KNN search with configurable top-K
  - Range search
  - Hybrid search (vector + keyword)
  - Faceted search
  - Re-ranking strategies

- **Multi-Database Support**
  - Cloudflare Vectorize
  - Pinecone
  - Weaviate
  - Qdrant
  - Milvus
  - In-memory fallback

- **Real-Time Indexing**
  - Incremental updates
  - Bulk indexing with progress tracking
  - Index optimization
  - Replication support

- **Query Optimization**
  - Automatic query planning
  - Result caching
  - Prefetching
  - Performance monitoring

## Installation

```bash
npm install @claudeflare/vector-search
```

## Quick Start

```typescript
import { VectorSearch } from '@claudeflare/vector-search';

// Initialize
const vectorSearch = new VectorSearch({
  dimension: 768,
  metric: 'cosine',
  indexType: 'hnsw',
});

await vectorSearch.initialize();

// Insert vectors
await vectorSearch.insert({
  id: 'doc1',
  vector: embedding,
  metadata: { text: 'Hello world' },
});

// Search
const results = await vectorSearch.search({
  vector: queryEmbedding,
  topK: 10,
});

// Shutdown
await vectorSearch.shutdown();
```

## Configuration

```typescript
interface VectorSearchConfig {
  dimension: number;           // Embedding dimension
  metric?: DistanceMetric;     // Distance metric (cosine, euclidean, etc.)
  indexType?: IndexType;       // Index type (hnsw, ivf, etc.)
  cacheEnabled?: boolean;      // Enable result caching
  cacheSize?: number;          // Cache size
}
```

## Index Types

### HNSW (Hierarchical Navigable Small World)

Best for high-performance approximate search:

```typescript
const vectorSearch = new VectorSearch({
  dimension: 768,
  indexType: 'hnsw',
  indexConfig: {
    M: 16,              // Max connections per node
    efConstruction: 200, // Construction parameter
    efSearch: 50,       // Search parameter
  },
});
```

### IVF (Inverted File Index)

Best for large-scale datasets:

```typescript
const vectorSearch = new VectorSearch({
  dimension: 768,
  indexType: 'ivf',
  indexConfig: {
    nlist: 100,    // Number of clusters
    nprobe: 10,    // Clusters to search
  },
});

// Train with sample data first
await vectorSearch.train(sampleVectors);
```

## Search Options

### Basic Search

```typescript
const results = await vectorSearch.search({
  vector: queryEmbedding,
  topK: 10,
});
```

### Search with Metadata Filter

```typescript
const results = await vectorSearch.search({
  vector: queryEmbedding,
  topK: 10,
  filter: {
    must: [
      {
        field: 'category',
        operator: 'equals',
        value: 'technology',
      },
    ],
  },
});
```

### Hybrid Search

```typescript
import { SearchEngine } from '@claudeflare/vector-search';

const searchEngine = new SearchEngine(vectorIndex);

const results = await searchEngine.hybridSearch({
  vector: queryEmbedding,
  query: 'search query text',
  topK: 10,
  vectorWeight: 0.7,
  keywordWeight: 0.3,
});
```

## Embeddings

### Single Text

```typescript
const embedding = await vectorSearch.embed('Hello world');
// Returns Float32Array of dimension 768
```

### Batch Texts

```typescript
const embeddings = await vectorSearch.embedBatch([
  'Hello world',
  'Goodbye world',
  'How are you?',
]);
```

### Custom Embedding Model

```typescript
import { EmbeddingManager } from '@claudeflare/vector-search';

const embeddingManager = new EmbeddingManager({
  name: 'custom-model',
  dimension: 768,
  modelType: 'text',
});

const embedding = await embeddingManager.embed('text');
```

## Real-Time Indexing

```typescript
import { RealtimeIndexer } from '@claudeflare/vector-search';

const indexer = new RealtimeIndexer(vectorIndex, {
  queueSize: 10000,
  batchSize: 100,
  flushInterval: 1000,
});

// Enable replication
indexer.enableReplication(3);

// Bulk index with progress
await indexer.bulkIndex(records, {
  batchSize: 1000,
  progressCallback: (progress) => {
    console.log(`Progress: ${progress.percentage}%`);
  },
});
```

## Query Optimization

```typescript
import { QueryOptimizer } from '@claudeflare/vector-search';

const optimizer = new QueryOptimizer(vectorIndex, {
  cacheEnabled: true,
  prefetchEnabled: true,
});

// Optimize and execute
const { results, metrics, plan } = await optimizer.search(query);

// Get statistics
const stats = optimizer.getQueryStats();
console.log(`Average latency: ${stats.avgLatency}ms`);
console.log(`Cache hit rate: ${stats.cacheHitRate}`);
```

## Database Integration

### Cloudflare Vectorize

```typescript
const vectorSearch = new VectorSearch({
  dimension: 768,
  databaseConfig: {
    type: 'cloudflare-vectorize',
    cloudflareAccountId: 'your-account-id',
    apiKey: 'your-api-key',
    namespace: 'my-vectors',
  },
});
```

### Pinecone

```typescript
const vectorSearch = new VectorSearch({
  dimension: 768,
  databaseConfig: {
    type: 'pinecone',
    apiKey: 'your-api-key',
    environment: 'us-east1-gcp',
    indexName: 'my-index',
  },
});
```

## Performance

- **Indexing**: >10,000 vectors/second
- **Search**: <10ms p95 latency
- **Throughput**: >1000 QPS
- **Scalability**: Supports 1M+ vectors
- **Recall**: >90% for HNSW

## API Reference

### VectorSearch

Main class for vector search operations.

#### Methods

- `initialize()`: Initialize the vector search system
- `insert(record)`: Insert a single vector
- `insertBatch(records)`: Insert multiple vectors
- `delete(id)`: Delete a vector
- `update(record)`: Update a vector
- `search(query)`: Search for similar vectors
- `embed(text)`: Generate embedding for text
- `embedBatch(texts)`: Generate embeddings for multiple texts
- `getStats()`: Get index statistics
- `optimize()`: Optimize the index
- `shutdown()`: Shutdown the system

### SearchQuery

```typescript
interface SearchQuery {
  vector: Float32Array;
  topK?: number;
  filter?: VectorFilter;
  namespace?: string;
  includeMetadata?: boolean;
}
```

### VectorFilter

```typescript
interface VectorFilter {
  must?: MetadataFilter[];
  mustNot?: MetadataFilter[];
  should?: MetadataFilter[];
}

interface MetadataFilter {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | string[] | number[];
}
```

## Examples

See the `examples/` directory for more usage examples:

- `basic-usage.ts`: Basic operations
- `advanced-search.ts`: Advanced search techniques
- `real-time-indexing.ts`: Real-time indexing
- `database-integration.ts`: Database integration

## Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance

# Run with coverage
npm run test:coverage
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
