/**
 * Cloudflare Worker entry point
 */

import { Hono } from 'hono';

type Bindings = {
  // Add your Cloudflare bindings here
  // KV: KVNamespace;
  // R2: R2Bucket;
};

type Variables = {
  // Add your Hono variables here
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    project: '{{name}}',
  });
});

// Example API route
app.get('/api/hello', (c) => {
  return c.json({
    message: 'Hello from {{name}}!',
  });
});

// Example with environment variable
app.get('/api/env', (c) => {
  return c.json({
    environment: c.env.ENVIRONMENT || 'development',
  });
});

export default app;
