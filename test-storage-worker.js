/**
 * Storage Test Worker
 * Tests KV, D1, and R2 storage functionality
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  CACHE_KV: KVNamespace;
  DB: D1Database;
  STORAGE_BUCKET: R2Bucket;
  ENVIRONMENT: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    worker: 'storage-test',
  });
});

// Test KV storage
app.get('/test/kv', async (c) => {
  try {
    await c.env.CACHE_KV.put('test-key', 'test-value');
    const value = await c.env.CACHE_KV.get('test-key');
    return c.json({ status: 'ok', value });
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// Test D1 database
app.get('/test/db', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT 1 as test').all();
    return c.json({ status: 'ok', results });
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// Test R2 storage
app.get('/test/r2', async (c) => {
  try {
    const object = await c.env.STORAGE_BUCKET.get('test-object');
    return c.json({ status: 'ok', object: object ? 'exists' : 'not found' });
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// Test all storage
app.get('/test/all', async (c) => {
  const results = {
    kv: false,
    db: false,
    r2: false,
  };

  try {
    // Test KV
    await c.env.CACHE_KV.put('all-test-key', 'all-test-value');
    const kvValue = await c.env.CACHE_KV.get('all-test-key');
    results.kv = kvValue === 'all-test-value';
  } catch (error) {
    console.error('KV test failed:', error);
  }

  try {
    // Test D1
    const { results: dbResults } = await c.env.DB.prepare('SELECT 1 as test').all();
    results.db = dbResults && dbResults.length > 0;
  } catch (error) {
    console.error('DB test failed:', error);
  }

  try {
    // Test R2
    const object = await c.env.STORAGE_BUCKET.get('test-object');
    results.r2 = object !== null;
  } catch (error) {
    console.error('R2 test failed:', error);
  }

  return c.json({
    status: 'completed',
    results,
    allWorking: Object.values(results).every(Boolean),
  });
});

export default app;