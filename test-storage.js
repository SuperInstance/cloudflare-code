// Test storage functionality
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

export default app;