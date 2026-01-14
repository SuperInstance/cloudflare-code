/**
 * ClaudeFlare Cloudflare Worker Entry Point
 * Main request handler and routing logic
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  // KV Storage
  CACHE_KV: KVNamespace;
  
  // Durable Objects
  AGENT_ORCHESTRATOR: DurableObjectNamespace;
  VECTOR_INDEX: DurableObjectNamespace;
  
  // R2 Storage
  STORAGE_BUCKET: R2Bucket;
  
  // D1 Database
  DB: D1Database;
  
  // Queue
  TASK_QUEUE: Queue;
  
  // Environment variables
  ENVIRONMENT: string;
  API_ENDPOINT: string;
  GRAPHQL_ENDPOINT: string;
  ENABLE_CACHE: string;
  ENABLE_ANALYTICS: string;
  ENABLE_RATE_LIMITING: string;
  LOG_LEVEL: string;
  PROVIDER_ROUTING_STRATEGY: string;
  MAX_CONCURRENT_REQUESTS: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', cors());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'unknown',
  });
});

// Version endpoint
app.get('/version', (c) => {
  return c.json({
    version: '0.1.0',
    commit: process.env.CF_PAGES_COMMIT_SHA || 'dev',
  });
});

// Metrics endpoint
app.get('/metrics', (c) => {
  return c.json({
    requests: 0,
    errors: 0,
    latency: 0,
  });
});

// API v1 routes
app.route('/api/v1', createAPIRouter());

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

function createAPIRouter() {
  const router = new Hono<{ Bindings: Bindings }>();

  router.get('/test', (c) => {
    return c.json({
      status: 'ok',
      message: 'API is working',
    });
  });

  router.post('/test', async (c) => {
    const body = await c.req.json();
    return c.json({
      status: 'ok',
      received: body,
    });
  });

  return router;
}

// Cloudflare Workers fetch handler
export default {
  fetch: app.fetch,
};
