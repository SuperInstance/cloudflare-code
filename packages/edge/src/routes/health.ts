import type { Context } from 'hono';
import type { Env } from '../types/index';
import type { HealthResponse } from '../types/index';

const START_TIME = Date.now();

/**
 * Health check endpoint
 * GET /health
 */
export async function getHealth(c: Context<{ Bindings: Env }>) {
  const uptime = Date.now() - START_TIME;

  const response: HealthResponse = {
    status: 'healthy',
    timestamp: Date.now(),
    version: c.env.API_VERSION || '0.1.0',
    environment: c.env.ENVIRONMENT || 'unknown',
    uptime,
  };

  return c.json(response, 200);
}
