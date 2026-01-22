/**
 * ClaudeFlare Fine-tuning Worker
 * Cloudflare Worker entry point for the fine-tuning system
 */

import { createRouter } from './api/routes';
import { ModelRegistryDO } from './models/registry';
import type { Env } from './types';

export { ModelRegistryDO };

export default {
  /**
   * Main fetch handler
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      // Create router and handle request
      const router = createRouter(env);
      const response = await router.handle(request);

      // Add CORS headers to all responses
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      return response;

    } catch (error) {
      console.error('Worker error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'An unexpected error occurred',
            timestamp: Date.now(),
          },
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },

  /**
   * Scheduled event handler (for periodic tasks)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Cleanup old training jobs
    await cleanupOldJobs(env);

    // Cleanup old alerts
    await cleanupOldAlerts(env);

    // Archive old metrics
    await archiveOldMetrics(env);

    // Update system metrics
    await updateSystemMetrics(env);
  },
};

// ============================================================================
// Scheduled Tasks
// ============================================================================

async function cleanupOldJobs(env: Env): Promise<void> {
  const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days

  await env.DB.prepare(`
    DELETE FROM training_jobs
    WHERE status IN ('completed', 'failed', 'cancelled')
    AND completed_at < ?
  `).bind(cutoff).run();

  console.log('Cleaned up old training jobs');
}

async function cleanupOldAlerts(env: Env): Promise<void> {
  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days

  await env.DB.prepare(`
    DELETE FROM alerts
    WHERE acknowledged = 1 AND timestamp < ?
  `).bind(cutoff).run();

  console.log('Cleaned up old alerts');
}

async function archiveOldMetrics(env: Env): Promise<void> {
  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days

  // Delete old metrics history
  await env.DB.prepare(`
    DELETE FROM metrics_history
    WHERE timestamp < ?
  `).bind(cutoff).run();

  console.log('Archived old metrics');
}

async function updateSystemMetrics(env: Env): Promise<void> {
  // Count active jobs
  const activeJobs = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM training_jobs
    WHERE status IN ('queued', 'preparing', 'training')
  `).first();

  // Count deployed models
  const deployedModels = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM models
    WHERE JSON_EXTRACT(deployment, '$.status') = 'active'
  `).first();

  // Store system metrics
  await env.DB.prepare(`
    INSERT INTO system_metrics (metric_name, metric_value, labels, timestamp)
    VALUES ('active_jobs', ?, ?, ?)
  `).bind(
    (activeJobs?.count as number) || 0,
    JSON.stringify({}),
    Date.now()
  ).run();

  await env.DB.prepare(`
    INSERT INTO system_metrics (metric_name, metric_value, labels, timestamp)
    VALUES ('deployed_models', ?, ?, ?)
  `).bind(
    (deployedModels?.count as number) || 0,
    JSON.stringify({}),
    Date.now()
  ).run();

  console.log('Updated system metrics');
}
