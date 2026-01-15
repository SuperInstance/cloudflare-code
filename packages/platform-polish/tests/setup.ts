// Test setup file
import { ConfigManager } from '../src/config/config-manager';

// Mock console methods in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock axios for HTTP requests
jest.mock('axios');
const mockedAxios = require('axios');

// Mock redis client
jest.mock('redis');
const mockedRedis = require('redis');

// Mock system information
jest.mock('systeminformation');
const mockedSystemInfo = require('systeminformation');

// Global test configuration
const testConfig = {
  name: 'Test Platform',
  version: '1.0.0-test',
  environment: 'test',
  services: [],
  global: {
    port: 3001,
    host: 'localhost',
    cluster: false,
    workers: 1,
    shutdownTimeout: 5000
  },
  orchestration: {
    enabled: true,
    autoScaling: {
      enabled: true,
      minInstances: 1,
      maxInstances: 3,
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
      interval: 2000,
      timeout: 1000,
      threshold: 1,
      failureThreshold: 2
    },
    livenessProbe: {
      enabled: true,
      interval: 5000,
      timeout: 1000,
      threshold: 1,
      failureThreshold: 2
    },
    rollback: {
      enabled: true,
      automatic: true,
      timeout: 60000,
      healthCheckInterval: 5000
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

export function createTestConfig(): any {
  return JSON.parse(JSON.stringify(testConfig));
}

export function createTestServiceConfig(serviceId: string, overrides: any = {}) {
  const baseConfig = {
    id: serviceId,
    name: `service-${serviceId}`,
    version: '1.0.0',
    host: 'localhost',
    port: 3000 + parseInt(serviceId),
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
          port: 3000 + parseInt(serviceId),
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
        type: 'api-key',
        provider: undefined
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
        algorithm: 'AES-256-GCM',
        key: undefined
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
  };

  return { ...baseConfig, ...overrides };
}

export function mockAxiosSuccess() {
  mockedAxios.get.mockResolvedValue({
    status: 200,
    data: {
      status: 'healthy',
      uptime: 1000,
      cpuUsage: 30,
      memoryUsage: 50,
      errorRate: 0
    }
  });
}

export function mockAxiosFailure() {
  mockedAxios.get.mockRejectedValue(new Error('Connection refused'));
}

export function mockRedisSuccess() {
  const mockClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue('{"test": "value"}'),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue(['key1', 'key2']),
    flushDb: jest.fn().mockResolvedValue('OK'),
    quit: jest.fn().mockResolvedValue(undefined),
    info: jest.fn().mockResolvedValue('used_memory:1000')
  };

  mockedRedis.createClient.mockReturnValue(mockClient);
  return mockClient;
}

export function mockSystemInfo() {
  mockedSystemInfo.cpu.mockResolvedValue({
    usage: 50
  });

  mockedSystemInfo.mem.mockResolvedValue({
    total: 8589934592, // 8GB
    free: 4294967296,  // 4GB
    used: 4294967296  // 4GB
  });

  mockedSystemInfo.networkStats.mockResolvedValue([
    {
      rx_bytes: 1000000,
      tx_bytes: 1000000
    }
  ]);
}

// Cleanup function
export function cleanup() {
  jest.clearAllMocks();
  jest.useRealTimers();
}

// Helper functions for tests
export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function createMockServiceRegistration(overrides: any = {}) {
  return {
    id: generateRandomId(),
    name: 'test-service',
    version: '1.0.0',
    host: 'localhost',
    port: 3000,
    metadata: {},
    health: {
      service: 'test-service',
      status: 'healthy',
      lastCheck: new Date(),
      uptime: 1000,
      responseTime: 100,
      errorRate: 0,
      cpuUsage: 30,
      memoryUsage: 50
    },
    capabilities: [],
    dependencies: [],
    ...overrides
  };
}