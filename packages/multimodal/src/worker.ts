/**
 * Cloudflare Worker Entry Point
 * Multimodal AI API Worker
 */

import app from './api/routes';

export interface Env {
  R2: R2Bucket;
  VECTORIZE: VectorizeIndex;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  ENVIRONMENT?: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    // Handle OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route request to Hono app
      const response = await app.fetch(request, env, ctx);

      // Add CORS headers to response
      const newResponse = new Response(response.body, response);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newResponse.headers.set(key, value);
      });

      return newResponse;
    } catch (error) {
      console.error('Worker error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'WORKER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  }
};

export const scheduled = async (
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> => {
  // Handle scheduled tasks (e.g., cleanup, indexing)
  console.log('Scheduled event:', event.cron);

  switch (event.cron) {
    case '0 0 * * *': // Daily at midnight
      await cleanupOldImages(env);
      break;
    case '0 */6 * * *': // Every 6 hours
      await reindexEmbeddings(env);
      break;
  }
};

async function cleanupOldImages(env: Env): Promise<void> {
  // Cleanup images older than 30 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  // List and delete old images
  const listed = await env.R2.list({
    limit: 1000
  });

  for (const object of listed.objects) {
    if (object.uploaded && object.uploaded < cutoffDate) {
      await env.R2.delete(object.key);
      console.log(`Deleted old image: ${object.key}`);
    }
  }
}

async function reindexEmbeddings(env: Env): Promise<void> {
  // Reindex or update embeddings
  console.log('Reindexing embeddings...');
  // Implementation depends on vector database
}
