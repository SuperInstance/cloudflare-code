/**
 * Example Routes for Storage System Usage
 *
 * Demonstrates how to use the multi-tier storage system in
 * Cloudflare Workers routes.
 */

import { createStorageManager } from '../lib/storage';
import { createKVCache } from '../lib/kv';
import { createR2Storage } from '../lib/r2';
import { CompressionUtils } from '../lib/compression';
import type { SessionData, MemoryEntry, UserPreferences } from '../types/index';

/**
 * Initialize storage manager from worker environment
 */
function initStorage(env: Env) {
  const kvCache = createKVCache(env.KV_CACHE, {
    defaultTTL: 60 * 60 * 24 * 7, // 7 days
    compression: true,
    retry: true,
  });

  const r2Storage = createR2Storage(env.R2_STORAGE, {
    compression: true,
    retry: true,
    maxUploadSize: 100 * 1024 * 1024, // 100MB
  });

  const storageManager = createStorageManager(
    env.SESSION_DO,
    kvCache,
    r2Storage,
    {
      hotMaxAge: 60 * 60 * 1000, // 1 hour
      warmMaxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      autoMigrate: true,
      promotionThreshold: 5,
    }
  );

  return { kvCache, r2Storage, storageManager };
}

/**
 * Route: Create new session
 *
 * POST /api/sessions
 *
 * Creates a new session in HOT tier (DO Memory)
 * Sub-millisecond access for active sessions
 */
export async function createSessionRoute(request: Request, env: Env): Promise<Response> {
  const { storageManager } = initStorage(env);

  try {
    const body = await request.json() as {
      userId: string;
      language?: string;
      framework?: string;
      projectPath?: string;
    };

    const sessionData: SessionData = {
      sessionId: crypto.randomUUID(),
      userId: body.userId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messages: [],
      metadata: {
        language: body.language ?? 'en',
        framework: body.framework ?? 'unknown',
        projectPath: body.projectPath ?? '',
        repositoryHash: '',
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        cacheHits: 0,
        cacheMisses: 0,
        hitRate: 0,
      },
      storage: {
        tier: 'hot',
        compressed: false,
        sizeBytes: 0,
        checkpointCount: 0,
        lastCheckpoint: Date.now(),
      },
    };

    // Store in HOT tier
    const result = await storageManager.set(
      sessionData.sessionId,
      sessionData,
      'session',
      'hot'
    );

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        sessionId: sessionData.sessionId,
        tier: result.tier,
        latency: result.latency,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Route: Get session
 *
 * GET /api/sessions/:sessionId
 *
 * Retrieves session from HOT/WARM/COLD tier automatically
 * Demonstrates tier fallback and automatic promotion
 */
export async function getSessionRoute(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const { storageManager } = initStorage(env);

  const url = new URL(request.url);
  const sessionId = url.pathname.split('/').pop();

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: 'Session ID required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Try all tiers (HOT -> WARM -> COLD)
  const result = await storageManager.get(sessionId, 'session');

  if (!result.success || !result.data) {
    return new Response(
      JSON.stringify({ error: 'Session not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // If data was retrieved from WARM or COLD, schedule promotion to HOT
  if (result.tier !== 'hot') {
    ctx.waitUntil(
      storageManager.promote(sessionId, result.tier, 'hot', 'session')
    );
  }

  return new Response(
    JSON.stringify({
      session: result.data,
      tier: result.tier,
      latency: result.latency,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Route: Store embedding
 *
 * POST /api/embeddings
 *
 * Stores embeddings in WARM tier (KV) with int8 quantization
 * 4x compression for efficient storage
 */
export async function storeEmbeddingRoute(request: Request, env: Env): Promise<Response> {
  const { kvCache } = initStorage(env);

  try {
    const body = await request.json() as {
      key: string;
      embedding: number[];
    };

    const embedding = new Float32Array(body.embedding);

    // Compress embedding (4x reduction with int8 quantization)
    const compressed = CompressionUtils.compressEmbeddingInt8(embedding);

    console.log(`Embedding compression:`);
    console.log(`  Original: ${compressed.originalSize} bytes`);
    console.log(`  Compressed: ${compressed.quantizedSize} bytes`);
    console.log(`  Ratio: ${compressed.compressionRatio}x`);

    // Store in KV (WARM tier)
    await kvCache.setEmbedding(body.key, embedding, 60 * 60 * 24 * 30); // 30 days

    return new Response(
      JSON.stringify({
        key: body.key,
        compressedSize: compressed.quantizedSize,
        originalSize: compressed.originalSize,
        compressionRatio: compressed.compressionRatio,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Route: Cache LLM response
 *
 * POST /api/cache
 *
 * Caches LLM responses in WARM tier (KV)
 * Demonstrates semantic caching for cost reduction
 */
export async function cacheLLMResponseRoute(request: Request, env: Env): Promise<Response> {
  const { kvCache } = initStorage(env);

  try {
    const body = await request.json() as {
      prompt: string;
      response: string;
      model: string;
      tokens: number;
      cost: number;
      latency: number;
    };

    // Generate hash for prompt
    const promptHash = await generatePromptHash(body.prompt);

    // Check cache first
    const cached = await kvCache.getCachedLLMResponse(promptHash);

    if (cached) {
      // Cache hit - return cached response
      return new Response(
        JSON.stringify({
          response: cached.response,
          cacheHit: true,
          latency: 0,
          cost: 0,
          metadata: cached.metadata,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Cache miss - store response
    await kvCache.cacheLLMResponse(
      promptHash,
      body.response,
      {
        model: body.model,
        tokens: body.tokens,
        cost: body.cost,
        latency: body.latency,
      },
      60 * 60 * 24 * 7 // 7 days TTL
    );

    return new Response(
      JSON.stringify({
        cacheHit: false,
        message: 'Response cached',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Route: Archive conversation
 *
 * POST /api/conversations/:sessionId/archive
 *
 * Archives conversation to COLD tier (R2)
 * Demonstrates long-term storage and compression
 */
export async function archiveConversationRoute(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const { r2Storage, storageManager } = initStorage(env);

  const url = new URL(request.url);
  const sessionId = url.pathname.split('/').slice(-2, -1)[0];

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: 'Session ID required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get session from any tier
    const sessionResult = await storageManager.get(sessionId, 'session');

    if (!sessionResult.success || !sessionResult.data) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const session = sessionResult.data as SessionData;

    // Compress session data
    const compressed = await CompressionUtils.compressSession(session);

    console.log(`Session compression:`);
    console.log(`  Original: ${compressed.originalSize} bytes`);
    console.log(`  Compressed: ${compressed.compressedSize} bytes`);
    console.log(`  Ratio: ${compressed.compressionRatio.toFixed(2)}x`);

    // Archive to R2 (COLD tier)
    await r2Storage.archiveSession(session);

    // Also store conversation history separately
    await r2Storage.storeConversationHistory(sessionId, session.messages, {
      messageCount: String(session.metadata.messageCount),
      totalTokens: String(session.metadata.totalTokens),
    });

    // Optionally migrate session from HOT to COLD
    if (sessionResult.tier === 'hot') {
      ctx.waitUntil(
        storageManager.migrate(sessionId, 'hot', 'cold', 'session')
      );
    }

    return new Response(
      JSON.stringify({
        sessionId,
        archived: true,
        compressionRatio: compressed.compressionRatio,
        originalSize: compressed.originalSize,
        compressedSize: compressed.compressedSize,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Route: Get user preferences
 *
 * GET /api/users/:userId/preferences
 *
 * Retrieves user preferences from WARM tier (KV)
 */
export async function getUserPreferencesRoute(request: Request, env: Env): Promise<Response> {
  const { kvCache } = initStorage(env);

  const url = new URL(request.url);
  const userId = url.pathname.split('/').slice(-2, -1)[0];

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'User ID required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const preferences = await kvCache.getUserPreferences(userId);

  if (!preferences) {
    return new Response(
      JSON.stringify({ error: 'Preferences not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify(preferences),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Route: Update user preferences
 *
 * PUT /api/users/:userId/preferences
 *
 * Updates user preferences in WARM tier (KV)
 */
export async function updateUserPreferencesRoute(request: Request, env: Env): Promise<Response> {
  const { kvCache } = initStorage(env);

  const url = new URL(request.url);
  const userId = url.pathname.split('/').slice(-2, -1)[0];

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'User ID required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const updates = await request.json() as Partial<UserPreferences>;

    // Get existing preferences
    const existing = await kvCache.getUserPreferences(userId);

    // Merge with updates
    const preferences: UserPreferences = existing ?? {
      userId,
      theme: 'auto',
      language: 'en',
      framework: 'unknown',
      defaultModel: 'claude-3',
      temperature: 0.7,
      maxTokens: 4096,
      agentConfig: {
        directorEnabled: true,
        plannerEnabled: true,
        executorEnabled: true,
      },
      cacheConfig: {
        enabled: true,
        ttl: 3600,
        maxSize: 1000,
      },
    };

    Object.assign(preferences, updates);

    // Store in KV
    await kvCache.setUserPreferences(userId, preferences);

    return new Response(
      JSON.stringify(preferences),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Route: Get storage statistics
 *
 * GET /api/storage/stats
 *
 * Returns statistics across all storage tiers
 */
export async function getStorageStatsRoute(request: Request, env: Env): Promise<Response> {
  const { storageManager } = initStorage(env);

  const stats = await storageManager.getStats();

  return new Response(
    JSON.stringify({
      hot: {
        description: 'HOT Tier (DO Memory)',
        latency: '< 1ms',
        capacity: '128MB per DO',
        ...stats.hot,
      },
      warm: {
        description: 'WARM Tier (KV)',
        latency: '1-50ms',
        capacity: '1GB',
        ...stats.warm,
      },
      cold: {
        description: 'COLD Tier (R2)',
        latency: '50-100ms',
        capacity: '10GB',
        ...stats.cold,
      },
      accessPatterns: stats.totalAccessPatterns,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Route: Run migration policy
 *
 * POST /api/storage/migrate
 *
 * Manually trigger migration policy
 * Moves data between tiers based on age and access patterns
 */
export async function runMigrationRoute(request: Request, env: Env): Promise<Response> {
  const { storageManager } = initStorage(env);

  const result = await storageManager.runMigrationPolicy();

  return new Response(
    JSON.stringify({
      migrated: result.migrated,
      errors: result.errors,
      message: `Migrated ${result.migrated} items with ${result.errors} errors`,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Helper: Generate hash for prompt
 */
async function generatePromptHash(prompt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(prompt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Main worker export
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route matching
    if (path === '/api/sessions' && request.method === 'POST') {
      return createSessionRoute(request, env);
    }

    if (path.startsWith('/api/sessions/') && request.method === 'GET') {
      return getSessionRoute(request, env, ctx);
    }

    if (path === '/api/embeddings' && request.method === 'POST') {
      return storeEmbeddingRoute(request, env);
    }

    if (path === '/api/cache' && request.method === 'POST') {
      return cacheLLMResponseRoute(request, env);
    }

    if (path.match(/\/api\/conversations\/[^/]+\/archive/) && request.method === 'POST') {
      return archiveConversationRoute(request, env, ctx);
    }

    if (path.match(/\/api\/users\/[^/]+\/preferences/) && request.method === 'GET') {
      return getUserPreferencesRoute(request, env);
    }

    if (path.match(/\/api\/users\/[^/]+\/preferences/) && request.method === 'PUT') {
      return updateUserPreferencesRoute(request, env);
    }

    if (path === '/api/storage/stats' && request.method === 'GET') {
      return getStorageStatsRoute(request, env);
    }

    if (path === '/api/storage/migrate' && request.method === 'POST') {
      return runMigrationRoute(request, env);
    }

    // 404 for unknown routes
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  },
};
