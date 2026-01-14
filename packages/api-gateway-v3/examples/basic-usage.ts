/**
 * Basic Usage Example
 */

import { APIGateway, createGateway } from '../src/index.js';
import type { GatewayConfig } from '../src/types/index.js';

// Create gateway configuration
const config: GatewayConfig = {
  id: 'my-gateway',
  name: 'My API Gateway',
  environment: 'production',
  services: [
    {
      id: 'users-service',
      name: 'Users Service',
      version: '1.0.0',
      endpoint: 'https://api.users.example.com',
      timeout: 5000,
      metadata: {
        description: 'User management service',
      },
    },
    {
      id: 'posts-service',
      name: 'Posts Service',
      version: '1.0.0',
      endpoint: 'https://api.posts.example.com',
      timeout: 5000,
      metadata: {
        description: 'Post management service',
      },
    },
  ],
  routes: [
    {
      id: 'get-users',
      path: '/api/users',
      method: ['GET'],
      serviceId: 'users-service',
      cachePolicy: {
        enabled: true,
        ttl: 60000,
        cacheableMethods: ['GET'],
        cacheableStatusCodes: [200],
      },
    },
    {
      id: 'get-posts',
      path: '/api/posts',
      method: ['GET'],
      serviceId: 'posts-service',
    },
  ],
  middleware: [
    {
      name: 'logging',
      enabled: true,
      order: 1,
    },
    {
      name: 'cors',
      enabled: true,
      order: 2,
    },
  ],
  analytics: {
    enabled: true,
    batchSize: 100,
    flushInterval: 10000,
    sampling: 1.0,
    metrics: [
      {
        name: 'request.count',
        type: 'counter',
        enabled: true,
      },
      {
        name: 'request.duration',
        type: 'histogram',
        enabled: true,
      },
    ],
  },
  edge: {
    enabled: true,
    functions: [],
    cache: {
      enabled: true,
      ttl: 3600000,
      purgeKeys: [],
      cacheKeys: [],
    },
    routing: {
      strategy: 'latency',
      regions: [
        {
          name: 'us-east-1',
          code: 'use1',
          endpoint: 'https://use1.example.com',
          latitude: 40.7128,
          longitude: -74.0060,
          healthy: true,
        },
        {
          name: 'eu-west-1',
          code: 'euw1',
          endpoint: 'https://euw1.example.com',
          latitude: 51.5074,
          longitude: -0.1278,
          healthy: true,
        },
      ],
      healthCheck: true,
      healthCheckInterval: 30000,
    },
  },
  caching: {
    enabled: true,
    defaultTTL: 3600000,
    maxSize: 10000,
    evictionPolicy: 'lru',
    compression: true,
  },
  rateLimit: {
    enabled: true,
    defaultLimit: 1000,
    defaultWindow: 60000,
    storage: 'memory',
  },
  circuitBreaker: {
    enabled: true,
    defaultThreshold: 0.5,
    defaultResetTimeout: 60000,
    monitoringEnabled: true,
  },
  versioning: {
    strategy: 'header',
    defaultVersion: 'v1',
    versions: [
      {
        version: 'v1',
        serviceIds: ['users-service', 'posts-service'],
      },
      {
        version: 'v2',
        serviceIds: ['users-service-v2', 'posts-service-v2'],
      },
    ],
  },
  graphql: {
    enabled: false,
    endpoint: '/graphql',
    subscriptions: false,
  },
};

// Create and initialize gateway
const gateway = createGateway(config);

// Export for use in other modules
export { gateway };

// Example request handling
export async function handleRequest(request: Request): Promise<Response> {
  try {
    // Convert to gateway request format
    const gatewayRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      query: new URL(request.url).searchParams,
      params: {},
      context: {},
      metadata: {
        sourceIp: request.headers.get('CF-Connecting-IP') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown',
      },
    };

    // Handle request through gateway
    const gatewayResponse = await gateway.handle(gatewayRequest);

    // Convert back to standard Response
    return new Response(gatewayResponse.body, {
      status: gatewayResponse.status,
      statusText: gatewayResponse.statusText,
      headers: gatewayResponse.headers,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: (error as Error).message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

// Example Cloudflare Worker export
export default {
  async fetch(request: Request): Promise<Response> {
    return handleRequest(request);
  },
};
