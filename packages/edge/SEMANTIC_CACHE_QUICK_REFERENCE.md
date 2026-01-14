# Semantic Cache Quick Reference

## Installation

No additional dependencies required. Uses existing:
- `@cloudflare/workers-types` (already installed)
- Cloudflare Workers AI binding
- Existing KV/R2 storage

## Quick Start

### 1. Configure wrangler.toml

```toml
[[kv_namespaces]]
binding = "KV_CACHE"
id = "your-kv-namespace-id"

[ai]
binding = "AI"
```

### 2. Initialize Cache

```typescript
import { SemanticCache } from './lib/cache/semantic';
import { KVCache } from './lib/kv';

const cache = new SemanticCache({
  similarityThreshold: 0.90,
  kvCache: new KVCache(env.KV_CACHE),
  ai: env.AI,
});
```

### 3. Use Cache

```typescript
// Check cache
const result = await cache.check('What is TypeScript?', {
  model: 'claude-3-haiku',
});

if (result.hit) {
  return result.response; // <1ms!
}

// Generate response
const response = await callProvider(request);

// Store in cache
await cache.store('What is TypeScript?', response, {
  model: 'claude-3-haiku',
});
```

## Common Patterns

### Pattern 1: Basic Caching

```typescript
const result = await cache.check(prompt, metadata);
if (result.hit) return result.response;

const response = await generateResponse(prompt);
await cache.store(prompt, response, metadata);
return response;
```

### Pattern 2: With Request Router

```typescript
import { CacheAwareRequestHandler } from './lib/cache/integration';

const handler = new CacheAwareRequestHandler({
  kvCache: new KVCache(env.KV_CACHE),
  ai: env.AI,
});

const result = await handler.handleRequest(
  chatRequest,
  async (req) => await callProvider(req)
);
```

### Pattern 3: Monitor Statistics

```typescript
const stats = cache.getStats();

console.log(`Hit rate: ${stats.hitRate.toFixed(1)}%`);
console.log(`Latency: ${stats.avgLatency.toFixed(2)}ms`);
console.log(`Saved: ${stats.metrics.tokensSaved} tokens`);
console.log(`Savings: $${stats.metrics.costSaved.toFixed(2)}`);
```

## Configuration Options

### Similarity Threshold

```typescript
// High precision (code generation)
new SemanticCache({ similarityThreshold: 0.92 });

// Balanced (default)
new SemanticCache({ similarityThreshold: 0.90 });

// More flexible (explanations)
new SemanticCache({ similarityThreshold: 0.85 });
```

### Cache Size

```typescript
// Small (1,000 entries)
new SemanticCache({ maxHotEntries: 1000 });

// Medium (default)
new SemanticCache({ maxHotEntries: 10000 });

// Large (50,000 entries)
new SemanticCache({ maxHotEntries: 50000 });
```

### TTL

```typescript
// 1 day
new SemanticCache({ ttl: 86400 });

// 7 days (default)
new SemanticCache({ ttl: 604800 });

// 30 days
new SemanticCache({ ttl: 2592000 });
```

## Performance Targets

| Operation | Target | Usage |
|-----------|--------|-------|
| **HOT Cache Hit** | <1ms | Frequent queries |
| **WARM Cache Hit** | 1-50ms | Less frequent queries |
| **Cache Miss** | 50-100ms | New queries |
| **Hit Rate** | 45-80% | Overall system |

## Troubleshooting

### Low Hit Rate

```typescript
// Check statistics
const stats = cache.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);

// Try lowering threshold
cache = new SemanticCache({ similarityThreshold: 0.85 });
```

### High Memory

```typescript
// Reduce cache size
cache = new SemanticCache({ maxHotEntries: 5000 });

// Check memory usage
const stats = cache.getStats();
console.log(`HOT cache: ${stats.hotCacheSize} entries`);
```

### Slow Embeddings

```typescript
// Check if Workers AI is configured
if (!env.AI) {
  console.warn('Workers AI not configured');
  // Add OpenAI fallback
  cache = new SemanticCache({
    embeddingService: new EmbeddingService({
      fallbackApiKey: env.OPENAI_API_KEY,
    }),
  });
}
```

## Testing

```bash
# Run tests
npm test -- semantic-cache.test

# Run benchmarks
npm test -- semantic-cache.bench

# Watch mode
npm run test:watch
```

## Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/lib/embeddings.ts` | Embedding generation | 403 |
| `src/lib/hnsw.ts` | Vector search index | 578 |
| `src/lib/cache/semantic.ts` | Main cache implementation | 607 |
| `src/lib/cache/integration.ts` | Integration helpers | 401 |
| `tests/semantic-cache.test.ts` | Unit tests | 536 |
| `tests/semantic-cache.bench.ts` | Benchmarks | 442 |

## Key Classes

### EmbeddingService

```typescript
class EmbeddingService {
  generate(text: string): Promise<Float32Array>
  quantize(embedding: Float32Array): QuantizationResult
  dequantize(quantized: Int8Array, ...): Float32Array
  similarity(a: Float32Array, b: Float32Array): number
}
```

### HNSWIndex

```typescript
class HNSWIndex {
  add(vector: Float32Array, id: string): void
  search(query: Float32Array, k: number): SearchResult[]
  remove(id: string): boolean
  getStats(): IndexStats
}
```

### SemanticCache

```typescript
class SemanticCache {
  check(prompt: string, metadata: CacheMetadata): Promise<SemanticCacheResult>
  store(prompt: string, response: ChatResponse, metadata: CacheMetadata): Promise<void>
  getStats(): CacheStats
  clear(): Promise<void>
}
```

## Metrics

### Tracked Metrics

- Total queries
- HOT/WARM/COLD hits
- Cache misses
- Average latency
- Tokens saved
- Cost saved

### Access Metrics

```typescript
const stats = cache.getStats();

console.log({
  totalQueries: stats.metrics.totalQueries,
  hitRate: stats.hitRate,
  avgLatency: stats.avgLatency,
  tokensSaved: stats.metrics.tokensSaved,
  costSaved: stats.metrics.costSaved,
});
```

## Best Practices

1. **Always include context metadata**
   ```typescript
   await cache.store(prompt, response, {
     model: 'claude-3-haiku',
     temperature: 0.7,
     language: 'typescript',
   });
   ```

2. **Monitor hit rate regularly**
   ```typescript
   setInterval(() => {
     const stats = cache.getStats();
     if (stats.hitRate < 40) {
       console.warn('Low hit rate!');
     }
   }, 60000);
   ```

3. **Use appropriate thresholds**
   - Code generation: 0.92 (high precision)
   - Documentation: 0.85 (more flexible)
   - General: 0.90 (balanced)

4. **Warm cache with common queries**
   ```typescript
   const commonQueries = ['What is X?', 'How do I Y?'];
   for (const q of commonQueries) {
     await cache.store(q, await generateResponse(q));
   }
   ```

## Support

- Documentation: `/packages/edge/src/lib/cache/README.md`
- Tests: `/packages/edge/tests/semantic-cache.test.ts`
- Benchmarks: `/packages/edge/tests/semantic-cache.bench.ts`
- Examples: `/packages/edge/src/lib/cache/integration.ts`

## Status

✅ Implementation complete
✅ Tests passing
✅ Benchmarks validated
✅ Documentation complete
✅ Ready for production
