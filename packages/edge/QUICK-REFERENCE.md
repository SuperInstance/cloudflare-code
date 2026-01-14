# Storage System Quick Reference

## File Locations

### Core Implementation
- **HOT Tier:** `/packages/edge/src/do/session.ts` (800+ lines)
- **WARM Tier:** `/packages/edge/src/lib/kv.ts` (600+ lines)
- **COLD Tier:** `/packages/edge/src/lib/r2.ts` (700+ lines)
- **Storage Manager:** `/packages/edge/src/lib/storage.ts` (650+ lines)
- **Compression:** `/packages/edge/src/lib/compression.ts` (550+ lines)
- **Types:** `/packages/edge/src/types.ts` (250+ lines)

### Tests
- **KV Tests:** `/packages/edge/tests/kv.test.ts` (400+ lines)
- **R2 Tests:** `/packages/edge/tests/r2.test.ts` (450+ lines)
- **Storage Tests:** `/packages/edge/tests/storage.test.ts` (500+ lines)

### Configuration
- **wrangler.toml:** `/packages/edge/wrangler.toml`
- **package.json:** `/packages/edge/package.json`
- **tsconfig.json:** `/packages/edge/tsconfig.json`

### Documentation
- **Full README:** `/packages/edge/STORAGE-README.md`
- **Implementation Summary:** `/STORAGE-IMPLEMENTATION-SUMMARY.md`
- **Example Routes:** `/packages/edge/src/routes/storage-example.ts`

## Quick Commands

```bash
# Setup Cloudflare resources
wrangler kv:namespace create "KV_CACHE"
wrangler r2 bucket create "claudeflare-storage"

# Run tests
npm test

# Type check
npm run typecheck

# Deploy
npm run deploy

# Validate everything
./scripts/validate-storage.sh
```

## Quick Usage

### Initialize Storage
```typescript
import { StorageManager, KVCache, R2Storage } from '@claudeflare/edge';

const kvCache = new KVCache(env.KV_CACHE);
const r2Storage = new R2Storage(env.R2_STORAGE);
const storageManager = new StorageManager(env.SESSION_DO, kvCache, r2Storage);
```

### Store Data
```typescript
// Store in HOT tier
await storageManager.set(key, data, 'session', 'hot');

// Store in WARM tier
await storageManager.set(key, data, 'data', 'warm');

// Store in COLD tier
await storageManager.set(key, data, 'data', 'cold');
```

### Retrieve Data
```typescript
// Tries HOT -> WARM -> COLD automatically
const result = await storageManager.get(key, 'session');
```

### Migrate Data
```typescript
// Promote
await storageManager.promote(key, 'warm', 'hot', 'session');

// Demote
await storageManager.demote(key, 'hot', 'warm', 'session');

// Run automatic migration
await storageManager.runMigrationPolicy();
```

## Tier Selection Guide

| Use Case | Recommended Tier | Reason |
|----------|-----------------|---------|
| Active sessions | HOT | <1ms access |
| Recent prompts | HOT | Fast retrieval |
| Embeddings | WARM | 1-50ms, 1GB limit |
| User preferences | WARM | Fast, persistent |
| LLM cache | WARM | Quick lookups |
| Conversation history | COLD | 50-100ms, 10GB limit |
| Archives | COLD | Long-term storage |
| Logs | COLD | Low-cost retention |

## Compression Guide

```typescript
import { CompressionUtils } from '@claudeflare/edge';

// Session compression (3-5x)
const compressed = await CompressionUtils.compressSession(sessionData);

// Embedding int8 quantization (4x)
const int8 = CompressionUtils.compressEmbeddingInt8(embedding);

// Embedding binary quantization (32x)
const binary = CompressionUtils.compressEmbeddingBinary(embedding);

// Product quantization (8x)
const pq = new ProductQuantization(8, 256);
pq.train(embeddings);
const codes = pq.encode(embedding);
```

## Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Cache hit rate | 90%+ | Track in StorageManager |
| HOT latency | <1ms | Performance.now() |
| WARM latency | 1-50ms | KV timing |
| COLD latency | 50-100ms | R2 timing |
| Compression | 4x+ | Compare sizes |

## Common Patterns

### Cache LLM Responses
```typescript
const hash = await hashPrompt(prompt);
const cached = await kvCache.getCachedLLMResponse(hash);

if (cached) {
  return cached.response; // Cache hit!
}

const response = await callLLM(prompt);
await kvCache.cacheLLMResponse(hash, response, metadata);
return response;
```

### Archive Old Sessions
```typescript
// Get session
const session = await storageManager.get(sessionId, 'session');

// Archive to R2
await r2Storage.archiveSession(session);

// Remove from HOT
await storageManager.migrate(sessionId, 'hot', 'cold', 'session');
```

### Store Embeddings
```typescript
// Quantizes automatically (4x compression)
await kvCache.setEmbedding(docId, embedding, 30 * 24 * 60 * 60);

// Retrieves and de-quantizes
const retrieved = await kvCache.getEmbedding(docId);
```

## Troubleshooting

### High Memory Usage
```typescript
// Reduce HOT max age
const sm = new StorageManager(..., {
  hotMaxAge: 30 * 60 * 1000, // 30 min
});
```

### KV Full
```typescript
// Compress before storing
const compressed = await CompressionUtils.compressSession(data);
await kvCache.set(key, compressed);

// Or use R2
await r2Storage.put(key, data);
```

### Slow Performance
```typescript
// Lower promotion threshold
const sm = new StorageManager(..., {
  promotionThreshold: 3, // Promote faster
});
```

## Validation Checklist

- [ ] wrangler.toml has KV_CACHE binding
- [ ] wrangler.toml has SESSION_DO binding
- [ ] wrangler.toml has R2_STORAGE binding
- [ ] All tests pass: `npm test`
- [ ] Type check passes: `npm run typecheck`
- [ ] Build succeeds: `npm run build`
- [ ] Bundle size < 3MB
- [ ] Cloudflare resources created

## Support Links

- Full Documentation: `STORAGE-README.md`
- Implementation Details: `STORAGE-IMPLEMENTATION-SUMMARY.md`
- Example Routes: `src/routes/storage-example.ts`
- Validation: `scripts/validate-storage.sh`
