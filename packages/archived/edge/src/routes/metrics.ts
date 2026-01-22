/**
 * Metrics Routes
 *
 * Provides endpoints for metrics collection, monitoring, and dashboard data.
 * Compatible with Prometheus scraping and custom dashboards.
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { RequestMetricsCollector } from '../lib/metrics/request';
import { ProviderMetricsCollector } from '../lib/metrics/provider';
import { CacheMetricsCollector } from '../lib/metrics/cache';
import { MetricsAggregator } from '../lib/metrics/aggregator';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /metrics - Prometheus-style metrics endpoint
 *
 * Returns metrics in Prometheus text format for scraping.
 */
app.get('/metrics', async (c) => {
  try {
    // Initialize collectors
    const requestCollector = new RequestMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );
    const providerCollector = new ProviderMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );
    const cacheCollector = new CacheMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );

    const aggregator = new MetricsAggregator(
      requestCollector,
      providerCollector,
      cacheCollector
    );

    // Get Prometheus metrics
    const metrics = await aggregator.getPrometheusMetrics();

    return c.text(metrics, 200, {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    });
  } catch (error) {
    console.error('Error generating metrics:', error);
    return c.text(
      `# Error generating metrics\n${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      }
    );
  }
});

/**
 * GET /v1/metrics/dashboard - Dashboard data endpoint
 *
 * Returns aggregated metrics for dashboard visualization.
 *
 * Query params:
 * - timeRange: 'hour' | 'day' | 'week' (default: 'day')
 */
app.get('/v1/metrics/dashboard', async (c) => {
  try {
    const timeRange = (c.req.query('timeRange') || 'day') as
      | 'hour'
      | 'day'
      | 'week';

    // Initialize collectors
    const requestCollector = new RequestMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );
    const providerCollector = new ProviderMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );
    const cacheCollector = new CacheMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );

    const aggregator = new MetricsAggregator(
      requestCollector,
      providerCollector,
      cacheCollector
    );

    // Get dashboard data
    const data = await aggregator.getDashboardData(timeRange);

    return c.json(data, 200, {
      'Cache-Control': 'public, max-age=15', // Cache for 15 seconds
    });
  } catch (error) {
    console.error('Error generating dashboard data:', error);
    return c.json(
      {
        error: 'Failed to generate dashboard data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /v1/metrics/savings - Cost savings endpoint
 *
 * Returns cost savings from optimizations.
 *
 * Query params:
 * - period: 'hour' | 'day' | 'week' (default: 'day')
 */
app.get('/v1/metrics/savings', async (c) => {
  try {
    const period = (c.req.query('period') || 'day') as 'hour' | 'day' | 'week';

    // Initialize collectors
    const requestCollector = new RequestMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );
    const providerCollector = new ProviderMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );
    const cacheCollector = new CacheMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );

    const aggregator = new MetricsAggregator(
      requestCollector,
      providerCollector,
      cacheCollector
    );

    // Get savings
    const savings = await aggregator.calculateSavings(period);

    return c.json(savings, 200, {
      'Cache-Control': 'public, max-age=60', // Cache for 1 minute
    });
  } catch (error) {
    console.error('Error calculating savings:', error);
    return c.json(
      {
        error: 'Failed to calculate savings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /v1/metrics/providers - Provider status endpoint
 *
 * Returns health and performance metrics for all providers.
 */
app.get('/v1/metrics/providers', async (c) => {
  try {
    const providerCollector = new ProviderMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );

    const providers = await providerCollector.getAllProviders();

    return c.json(providers, 200, {
      'Cache-Control': 'public, max-age=30', // Cache for 30 seconds
    });
  } catch (error) {
    console.error('Error getting provider metrics:', error);
    return c.json(
      {
        error: 'Failed to get provider metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /v1/metrics/providers/:provider - Individual provider endpoint
 *
 * Returns detailed metrics for a specific provider.
 */
app.get('/v1/metrics/providers/:provider', async (c) => {
  try {
    const provider = c.req.param('provider');

    const providerCollector = new ProviderMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );

    const status = await providerCollector.getProviderStatus(provider);

    if (!status) {
      return c.json(
        {
          error: 'Provider not found',
          provider,
        },
        404
      );
    }

    return c.json(status, 200, {
      'Cache-Control': 'public, max-age=30',
    });
  } catch (error) {
    console.error('Error getting provider status:', error);
    return c.json(
      {
        error: 'Failed to get provider status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /v1/metrics/cache - Cache performance endpoint
 *
 * Returns cache metrics for all tiers.
 */
app.get('/v1/metrics/cache', async (c) => {
  try {
    const cacheCollector = new CacheMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );

    const [allTiers, overall, savings] = await Promise.all([
      cacheCollector.getAllTiers(),
      cacheCollector.getOverallMetrics(),
      cacheCollector.getSavings(),
    ]);

    return c.json(
      {
        tiers: allTiers,
        overall,
        savings,
      },
      200,
      {
        'Cache-Control': 'public, max-age=15',
      }
    );
  } catch (error) {
    console.error('Error getting cache metrics:', error);
    return c.json(
      {
        error: 'Failed to get cache metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /v1/metrics/anomalies - Anomaly detection endpoint
 *
 * Returns detected anomalies in metrics.
 */
app.get('/v1/metrics/anomalies', async (c) => {
  try {
    const requestCollector = new RequestMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );
    const providerCollector = new ProviderMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );
    const cacheCollector = new CacheMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );

    const aggregator = new MetricsAggregator(
      requestCollector,
      providerCollector,
      cacheCollector
    );

    const anomalies = await aggregator.detectAnomalies();

    return c.json(
      {
        anomalies,
        count: anomalies.length,
        timestamp: Date.now(),
      },
      200,
      {
        'Cache-Control': 'public, max-age=30',
      }
    );
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    return c.json(
      {
        error: 'Failed to detect anomalies',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /v1/metrics/forecast - Cost forecast endpoint
 *
 * Returns cost forecast for next hour, day, and week.
 *
 * Query params:
 * - period: 'hour' | 'day' | 'week' (default: 'day')
 */
app.get('/v1/metrics/forecast', async (c) => {
  try {
    const period = (c.req.query('period') || 'day') as 'hour' | 'day' | 'week';

    const requestCollector = new RequestMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );
    const providerCollector = new ProviderMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );
    const cacheCollector = new CacheMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );

    const aggregator = new MetricsAggregator(
      requestCollector,
      providerCollector,
      cacheCollector
    );

    const forecast = await aggregator.generateForecast(Date.now(), period);

    return c.json(forecast, 200, {
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
    });
  } catch (error) {
    console.error('Error generating forecast:', error);
    return c.json(
      {
        error: 'Failed to generate forecast',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /v1/metrics/top-providers - Top providers endpoint
 *
 * Returns ranked providers by usage, cost, latency, and quality.
 *
 * Query params:
 * - limit: number of providers to return (default: 5)
 */
app.get('/v1/metrics/top-providers', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '5', 10);

    const requestCollector = new RequestMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );
    const providerCollector = new ProviderMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );
    const cacheCollector = new CacheMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );

    const aggregator = new MetricsAggregator(
      requestCollector,
      providerCollector,
      cacheCollector
    );

    const topProviders = await aggregator.getTopProviders(limit);

    return c.json(topProviders, 200, {
      'Cache-Control': 'public, max-age=60',
    });
  } catch (error) {
    console.error('Error getting top providers:', error);
    return c.json(
      {
        error: 'Failed to get top providers',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /v1/metrics/record - Record metrics endpoint
 *
 * Records metrics for a request. Used internally by the API.
 */
app.post('/v1/metrics/record', async (c) => {
  try {
    const body = await c.req.json();

    // Validate required fields
    if (!body.requestId || !body.provider || !body.model) {
      return c.json(
        {
          error: 'Missing required fields',
          required: ['requestId', 'provider', 'model'],
        },
        400
      );
    }

    // Initialize collectors
    const requestCollector = new RequestMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );
    const providerCollector = new ProviderMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );
    const cacheCollector = new CacheMetricsCollector(
      c.env.CACHE_KV!,
      c.env.STORAGE_R2!
    );

    // Record request metrics
    await requestCollector.record({
      requestId: body.requestId,
      timestamp: body.timestamp || Date.now(),
      provider: body.provider,
      model: body.model,
      latency: body.latency || 0,
      tokens: body.tokens || { prompt: 0, completion: 0, total: 0 },
      cacheHit: body.cacheHit || false,
      cacheTier: body.cacheTier,
      cost: body.cost || 0,
      success: body.success ?? true,
      errorCode: body.errorCode,
      userId: body.userId,
      sessionId: body.sessionId,
      feature: body.feature,
    });

    // Record provider metrics
    if (body.success) {
      providerCollector.recordSuccess(
        body.provider,
        body.latency || 0,
        body.tokens?.total || 0
      );
    } else {
      providerCollector.recordFailure(body.provider, body.errorCode || 'UNKNOWN');
    }

    // Record cache metrics
    if (body.cacheHit) {
      cacheCollector.recordHit(
        body.cacheTier || 'warm',
        body.cacheLatency || body.latency || 0
      );
    } else {
      cacheCollector.recordMiss(
        body.cacheTier || 'warm',
        body.cacheLatency || body.latency || 0
      );
    }

    return c.json({ success: true, recorded: true }, 200);
  } catch (error) {
    console.error('Error recording metrics:', error);
    return c.json(
      {
        error: 'Failed to record metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default app;
