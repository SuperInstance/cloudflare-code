/**
 * ClaudeFlare Edge API - Ultra-Optimized
 * Cloudflare Workers with minimal cold start
 */

import { Hono } from 'hono';
import type { Env } from './types';

// Streamlined imports
import { errorHandler, requestId } from './middleware/error-handler';
import { devCORS } from './middleware/cors';
import { getHealth } from './routes/health';
import { getStatus } from './routes/status';
import { createChatCompletion, createChatCompletionStream } from './routes/chat';
import { listModels, getModel } from './routes/models';
import metricsRoutes from './routes/metrics';
import codebaseRoutes from './routes/codebase';
import { createAgentOrchestration, getAgentRegistryStatus, getAvailableAgents } from './routes/agents';

// Create app with minimal middleware stack
const app = new Hono<{ Bindings: Env }>()
  .use('*', devCORS)
  .use('*', requestId)
  .use('*', errorHandler)
  .get('/health', getHealth);

// v1 API routes
const v1 = new Hono<{ Bindings: Env }>()
  .get('/status', getStatus)
  .post('/chat', createChatCompletion)
  .post('/chat/stream', createChatCompletionStream)
  .get('/models', listModels)
  .get('/models/:id', getModel)
  .post('/agents/orchestrate', createAgentOrchestration)
  .get('/agents/status', getAgentRegistryStatus)
  .get('/agents/available/:type?', getAvailableAgents)
  .route('/codebase', codebaseRoutes);

// Mount routes
app.route('/v1', v1);
app.route('/metrics', metricsRoutes);
app.route('/v1/metrics', metricsRoutes);

// Root endpoint (streamlined)
app.get('/', (c) => c.json({
  name: 'ClaudeFlare Edge API',
  version: '0.1.0',
  endpoints: {
    health: 'GET /health',
    v1: 'GET /v1',
    chat: 'POST /v1/chat',
    models: 'GET /v1/models',
    metrics: 'GET /metrics',
    agents: 'POST /v1/agents/orchestrate',
    codebase: 'GET /v1/codebase'
  }
}));

export default app;
export type AppType = typeof app;
