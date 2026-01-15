/**
 * Unit Tests for Provider Registry
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createProviderRegistry,
  type ProviderClient,
  type ProviderCapabilities,
  type QuotaInfo,
  type HealthStatus,
} from '../../../../packages/edge/src/lib/providers';

// Mock provider for testing
class MockProvider implements ProviderClient {
  constructor(
    public name: string,
    private available: boolean = true,
    private healthy: boolean = true
  ) {}

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    functionCalling: false,
    vision: false,
    maxContextTokens: 128000,
    maxOutputTokens: 4096,
    avgLatency: 100,
    hasFreeTier: true,
    freeTierDaily: 10000,
    inputCostPer1M: 0.05,
    outputCostPer1M: 0.05,
  };

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async chat(): Promise<any> {
    return { content: 'test response' };
  }

  async *stream(): AsyncIterable<any> {
    yield { delta: 'test' };
  }

  async getQuota(): Promise<QuotaInfo> {
    return {
      provider: this.name,
      used: 1000,
      limit: 10000,
      remaining: 9000,
      resetTime: Date.now() + 86400000,
      resetType: 'daily',
      lastUpdated: Date.now(),
      isExhausted: false,
    };
  }

  async getModelList(): Promise<string[]> {
    return ['model1', 'model2'];
  }

  async getHealthStatus(): Promise<HealthStatus> {
    return {
      provider: this.name,
      isHealthy: this.healthy,
      lastCheck: Date.now(),
      avgLatency: 100,
      successRate: 0.95,
      totalRequests: 100,
      failedRequests: 5,
      circuitState: 'closed',
    };
  }

  async test(): Promise<boolean> {
    return this.available && this.healthy;
  }
}

describe('ProviderRegistry', () => {
  let registry: ReturnType<typeof createProviderRegistry>;

  beforeEach(() => {
    registry = createProviderRegistry({
      autoHealthCheck: false, // Disable auto health checks in tests
      healthCheckInterval: 1000,
      minSuccessRate: 0.9,
      maxLatency: 5000,
    });
  });

  afterEach(() => {
    registry.destroy();
  });

  describe('register', () => {
    it('should register a provider', () => {
      const provider = new MockProvider('test-provider');
      registry.register(provider);

      const retrieved = registry.getByName('test-provider');
      expect(retrieved).toBe(provider);
    });

    it('should register multiple providers', () => {
      const provider1 = new MockProvider('provider1');
      const provider2 = new MockProvider('provider2');

      registry.register(provider1);
      registry.register(provider2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });

    it('should set default priority', () => {
      const provider = new MockProvider('test-provider');
      registry.register(provider);

      const metadata = registry.getMetadata('test-provider');
      expect(metadata?.priority).toBe(0);
    });

    it('should set custom priority', () => {
      const provider = new MockProvider('test-provider');
      registry.register(provider, { priority: 10 });

      const metadata = registry.getMetadata('test-provider');
      expect(metadata?.priority).toBe(10);
    });
  });

  describe('unregister', () => {
    it('should unregister a provider', () => {
      const provider = new MockProvider('test-provider');
      registry.register(provider);
      registry.unregister('test-provider');

      const retrieved = registry.getByName('test-provider');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered providers', () => {
      const provider1 = new MockProvider('provider1');
      const provider2 = new MockProvider('provider2');

      registry.register(provider1);
      registry.register(provider2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(provider1);
      expect(all).toContain(provider2);
    });
  });

  describe('getEnabled', () => {
    it('should return only enabled providers', () => {
      const provider1 = new MockProvider('provider1');
      const provider2 = new MockProvider('provider2');

      registry.register(provider1, { enabled: true });
      registry.register(provider2, { enabled: false });

      const enabled = registry.getEnabled();
      expect(enabled).toHaveLength(1);
      expect(enabled[0]).toBe(provider1);
    });
  });

  describe('getAvailable', () => {
    it('should return only available providers', async () => {
      const provider1 = new MockProvider('provider1', true);
      const provider2 = new MockProvider('provider2', false);

      registry.register(provider1);
      registry.register(provider2);

      const available = await registry.getAvailable();
      expect(available).toHaveLength(1);
      expect(available[0]).toBe(provider1);
    });

    it('should return only healthy providers', async () => {
      const provider1 = new MockProvider('provider1', true, true);
      const provider2 = new MockProvider('provider2', true, false);

      registry.register(provider1);
      registry.register(provider2);

      const available = await registry.getAvailable();
      expect(available).toHaveLength(1);
      expect(available[0]).toBe(provider1);
    });
  });

  describe('getByPriority', () => {
    it('should sort providers by priority', async () => {
      const provider1 = new MockProvider('provider1');
      const provider2 = new MockProvider('provider2');
      const provider3 = new MockProvider('provider3');

      registry.register(provider1, { priority: 5 });
      registry.register(provider2, { priority: 10 });
      registry.register(provider3, { priority: 1 });

      const byPriority = await registry.getByPriority();
      expect(byPriority[0]).toBe(provider2);
      expect(byPriority[1]).toBe(provider1);
      expect(byPriority[2]).toBe(provider3);
    });
  });

  describe('setEnabled', () => {
    it('should enable/disable provider', () => {
      const provider = new MockProvider('test-provider');
      registry.register(provider, { enabled: true });

      registry.setEnabled('test-provider', false);
      const metadata = registry.getMetadata('test-provider');
      expect(metadata?.enabled).toBe(false);

      registry.setEnabled('test-provider', true);
      expect(metadata?.enabled).toBe(true);
    });
  });

  describe('setPriority', () => {
    it('should set provider priority', () => {
      const provider = new MockProvider('test-provider');
      registry.register(provider, { priority: 5 });

      registry.setPriority('test-provider', 10);
      const metadata = registry.getMetadata('test-provider');
      expect(metadata?.priority).toBe(10);
    });
  });

  describe('checkProviderHealth', () => {
    it('should check provider health', async () => {
      const provider = new MockProvider('test-provider', true, true);
      registry.register(provider);

      const health = await registry.checkProviderHealth('test-provider');
      expect(health.provider).toBe('test-provider');
      expect(health.isHealthy).toBe(true);
    });

    it('should mark unhealthy providers', async () => {
      const provider = new MockProvider('test-provider', true, false);
      registry.register(provider);

      const health = await registry.checkProviderHealth('test-provider');
      expect(health.isHealthy).toBe(false);
    });
  });

  describe('getAllHealthStatus', () => {
    it('should return health status for all providers', () => {
      const provider1 = new MockProvider('provider1');
      const provider2 = new MockProvider('provider2');

      registry.register(provider1);
      registry.register(provider2);

      const statuses = registry.getAllHealthStatus();
      expect(statuses.size).toBe(2);
      expect(statuses.has('provider1')).toBe(true);
      expect(statuses.has('provider2')).toBe(true);
    });
  });

  describe('getAllQuotas', () => {
    it('should return quota info for all providers', async () => {
      const provider1 = new MockProvider('provider1');
      const provider2 = new MockProvider('provider2');

      registry.register(provider1);
      registry.register(provider2);

      const quotas = await registry.getAllQuotas();
      expect(quotas.size).toBe(2);
      expect(quotas.get('provider1')?.remaining).toBe(9000);
      expect(quotas.get('provider2')?.remaining).toBe(9000);
    });
  });

  describe('getStats', () => {
    it('should return registry statistics', () => {
      const provider1 = new MockProvider('provider1');
      const provider2 = new MockProvider('provider2');

      registry.register(provider1, { enabled: true });
      registry.register(provider2, { enabled: false });

      const stats = registry.getStats();
      expect(stats.totalProviders).toBe(2);
      expect(stats.enabledProviders).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all providers', () => {
      const provider1 = new MockProvider('provider1');
      const provider2 = new MockProvider('provider2');

      registry.register(provider1);
      registry.register(provider2);
      registry.clear();

      expect(registry.getAll()).toHaveLength(0);
    });
  });
});
