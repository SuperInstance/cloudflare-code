/**
 * Basic API Gateway Usage Example
 *
 * This example demonstrates how to set up and use the API Gateway
 * for basic request routing and proxying.
 */

import { createAPIGateway } from '../src';

// Define your gateway configuration
const gatewayConfig = {
  id: 'my-api-gateway',
  name: 'My API Gateway',
  environment: 'production' as const,

  // Define routes
  routes: [
    {
      id: 'api-v1-users',
      name: 'Users API v1',
      path: '/api/v1/users',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      upstream: {
        type: 'load_balanced',
        targets: [
          {
            id: 'users-service-1',
            url: 'https://users-service-1.example.com',
            weight: 1,
            healthStatus: 'healthy',
          },
          {
            id: 'users-service-2',
            url: 'https://users-service-2.example.com',
            weight: 1,
            healthStatus: 'healthy',
          },
        ],
        strategy: 'round_robin',
        healthCheck: {
          enabled: true,
          path: '/health',
          interval: 30000,
          timeout: 5000,
          unhealthyThreshold: 3,
          healthyThreshold: 2,
        },
      },
      middleware: [],
      auth: {
        required: true,
        methods: ['api_key', 'jwt'],
        jwt: {
          issuer: 'https://auth.example.com',
          audience: ['api.example.com'],
          algorithms: ['RS256'],
          issuers: ['https://auth.example.com'],
        },
      },
      rateLimit: {
        enabled: true,
        algorithm: 'token_bucket',
        limits: [
          {
            id: 'users-api-limit',
            name: 'Users API Rate Limit',
            scope: 'per_user',
            limit: 100,
            window: 60000, // 1 minute
          },
        ],
      },
      cache: {
        enabled: true,
        ttl: 300, // 5 minutes
        staleTtl: 60,
        cacheableStatuses: [200],
      },
    },

    {
      id: 'api-v1-posts',
      name: 'Posts API v1',
      path: '/api/v1/posts',
      methods: ['GET', 'POST'],
      upstream: {
        type: 'single',
        targets: [
          {
            id: 'posts-service',
            url: 'https://posts-service.example.com',
          },
        ],
      },
      middleware: [],
      auth: {
        required: true,
        methods: ['api_key'],
      },
      rateLimit: {
        enabled: true,
        algorithm: 'sliding_window',
        limits: [
          {
            id: 'posts-api-limit',
            name: 'Posts API Rate Limit',
            scope: 'per_ip',
            limit: 1000,
            window: 3600000, // 1 hour
          },
        ],
      },
    },
  ],

  globalMiddleware: [],

  defaultAuth: {
    required: false,
    methods: ['none'],
  },

  defaultRateLimit: {
    enabled: true,
    algorithm: 'token_bucket',
    limits: [
      {
        id: 'global-limit',
        name: 'Global Rate Limit',
        scope: 'per_ip',
        limit: 10000,
        window: 3600000, // 1 hour
      },
    ],
  },

  errorHandling: {
    includeStackTrace: false,
    includeRequestDetails: true,
    customErrors: {
      404: {
        status: 404,
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
      },
      500: {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'An internal server error occurred',
      },
    },
  },

  analytics: {
    enabled: true,
    sampleRate: 0.1, // Sample 10% of requests
    bufferSize: 1000,
    flushInterval: 60000, // 1 minute
    events: ['request', 'response', 'error'],
  },

  monitoring: {
    enabled: true,
    metricsPath: '/metrics',
    healthCheckPath: '/health',
    readinessCheckPath: '/ready',
  },
};

// Create the gateway with environment bindings
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const gateway = createAPIGateway({
      env: {
        KV: env.KIEWS,
        DO: env.DURABLE_OBJECTS,
        R2: env.R2_BUCKETS,
        D1: env.DATABASES,
        secrets: env.SECRETS,
        services: env.SERVICES,
        vars: env.VARS,
      },
      config: gatewayConfig,
    });

    return gateway.handle(request, ctx);
  },
};
