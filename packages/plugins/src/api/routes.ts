/**
 * Plugin API routes for Cloudflare Workers
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type {
  PluginManifest,
  PluginId,
  PluginLoadOptions,
  WebhookPayload,
  SecurityContext,
} from '../types';
import { PluginRegistry } from '../registry/plugin-registry';
import { PluginLoader } from '../loader/plugin-loader';
import { PluginDiscovery } from '../registry/discovery';
import { globalWebhookHandler } from '../webhooks';
import {
  PluginNotFoundError,
  PluginValidationError,
  RegistryError,
} from '../types/errors';

// Types for Hono binding
type Bindings = {
  KV: KVNamespace;
  DB: D1Database;
  R2: R2Bucket;
};

type Variables = {
  securityContext: SecurityContext;
};

const api = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * Get security context from request
 */
function getSecurityContext(c: any): SecurityContext {
  const authHeader = c.req.header('Authorization');
  const apiKey = c.req.header('X-API-Key');
  const sessionId = c.req.header('X-Session-Id');

  return {
    userId: c.req.header('X-User-Id'),
    sessionId,
    apiKeyId: apiKey,
    permissions: [], // Would be populated from auth
    roles: [],
    ipAddress: c.req.header('CF-Connecting-IP'),
    userAgent: c.req.header('User-Agent'),
    timestamp: new Date(),
  };
}

// ===== Plugin Management Routes =====

/**
 * GET /api/plugins
 * List all plugins
 */
api.get('/api/plugins', async (c) => {
  const registry = c.get('registry') as PluginRegistry;
  const search = c.req.query('search');
  const type = c.req.query('type');
  const enabled = c.req.query('enabled');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const results = registry.query({
    search,
    type: type as any,
    enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
    limit,
    offset,
  });

  return c.json({
    success: true,
    data: results.map((e) => ({
      ...e.manifest,
      enabled: e.enabled,
      health: e.health,
      state: e.plugin?.getState(),
    })),
    meta: {
      total: results.length,
      limit,
      offset,
    },
  });
});

/**
 * GET /api/plugins/:id
 * Get plugin details
 */
api.get('/api/plugins/:id', async (c) => {
  const registry = c.get('registry') as PluginRegistry;
  const pluginId = c.req.param('id');

  const entry = registry.get(pluginId);
  if (!entry) {
    return c.json({ success: false, error: 'Plugin not found' }, 404);
  }

  return c.json({
    success: true,
    data: {
      manifest: entry.manifest,
      enabled: entry.enabled,
      health: entry.health,
      state: entry.plugin?.getState(),
      metadata: entry.metadata,
      info: entry.plugin?.getInfo(),
    },
  });
});

/**
 * POST /api/plugins
 * Install/register a new plugin
 */
api.post(
  '/api/plugins',
  zValidator('json', z.object({
    manifest: z.any(), // Would use proper schema
    enabled: z.boolean().optional(),
  })),
  async (c) => {
    const registry = c.get('registry') as PluginRegistry;
    const { manifest, enabled = true } = c.req.valid('json');

    try {
      await registry.register(manifest);

      if (enabled === false) {
        await registry.disable(manifest.id);
      }

      return c.json({
        success: true,
        data: { id: manifest.id, message: 'Plugin registered successfully' },
      }, 201);
    } catch (error) {
      return c.json({
        success: false,
        error: (error as Error).message,
      }, 400);
    }
  }
);

/**
 * PUT /api/plugins/:id
 * Update plugin
 */
api.put(
  '/api/plugins/:id',
  zValidator('json', z.object({
    manifest: z.any().optional(),
    enabled: z.boolean().optional(),
  })),
  async (c) => {
    const registry = c.get('registry') as PluginRegistry;
    const pluginId = c.req.param('id');
    const { manifest, enabled } = c.req.valid('json');

    try {
      if (manifest) {
        await registry.update(pluginId, manifest);
      }

      if (enabled !== undefined) {
        if (enabled) {
          await registry.enable(pluginId);
        } else {
          await registry.disable(pluginId);
        }
      }

      return c.json({
        success: true,
        data: { message: 'Plugin updated successfully' },
      });
    } catch (error) {
      return c.json({
        success: false,
        error: (error as Error).message,
      }, 400);
    }
  }
);

/**
 * DELETE /api/plugins/:id
 * Uninstall/remove plugin
 */
api.delete('/api/plugins/:id', async (c) => {
  const registry = c.get('registry') as PluginRegistry;
  const pluginId = c.req.param('id');

  try {
    await registry.unregister(pluginId);
    return c.json({
      success: true,
      data: { message: 'Plugin unregistered successfully' },
    });
  } catch (error) {
    return c.json({
      success: false,
      error: (error as Error).message,
    }, 404);
  }
});

// ===== Plugin Lifecycle Routes =====

/**
 * POST /api/plugins/:id/load
 * Load a plugin
 */
api.post('/api/plugins/:id/load', async (c) => {
  const loader = c.get('loader') as PluginLoader;
  const pluginId = c.req.param('id');
  const body = await c.req.json();

  const options: PluginLoadOptions = {
    sandboxed: body.sandboxed,
    hotReload: body.hotReload,
    autoActivate: body.autoActivate,
    config: body.config,
    secrets: body.secrets,
    env: body.env,
    timeout: body.timeout,
  };

  const result = await loader.load(pluginId, options);

  if (result.success) {
    return c.json({
      success: true,
      data: {
        pluginId,
        message: 'Plugin loaded successfully',
        loadTime: result.loadTime,
      },
    });
  } else {
    return c.json({
      success: false,
      error: result.error,
    }, 400);
  }
});

/**
 * POST /api/plugins/:id/unload
 * Unload a plugin
 */
api.post('/api/plugins/:id/unload', async (c) => {
  const loader = c.get('loader') as PluginLoader;
  const pluginId = c.req.param('id');

  try {
    await loader.unload(pluginId);
    return c.json({
      success: true,
      data: { message: 'Plugin unloaded successfully' },
    });
  } catch (error) {
    return c.json({
      success: false,
      error: (error as Error).message,
    }, 400);
  }
});

/**
 * POST /api/plugins/:id/reload
 * Reload a plugin (hot reload)
 */
api.post('/api/plugins/:id/reload', async (c) => {
  const loader = c.get('loader') as PluginLoader;
  const pluginId = c.req.param('id');

  try {
    await loader.reload(pluginId);
    return c.json({
      success: true,
      data: { message: 'Plugin reloaded successfully' },
    });
  } catch (error) {
    return c.json({
      success: false,
      error: (error as Error).message,
    }, 400);
  }
});

/**
 * POST /api/plugins/:id/activate
 * Activate a plugin
 */
api.post('/api/plugins/:id/activate', async (c) => {
  const registry = c.get('registry') as PluginRegistry;
  const pluginId = c.req.param('id');

  try {
    const entry = registry.get(pluginId);
    if (!entry) {
      throw new PluginNotFoundError(pluginId);
    }

    if (!entry.plugin) {
      throw new Error('Plugin not loaded');
    }

    await entry.plugin.activate();
    await registry.updateHealth(pluginId, 'healthy');

    return c.json({
      success: true,
      data: { message: 'Plugin activated successfully' },
    });
  } catch (error) {
    return c.json({
      success: false,
      error: (error as Error).message,
    }, 400);
  }
});

/**
 * POST /api/plugins/:id/deactivate
 * Deactivate a plugin
 */
api.post('/api/plugins/:id/deactivate', async (c) => {
  const registry = c.get('registry') as PluginRegistry;
  const pluginId = c.req.param('id');

  try {
    const entry = registry.get(pluginId);
    if (!entry) {
      throw new PluginNotFoundError(pluginId);
    }

    if (!entry.plugin) {
      throw new Error('Plugin not loaded');
    }

    await entry.plugin.deactivate();

    return c.json({
      success: true,
      data: { message: 'Plugin deactivated successfully' },
    });
  } catch (error) {
    return c.json({
      success: false,
      error: (error as Error).message,
    }, 400);
  }
});

/**
 * GET /api/plugins/:id/health
 * Get plugin health
 */
api.get('/api/plugins/:id/health', async (c) => {
  const registry = c.get('registry') as PluginRegistry;
  const pluginId = c.req.param('id');

  const entry = registry.get(pluginId);
  if (!entry) {
    return c.json({ success: false, error: 'Plugin not found' }, 404);
  }

  if (!entry.plugin) {
    return c.json({
      success: true,
      data: {
        health: entry.health,
        state: 'not_loaded',
      },
    });
  }

  const health = await entry.plugin.healthCheck();
  return c.json({
    success: true,
    data: health,
  });
});

/**
 * GET /api/plugins/:id/metrics
 * Get plugin metrics
 */
api.get('/api/plugins/:id/metrics', async (c) => {
  const registry = c.get('registry') as PluginRegistry;
  const pluginId = c.req.param('id');

  const entry = registry.get(pluginId);
  if (!entry?.plugin) {
    return c.json({ success: false, error: 'Plugin not loaded' }, 404);
  }

  const metrics = entry.plugin.getMetrics();
  return c.json({
    success: true,
    data: metrics,
  });
});

/**
 * GET /api/plugins/:id/errors
 * Get plugin errors
 */
api.get('/api/plugins/:id/errors', async (c) => {
  const registry = c.get('registry') as PluginRegistry;
  const pluginId = c.req.param('id');

  const entry = registry.get(pluginId);
  if (!entry?.plugin) {
    return c.json({ success: false, error: 'Plugin not loaded' }, 404);
  }

  const errors = entry.plugin.getErrors();
  return c.json({
    success: true,
    data: {
      errors: errors.map((e) => ({
        message: e.message,
        stack: e.stack,
        name: e.name,
      })),
      count: errors.length,
    },
  });
});

// ===== Discovery Routes =====

/**
 * GET /api/plugins/discover
 * Discover plugins from sources
 */
api.get('/api/plugins/discover', async (c) => {
  const discovery = c.get('discovery') as PluginDiscovery;
  const type = c.req.query('type');
  const search = c.req.query('search');
  const minVersion = c.req.query('minVersion');

  if (search) {
    const results = await discovery.search(search, {
      type,
      minVersion,
    });
    return c.json({
      success: true,
      data: results,
    });
  } else {
    const results = await discovery.discover({
      type,
      minVersion,
    });

    return c.json({
      success: true,
      data: results.flatMap((r) => r.manifests),
    });
  }
});

/**
 * GET /api/plugins/featured
 * Get featured plugins
 */
api.get('/api/plugins/featured', async (c) => {
  const discovery = c.get('discovery') as PluginDiscovery;
  const featured = await discovery.getFeatured();

  return c.json({
    success: true,
    data: featured,
  });
});

/**
 * GET /api/plugins/popular
 * Get popular plugins
 */
api.get('/api/plugins/popular', async (c) => {
  const discovery = c.get('discovery') as PluginDiscovery;
  const popular = await discovery.getPopular();

  return c.json({
    success: true,
    data: popular,
  });
});

// ===== Webhook Routes =====

/**
 * POST /api/webhooks
 * Register a webhook
 */
api.post(
  '/api/webhooks',
  zValidator('json', z.object({
    id: z.string(),
    url: z.string().url(),
    secret: z.string(),
    events: z.array(z.string()),
    enabled: z.boolean().optional(),
    method: z.enum(['POST', 'PUT']).optional(),
    headers: z.record(z.string()).optional(),
    timeout: z.number().optional(),
    retry: z.object({
      maxAttempts: z.number(),
      backoffMs: z.number(),
    }).optional(),
  })),
  async (c) => {
    const { id, url, secret, events, enabled = true, method = 'POST', headers, timeout, retry } = c.req.valid('json');

    globalWebhookHandler.register({
      id,
      url,
      secret,
      events: events as any,
      enabled,
      method,
      headers,
      timeout,
      retry,
    });

    return c.json({
      success: true,
      data: { id, message: 'Webhook registered successfully' },
    }, 201);
  }
);

/**
 * DELETE /api/webhooks/:id
 * Unregister a webhook
 */
api.delete('/api/webhooks/:id', async (c) => {
  const webhookId = c.req.param('id');
  globalWebhookHandler.unregister(webhookId);

  return c.json({
    success: true,
    data: { message: 'Webhook unregistered successfully' },
  });
});

/**
 * GET /api/webhooks
 * List all webhooks
 */
api.get('/api/webhooks', async (c) => {
  const webhooks = globalWebhookHandler.getAll();
  return c.json({
    success: true,
    data: webhooks.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      enabled: w.enabled,
      method: w.method,
    })),
  });
});

/**
 * POST /api/webhooks/:id/deliver
 * Test deliver a webhook
 */
api.post('/api/webhooks/:id/deliver', async (c) => {
  const webhookId = c.req.param('id');
  const body = await c.req.json();

  const payload: WebhookPayload = {
    type: body.type || 'custom',
    id: crypto.randomUUID(),
    timestamp: new Date(),
    source: 'test',
    data: body.data || {},
    headers: {},
  };

  const result = await globalWebhookHandler.deliver(webhookId, payload);

  return c.json({
    success: result.success,
    data: result,
  });
});

/**
 * GET /api/webhooks/:id/history
 * Get webhook delivery history
 */
api.get('/api/webhooks/:id/history', async (c) => {
  const webhookId = c.req.param('id');
  const history = globalWebhookHandler.getDeliveryHistory(webhookId);

  return c.json({
    success: true,
    data: history,
  });
});

/**
 * GET /api/webhooks/stats
 * Get webhook statistics
 */
api.get('/api/webhooks/stats', async (c) => {
  const stats = globalWebhookHandler.getStats();
  return c.json({
    success: true,
    data: stats,
  });
});

// ===== Marketplace Routes =====

/**
 * GET /api/marketplace/plugins
 * Browse marketplace plugins
 */
api.get('/api/marketplace/plugins', async (c) => {
  const discovery = c.get('discovery') as PluginDiscovery;
  const search = c.req.query('search');
  const type = c.req.query('type');
  const sort = c.req.query('sort') || 'popular';

  let results: PluginManifest[] = [];

  switch (sort) {
    case 'featured':
      results = await discovery.getFeatured();
      break;
    case 'popular':
      results = await discovery.getPopular();
      break;
    case 'recent':
      results = await discovery.getRecentlyUpdated();
      break;
    default:
      results = await discovery.getPopular();
  }

  // Filter
  if (search) {
    const searchLower = search.toLowerCase();
    results = results.filter((r) =>
      r.name.toLowerCase().includes(searchLower) ||
      r.description.toLowerCase().includes(searchLower) ||
      r.keywords.some((k) => k.toLowerCase().includes(searchLower))
    );
  }

  if (type) {
    results = results.filter((r) => r.type === type);
  }

  return c.json({
    success: true,
    data: results,
    meta: {
      total: results.length,
    },
  });
});

/**
 * GET /api/marketplace/plugins/:id
 * Get marketplace plugin details
 */
api.get('/api/marketplace/plugins/:id', async (c) => {
  const pluginId = c.req.param('id');
  const discovery = c.get('discovery') as PluginDiscovery;

  // Search for the plugin
  const results = await discovery.search(pluginId);
  const plugin = results.find((p) => p.id === pluginId);

  if (!plugin) {
    return c.json({ success: false, error: 'Plugin not found in marketplace' }, 404);
  }

  return c.json({
    success: true,
    data: plugin,
  });
});

// ===== Statistics Routes =====

/**
 * GET /api/stats
 * Get overall system statistics
 */
api.get('/api/stats', async (c) => {
  const registry = c.get('registry') as PluginRegistry;
  const loader = c.get('loader') as PluginLoader;

  const registryStats = registry.getStats();
  const loaderStats = loader.getStats();
  const webhookStats = globalWebhookHandler.getStats();

  return c.json({
    success: true,
    data: {
      registry: registryStats,
      loader: loaderStats,
      webhooks: webhookStats,
      timestamp: new Date(),
    },
  });
});

export { api };
