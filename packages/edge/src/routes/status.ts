import type { Context } from 'hono';
import type { Env, StatusResponse } from '../types/index';

/**
 * System status endpoint
 * GET /v1/status
 */
export async function getStatus(c: Context<{ Bindings: Env }>) {
  // Check service health
  const services = {
    api: true,
    cache: await checkCache(c.env),
    storage: await checkStorage(c.env),
    database: await checkDatabase(c.env),
    queue: await checkQueue(c.env),
  };

  // Calculate overall status
  const allHealthy = Object.values(services).every(v => v === true);
  const someDegraded = Object.values(services).some(v => v === false);

  const response: StatusResponse = {
    status: allHealthy ? 'operational' : someDegraded ? 'degraded' : 'down',
    version: c.env.API_VERSION || '0.1.0',
    environment: c.env.ENVIRONMENT || 'unknown',
    timestamp: Date.now(),
    services,
    metrics: {
      // These would be populated from actual metrics
      requestsPerSecond: undefined,
      averageLatency: undefined,
      errorRate: undefined,
    },
  };

  const statusCode = allHealthy ? 200 : someDegraded ? 503 : 503;

  return c.json(response, statusCode);
}

/**
 * Check KV cache health
 */
async function checkCache(env: Env): Promise<boolean> {
  try {
    if (!env.CACHE_KV) {
      return true; // Not configured, not an error
    }

    // Try to read a test key
    await env.CACHE_KV.get('health:check', { type: 'text' });
    return true;
  } catch (error) {
    console.error('Cache health check failed:', error);
    return false;
  }
}

/**
 * Check R2 storage health
 */
async function checkStorage(env: Env): Promise<boolean> {
  try {
    if (!env.STORAGE_R2) {
      return true; // Not configured, not an error
    }

    // Try to list objects (limit to 1 for health check)
    await env.STORAGE_R2.list({ limit: 1 });
    return true;
  } catch (error) {
    console.error('Storage health check failed:', error);
    return false;
  }
}

/**
 * Check D1 database health
 */
async function checkDatabase(env: Env): Promise<boolean> {
  try {
    if (!env.DB) {
      return true; // Not configured, not an error
    }

    // Try to run a simple query
    await env.DB.prepare('SELECT 1').first();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Check Queue health
 */
async function checkQueue(env: Env): Promise<boolean> {
  try {
    if (!env.QUEUE_PRODUCER) {
      return true; // Not configured, not an error
    }

    // Queue producer is just a binding, if it exists we consider it healthy
    return true;
  } catch (error) {
    console.error('Queue health check failed:', error);
    return false;
  }
}
