import { CircuitBreakerManager } from '../src/circuit-breaker/circuit-breaker-manager';
import { ServiceConfig } from '../src/types';
import { createTestServiceConfig } from './setup';

// Simple CircuitBreaker class for testing
class TestCircuitBreaker {
  constructor(
    public config: any,
    public name: string
  ) {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successCount = 0;
    this.lastFailure = null;
  }

  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  successCount: number;
  lastFailure: Date | null;

  start() {}
  stop() {}
  async execute(operation: () => Promise<any>): Promise<any> {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }

    try {
      const result = await operation();
      this.successCount++;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = new Date();
      if (this.failures >= this.config.errorThreshold) {
        this.state = 'OPEN';
      }
      throw error;
    }
  }

  forceOpen() {
    this.state = 'OPEN';
    this.failures = 0;
  }

  forceClose() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successCount = 0;
    this.lastFailure = null;
  }

  reset() {
    this.state = 'HALF_OPEN';
    this.failures = 0;
    this.successCount = 0;
    this.lastFailure = null;
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successCount: this.successCount,
      lastFailure: this.lastFailure
    };
  }
}

// Mock the SimpleCircuitBreaker
jest.mock('../src/circuit-breaker/circuit-breaker-manager', () => {
  const originalModule = jest.requireActual('../src/circuit-breaker/circuit-breaker-manager');

  return {
    ...originalModule,
    SimpleCircuitBreaker: TestCircuitBreaker
  };
});

describe('CircuitBreakerManager', () => {
  let circuitBreakerManager: CircuitBreakerManager;
  let mockConfig: any;
  let serviceConfig: ServiceConfig;

  beforeEach(() => {
    // Mock config
    mockConfig = {
      services: [
        {
          id: 'test-service',
          name: 'test-service',
          version: '1.0.0',
          host: 'localhost',
          port: 3000,
          healthCheck: {
            enabled: true,
            endpoint: '/health',
            interval: 5000,
            timeout: 3000,
            retries: 3,
            healthyThreshold: 2,
            unhealthyThreshold: 3
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
            retryableStatusCodes: []
          },
          security: {
            enabled: true,
            auth: { type: 'api-key' },
            rateLimiting: { enabled: true, requestsPerMinute: 60, burst: 10 },
            cors: { enabled: true, origins: ['*'], methods: ['GET'], headers: ['*'], credentials: false },
            encryption: { enabled: false, algorithm: 'AES-256-GCM' }
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
            metrics: { enabled: true, interval: 10000, retention: 86400 },
            tracing: { enabled: true, sampling: 0.1 },
            logging: { level: 'info', format: 'json', outputs: ['console'] }
          },
          loadBalancing: { strategy: 'round-robin', stickySessions: false, healthCheckInterval: 5000, nodes: [] },
          retry: { enabled: true, maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2, maxDelayMs: 10000, retryableStatusCodes: [] }
        }
      ]
    };

    circuitBreakerManager = new CircuitBreakerManager(mockConfig);
    serviceConfig = createTestServiceConfig('test-service');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create CircuitBreakerManager instance', () => {
      expect(circuitBreakerManager).toBeInstanceOf(CircuitBreakerManager);
    });
  });

  describe('start/stop lifecycle', () => {
    it('should start successfully', async () => {
      await expect(circuitBreakerManager.start()).resolves.not.toThrow();
    });

    it('should throw error when already running', async () => {
      await circuitBreakerManager.start();
      await expect(circuitBreakerManager.start()).rejects.toThrow('Circuit Breaker Manager is already running');
    });

    it('should stop successfully', async () => {
      await circuitBreakerManager.start();
      await expect(circuitBreakerManager.stop()).resolves.not.toThrow();
    });

    it('should handle multiple stops gracefully', async () => {
      await circuitBreakerManager.start();
      await circuitBreakerManager.stop();
      await circuitBreakerManager.stop(); // Should not throw
    });
  });

  describe('execute method', () => {
    beforeEach(async () => {
      await circuitBreakerManager.start();
    });

    it('should execute operation successfully', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await circuitBreakerManager.execute('test-service', operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should fallback to provided function on failure', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const fallback = jest.fn().mockResolvedValue('fallback');

      const result = await circuitBreakerManager.execute('test-service', operation, fallback);

      expect(result).toBe('fallback');
      expect(operation).toHaveBeenCalled();
      expect(fallback).toHaveBeenCalled();
    });

    it('should throw error when no fallback provided and operation fails', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(circuitBreakerManager.execute('test-service', operation)).rejects.toThrow('Operation failed');
    });

    it('should throw error when no circuit breaker found', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      await expect(circuitBreakerManager.execute('non-existent-service', operation)).rejects.toThrow(
        'Circuit breaker not found for service'
      );
    });

    it('should handle execution timeout', async () => {
      const slowOperation = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      // Mock the timeout to be shorter
      const originalExecute = circuitBreakerManager['breakers'].get('test-service')?.execute;
      if (originalExecute) {
        circuitBreakerManager['breakers'].get('test-service')!.execute = jest.fn().mockImplementation((op) => {
          return Promise.race([
            op(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
          ]);
        });
      }

      await expect(circuitBreakerManager.execute('test-service', slowOperation)).rejects.toThrow('Timeout');
    });
  });

  describe('circuit breaker state management', () => {
    beforeEach(async () => {
      await circuitBreakerManager.start();
    });

    it('should force open circuit', async () => {
      await circuitBreakerManager.forceOpen('test-service');

      const state = circuitBreakerManager.getState('test-service');
      expect(state?.state).toBe('OPEN');
    });

    it('should force close circuit', async () => {
      await circuitBreakerManager.forceOpen('test-service');
      await circuitBreakerManager.forceClose('test-service');

      const state = circuitBreakerManager.getState('test-service');
      expect(state?.state).toBe('CLOSED');
    });

    it('should set circuit state', async () => {
      await circuitBreakerManager.setState('test-service', 'HALF_OPEN');

      const state = circuitBreakerManager.getState('test-service');
      expect(state?.state).toBe('HALF_OPEN');
    });

    it('should throw error when setting state for non-existent service', async () => {
      await expect(circuitBreakerManager.setState('non-existent-service', 'OPEN')).rejects.toThrow(
        'Circuit breaker not found for service'
      );
    });
  });

  describe('failure and success tracking', () => {
    beforeEach(async () => {
      await circuitBreakerManager.start();
    });

    it('should record success', async () => {
      await circuitBreakerManager.recordSuccess('test-service');

      const state = circuitBreakerManager.getState('test-service');
      expect(state?.successCount).toBe(1);
    });

    it('should record failure', async () => {
      await circuitBreakerManager.recordFailure('test-service');

      const state = circuitBreakerManager.getState('test-service');
      expect(state?.failures).toBe(1);
      expect(state?.lastFailure).toBeDefined();
    });

    it('should automatically open circuit after threshold failures', async () => {
      // Record more failures than the threshold (5)
      for (let i = 0; i < 6; i++) {
        await circuitBreakerManager.recordFailure('test-service');
      }

      const state = circuitBreakerManager.getState('test-service');
      expect(state?.state).toBe('OPEN');
    });
  });

  describe('configuration refresh', () => {
    beforeEach(async () => {
      await circuitBreakerManager.start();
    });

    it('should refresh configuration for service', async () => {
      const newConfig = {
        ...serviceConfig,
        circuitBreaker: {
          enabled: true,
          threshold: 10,
          timeout: 120000,
          resetTimeout: 60000,
          halfOpenRequests: 2,
          slidingWindowSize: 20,
          slidingWindowType: 'percentage'
        }
      };

      await expect(circuitBreakerManager.refreshConfig(newConfig)).resolves.not.toThrow();
    });
  });

  describe('stats collection', () => {
    beforeEach(async () => {
      await circuitBreakerManager.start();

      // Record some activity
      await circuitBreakerManager.recordSuccess('test-service');
      await circuitBreakerManager.recordSuccess('test-service');
      await circuitBreakerManager.recordFailure('test-service');
    });

    it('should get stats for all services', async () => {
      const stats = await circuitBreakerManager.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalServices).toBe(1);
      expect(stats.breakdown).toBeDefined();
      expect(stats.services).toBeDefined();
      expect(stats.services['test-service']).toBeDefined();
      expect(stats.services['test-service'].failures).toBe(1);
      expect(stats.services['test-service'].successes).toBe(2);
    });

    it('should calculate uptime correctly', async () => {
      const stats = await circuitBreakerManager.getStats();
      const serviceStats = stats.services['test-service'];

      expect(serviceStats.uptime).toBeDefined();
      expect(typeof serviceStats.uptime).toBe('number');
    });
  });

  describe('error handling', () => {
    it('should handle start failure', async () => {
      // Mock initialization to fail
      const originalInitialize = circuitBreakerManager['initializeCircuitBreaker'];
      circuitBreakerManager['initializeCircuitBreaker'] = jest.fn().mockRejectedValue(new Error('Init failed'));

      await expect(circuitBreakerManager.start()).rejects.toThrow('Init failed');
    });

    it('should handle stop failure', async () => {
      await circuitBreakerManager.start();

      // Mock stop to fail
      circuitBreakerManager['circuitBreakerStats'].forEach(state => {
        state.failures = 10; // Force OPEN state
      });

      await expect(circuitBreakerManager.stop()).resolves.not.toThrow();
    });
  });

  describe('event emission', () => {
    beforeEach(() => {
      jest.spyOn(circuitBreakerManager, 'emit');
    });

    it('should emit state change events', async () => {
      await circuitBreakerManager.forceOpen('test-service');

      expect(circuitBreakerManager.emit).toHaveBeenCalledWith('stateChange', {
        service: 'test-service',
        state: 'OPEN'
      });
    });

    it('should emit started event', async () => {
      circuitBreakerManager['isRunning'] = false;
      await circuitBreakerManager.start();

      expect(circuitBreakerManager.emit).toHaveBeenCalledWith('started');
    });

    it('should emit stopped event', async () => {
      await circuitBreakerManager.start();
      await circuitBreakerManager.stop();

      expect(circuitBreakerManager.emit).toHaveBeenCalledWith('stopped');
    });
  });
});