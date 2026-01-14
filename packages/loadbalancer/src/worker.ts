/**
 * Cloudflare Worker implementation for the load balancer
 */

import { LoadBalancer } from './loadbalancer.js';
import type { LoadBalancerConfig, Region, RegionInfo } from './types/index.js';

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
}

/**
 * Sample Cloudflare Worker for the load balancer
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Initialize load balancer with configuration
      const config = await loadBalancerConfig(env);
      const loadBalancer = new LoadBalancer(config);

      // Perform health check if requested
      const url = new URL(request.url);
      if (url.pathname === '/health') {
        const health = await loadBalancer.healthCheck();
        return Response.json(health, {
          status: health.healthy ? 200 : 503,
        });
      }

      // Get stats if requested
      if (url.pathname === '/stats') {
        const stats = loadBalancer.getStats();
        return Response.json(stats);
      }

      // Route the request
      const decision = await loadBalancer.route(request);

      // Add routing information to response headers
      const headers = new Headers();
      headers.set('X-Region', decision.selectedRegion);
      headers.set('X-Datacenter', decision.selectedDatacenter);
      headers.set('X-Confidence', decision.confidence.toString());
      headers.set('X-Request-ID', decision.requestId);

      // Forward request to selected endpoint
      const targetUrl = new URL(request.url);
      targetUrl.hostname = new URL(decision.selectedEndpoint).hostname;

      const forwardedRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        // @ts-ignore - Cloudflare-specific property
        cf: request.cf,
      });

      // Add routing headers
      forwardedRequest.headers.set('X-Forwarded-By', 'ClaudeFlare-LB');
      forwardedRequest.headers.set('X-Request-ID', decision.requestId);

      const response = await fetch(forwardedRequest);

      // Copy response headers and add our own
      const responseHeaders = new Headers(response.headers);
      for (const [key, value] of headers.entries()) {
        responseHeaders.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });

    } catch (error) {
      console.error('Load balancer error:', error);

      return Response.json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  },
};

/**
 * Load load balancer configuration from environment
 */
async function loadBalancerConfig(env: Env): Promise<LoadBalancerConfig> {
  // Load regions from database or KV
  const regions = await loadRegions(env);

  return {
    regions,
    defaultStrategy: 'adaptive',
    fallbackStrategy: 'geographic',
    geographic: {
      preferContinentLocal: true,
      maxDistanceKm: 15000,
    },
    latency: {
      preferP50: false,
      maxLatency: 300,
      enablePrediction: true,
    },
    capacity: {
      maxUtilization: 0.85,
      enablePrediction: true,
    },
    health: {
      checkInterval: 30000,
      automaticFailover: true,
    },
    traffic: {
      enableRateLimiting: true,
      enableThrottling: true,
      enableDDoSProtection: true,
    },
    anycast: {
      enabled: true,
    },
  };
}

/**
 * Load region configuration from database
 */
async function loadRegions(env: Env): Promise<Map<Region, RegionInfo>> {
  const regions = new Map<Region, RegionInfo>();

  try {
    // Query database for region configuration
    const result = await env.DB.prepare(`
      SELECT id, name, capacity, available_capacity, status, health_score, priority
      FROM regions
      WHERE status IN ('active', 'degraded')
    `).all();

    for (const row of result.results) {
      // Load datacenters for this region
      const datacenters = await loadDatacenters(env, row.id as string);

      regions.set(row.id as string, {
        id: row.id as string,
        name: row.name as string,
        location: {
          country: 'US',
          continent: 'NA',
          latitude: 0,
          longitude: 0,
        },
        capacity: row.capacity as number,
        availableCapacity: row.available_capacity as number,
        status: row.status as any,
        healthScore: row.health_score as number,
        latencyScore: 0,
        priority: row.priority as number,
        datacenters,
      });
    }

  } catch (error) {
    console.error('Failed to load regions:', error);

    // Return default regions if database query fails
    return getDefaultRegions();
  }

  return regions;
}

/**
 * Load datacenters for a region
 */
async function loadDatacenters(env: Env, regionId: string): Promise<any[]> {
  try {
    const result = await env.DB.prepare(`
      SELECT id, name, capacity, available_capacity, status, health_score, endpoint
      FROM datacenters
      WHERE region_id = ?
      AND status != 'unhealthy'
    `).bind(regionId).all();

    return result.results.map((row: any) => ({
      id: row.id,
      region: regionId,
      name: row.name,
      location: {
        country: 'US',
        continent: 'NA',
        latitude: 0,
        longitude: 0,
      },
      capacity: row.capacity,
      availableCapacity: row.available_capacity,
      status: row.status,
      healthScore: row.health_score,
      endpoints: [row.endpoint],
    }));

  } catch (error) {
    console.error(`Failed to load datacenters for region ${regionId}:`, error);
    return [];
  }
}

/**
 * Get default region configuration
 */
function getDefaultRegions(): Map<Region, RegionInfo> {
  const regions = new Map<Region, RegionInfo>();

  regions.set('us-east-1', {
    id: 'us-east-1',
    name: 'US East (N. Virginia)',
    location: {
      country: 'US',
      continent: 'NA',
      latitude: 38.13,
      longitude: -78.45,
    },
    capacity: 10000,
    availableCapacity: 8000,
    status: 'active',
    healthScore: 95,
    latencyScore: 90,
    priority: 10,
    datacenters: [{
      id: 'dc-use1-1',
      region: 'us-east-1',
      name: 'N. Virginia Data Center',
      location: {
        country: 'US',
        continent: 'NA',
        latitude: 38.13,
        longitude: -78.45,
      },
      capacity: 10000,
      availableCapacity: 8000,
      status: 'healthy',
      healthScore: 95,
      endpoints: ['https://use1.claudeflare.com'],
    }],
  });

  regions.set('eu-west-1', {
    id: 'eu-west-1',
    name: 'EU (Ireland)',
    location: {
      country: 'IE',
      continent: 'EU',
      latitude: 53.41,
      longitude: -6.27,
    },
    capacity: 8000,
    availableCapacity: 7000,
    status: 'active',
    healthScore: 92,
    latencyScore: 88,
    priority: 9,
    datacenters: [{
      id: 'dc-euw1-1',
      region: 'eu-west-1',
      name: 'Ireland Data Center',
      location: {
        country: 'IE',
        continent: 'EU',
        latitude: 53.41,
        longitude: -6.27,
      },
      capacity: 8000,
      availableCapacity: 7000,
      status: 'healthy',
      healthScore: 92,
      endpoints: ['https://euw1.claudeflare.com'],
    }],
  });

  regions.set('ap-southeast-1', {
    id: 'ap-southeast-1',
    name: 'Asia Pacific (Singapore)',
    location: {
      country: 'SG',
      continent: 'AS',
      latitude: 1.35,
      longitude: 103.82,
    },
    capacity: 6000,
    availableCapacity: 5000,
    status: 'active',
    healthScore: 90,
    latencyScore: 85,
    priority: 8,
    datacenters: [{
      id: 'dc-apse1-1',
      region: 'ap-southeast-1',
      name: 'Singapore Data Center',
      location: {
        country: 'SG',
        continent: 'AS',
        latitude: 1.35,
        longitude: 103.82,
      },
      capacity: 6000,
      availableCapacity: 5000,
      status: 'healthy',
      healthScore: 90,
      endpoints: ['https://apse1.claudeflare.com'],
    }],
  });

  return regions;
}
