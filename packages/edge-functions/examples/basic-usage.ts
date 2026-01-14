/**
 * Basic Usage Example
 *
 * Demonstrates basic edge function creation, registration, and execution.
 */

import {
  FunctionRuntime,
  createEdgeFunction,
  createEdgeRequest,
  CacheLayer,
  createCacheLayer,
} from '../src/index';

// ============================================================================
// Create Runtime
// ============================================================================

const runtime = new FunctionRuntime({
  defaultTimeout: 30000,
  defaultMemoryLimit: 128,
  enableMetrics: true,
});

// ============================================================================
// Create Cache Layer
// ============================================================================

const cache = createCacheLayer({
  defaultTTL: 60,
  maxSize: 1000,
  enableMetrics: true,
});

// ============================================================================
// Define Edge Functions
// ============================================================================

// Simple greeting function
const greetFunction = createEdgeFunction(
  'greet',
  'Greeting Function',
  async (input: { name: string; title?: string }) => {
    const title = input.title || '';
    return `Hello, ${title} ${input.name}!`;
  },
  {
    timeout: 5000,
    cache: {
      enabled: true,
      ttl: 300, // 5 minutes
    },
  }
);

// Data transformation function
const transformFunction = createEdgeFunction(
  'transform',
  'Data Transform',
  async (input: { data: number[] }) => {
    return {
      sum: input.data.reduce((a, b) => a + b, 0),
      average: input.data.reduce((a, b) => a + b, 0) / input.data.length,
      count: input.data.length,
      min: Math.min(...input.data),
      max: Math.max(...input.data),
    };
  },
  {
    timeout: 10000,
    cache: {
      enabled: true,
      ttl: 600,
    },
  }
);

// API proxy function
const apiProxyFunction = createEdgeFunction(
  'api-proxy',
  'API Proxy',
  async (input: { url: string }) => {
    const response = await fetch(input.url, {
      headers: {
        'User-Agent': 'ClaudeFlare/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  },
  {
    timeout: 15000,
    cache: {
      enabled: true,
      ttl: 300,
      staleWhileRevalidate: 60,
    },
  }
);

// ============================================================================
// Register Functions
// ============================================================================

runtime.registerFunctions([greetFunction, transformFunction, apiProxyFunction]);

// ============================================================================
// Execute Functions
// ============================================================================

async function executeExample() {
  const context = {
    env: {
      KV: {},
      DURABLE: {},
      R2: {},
      DB: {},
      QUEUE: {},
    },
    waitUntil: (promise: Promise<any>) => promise,
  };

  // Example 1: Simple greeting
  console.log('=== Example 1: Simple Greeting ===');
  const greetRequest = createEdgeRequest('greet', {
    name: 'Alice',
    title: 'Dr.',
  });

  const greetResponse = await runtime.execute(greetRequest, context);
  console.log('Response:', greetResponse.data);
  console.log('Duration:', greetResponse.metrics.duration, 'ms');

  // Example 2: Data transformation
  console.log('\n=== Example 2: Data Transformation ===');
  const transformRequest = createEdgeRequest('transform', {
    data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  });

  const transformResponse = await runtime.execute(transformRequest, context);
  console.log('Response:', transformResponse.data);

  // Example 3: With caching
  console.log('\n=== Example 3: With Caching ===');
  const cacheKey = 'greet:{"name":"Bob"}';
  await cache.set('greet', { name: 'Bob' }, 'Cached Hello, Bob!');

  const cached = await cache.get('greet', { name: 'Bob' });
  console.log('Cached result:', cached);

  // Example 4: Check metrics
  console.log('\n=== Example 4: Metrics ===');
  const metrics = runtime.getMetrics('greet');
  if (metrics) {
    console.log('Total executions:', metrics.totalExecutions);
    console.log('Average time:', metrics.avgExecutionTime.toFixed(2), 'ms');
    console.log('P95 time:', metrics.p95ExecutionTime.toFixed(2), 'ms');
  }

  // Example 5: Cache statistics
  console.log('\n=== Example 5: Cache Statistics ===');
  const cacheStats = cache.getStats('greet');
  if (cacheStats) {
    console.log('Cache hits:', cacheStats.hits);
    console.log('Cache misses:', cacheStats.misses);
    console.log('Hit rate:', (cacheStats.hitRate * 100).toFixed(2) + '%');
  }
}

// ============================================================================
// Run Example
// ============================================================================

executeExample().catch(console.error);
