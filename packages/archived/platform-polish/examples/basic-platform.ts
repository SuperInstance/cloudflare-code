import { createPlatform, PlatformConfig } from '../src/index';

// Example platform configuration
const config: PlatformConfig = {
  name: 'Example Platform',
  version: '1.0.0',
  environment: 'development',
  services: [
    {
      id: 'user-service',
      name: 'user-service',
      version: '1.0.0',
      host: 'localhost',
      port: 3001,
      healthCheck: {
        enabled: true,
        endpoint: '/health',
        interval: 5000,
        timeout: 3000,
        retries: 3,
        healthyThreshold: 2,
        unhealthyThreshold: 3
      },
      loadBalancing: {
        strategy: 'round-robin',
        stickySessions: false,
        healthCheckInterval: 5000,
        nodes: [
          {
            host: 'localhost',
            port: 3001,
            weight: 1,
            healthy: true,
            connections: 0,
            lastHealthCheck: new Date()
          }
        ]
      },
      circuitBreaker: {
        enabled: true,
        threshold: 5,
        timeout: 60000,
        resetTimeout: 30000,
        halfOpenRequests: 1,
        slidingWindowSize: 10,
        slidingWindowType: 'count'
      },
      retry: {
        enabled: true,
        maxAttempts: 3,
        delayMs: 1000,
        backoffMultiplier: 2,
        maxDelayMs: 10000,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504]
      },
      security: {
        enabled: true,
        auth: {
          type: 'api-key'
        },
        rateLimiting: {
          enabled: true,
          requestsPerMinute: 60,
          burst: 10
        },
        cors: {
          enabled: true,
          origins: ['*'],
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
        type: 'memory',
        ttl: 3600,
        maxSize: 10000,
        evictionPolicy: 'lru'
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
    }
  ],
  global: {
    port: 3000,
    host: 'localhost',
    cluster: false,
    workers: 1,
    shutdownTimeout: 30000
  },
  orchestration: {
    enabled: true,
    autoScaling: {
      enabled: true,
      minInstances: 1,
      maxInstances: 10,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.3
    },
    serviceDependencies: [],
    migration: {
      enabled: true,
      autoMigrate: true,
      backupBeforeMigration: true,
      rollbackOnFailure: true
    }
  },
  deployment: {
    enabled: true,
    strategy: 'rolling',
    healthCheckEndpoint: '/health',
    readinessProbe: {
      enabled: true,
      interval: 5000,
      timeout: 3000,
      threshold: 1,
      failureThreshold: 3
    },
    livenessProbe: {
      enabled: true,
      interval: 10000,
      timeout: 3000,
      threshold: 1,
      failureThreshold: 3
    },
    rollback: {
      enabled: true,
      automatic: true,
      timeout: 300000,
      healthCheckInterval: 10000
    }
  },
  optimization: {
    enabled: true,
    cpu: {
      enabled: true,
      target: 0.7,
      scaleDown: 0.3
    },
    memory: {
      enabled: true,
      target: 0.8,
      scaleDown: 0.3
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
  console.log('Creating platform...');
  const platform = createPlatform(config);

  // Add event listeners
  platform.on('started', () => {
    console.log('Platform started successfully');
  });

  platform.on('stopped', () => {
    console.log('Platform stopped');
  });

  platform.on('healthUpdate', (health) => {
    console.log('Health update:', health);
  });

  platform.on('serviceRegistered', (service) => {
    console.log('Service registered:', service.name);
  });

  // Start the platform
  await platform.start();

  // Register some services
  await platform.registerService(config.services[0]);

  // Get service stats
  const stats = await platform.getStats();
  console.log('Platform stats:', stats);

  // Make a service request
  try {
    const response = await platform.requestService('user-service', '/api/users');
    console.log('Service response:', response);
  } catch (error) {
    console.error('Service request failed:', error);
  }

  // Get health status
  const healthStatus = await platform.getHealthStatus();
  console.log('Health status:', healthStatus);

  // Get metrics
  const metrics = await platform.getMetrics();
  console.log('Metrics:', metrics);

  // Simulate some load
  for (let i = 0; i < 10; i++) {
    try {
      await platform.requestService('user-service', '/api/users');
      console.log(`Request ${i + 1} completed`);
    } catch (error) {
      console.error(`Request ${i + 1} failed:`, error.message);
    }

    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Show final stats
  const finalStats = await platform.getStats();
  console.log('Final platform stats:', finalStats);

  // Stop the platform
  console.log('Stopping platform...');
  await platform.stop();
}

// Run the example
main().catch(console.error);