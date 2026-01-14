/**
 * ClaudeFlare Edge API - Main Entry Point
 *
 * Cloudflare Workers API built with Hono framework
 * Edge-optimized for sub-millisecond cold starts
 *
 * Performance Optimizations:
 * - Lazy initialization for minimal cold start
 * - Code splitting for reduced bundle size
 * - Multi-level caching for fast responses
 * - Parallel execution for concurrent operations
 */

import { Hono } from 'hono';
import type { Env } from './types';

// Middleware
import { errorHandler, requestLogger, requestId } from './middleware/error-handler';
import { devCORS } from './middleware/cors';

// Performance optimizations (lazy loaded)
let coldStartOptimizer: any = null;
let performanceTracker: any = null;

/**
 * Lazy load performance optimizations
 * This is called on first request to minimize cold start time
 */
async function initializeOptimizations(env: Env) {
  if (coldStartOptimizer) return; // Already initialized

  const startTime = performance.now();

  // Import optimizations only when needed
  const { getOptimizer } = await import('../optimizations/index');
  const { getPerformanceTracker } = await import('../optimizations/index');

  // Initialize optimizer
  coldStartOptimizer = getOptimizer();
  await coldStartOptimizer.initCritical();

  // Initialize performance tracker
  performanceTracker = getPerformanceTracker({
    enabled: true,
    sampleRate: 1.0,
  });

  const initTime = performance.now() - startTime;
  console.log(`Optimizations initialized in ${initTime.toFixed(2)}ms`);
}

// Routes
import { getHealth } from './routes/health';
import { getStatus } from './routes/status';
import { createChatCompletion, createChatCompletionStream } from './routes/chat';
import { listModels, getModel } from './routes/models';
import metricsRoutes from './routes/metrics';
import codebaseRoutes from './routes/codebase';
import {
  createAgentOrchestration,
  getAgentRegistryStatus,
  getAvailableAgents,
} from './routes/agents';

// Create Hono app with typed environment
const app = new Hono<{ Bindings: Env }>();

/**
 * Performance initialization middleware
 * Runs on every request to ensure lazy initialization
 */
app.use('*', async (c, next) => {
  // Initialize optimizations on first request
  await initializeOptimizations(c.env);
  await next();
});

// Apply global middleware
app.use('*', devCORS);
app.use('*', requestId);
app.use('*', requestLogger);
app.use('*', errorHandler);

// Health check endpoint (no version prefix)
app.get('/health', getHealth);

// v1 API routes
const v1 = new Hono<{ Bindings: Env }>();

// Status endpoint
v1.get('/status', getStatus);

// Chat completions endpoint
v1.post('/chat', createChatCompletion);
v1.post('/chat/stream', createChatCompletionStream);

// Models endpoints
v1.get('/models', listModels);
v1.get('/models/:id', getModel);

// Codebase RAG endpoints
v1.route('/codebase', codebaseRoutes);

// Agent orchestration endpoints
v1.post('/agents/orchestrate', createAgentOrchestration);
v1.get('/agents/status', getAgentRegistryStatus);
v1.get('/agents/available/:type?', getAvailableAgents);

// Mount v1 routes
app.route('/v1', v1);

// Metrics routes (standalone and v1)
app.route('/metrics', metricsRoutes);
app.route('/v1/metrics', metricsRoutes);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'ClaudeFlare Edge API',
    version: '0.1.0',
    status: 'operational',
    endpoints: {
      health: 'GET /health',
      status: 'GET /v1/status',
      chat: 'POST /v1/chat',
      models: 'GET /v1/models',
      metrics: 'GET /metrics (Prometheus)',
      dashboard: 'GET /v1/metrics/dashboard',
      agents: {
        orchestrate: 'POST /v1/agents/orchestrate',
        status: 'GET /v1/agents/status',
        available: 'GET /v1/agents/available/:type?',
      },
      codebase: {
        upload: 'POST /v1/codebase/upload',
        batch: 'POST /v1/codebase/batch',
        search: 'GET /v1/codebase/search',
        file: 'GET /v1/codebase/file',
        stats: 'GET /v1/codebase/stats',
        clear: 'DELETE /v1/codebase',
        reindex: 'POST /v1/codebase/reindex',
      },
    },
    documentation: 'https://docs.claudeflare.com',
    timestamp: Date.now(),
  });
});

// Export default handler for Cloudflare Workers
export default app;

// Export for testing
export type AppType = typeof app;
