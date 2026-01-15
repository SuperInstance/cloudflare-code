# ClaudeFlare User Guide - Complete Reference

## What is ClaudeFlare?

ClaudeFlare is an **enterprise-grade edge computing platform** built on Cloudflare Workers that provides:

- **150+ AI Agents** for various tasks (code, search, streaming, monitoring, security)
- **13 Durable Objects** for stateful computing
- **Multi-region deployment** with canary releases and blue-green deployments
- **Unified integration layer** connecting all packages seamlessly
- **Production-ready monitoring** with metrics, logging, tracing, and alerting
- **Enterprise security** with JWT, OAuth2, RBAC, and rate limiting

## Quick Start

### 1. Installation

```bash
# Clone repository
git clone https://github.com/claudeflare/claudeflare.git
cd claudeflare

# Install dependencies
npm install

# Configure environment
cp wrangler.example.toml wrangler.toml
# Edit wrangler.toml with your Cloudflare credentials

# Deploy to Cloudflare Workers
npm run deploy
```

### 2. Basic Usage

#### Using an AI Agent

```typescript
import { AgentOrchestrator } from '@claudeflare/agents';

export default {
  async fetch(request: Request, env: Env) {
    const orchestrator = new AgentOrchestrator(env);

    // Generate code
    const result = await orchestrator.invoke('code-generator', {
      prompt: 'Create a REST API with Node.js',
      language: 'typescript',
    });

    return Response.json(result);
  },
};
```

#### Vector Search

```typescript
import { VectorSearchEngine } from '@claudeflare/search-engine';

const search = new VectorSearchEngine({
  kv: env.KV,
  r2: env.R2,
});

// Index documents
await search.index([
  {
    id: 'doc1',
    text: 'Machine learning is awesome',
    metadata: { category: 'AI' },
  },
]);

// Search similar documents
const results = await search.search('deep learning', {
  topK: 10,
  filter: { category: 'AI' },
});
```

#### Real-time Streaming

```typescript
import { StreamingService } from '@claudeflare/streaming';

const streaming = new StreamingService({
  enableBackpressure: true,
  enableFaultTolerance: true,
});

// Create streaming pipeline
const pipeline = streaming.createPipeline()
  .source('http')
  .process('transform')
  .sink('websocket');

await pipeline.start();
```

## Use Cases

### Use Case 1: AI-Powered Code Assistant

**Scenario**: Build an AI code assistant that can generate, review, and optimize code.

```typescript
// src/workers/code-assistant.ts
import { AgentOrchestrator } from '@claudeflare/agents';
import { CodebaseManager } from '@claudeflare/codebase';

export default {
  async fetch(request: Request, env: Env) {
    const orchestrator = new AgentOrchestrator(env);
    const codebase = new CodebaseManager(env);

    if (request.method === 'POST' && url.pathname === '/generate') {
      const { prompt, language, context } = await request.json();

      // Generate code with context
      const result = await orchestrator.invoke('code-generator', {
        prompt,
        language,
        context: await codebase.getContext(context),
      });

      return Response.json({
        code: result.data,
        explanation: result.explanation,
        tests: result.suggestedTests,
      });
    }

    if (request.method === 'POST' && url.pathname === '/review') {
      const { code, filePath } = await request.json();

      // Review code
      const review = await orchestrator.invoke('code-reviewer', {
        code,
        filePath,
        rules: await codebase.getRules(),
      });

      return Response.json({
        issues: review.data.issues,
        suggestions: review.data.suggestions,
        score: review.data.score,
      });
    }

    if (request.method === 'POST' && url.pathname === '/optimize') {
      const { code, target } = await request.json();

      // Optimize code
      const optimized = await orchestrator.invoke('code-optimizer', {
        code,
        target: target || 'performance',
      });

      return Response.json({
        original: code,
        optimized: optimized.code,
        improvements: optimized.improvements,
        benchmark: optimized.benchmark,
      });
    }

    return Response.json({ error: 'Not found' }, 404);
  },
};
```

### Use Case 2: Real-Time Analytics Dashboard

**Scenario**: Build a real-time analytics dashboard with live data streaming.

```typescript
// src/workers/analytics.ts
import { StreamingService } from '@claudeflare/streaming';
import { MetricsCollector } from '@claudeflare/monitoring';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const streaming = new StreamingService(env);
    const metrics = new MetricsCollector(env);

    if (url.pathname === '/analytics/stream') {
      // Upgrade to WebSocket
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket', 426);
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      ctx.waitUntil(handleAnalyticsWebSocket(server, metrics, streaming));

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // REST endpoints
    if (url.pathname === '/analytics/summary') {
      const summary = await metrics.getSummary({
        start: Date.now() - 86400000, // Last 24 hours
        end: Date.now(),
      });

      return Response.json(summary);
    }

    if (url.pathname === '/analytics/timeseries') {
      const timeseries = await metrics.getTimeSeries('requestCount', {
        start: Date.now() - 3600000, // Last hour
        granularity: 'minute',
      });

      return Response.json(timeseries);
    }

    return Response.json({ error: 'Not found' }, 404);
  },
};

async function handleAnalyticsWebSocket(
  ws: WebSocket,
  metrics: MetricsCollector,
  streaming: StreamingService
) {
  ws.accept();

  // Subscribe to metrics updates
  const subscription = await streaming.subscribe('metrics', async (data) => {
    ws.send(JSON.stringify({
      type: 'metrics',
      data,
      timestamp: Date.now(),
    }));
  });

  // Handle incoming messages
  ws.addEventListener('message', async (msg) => {
    const { type, query } = JSON.parse(msg.data);

    if (type === 'subscribe') {
      // Subscribe to specific metric
      await metrics.on(query.metric, (value) => {
        ws.send(JSON.stringify({
          type: 'value',
          metric: query.metric,
          value,
          timestamp: Date.now(),
        }));
      });
    }

    if (type === 'query') {
      // Execute query
      const result = await metrics.query(query);
      ws.send(JSON.stringify({
        type: 'query-result',
        result,
        timestamp: Date.now(),
      }));
    }
  });

  // Send initial data
  const initialMetrics = await metrics.getCurrentMetrics();
  ws.send(JSON.stringify({
    type: 'initial',
    metrics: initialMetrics,
    timestamp: Date.now(),
  }));
}
```

### Use Case 3: Intelligent Search with AI

**Scenario**: Build a semantic search engine with AI-powered ranking.

```typescript
// src/workers/search.ts
import { VectorSearchEngine } from '@claudeflare/search-engine';
import { AgentOrchestrator } from '@claudeflare/agents';
import { SmartRouter } from '@claudeflare/router';

export default {
  async fetch(request: Request, env: Env) {
    const search = new VectorSearchEngine(env);
    const orchestrator = new AgentOrchestrator(env);
    const router = new SmartRouter(env);

    if (request.method === 'POST' && url.pathname === '/search') {
      const { query, filters, rerank } = await request.json();

      // Step 1: Vector search
      const vectorResults = await search.search(query, {
        topK: 100,
        filters,
      });

      if (!rerank) {
        return Response.json(vectorResults);
      }

      // Step 2: AI reranking
      const reranked = await orchestrator.invoke('search-reranker', {
        query,
        results: vectorResults,
        context: {
          userId: request.headers.get('x-user-id'),
          tier: request.headers.get('x-tier') || 'free',
        },
      });

      return Response.json(reranked.data);
    }

    if (request.method === 'POST' && url.pathname === '/index') {
      const { documents } = await request.json();

      // Generate embeddings
      const embeddings = await router.embed(documents.map(d => d.text));

      // Index documents
      await search.index(
        documents.map((doc, i) => ({
          id: doc.id,
          vector: embeddings[i],
          metadata: doc.metadata,
        }))
      );

      return Response.json({
        indexed: documents.length,
        timestamp: Date.now(),
      });
    }

    if (request.method === 'GET' && url.pathname.startsWith('/suggestions/')) {
      const prefix = url.pathname.split('/').pop();

      // Generate query suggestions using AI
      const suggestions = await orchestrator.invoke('query-suggester', {
        prefix,
        context: {
          recentQueries: await getRecentQueries(request),
          userId: request.headers.get('x-user-id'),
        },
      });

      return Response.json(suggestions.data);
    }

    return Response.json({ error: 'Not found' }, 404);
  },
};
```

### Use Case 4: Multi-Tenant SaaS Platform

**Scenario**: Build a multi-tenant SaaS with per-tenant configuration.

```typescript
// src/workers/saas.ts
import { IntegrationManager } from '@claudeflare/integration';
import { RBAC } from '@claudeflare/auth';
import { RateLimitManager } from '@claudeflare/rate-limit';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const integration = new IntegrationManager(env);
    const rbac = new RBAC(env);
    const rateLimit = new RateLimitManager(env);

    // Authenticate tenant
    const tenant = await authenticateTenant(request);

    if (!tenant) {
      return Response.json({ error: 'Unauthorized' }, 401);
    }

    // Load tenant configuration
    const config = await loadTenantConfig(tenant.id);

    // Apply tenant-specific rate limits
    const rateLimitResult = await rateLimit.checkLimit(
      tenant.id,
      'user',
      tenant.tier,
      request.url,
      request.method
    );

    if (!rateLimitResult.allowed) {
      return Response.json({
        error: 'Rate limit exceeded',
        limit: rateLimitResult.limit,
        resetAt: rateLimitResult.resetTime,
      }, 429);
    }

    // Apply RBAC
    const allowed = await rbac.check(tenant.userId, url.pathname, request.method);
    if (!allowed) {
      return Response.json({ error: 'Forbidden' }, 403);
    }

    // Route request based on tenant config
    const service = integration.getOrchestrator().invokeDiscovered(
      config.serviceName,
      await prepareRequest(request, config),
      { capability: config.capability }
    );

    return Response.json(await service);
  },
});

async function authenticateTenant(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  // Validate JWT and return tenant info
  return verifyTenantToken(token);
}

async function loadTenantConfig(tenantId: string) {
  // Load tenant-specific configuration
  return {
    serviceName: 'tenant-service',
    capability: 'process-request',
    settings: { /* tenant settings */ },
  };
}
```

### Use Case 5: Real-Time Collaboration

**Scenario**: Build real-time collaborative features with WebSockets.

```typescript
// src/workers/collaboration.ts
import { RealtimeService } from '@claudeflare/realtime';
import { AgentOrchestrator } from '@claudeflare/agents';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const realtime = new RealtimeService(env);
    const orchestrator = new AgentOrchestrator(env);

    if (url.pathname === '/collaborate/connect') {
      // WebSocket upgrade
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      ctx.waitUntil(handleCollaborationWebSocket(server, realtime, orchestrator));

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return Response.json({ error: 'Not found' }, 404);
  },
};

async function handleCollaborationWebSocket(
  ws: WebSocket,
  realtime: RealtimeService,
  orchestrator: AgentOrchestrator
) {
  ws.accept();

  const room = await realtime.joinRoom('default-room');
  const userId = generateUserId();

  // Broadcast user joined
  await room.broadcast({
    type: 'user-joined',
    userId,
    timestamp: Date.now(),
  });

  ws.addEventListener('message', async (msg) => {
    const { type, data } = JSON.parse(msg.data);

    if (type === 'cursor-move') {
      // Broadcast cursor position
      await room.broadcast({
        type: 'cursor-move',
        userId,
        position: data.position,
        timestamp: Date.now(),
      }, { exclude: ws });
    }

    if (type === 'text-change') {
      // Apply operational transformation
      const transformed = await orchestrator.invoke('ot-engine', {
        operation: data.operation,
        documentId: data.documentId,
        revision: data.revision,
      });

      if (transformed.success) {
        // Broadcast to all users
        await room.broadcast({
          type: 'text-change',
          operation: transformed.data.operation,
          revision: transformed.data.revision,
          timestamp: Date.now(),
        });
      }
    }

    if (type === 'ai-suggest') {
      // Get AI suggestions
      const suggestions = await orchestrator.invoke('code-completer', {
        code: data.code,
        cursor: data.cursor,
        context: data.context,
      });

      ws.send(JSON.stringify({
        type: 'suggestions',
        suggestions: suggestions.data,
      }));
    }
  });

  ws.addEventListener('close', async () => {
    await room.leave(userId);

    await room.broadcast({
      type: 'user-left',
      userId,
      timestamp: Date.now(),
    });
  });
}
```

## Integration Examples

### Example 1: Connect to External API

```typescript
import { AgentOrchestrator } from '@claudeflare/agents';

export default {
  async fetch(request: Request, env: Env) {
    const orchestrator = new AgentOrchestrator(env);

    // Use HTTP agent to call external API
    const response = await orchestrator.invoke('http-client', {
      url: 'https://api.example.com/data',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.API_KEY}`,
      },
    });

    // Transform response using AI
    const transformed = await orchestrator.invoke('data-transformer', {
      data: response.data,
      transformation: 'summarize',
    });

    return Response.json(transformed.data);
  },
};
```

### Example 2: Process Webhook

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (request.method === 'POST' && url.pathname === '/webhook') {
      const event = await request.json();

      // Validate webhook
      const signature = request.headers.get('x-webhook-signature');
      if (!await verifyWebhook(signature, event, env.WEBHOOK_SECRET)) {
        return Response.json({ error: 'Invalid signature' }, 401);
      }

      // Process asynchronously
      ctx.waitUntil(processWebhook(event, env));

      return Response.json({ received: true });
    }
  },
});

async function processWebhook(event: unknown, env: Env) {
  const orchestrator = new AgentOrchestrator(env);

  // Route to appropriate handler based on event type
  const handler = eventHandlers[event.type];
  if (handler) {
    await orchestrator.invoke(handler.agent, {
      event,
      config: handler.config,
    });
  }
}

const eventHandlers = {
  'user.created': {
    agent: 'welcome-email',
    config: { template: 'welcome' },
  },
  'subscription.renewed': {
    agent: 'billing-processor',
    config: { action: 'renew' },
  },
};
```

### Example 3: Scheduled Tasks

```typescript
export default {
  async fetch(request: Request, env: Env) {
    return new Response('OK');
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Run every hour
    if (event.cron === '0 * * * *') {
      ctx.waitUntil(generateReports(env));
    }

    // Run daily at midnight
    if (event.cron === '0 0 * * *') {
      ctx.waitUntil(dailyCleanup(env));
    }
  },
};

async function generateReports(env: Env) {
  const orchestrator = new AgentOrchestrator(env);

  // Generate usage report
  const report = await orchestrator.invoke('report-generator', {
    type: 'usage',
    period: 'daily',
    data: await fetchMetrics(env),
  });

  // Send to stakeholders
  await orchestrator.invoke('email-sender', {
    recipients: ['admin@example.com'],
    subject: 'Daily Usage Report',
    body: report.data.markdown,
  });
}

async function dailyCleanup(env: Env) {
  // Clean old logs
  await env.KV.delete({ prefix: 'log:', olderThan: 7 * 24 * 60 * 60 });

  // Clean cache
  await env.KV.delete({ prefix: 'cache:', olderThan: 1 * 24 * 60 * 60 });
}
```

## Configuration Guide

### Environment Variables

```bash
# Required
ENVIRONMENT=production
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional
LOG_LEVEL=info
ENABLE_METRICS=true
ENABLE_TRACING=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

### Feature Flags

```typescript
import { FeatureFlagManager } from '@claudeflare/config';

const flags = new FeatureFlagManager(env);

// Check if feature is enabled
if (await flags.isEnabled('new-ui', { userId: 'user-123' })) {
  // Show new UI
}

// Get A/B test variant
const variant = await flags.getVariant('experiment-1', { userId: 'user-123' });
if (variant === 'treatment') {
  // Show treatment
}
```

### Custom Agents

```typescript
import { createServiceAdapter } from '@claudeflare/integration';

const customAgent = createServiceAdapter(
  integrationManager,
  {
    name: '@myorg/custom-agent',
    version: '1.0.0',
    instanceId: 'custom-1',
  },
  [
    {
      name: 'my-custom-capability',
      version: '1.0.0',
      description: 'Does custom work',
      handler: async (input) => {
        // Your custom logic
        return { result: 'custom result' };
      },
    },
  ]
);

await customAgent.register();
```

## Monitoring and Debugging

### View Metrics

```typescript
// GET /metrics
export async function getMetrics(env: Env) {
  const metrics = await env.KV.get('metrics', 'json');
  return Response.json(metrics);
}
```

### View Logs

```bash
# Tail logs in real-time
wrangler tail --format=pretty

# Get logs from last hour
cf-api logs --since="1h" > logs.json
```

### Debug Mode

```typescript
// Enable debug logging
const logger = new Logger({
  level: 'debug',
  structured: true,
});

logger.debug('Request details', {
  method: request.method,
  url: request.url,
  headers: Object.fromEntries(request.headers),
});
```

## Best Practices

### 1. Error Handling

```typescript
try {
  const result = await orchestrator.invoke('agent', input);
  return Response.json(result);
} catch (error) {
  logger.error('Agent invocation failed', { error, input });

  // Check if error is retryable
  if (error.retryable) {
    // Retry with backoff
    await delay(error.retryAfter);
    return await orchestrator.invoke('agent', input);
  }

  // Return user-friendly error
  return Response.json({
    error: 'Service temporarily unavailable',
    code: error.code,
  }, 503);
}
```

### 2. Caching

```typescript
// Cache expensive operations
const cacheKey = `agent:${agentName}:${hash(input)}`;
const cached = await env.KV.get(cacheKey, 'json');

if (cached) {
  return Response.json(cached);
}

const result = await orchestrator.invoke(agentName, input);
await env.KV.put(cacheKey, JSON.stringify(result), {
  expirationTtl: 3600, // 1 hour
});

return Response.json(result);
```

### 3. Timeouts

```typescript
// Set timeout for long operations
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const result = await fetch(url, {
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  return result;
} catch (error) {
  if (error.name === 'AbortError') {
    throw new Error('Request timed out');
  }
  throw error;
}
```

### 4. Monitoring

```typescript
// Track performance
const start = Date.now();
const result = await operation();
const duration = Date.now() - start;

metrics.record('operation.duration', duration);
metrics.increment('operation.count');

// Track errors
if (result.error) {
  metrics.increment('operation.errors');
  alerts.trigger('operation-failed', { error: result.error });
}
```

## Troubleshooting

### Common Issues

**Issue**: Workers cold start latency
- **Solution**: Use Durable Objects for warm state, implement caching

**Issue**: Rate limit errors
- **Solution**: Implement exponential backoff, use fallback providers

**Issue**: Memory limit exceeded
- **Solution**: Optimize data structures, use streaming for large data

**Issue**: Timeout errors
- **Solution**: Break into smaller operations, use async processing

### Getting Help

1. Check documentation: `docs/`
2. Search issues: `github.com/claudeflare/claudeflare/issues`
3. Join Discord: `discord.gg/claudeflare`
4. Email support: `support@claudeflare.dev`

## Summary

ClaudeFlare provides a comprehensive, production-ready platform for building edge applications with:

- **150+ AI Agents** for intelligent operations
- **Multi-region deployment** with zero-downtime updates
- **Enterprise security** with full auth/rate-limiting
- **Production monitoring** with metrics/logs/tracing
- **Unified integration** for seamless package communication

For more details, see:
- [Production Guide](./PRODUCTION_GUIDE.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [API Documentation](./docs/api.md)
- [Examples](./examples/)
