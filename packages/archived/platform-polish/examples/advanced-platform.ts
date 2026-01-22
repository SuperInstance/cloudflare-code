import { createPlatform, PlatformConfig } from '../src/index';

// Advanced platform configuration with multiple services
const config: PlatformConfig = {
  name: 'Advanced Platform',
  version: '1.0.0',
  environment: 'development',
  services: [
    // API Gateway
    {
      id: 'api-gateway',
      name: 'api-gateway',
      version: '1.0.0',
      host: 'localhost',
      port: 3001,
      healthCheck: {
        enabled: true,
        endpoint: '/health',
        interval: 3000,
        timeout: 2000,
        retries: 3
      },
      loadBalancing: {
        strategy: 'least-connections',
        stickySessions: true,
        healthCheckInterval: 3000,
        nodes: [
          { host: 'localhost', port: 3001, weight: 1 }
        ]
      },
      circuitBreaker: {
        enabled: true,
        threshold: 3,
        timeout: 30000,
        resetTimeout: 15000,
        halfOpenRequests: 1,
        slidingWindowSize: 5,
        slidingWindowType: 'count'
      },
      retry: {
        enabled: true,
        maxAttempts: 5,
        delayMs: 500,
        backoffMultiplier: 1.5,
        maxDelayMs: 5000,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504]
      },
      security: {
        enabled: true,
        auth: {
          type: 'jwt',
          provider: 'auth0'
        },
        rateLimiting: {
          enabled: true,
          requestsPerMinute: 1000,
          burst: 100
        },
        cors: {
          enabled: true,
          origins: ['https://myapp.com', 'https://app.myapp.com'],
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          headers: ['Content-Type', 'Authorization', 'X-Requested-With'],
          credentials: true
        },
        encryption: {
          enabled: true,
          algorithm: 'AES-256-GCM',
          key: process.env.ENCRYPTION_KEY
        }
      },
      cache: {
        enabled: true,
        type: 'redis',
        ttl: 3600,
        maxSize: 50000,
        evictionPolicy: 'lru',
        redis: {
          host: 'localhost',
          port: 6379,
          password: process.env.REDIS_PASSWORD,
          db: 0
        }
      },
      monitoring: {
        enabled: true,
        metrics: {
          enabled: true,
          interval: 5000,
          retention: 86400
        },
        tracing: {
          enabled: true,
          sampling: 0.2
        },
        logging: {
          level: 'debug',
          format: 'json',
          outputs: ['console', 'file']
        }
      }
    },
    // User Service
    {
      id: 'user-service',
      name: 'user-service',
      version: '1.0.0',
      host: 'localhost',
      port: 3002,
      healthCheck: {
        enabled: true,
        endpoint: '/health',
        interval: 5000,
        timeout: 3000,
        retries: 2
      },
      loadBalancing: {
        strategy: 'weighted',
        stickySessions: false,
        healthCheckInterval: 5000,
        nodes: [
          { host: 'localhost', port: 3002, weight: 3 },
          { host: 'localhost', port: 3003, weight: 2 }
        ]
      },
      circuitBreaker: {
        enabled: true,
        threshold: 5,
        timeout: 45000,
        resetTimeout: 20000,
        halfOpenRequests: 2,
        slidingWindowSize: 10,
        slidingWindowType: 'percentage'
      },
      retry: {
        enabled: true,
        maxAttempts: 3,
        delayMs: 1000,
        backoffMultiplier: 2,
        maxDelayMs: 8000,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504]
      },
      security: {
        enabled: true,
        auth: {
          type: 'api-key'
        },
        rateLimiting: {
          enabled: true,
          requestsPerMinute: 200,
          burst: 20
        },
        cors: {
          enabled: true,
          origins: ['*'],
          methods: ['GET', 'POST', 'PUT', 'DELETE'],
          headers: ['*'],
          credentials: false
        },
        encryption: {
          enabled: true,
          algorithm: 'AES-256-GCM'
        }
      },
      cache: {
        enabled: true,
        type: 'memory',
        ttl: 1800,
        maxSize: 10000,
        evictionPolicy: 'lfu'
      },
      monitoring: {
        enabled: true,
        metrics: {
          enabled: true,
          interval: 10000,
          retention: 86400
        },
        tracing: {
          enabled: true,
          sampling: 0.1
        },
        logging: {
          level: 'info',
          format: 'json',
          outputs: ['console']
        }
      }
    },
    // Order Service
    {
      id: 'order-service',
      name: 'order-service',
      version: '1.0.0',
      host: 'localhost',
      port: 3004,
      healthCheck: {
        enabled: true,
        endpoint: '/health',
        interval: 4000,
        timeout: 2500,
        retries: 3
      },
      loadBalancing: {
        strategy: 'ip-hash',
        stickySessions: false,
        healthCheckInterval: 4000,
        nodes: [
          { host: 'localhost', port: 3004, weight: 1 },
          { host: 'localhost', port: 3005, weight: 1 }
        ]
      },
      circuitBreaker: {
        enabled: true,
        threshold: 4,
        timeout: 60000,
        resetTimeout: 30000,
        halfOpenRequests: 1,
        slidingWindowSize: 8,
        slidingWindowType: 'count'
      },
      retry: {
        enabled: true,
        maxAttempts: 4,
        delayMs: 2000,
        backoffMultiplier: 3,
        maxDelayMs: 12000,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504]
      },
      security: {
        enabled: true,
        auth: {
          type: 'oauth'
        },
        rateLimiting: {
          enabled: true,
          requestsPerMinute: 500,
          burst: 50
        },
        cors: {
          enabled: true,
          origins: ['*'],
          methods: ['GET', 'POST', 'PUT', 'DELETE'],
          headers: ['*'],
          credentials: false
        },
        encryption: {
          enabled: false,
          algorithm: 'AES-256-GCM'
        }
      },
      cache: {
        enabled: true,
        type: 'redis',
        ttl: 7200,
        maxSize: 20000,
        evictionPolicy: 'fifo',
        redis: {
          host: 'localhost',
          port: 6379,
          password: process.env.REDIS_PASSWORD,
          db: 1
        }
      },
      monitoring: {
        enabled: true,
        metrics: {
          enabled: true,
          interval: 8000,
          retention: 86400
        },
        tracing: {
          enabled: true,
          sampling: 0.15
        },
        logging: {
          level: 'warn',
          format: 'json',
          outputs: ['console']
        }
      }
    }
  ],
  global: {
    port: 3000,
    host: '0.0.0.0',
    cluster: true,
    workers: 4,
    shutdownTimeout: 45000
  },
  orchestration: {
    enabled: true,
    autoScaling: {
      enabled: true,
      minInstances: 2,
      maxInstances: 20,
      scaleUpThreshold: 0.75,
      scaleDownThreshold: 0.25
    },
    serviceDependencies: [
      {
        service: 'api-gateway',
        dependsOn: ['user-service', 'order-service'],
        version: '1.0.0',
        optional: false
      },
      {
        service: 'user-service',
        dependsOn: [],
        version: '1.0.0',
        optional: true
      },
      {
        service: 'order-service',
        dependsOn: ['user-service'],
        version: '1.0.0',
        optional: false
      }
    ],
    migration: {
      enabled: true,
      autoMigrate: true,
      backupBeforeMigration: true,
      rollbackOnFailure: true
    }
  },
  deployment: {
    enabled: true,
    strategy: 'blue-green',
    healthCheckEndpoint: '/health',
    readinessProbe: {
      enabled: true,
      interval: 3000,
      timeout: 2000,
      threshold: 2,
      failureThreshold: 5
    },
    livenessProbe: {
      enabled: true,
      interval: 15000,
      timeout: 5000,
      threshold: 3,
      failureThreshold: 3
    },
    rollback: {
      enabled: true,
      automatic: true,
      timeout: 300000,
      healthCheckInterval: 5000
    }
  },
  optimization: {
    enabled: true,
    cpu: {
      enabled: true,
      target: 0.6,
      scaleDown: 0.2
    },
    memory: {
      enabled: true,
      target: 0.7,
      scaleDown: 0.2
    },
    network: {
      enabled: true,
      compression: true,
      caching: true
    },
    database: {
      enabled: true,
      connectionPooling: true,
      queryCaching: true
    }
  }
};

async function main() {
  console.log('Creating advanced platform...');
  const platform = createPlatform(config);

  // Add comprehensive event listeners
  platform.on('started', () => {
    console.log('Platform started successfully');
  });

  platform.on('stopped', () => {
    console.log('Platform stopped');
  });

  platform.on('healthUpdate', (health) => {
    console.log('Health update:', `${health.service} - ${health.status}`);
  });

  platform.on('serviceRegistered', (service) => {
    console.log(`Service registered: ${service.name} (${service.id})`);
  });

  platform.on('serviceDeregistered', (serviceId) => {
    console.log(`Service deregistered: ${serviceId}`);
  });

  platform.on('metric', (metric) => {
    if (metric.metric === 'http_requests_total') {
      console.log(`HTTP request: ${metric.service} - ${metric.value}`);
    }
  });

  // Register all services
  console.log('Registering services...');
  for (const serviceConfig of config.services) {
    await platform.registerService(serviceConfig);
    console.log(`Registered: ${serviceConfig.name}`);
  }

  // Start the platform
  await platform.start();

  // Wait for services to be ready
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Get initial stats
  const stats = await platform.getStats();
  console.log('Initial platform stats:', JSON.stringify(stats, null, 2));

  // Make some requests to test load balancing
  console.log('\nTesting load balancing...');
  const services = ['user-service', 'order-service'];

  for (let i = 0; i < 20; i++) {
    const serviceName = services[i % services.length];
    try {
      const response = await platform.requestService(serviceName, '/api/test');
      console.log(`Request ${i + 1} to ${serviceName}: Success`);
    } catch (error) {
      console.error(`Request ${i + 1} to ${serviceName}: Failed - ${error.message}`);
    }

    // Simulate realistic request spacing
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  }

  // Show load balancer stats
  console.log('\nLoad balancer stats:');
  for (const serviceName of services) {
    const lbStats = await platform.getNodeStats(serviceName);
    console.log(`${serviceName}:`, JSON.stringify(lbStats, null, 2));
  }

  // Get health status for all services
  console.log('\nHealth status:');
  const healthStatuses = await platform.getHealthStatus();
  healthStatuses.forEach(status => {
    console.log(`${status.service}: ${status.status} - RT: ${status.responseTime}ms`);
  });

  // Get current metrics
  console.log('\nCurrent metrics:');
  const metrics = await platform.getMetrics();
  console.log(JSON.stringify(metrics, null, 2));

  // Simulate a failure scenario
  console.log('\nSimulating service failure...');
  try {
    // Force open circuit breaker for user service
    await platform.forceOpen('user-service');
    console.log('Circuit breaker opened for user-service');

    // Try to make requests to the failed service
    for (let i = 0; i < 5; i++) {
      try {
        await platform.requestService('user-service', '/api/users');
      } catch (error) {
        console.log(`Expected failure: ${error.message}`);
      }
    }

    // Show fallback stats
    console.log('\nFallback test complete');
  } catch (error) {
    console.error('Error during failure simulation:', error);
  }

  // Show final stats
  console.log('\nFinal platform stats:');
  const finalStats = await platform.getStats();
  console.log(JSON.stringify(finalStats, null, 2));

  // Clean shutdown
  console.log('\nShutting down platform...');
  await platform.stop();
}

// Run the advanced example
main().catch(console.error);