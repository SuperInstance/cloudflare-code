/**
 * Semantic Cache Integration with Request Router
 *
 * This module demonstrates how to integrate the semantic cache
 * with the existing request routing system.
 *
 * Architecture:
 * ```
 * Request → Semantic Cache Check
 *          ↓
 *       Hit? → Return cached response
 *          ↓
 *       Miss → Forward to provider
 *          ↓
 *          Store in cache with embedding
 * ```
 */

import type { ChatRequest, ChatResponse } from '@claudeflare/shared';
import { SemanticCache } from './semantic';
import { EmbeddingService } from '../embeddings';
import { HNSWIndex } from '../hnsw';
import type { KVCache } from '../kv';

export interface CacheIntegrationOptions {
  /**
   * Enable semantic caching
   * @default true
   */
  enabled?: boolean;

  /**
   * Similarity threshold for cache hits
   * @default 0.90
   */
  similarityThreshold?: number;

  /**
   * Maximum entries in hot cache
   * @default 10000
   */
  maxHotEntries?: number;

  /**
   * KV cache for warm tier
   */
  kvCache?: KVCache;

  /**
   * Cloudflare AI binding for embeddings
   */
  ai?: AiTextEmbeddingsInput;
}

/**
 * Cache-aware request handler
 *
 * Wraps the request router with semantic caching capabilities.
 */
export class CacheAwareRequestHandler {
  private semanticCache: SemanticCache;
  private enabled: boolean;

  constructor(options: CacheIntegrationOptions = {}) {
    this.enabled = options.enabled ?? true;

    // Initialize semantic cache
    const embeddingService = new EmbeddingService({
      ai: options.ai,
    });

    const hnswIndex = new HNSWIndex({
      M: 16,
      efConstruction: 100,
      ef: 50,
    });

    this.semanticCache = new SemanticCache({
      similarityThreshold: options.similarityThreshold ?? 0.90,
      maxHotEntries: options.maxHotEntries ?? 10000,
      embeddingService,
      hnswIndex,
      kvCache: options.kvCache,
      enablePersistence: true,
    });
  }

  /**
   * Handle chat request with semantic caching
   *
   * @param request - Chat request
   * @param providerFn - Provider function to call on cache miss
   * @returns Chat response
   */
  async handleRequest(
    request: ChatRequest,
    providerFn: (req: ChatRequest) => Promise<ChatResponse>
  ): Promise<{
    response: ChatResponse;
    cacheHit: boolean;
    cacheSource: 'hot' | 'warm' | 'cold' | 'none';
    latency: number;
  }> {
    const startTime = performance.now();

    // Extract prompt from messages
    const prompt = this.extractPrompt(request.messages);

    // Extract metadata for context matching
    const metadata = {
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    };

    // Check semantic cache
    if (this.enabled) {
      const cacheResult = await this.semanticCache.check(prompt, metadata);

      if (cacheResult.hit && cacheResult.response) {
        const latency = performance.now() - startTime;

        console.log(`Cache hit (${cacheResult.source}): ${cacheResult.similarity.toFixed(4)} similarity`);

        return {
          response: cacheResult.response,
          cacheHit: true,
          cacheSource: cacheResult.source,
          latency,
        };
      }
    }

    // Cache miss - call provider
    const response = await providerFn(request);

    // Store in semantic cache
    if (this.enabled) {
      await this.semanticCache.store(prompt, response, metadata);
    }

    const latency = performance.now() - startTime;

    console.log(`Cache miss - total latency: ${latency.toFixed(2)}ms`);

    return {
      response,
      cacheHit: false,
      cacheSource: 'none',
      latency,
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): ReturnType<SemanticCache['getStats']> {
    return this.semanticCache.getStats();
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    await this.semanticCache.clear();
  }

  /**
   * Extract prompt from messages
   *
   * @private
   */
  private extractPrompt(messages: ChatRequest['messages']): string {
    // Get the last user message
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];

    if (!lastUserMessage) {
      return '';
    }

    return lastUserMessage.content;
  }
}

/**
 * Example usage with Cloudflare Workers
 *
 * ```typescript
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     // Initialize cache handler
 *     const cacheHandler = new CacheAwareRequestHandler({
 *       kvCache: new KVCache(env.KV_CACHE),
 *       ai: env.AI,
 *     });
 *
 *     // Parse request
 *     const chatRequest = await request.json();
 *
 *     // Handle with caching
 *     const result = await cacheHandler.handleRequest(
 *       chatRequest,
 *       async (req) => {
 *         // Call your provider here
 *         return await callProvider(req);
 *       }
 *     );
 *
 *     return Response.json({
 *       ...result.response,
 *       cached: result.cacheHit,
 *       cacheSource: result.cacheSource,
 *     });
 *   }
 * };
 * ```
 */

/**
 * Express/Koa middleware example
 *
 * ```typescript
 * import { CacheAwareRequestHandler } from './cache/integration';
 *
 * const cacheHandler = new CacheAwareRequestHandler({
 *   kvCache: new KVCache(kvNamespace),
 * });
 *
 * app.post('/api/chat', async (req, res) => {
 *   const result = await cacheHandler.handleRequest(
 *     req.body,
 *     async (request) => {
 *       return await provider.chat(request);
 *     }
 *   );
 *
 *   res.json({
 *     ...result.response,
 *     _cached: result.cacheHit,
 *     _cacheSource: result.cacheSource,
 *   });
 * });
 * ```
 */

/**
 * Hono middleware example
 *
 * ```typescript
 * import { Hono } from 'hono';
 * import { CacheAwareRequestHandler } from './cache/integration';
 *
 * const app = new Hono();
 *
 * let cacheHandler: CacheAwareRequestHandler;
 *
 * app.use('*', async (c, next) => {
 *   if (!cacheHandler) {
 *     cacheHandler = new CacheAwareRequestHandler({
 *       kvCache: new KVCache(c.env.KV_CACHE),
 *       ai: c.env.AI,
 *     });
 *   }
 *   c.set('cacheHandler', cacheHandler);
 *   await next();
 * });
 *
 * app.post('/api/chat', async (c) => {
 *   const cacheHandler = c.get('cacheHandler');
 *   const request = await c.req.json();
 *
 *   const result = await cacheHandler.handleRequest(
 *     request,
 *     async (req) => {
 *       return await callProvider(req);
 *     }
 *   );
 *
 *   return c.json({
 *     ...result.response,
 *     _cached: result.cacheHit,
 *   });
 * });
 * ```
 */

/**
 * Monitoring and metrics endpoint
 *
 * ```typescript
 * app.get('/api/cache/stats', (c) => {
 *   const cacheHandler = c.get('cacheHandler');
 *   const stats = cacheHandler.getStats();
 *
 *   return c.json({
 *     hitRate: stats.hitRate,
 *     avgLatency: stats.avgLatency,
 *     totalQueries: stats.metrics.totalQueries,
 *     hotCacheSize: stats.hotCacheSize,
 *     tokensSaved: stats.metrics.tokensSaved,
 *     costSaved: stats.metrics.costSaved,
 *   });
 * });
 * ```
 */

/**
 * Cache invalidation on file changes
 *
 * ```typescript
 * import { SemanticCache } from './cache/semantic';
 *
 * const semanticCache = new SemanticCache({ kvCache });
 *
 * // Invalidate cache entries related to changed files
 * async function onFileChange(filePath: string, newContent: string) {
 *   // Generate embedding for changed file
 *   const embeddingService = new EmbeddingService({ ai: env.AI });
 *   const fileEmbedding = await embeddingService.generate(newContent);
 *
 *   // Find and invalidate affected cache entries
 *   const stats = semanticCache.getStats();
 *
 *   // In production, you'd want to track which files are referenced
 *   // by each cache entry and selectively invalidate
 *
 *   // For now, we can clear the cache when files change
 *   await semanticCache.clear();
 *
 *   console.log(`Cache cleared due to file change: ${filePath}`);
 * }
 * ```
 */

/**
 * Cache warming with common queries
 *
 * ```typescript
 * async function warmCache(cacheHandler: CacheAwareRequestHandler) {
 *   const commonQueries = [
 *     'What is TypeScript?',
 *     'How do I create a REST API?',
 *     'Explain React hooks',
 *     'Write a unit test',
 *   ];
 *
 *   const providerFn = async (req) => {
 *     return await callProvider(req);
 *   };
 *
 *   for (const query of commonQueries) {
 *     const request: ChatRequest = {
 *       messages: [{ role: 'user', content: query }],
 *       model: 'claude-3-haiku',
 *     };
 *
 *     await cacheHandler.handleRequest(request, providerFn);
 *   }
 *
 *   console.log('Cache warmed with', commonQueries.length, 'queries');
 * }
 * ```
 */

/**
 * A/B testing different similarity thresholds
 *
 * ```typescript
 * async function testThreshold(threshold: number) {
 *   const cacheHandler = new CacheAwareRequestHandler({
 *     similarityThreshold: threshold,
 *     kvCache: new KVCache(kvNamespace),
 *   });
 *
 *   // Run test queries
 *   for (const query of testQueries) {
 *     await cacheHandler.handleRequest(query, providerFn);
 *   }
 *
 *   const stats = cacheHandler.getStats();
 *
 *   return {
 *     threshold,
 *     hitRate: stats.hitRate,
 *     avgLatency: stats.avgLatency,
 *   };
 * }
 *
 * // Test different thresholds
 * const thresholds = [0.85, 0.90, 0.95];
 * const results = await Promise.all(thresholds.map(testThreshold));
 *
 * console.table(results);
 * ```
 */

export { SemanticCache, EmbeddingService, HNSWIndex } from './semantic';
export { createSemanticCache } from './semantic';
export { createEmbeddingService } from '../embeddings';
export { createHNSWIndex } from '../hnsw';
