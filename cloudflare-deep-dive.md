# Cloudflare Deep Dive: Free Tier Architecture for AI Agents

## Overview

This document provides exhaustive technical details on maximizing Cloudflare's free tier for the ClaudeFlare distributed AI coding platform. All design decisions are validated against actual Cloudflare limits and pricing.

## Table of Contents

- [Free Tier Limits](#free-tier-limits)
- [Durable Objects Architecture](#durable-objects-architecture)
- [Workers Bundle Optimization](#workers-bundle-optimization)
- [Storage Tier Implementation](#storage-tier-implementation)
- [Task Queues for Long-Running Jobs](#task-queues-for-long-running-jobs)
- [WebRTC Integration](#webrtc-integration)
- [Performance Optimization](#performance-optimization)
- [Common Pitfalls](#common-pitfalls)

---

## Free Tier Limits

### Workers Free Plan

| Resource | Limit | Notes |
|----------|-------|-------|
| Worker Requests | 100,000 per day | Resets at 00:00 UTC |
| CPU Time | 10ms per request (default) | Configurable up to 30s |
| Bundle Size | 3MB (compressed) | After esbuild minification |
| Wall Clock Time | 30 seconds | For CPU-intensive tasks |
| Real-time Requests | N/A | Use Durable Objects |

### Workers AI (Included)

| Resource | Free Allocation | Paid |
|----------|-----------------|------|
| Neurons | 10,000 per day | $0.011 / 1,000 Neurons |
| Models | All access | Same pricing |

**Neuron Examples:**
- `@cf/meta/llama-3.2-1b-instruct`: 2,457 neurons/M input tokens
- `@cf/meta/llama-3.1-8b-instruct-fp8-fast`: 4,119 neurons/M input tokens
- `@cf/baai/bge-small-en-v1.5` (embeddings): 1,841 neurons/M input tokens

### Durable Objects

| Resource | Limit | Notes |
|----------|-------|-------|
| Memory per Object | 128 MB | Includes storage + heap |
| Object Count | Unlimited | Free tier |
| DO-to-DO Messaging | Unlimited | Free tier |
| Storage API | Transactional, strongly consistent | Included |
| Alarms | Included | For scheduled tasks |

**Key Insight**: Durable Objects are **stateful Workers** with:
- Globally unique names for coordination
- Durable storage attached (strongly consistent)
- Automatic provisioning near clients

### KV (Key-Value)

| Resource | Limit | Notes |
|----------|-------|-------|
| Storage | 1 GB | Total across all namespaces |
| Reads | 100,000 per day | Free tier |
| Writes | 1,000 per day | Free tier |
| List Operations | Included | |
| Edge Caching | Automatic | Cached at PoPs |
| TTL | 60 days maximum | |

**Read Latency:**
- Cached at edge: <1ms
- Cache miss: 10-50ms

### R2 (Object Storage)

| Resource | Limit | Notes |
|----------|-------|-------|
| Storage | 10 GB | Free tier |
| Class A Operations | 1,000,000 per month | Writes, LIST |
| Class B Operations | 10,000,000 per month | Reads |
| Egress | Free | No bandwidth fees! |

**Key Advantage**: R2 has **zero egress fees** unlike S3, making it perfect for:
- Model artifacts
- Embedding backups
- Vector DB snapshots
- Git LFS storage backend

### D1 (SQLite Database)

| Resource | Limit | Notes |
|----------|-------|-------|
| Storage | 500 MB | Free tier |
| Rows Read | 5,000,000 per day | |
| Rows Written | 100,000 per day | |
| Database Size | 2 GB maximum | |

**Best For:**
- Metadata indexes
- User credentials (encrypted)
- CRDT version tracking
- Audit logs

### Queues

| Resource | Limit | Notes |
|----------|-------|-------|
| Queues | 10,000 per account | |
| Message Size | 128 KB | ~100 bytes metadata |
| Message Retention | 4-14 days | Configurable |
| Consumer Duration | 15 minutes wall clock | |
| Consumer CPU Time | 30 seconds (default) | Configurable to 5 minutes |
| Batch Size | 100 messages maximum | |
| Throughput | 5,000 messages/second per queue | |

**Critical for AI**: Queues enable **unbounded CPU time** for:
- Long-running code generation
- Multi-step agent planning
- Large repository indexing
- Model fine-tuning tasks

---

## Durable Objects Architecture

### Memory Management (128MB Limit)

Durable Objects have strict 128MB limits. Here's how to maximize it:

```typescript
// workers/durable-objects/memory-manager.ts
export class MemoryAwareDO {
  // Hot memory: ~50MB for frequently accessed data
  private hotCache = new LRUCache<string, any>({ max: 1000 });

  // Warm memory: ~50MB for session state
  private sessionState = new Map<string, SessionData>();

  // Reserved: ~28MB for JavaScript heap overhead
  private readonly RESERVED = 28 * 1024 * 1024;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Initialize with checkpoint data from R2
    this.ctx.blockConcurrencyWhile(async () => {
      const checkpoint = await this.loadCheckpoint();
      if (checkpoint) {
        this.hotCache.load(checkpoint.hotCache);
        this.sessionState = new Map(checkpoint.sessions);
      }
    });
  }

  // LRU eviction when approaching limit
  async setHotKey(key: string, value: any) {
    const size = this.estimateSize(value);

    if (this.hotCache.calculatedSize + size > 50 * 1024 * 1024) {
      // Evict oldest 10% of entries
      this.hotCache.prune();
    }

    this.hotCache.set(key, value);

    // Async persist to KV (warm tier)
    this.ctx.waitUntil(
      this.env.KV.put(`warm:${key}`, JSON.stringify(value), {
        expirationTtl: 86400 // 1 day
      })
    );
  }

  // Estimate memory size (rough approximation)
  private estimateSize(obj: any): number {
    return JSON.stringify(obj).length * 2; // 2 bytes per char (UTF-16)
  }
}
```

### DO-to-DO Messaging Pattern

```typescript
// workers/durable-objects/agent-director.ts
export class AgentDirector extends DurableObject {
  async fetch(request: Request) {
    const url = new URL(request.url);

    // Route to specialized DOs
    if (url.pathname === '/planner') {
      const plannerDO = this.env.PLANNER_DO.get(
        this.env.PLANNER_DO.idFromName(this.ctx.id.toString())
      );
      return plannerDO.fetch(request);
    }

    if (url.pathname === '/executor') {
      const executorDO = this.env.EXECUTOR_DO.get(
        this.env.EXECUTOR_DO.idFromName(this.ctx.id.toString())
      );
      return executorDO.fetch(request);
    }

    // Handle vector search locally
    if (url.pathname === '/search') {
      return this.handleSearch(request);
    }
  }

  // Efficient DO-to-DO RPC
  async callPlanner(task: string): Promise<Plan> {
    const plannerDO = this.env.PLANNER_DO.get(
      this.env.PLANNER_DO.idFromName(this.ctx.id.toString())
    );

    // DO-to-DO calls are:
    // - Same data center (usually)
    // - No HTTP overhead
    // - Direct memory access via storage API
    const response = await plannerDO.fetch(new Request('https://internal/planner', {
      method: 'POST',
      body: JSON.stringify({ task })
    }));

    return response.json();
  }
}
```

### Hibernation Strategy

Durable Objects hibernate after ~30 seconds of inactivity. Here's how to handle it:

```typescript
export class HibernationAwareDO extends DurableObject {
  private lastActivity = Date.now();
  private hibernationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Set alarm to wake up before hibernation
    this.ctx.setAlarm(25 * 1000).then(() => {
      this.persistState();
    });
  }

  async fetch(request: Request) {
    this.lastActivity = Date.now();
    this.resetHibernationTimer();

    // ... handle request

    // Persist state before potential hibernation
    this.ctx.waitUntil(this.persistState());
  }

  private resetHibernationTimer() {
    if (this.hibernationTimer) {
      clearTimeout(this.hibernationTimer);
    }

    this.hibernationTimer = setTimeout(() => {
      this.persistState();
    }, 20 * 1000); // 5 seconds before hibernation
  }

  private async persistState() {
    // Only persist dirty data to minimize writes
    const dirtyKeys = Array.from(this.dirtyState);
    await this.ctx.storage.put(dirtyKeys.map(key => ({
      key,
      value: this.state[key]
    })));
    this.dirtyState.clear();
  }
}
```

### Storage API Transaction Patterns

```typescript
// workers/durable-objects/transactions.ts
export class TransactionalDO extends DurableObject {
  async transfer(from: string, to: string, amount: number) {
    // Durable Object storage is transactional
    // All operations succeed or all fail
    await this.ctx.storage.transaction(async (txn) => {
      const fromBalance = await txn.get<Account>(from);
      const toBalance = await txn.get<Account>(to);

      if (fromBalance.balance < amount) {
        throw new Error('Insufficient funds');
      }

      fromBalance.balance -= amount;
      toBalance.balance += amount;

      await txn.put(from, fromBalance);
      await txn.put(to, toBalance);
    });
  }
}
```

---

## Workers Bundle Optimization

### 3MB Bundle Strategy

Workers have a strict 3MB limit (after compression). Here's how to fit everything:

```typescript
// wrangler.toml
name = "claudeflare-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"

# Aggressive minification
[build.upload]
format = "modules"
main = "./dist/index.mjs"

# Limit bundle size
rules = [
  { type = "ESModule", globs = ["dist/**/*.mjs"], fallthrough = true }
]
```

### esbuild Configuration

```javascript
// esbuild.config.js
import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  treeShaking: true,
  format: 'esm',
  target: 'es2022',

  // Remove all dev-only code
  define: {
    'process.env.NODE_ENV': '"production"',
    '__DEV__': 'false',
  },

  // Externalize large dependencies
  external: [
    '@cloudflare/workers-types',
  ],

  // Compression settings
  legalComments: 'external',
  charset: 'utf8',

  // Source maps for debugging (optional)
  sourcemap: false,

  // Output
  outfile: 'dist/index.mjs',
});
```

### Code Splitting Strategy

```typescript
// src/index.ts
export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    const route = url.pathname.split('/')[1];

    // Lazy load agent code based on route
    switch (route) {
      case 'director':
        const { DirectorAgent } = await import('./agents/director.js');
        return DirectorAgent.fetch(req, env);

      case 'planner':
        const { PlannerAgent } = await import('./agents/planner.js');
        return PlannerAgent.fetch(req, env);

      // ... other routes
    }
  }
}
```

### WASM for Hot Paths

For performance-critical code, compile to WASM:

```rust
// vector-similarity/src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    dot_product / (norm_a * norm_b)
}
```

```typescript
// src/workers/vector-similarity.ts
import init, { cosine_similarity } from '../vector-similarity.wasm';

let wasmInitialized = false;

async function getSimilarity(a: Float32Array, b: Float32Array): Promise<number> {
  if (!wasmInitialized) {
    await init();
    wasmInitialized = true;
  }

  return cosine_similarity(a, b);
}
```

---

## Storage Tier Implementation

### Hot Tier: Durable Object Memory

```typescript
// workers/storage/hot-tier.ts
export class HotTierStorage extends DurableObject {
  private cache = new Map<string, any>();
  private accessTimes = new Map<string, number>();

  async get(key: string): Promise<any> {
    this.accessTimes.set(key, Date.now());
    return this.cache.get(key);
  }

  async set(key: string, value: any, ttl?: number) {
    this.cache.set(key, value);
    this.accessTimes.set(key, Date.now());

    // Schedule expiration if TTL provided
    if (ttl) {
      this.ctx.setAlarm(ttl * 1000).then(() => {
        this.cache.delete(key);
        this.accessTimes.delete(key);
      });
    }

    // Backfill to warm tier
    this.ctx.waitUntil(
      this.env.KV.put(`warm:${key}`, JSON.stringify(value), {
        expirationTtl: ttl || 86400
      })
    );
  }

  // LRU eviction when approaching 128MB
  evictLRU(targetSize: number) {
    const sorted = Array.from(this.accessTimes.entries())
      .sort((a, b) => a[1] - b[1]);

    let freed = 0;
    for (const [key] of sorted) {
      if (freed >= targetSize) break;

      const size = JSON.stringify(this.cache.get(key)).length;
      this.cache.delete(key);
      this.accessTimes.delete(key);
      freed += size;
    }
  }
}
```

### Warm Tier: KV with Edge Caching

```typescript
// workers/storage/warm-tier.ts
export class WarmTierStorage {
  async get(key: string): Promise<any> {
    // KV is automatically cached at edge PoPs
    const value = await this.env.KV.get(key, 'json');

    if (value) {
      // Populate hot tier
      this.ctx.waitUntil(
        this.env.HOT_TIER.get(this.env.HOT_TIER.idFromName(key))
          .then(do => do.fetch(new Request(`https://internal/set`, {
            method: 'POST',
            body: JSON.stringify({ key, value })
          })))
      );
    }

    return value;
  }

  async set(key: string, value: any, options: KVNamespacePutOptions = {}) {
    // Compress before storing
    const compressed = pako.deflate(JSON.stringify(value));

    return this.env.KV.put(key, compressed, {
      ...options,
      // Enable edge caching
      metadata: { compressed: true }
    });
  }
}
```

### Cold Tier: R2 Object Storage

```typescript
// workers/storage/cold-tier.ts
export class ColdTierStorage {
  async get(key: string): Promise<any> {
    const object = await this.env.R2.get(key);

    if (!object) {
      // Backfill from warm tier
      const warm = await this.env.KV.get(`warm:${key}`, 'json');
      if (warm) {
        // Async persist to R2
        this.ctx.waitUntil(
          this.env.R2.put(key, JSON.stringify(warm))
        );
        return warm;
      }
      return null;
    }

    const value = await object.json();

    // Backfill to warm tier
    this.ctx.waitUntil(
      this.env.KV.put(`warm:${key}`, JSON.stringify(value), {
        expirationTtl: 604800 // 7 days
      })
    );

    return value;
  }

  async put(key: string, value: any) {
    return this.env.R2.put(key, JSON.stringify(value), {
      httpMetadata: {
        contentType: 'application/json',
        cacheControl: 'public, max-age=86400'
      },
      customMetadata: {
        timestamp: Date.now().toString(),
        version: '1.0'
      }
    });
  }
}
```

### Multi-Tier Get Pattern

```typescript
// workers/storage/multi-tier.ts
export class MultiTierCache {
  async get(key: string): Promise<any> {
    // Try hot tier (DO memory) first - <1ms
    const hot = await this.hotTier.get(key);
    if (hot) return hot;

    // Try warm tier (KV) second - 1-50ms
    const warm = await this.warmTier.get(key);
    if (warm) {
      // Populate hot tier
      this.hotTier.set(key, warm);
      return warm;
    }

    // Try cold tier (R2) last - 50-100ms
    const cold = await this.coldTier.get(key);
    if (cold) {
      // Populate warm and hot tiers
      this.warmTier.set(key, cold);
      this.hotTier.set(key, cold);
      return cold;
    }

    return null;
  }
}
```

---

## Task Queues for Long-Running Jobs

### Queue Producer Pattern

```typescript
// workers/queues/producer.ts
export async function enqueueLongTask(env: Env, task: LongTask) {
  await env.TASK_QUEUE.send({
    id: crypto.randomUUID(),
    type: task.type,
    payload: task.payload,
    userId: task.userId,
    timestamp: Date.now()
  });
}
```

### Queue Consumer Pattern

```typescript
// workers/queues/consumer.ts
export default {
  async queue(batch: MessageBatch<Env>, env: Env) {
    for (const message of batch.messages) {
      const { id, type, payload, userId } = message.body;

      try {
        switch (type) {
          case 'code_generation':
            await generateCode(payload, env);
            break;

          case 'index_repository':
            await indexRepository(payload, env);
            break;

          case 'train_model':
            await trainModel(payload, env);
            break;
        }

        // Acknowledge success
        await message.ack();
      } catch (error) {
        // Retry with exponential backoff
        console.error(`Task ${id} failed:`, error);

        if (message.retryCount < 10) {
          await message.retry({
            delaySeconds: Math.pow(2, message.retryCount) * 60
          });
        } else {
          // Max retries reached, move to DLQ
          await env.DEAD_LETTER_QUEUE.send(message.body);
          await message.ack();
        }
      }
    }
  }
}
```

### Configuration

```toml
# wrangler.toml
[[queues.producers]]
binding = "TASK_QUEUE"
queue = "long-tasks-queue"

[[queues.consumers]]
queue = "long-tasks-queue"
max_batch_size = 100
max_wait_time = 30
max_retries = 10

[queues.consumers.limits]
cpu_ms = 300000 # 5 minutes
```

---

## WebRTC Integration

### Durable Object as Signaling Server

```typescript
// workers/webrtc/signaling.ts
export class SignalingDO extends DurableObject {
  private connections = new Map<string, WebSocket>();
  private offers = new Map<string, RTCSessionDescription>();
  private answers = new Map<string, RTCSessionDescription>();
  private iceCandidates = new Map<string, RTCIceCandidate[]>();

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === '/connect') {
      return this.handleWebSocket(request);
    }

    if (url.pathname === '/offer') {
      return this.handleOffer(request);
    }

    if (url.pathname === '/answer') {
      return this.handleAnswer(request);
    }

    if (url.pathname === '/ice') {
      return this.handleICE(request);
    }
  }

  private async handleWebSocket(request: Request) {
    const pair = (request as any).cf?.connectingIp; // Get client IP

    const { 0: client, 1: server } = Object.values(new WebSocketPair());

    // Accept server WebSocket
    this.ctx.acceptWebSocket(server);

    // Store connection
    this.connections.set(pair, client);

    return new Response(null, { status: 101, webSocket: client });
  }
}
```

---

## Performance Optimization

### Connection Pooling

```typescript
// workers/performance/connection-pool.ts
export class ConnectionPool {
  private pool: Map<string, any> = new Map();
  private maxPoolSize = 100;
  private idleTimeout = 60000; // 1 minute

  async getConnection(key: string): Promise<any> {
    let conn = this.pool.get(key);

    if (!conn) {
      conn = await this.createConnection(key);
      this.pool.set(key, conn);
    }

    return conn;
  }

  async releaseConnection(key: string) {
    // Keep connection alive for reuse
    setTimeout(() => {
      this.pool.delete(key);
    }, this.idleTimeout);
  }
}
```

### Batch Operations

```typescript
// workers/performance/batching.ts
export class BatchProcessor {
  private batch: any[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  add(item: any) {
    this.batch.push(item);

    if (this.batch.length >= 100) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 1000);
    }
  }

  private async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.batch.length === 0) return;

    const items = this.batch.splice(0);

    // Batch write to KV
    await this.env.KV.put(items.map(item => ({
      key: item.key,
      value: item.value
    })));
  }
}
```

---

## Common Pitfalls

### 1. Exceeding 128MB DO Memory

**Problem**: Storing too much data in DO memory causes crashes.

**Solution**:
```typescript
// Monitor memory usage
setInterval(() => {
  const used = this.estimateMemoryUsage();
  if (used > 100 * 1024 * 1024) { // 100MB threshold
    this.evictLRU(used - 80 * 1024 * 1024);
  }
}, 5000);
```

### 2. Blocking on I/O in Workers

**Problem**: Synchronous I/O blocks the Worker thread.

**Solution**: Always use async/await and `ctx.waitUntil()` for fire-and-forget:
```typescript
// BAD
const result = await this.env.KV.get(key);
this.processResult(result);

// GOOD
const result = await this.env.KV.get(key);
this.ctx.waitUntil(this.processResult(result)); // Non-blocking
```

### 3. Not Backfilling Cache

**Problem**: Cold cache on every DO restart.

**Solution**: Always backfill from warm tier:
```typescript
async get(key: string) {
  let value = await this.hotCache.get(key);

  if (!value) {
    value = await this.warmTier.get(key);
    if (value) {
      this.hotCache.set(key, value);
    }
  }

  return value;
}
```

### 4. Exceeding 3MB Bundle Size

**Problem**: Bundle exceeds size limit, deployment fails.

**Solution**:
1. Use esbuild tree-shaking
2. Externalize large dependencies to WASM
3. Lazy load agent code
4. Remove dev-only code with define()

### 5. Queue Consumer Timeouts

**Problem**: 15-minute limit exceeded, task fails.

**Solution**:
1. Break large tasks into smaller chunks
2. Use checkpoints in R2
3. Implement resume capability

---

## Summary

Cloudflare's free tier provides everything needed for a production AI coding platform:

| Component | Free Tier | Strategy |
|-----------|-----------|----------|
| Compute | 100K requests/day | Use Durable Objects for stateful compute |
| AI | 10K neurons/day | Use local GPU for heavy lifting |
| Storage | 1GB KV, 10GB R2 | Multi-tier caching |
| Queues | Unlimited consumers | Offload long-running tasks |
| DOs | Unlimited | Core of the architecture |

**Key Takeaway**: The free tier is not just for prototypes—it's sufficient for production use when architected correctly.

---

## References

- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [KV Limits](https://developers.cloudflare.com/kv/platform/limits/)
- [R2 Limits](https://developers.cloudflare.com/r2/platform/limits/)
- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Queues Limits](https://developers.cloudflare.com/queues/platform/limits/)
