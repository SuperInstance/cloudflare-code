/**
 * Basic usage examples for @claudeflare/vector-search
 */

import { VectorSearch } from '../src/index.js';
import { SearchQuery } from '../src/types/index.js';

async function basicUsage() {
  // Initialize vector search
  const vectorSearch = new VectorSearch({
    dimension: 768, // Embedding dimension
    metric: 'cosine', // Distance metric
    indexType: 'hnsw', // Index type
    cacheEnabled: true,
    cacheSize: 1000,
  });

  await vectorSearch.initialize();

  // Example 1: Insert vectors
  console.log('Example 1: Inserting vectors');

  const vectors = [
    { id: 'doc1', vector: await vectorSearch.embed('Hello world') },
    { id: 'doc2', vector: await vectorSearch.embed('Goodbye world') },
    { id: 'doc3', vector: await vectorSearch.embed('Hello there') },
  ];

  await vectorSearch.insertBatch(
    vectors.map((v) => ({
      ...v,
      metadata: { text: v.id },
    }))
  );

  console.log(`Inserted ${vectors.length} vectors`);

  // Example 2: Basic search
  console.log('\nExample 2: Basic search');

  const query = await vectorSearch.embed('Hello');
  const results = await vectorSearch.search({
    vector: query,
    topK: 3,
  });

  console.log('Search results:');
  for (const result of results) {
    console.log(`  ${result.id}: score=${result.score.toFixed(4)}`);
  }

  // Example 3: Search with metadata filter
  console.log('\nExample 3: Search with filter');

  const filteredResults = await vectorSearch.search({
    vector: query,
    topK: 10,
    filter: {
      must: [
        {
          field: 'text',
          operator: 'equals',
          value: 'doc1',
        },
      ],
    },
  });

  console.log('Filtered results:', filteredResults);

  // Example 4: Delete vectors
  console.log('\nExample 4: Delete vectors');

  await vectorSearch.delete('doc1');
  console.log('Deleted doc1');

  // Example 5: Update vectors
  console.log('\nExample 5: Update vectors');

  const newVector = await vectorSearch.embed('Updated content');
  await vectorSearch.update({
    id: 'doc2',
    vector: newVector,
  });

  console.log('Updated doc2');

  // Example 6: Get statistics
  console.log('\nExample 6: Statistics');

  const stats = vectorSearch.getStats();
  console.log('Statistics:', stats);

  // Example 7: Cache management
  console.log('\nExample 7: Cache management');

  const cacheStats = vectorSearch.getCacheStats();
  console.log('Cache stats:', cacheStats);

  // Example 8: Optimize index
  console.log('\nExample 8: Optimize index');

  await vectorSearch.optimize();
  console.log('Index optimized');

  // Example 9: Health check
  console.log('\nExample 9: Health check');

  const health = await vectorSearch.getHealth();
  console.log('Health:', health);

  // Shutdown
  await vectorSearch.shutdown();
}

async function batchEmbeddingExample() {
  const vectorSearch = new VectorSearch({
    dimension: 768,
  });

  await vectorSearch.initialize();

  // Batch embed texts
  const texts = [
    'The quick brown fox jumps over the lazy dog',
    'Machine learning is a subset of artificial intelligence',
    'Vector databases enable efficient similarity search',
    'Cloudflare Workers provide serverless computing',
  ];

  console.log('Generating embeddings for', texts.length, 'texts...');

  const embeddings = await vectorSearch.embedBatch(texts);

  console.log(`Generated ${embeddings.length} embeddings`);
  console.log(`Each embedding has ${embeddings[0].length} dimensions`);

  // Insert with metadata
  const records = embeddings.map((embedding, i) => ({
    id: `text-${i}`,
    vector: embedding,
    metadata: {
      text: texts[i],
      length: texts[i].length,
    },
  }));

  await vectorSearch.insertBatch(records);

  console.log(`Inserted ${records.length} records`);

  await vectorSearch.shutdown();
}

async function advancedSearchExample() {
  const vectorSearch = new VectorSearch({
    dimension: 768,
    indexType: 'hnsw',
  });

  await vectorSearch.initialize();

  // Insert sample data
  const categories = ['technology', 'science', 'business', 'health'];

  for (const category of categories) {
    for (let i = 0; i < 10; i++) {
      const text = `${category} article ${i}`;
      const embedding = await vectorSearch.embed(text);

      await vectorSearch.insert({
        id: `${category}-${i}`,
        vector: embedding,
        metadata: {
          category,
          index: i,
          date: new Date().toISOString(),
        },
      });
    }
  }

  // Example 1: Range search
  console.log('\nExample 1: Search with category filter');

  const query = await vectorSearch.embed('technology news');
  const results = await vectorSearch.search({
    vector: query,
    topK: 5,
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

  console.log('Technology articles:');
  results.forEach((r) => console.log(`  ${r.id}: ${r.score.toFixed(4)}`));

  // Example 2: Multi-condition filter
  console.log('\nExample 2: Search with multiple filters');

  const multiFilterResults = await vectorSearch.search({
    vector: query,
    topK: 10,
    filter: {
      must: [
        {
          field: 'category',
          operator: 'in',
          value: ['technology', 'science'],
        },
      ],
      mustNot: [
        {
          field: 'index',
          operator: 'greater_than',
          value: 5,
        },
      ],
    },
  });

  console.log('Filtered results:');
  multiFilterResults.forEach((r) => console.log(`  ${r.id}`));

  await vectorSearch.shutdown();
}

async function performanceExample() {
  const vectorSearch = new VectorSearch({
    dimension: 768,
    indexType: 'hnsw',
    cacheEnabled: true,
  });

  await vectorSearch.initialize();

  // Insert 1000 vectors
  console.log('Inserting 1000 vectors...');

  const batchSize = 100;
  for (let i = 0; i < 1000; i += batchSize) {
    const records = [];

    for (let j = 0; j < batchSize && i + j < 1000; j++) {
      const vector = new Float32Array(768).fill(0).map(() => Math.random());

      records.push({
        id: `perf-${i + j}`,
        vector,
      });
    }

    await vectorSearch.insertBatch(records);
  }

  console.log('Insertion complete');

  // Measure search performance
  console.log('\nMeasuring search performance...');

  const queryVector = new Float32Array(768).fill(0).map(() => Math.random());
  const iterations = 100;

  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    await vectorSearch.search({
      vector: queryVector,
      topK: 10,
    });
  }

  const elapsed = Date.now() - startTime;
  const avgLatency = elapsed / iterations;

  console.log(`Search performance:`);
  console.log(`  Total time: ${elapsed}ms`);
  console.log(`  Average latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`  QPS: ${((iterations / elapsed) * 1000).toFixed(2)}`);

  await vectorSearch.shutdown();
}

// Run examples
async function main() {
  console.log('=== Basic Usage Example ===\n');
  await basicUsage();

  console.log('\n\n=== Batch Embedding Example ===\n');
  await batchEmbeddingExample();

  console.log('\n\n=== Advanced Search Example ===\n');
  await advancedSearchExample();

  console.log('\n\n=== Performance Example ===\n');
  await performanceExample();
}

main().catch(console.error);
