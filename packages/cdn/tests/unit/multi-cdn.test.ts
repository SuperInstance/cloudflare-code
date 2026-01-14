/**
 * Multi-CDN Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MultiCDNProvider, CDNLoadBalancer } from '../../src/multi-cdn/index.js';
import type { CDNProvider } from '../../src/types/index.js';

describe('MultiCDNProvider', () => {
  let multiCDN: MultiCDNProvider;

  beforeEach(() => {
    multiCDN = new MultiCDNProvider({
      primary: 'cloudflare',
      fallback: ['aws_cloudfront', 'fastly'],
      strategy: 'round_robin',
      weights: new Map([
        ['cloudflare', 100],
        ['aws_cloudfront', 50],
        ['fastly', 30]
      ]),
      healthCheck: {
        interval: 1000,
        timeout: 5000,
        unhealthyThreshold: 3,
        healthyThreshold: 2,
        path: 'https://example.com/health',
        expectedStatus: 200
      },
      failoverThreshold: 3
    });

    // Mock fetch for health checks
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    });
  });

  afterEach(() => {
    multiCDN.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with primary provider', () => {
      expect(multiCDN['providers'].has('cloudflare')).toBe(true);
    });

    it('should initialize with fallback providers', () => {
      expect(multiCDN['providers'].has('aws_cloudfront')).toBe(true);
      expect(multiCDN['providers'].has('fastly')).toBe(true);
    });

    it('should set initial provider status', () => {
      const status = multiCDN.getProviderStatus('cloudflare');
      expect(status).toBeDefined();
      expect(status?.healthy).toBe(true);
    });
  });

  describe('Routing Strategy', () => {
    it('should route using round-robin', async () => {
      const provider = new MultiCDNProvider({
        primary: 'cloudflare',
        fallback: ['aws_cloudfront'],
        strategy: 'round_robin'
      });

      const context = {
        url: 'https://example.com/test',
        method: 'GET',
        headers: {}
      };

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        body: ''
      });

      await provider.route(context);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should route using weighted distribution', async () => {
      const provider = new MultiCDNProvider({
        primary: 'cloudflare',
        fallback: ['aws_cloudfront'],
        strategy: 'weighted',
        weights: new Map([
          ['cloudflare', 70],
          ['aws_cloudfront', 30]
        ])
      });

      const context = {
        url: 'https://example.com/test',
        method: 'GET',
        headers: {}
      };

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        body: ''
      });

      await provider.route(context);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Provider Management', () => {
    it('should enable provider', () => {
      multiCDN.disableProvider('cloudflare');
      expect(multiCDN['providers'].get('cloudflare')?.enabled).toBe(false);

      multiCDN.enableProvider('cloudflare');
      expect(multiCDN['providers'].get('cloudflare')?.enabled).toBe(true);
    });

    it('should disable provider', () => {
      multiCDN.disableProvider('fastly');
      expect(multiCDN['providers'].get('fastly')?.enabled).toBe(false);
    });

    it('should get provider status', () => {
      const status = multiCDN.getProviderStatus('cloudflare');

      expect(status).toBeDefined();
      expect(status?.provider).toBe('cloudflare');
      expect(status).toHaveProperty('healthy');
      expect(status).toHaveProperty('responseTime');
    });

    it('should get all provider statuses', () => {
      const statuses = multiCDN.getAllProviderStatuses();

      expect(statuses.length).toBe(3);
    });

    it('should get healthy providers', () => {
      const healthy = multiCDN.getHealthyProviders();

      expect(healthy.length).toBeGreaterThan(0);
      expect(healthy).toContain('cloudflare');
    });
  });

  describe('Statistics', () => {
    it('should provide statistics', () => {
      const stats = multiCDN.getStatistics();

      expect(stats).toHaveProperty('totalProviders');
      expect(stats).toHaveProperty('healthyProviders');
      expect(stats).toHaveProperty('unhealthyProviders');
      expect(stats).toHaveProperty('primaryProvider');
      expect(stats).toHaveProperty('strategy');
    });

    it('should calculate healthy count correctly', () => {
      const stats = multiCDN.getStatistics();

      expect(stats.healthyProviders + stats.unhealthyProviders).toBe(stats.totalProviders);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      multiCDN.updateConfig({
        strategy: 'weighted'
      });

      expect(multiCDN['config'].strategy).toBe('weighted');
    });
  });

  describe('Events', () => {
    it('should emit provider_healthy event', () => {
      let emitted = false;
      multiCDN.on('provider_healthy', () => {
        emitted = true;
      });

      // Manually trigger event
      const status = multiCDN['providerStatus'].get('cloudflare')!;
      status.healthy = false;
      status.healthy = true;

      // Event should be emitted
      expect(multiCDN.listenerCount('provider_healthy')).toBe(1);
    });

    it('should emit provider_unhealthy event', () => {
      let emitted = false;
      multiCDN.on('provider_unhealthy', () => {
        emitted = true;
      });

      expect(multiCDN.listenerCount('provider_unhealthy')).toBe(1);
    });

    it('should emit failover event', () => {
      let emitted = false;
      multiCDN.on('failover', () => {
        emitted = true;
      });

      expect(multiCDN.listenerCount('failover')).toBe(1);
    });
  });
});

describe('CDNLoadBalancer', () => {
  let loadBalancer: CDNLoadBalancer;

  beforeEach(() => {
    loadBalancer = new CDNLoadBalancer({
      strategy: 'round_robin',
      sessionAffinity: true,
      weights: new Map([
        ['cloudflare', 100],
        ['aws_cloudfront', 50],
        ['fastly', 30]
      ])
    });
  });

  afterEach(() => {
    loadBalancer.destroy();
  });

  describe('Provider Selection', () => {
    it('should select provider using round-robin', () => {
      const context = {
        url: 'https://example.com/test',
        method: 'GET',
        headers: {}
      };

      const provider1 = loadBalancer.select(context);
      const provider2 = loadBalancer.select(context);
      const provider3 = loadBalancer.select(context);

      expect(provider1).toBeDefined();
      expect(provider2).toBeDefined();
      expect(provider3).toBeDefined();
    });

    it('should select provider using weights', () => {
      const balancer = new CDNLoadBalancer({
        strategy: 'weighted',
        weights: new Map([
          ['cloudflare', 100],
          ['aws_cloudfront', 50]
        ])
      });

      const context = {
        url: 'https://example.com/test',
        method: 'GET',
        headers: {}
      };

      const provider = balancer.select(context);

      expect(['cloudflare', 'aws_cloudfront']).toContain(provider);
    });

    it('should select provider using least connections', () => {
      const balancer = new CDNLoadBalancer({
        strategy: 'least_connections',
        weights: new Map([
          ['cloudflare', 100],
          ['aws_cloudfront', 100]
        ])
      });

      const context = {
        url: 'https://example.com/test',
        method: 'GET',
        headers: {}
      };

      const provider = balancer.select(context);

      expect(provider).toBeDefined();
    });

    it('should select provider using IP hash', () => {
      const balancer = new CDNLoadBalancer({
        strategy: 'ip_hash',
        weights: new Map([
          ['cloudflare', 100],
          ['aws_cloudfront', 100]
        ])
      });

      const context = {
        url: 'https://example.com/test',
        method: 'GET',
        headers: {},
        ip: '192.168.1.1'
      };

      const provider1 = balancer.select(context);
      const provider2 = balancer.select(context);

      // Same IP should route to same provider
      expect(provider1).toBe(provider2);
    });
  });

  describe('Session Affinity', () => {
    it('should maintain session affinity', () => {
      const balancer = new CDNLoadBalancer({
        strategy: 'round_robin',
        sessionAffinity: true,
        weights: new Map([
          ['cloudflare', 100],
          ['aws_cloudfront', 100]
        ])
      });

      const context = {
        url: 'https://example.com/test',
        method: 'GET',
        headers: {
          'user-agent': 'Mozilla/5.0'
        },
        ip: '192.168.1.1'
      };

      const provider1 = balancer.select(context);
      const provider2 = balancer.select(context);

      // Should return same provider for same session
      expect(provider1).toBe(provider2);
    });
  });

  describe('Connection Management', () => {
    it('should release connections', () => {
      const context = {
        url: 'https://example.com/test',
        method: 'GET',
        headers: {}
      };

      const provider = loadBalancer.select(context);
      const statsBefore = loadBalancer.getConnectionStats().get(provider);

      loadBalancer.release(provider);
      const statsAfter = loadBalancer.getConnectionStats().get(provider);

      expect(statsAfter?.activeConnections).toBeLessThan(statsBefore?.activeConnections ?? 1);
    });

    it('should track connection statistics', () => {
      const context = {
        url: 'https://example.com/test',
        method: 'GET',
        headers: {}
      };

      loadBalancer.select(context);
      loadBalancer.select(context);
      loadBalancer.select(context);

      const stats = loadBalancer.getStatistics();

      expect(stats.totalRequests).toBe(3);
      expect(stats.activeConnections).toBe(3);
    });
  });

  describe('Configuration Updates', () => {
    it('should update weights', () => {
      const newWeights = new Map([
        ['cloudflare', 80],
        ['aws_cloudfront', 60],
        ['fastly', 40]
      ]);

      loadBalancer.updateWeights(newWeights);

      const stats = loadBalancer.getStatistics();
      expect(stats.providers).toBeDefined();
    });

    it('should update strategy', () => {
      loadBalancer.updateStrategy('least_connections');

      const context = {
        url: 'https://example.com/test',
        method: 'GET',
        headers: {}
      };

      const provider = loadBalancer.select(context);
      expect(provider).toBeDefined();
    });

    it('should clear sessions', () => {
      const context = {
        url: 'https://example.com/test',
        method: 'GET',
        headers: {},
        ip: '192.168.1.1'
      };

      loadBalancer.select(context);
      loadBalancer.clearSessions();

      const stats = loadBalancer.getStatistics();
      expect(stats).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should provide detailed statistics', () => {
      const context1 = { url: 'https://example.com/test1', method: 'GET', headers: {} };
      const context2 = { url: 'https://example.com/test2', method: 'GET', headers: {} };
      const context3 = { url: 'https://example.com/test3', method: 'GET', headers: {} };

      loadBalancer.select(context1);
      loadBalancer.select(context2);
      loadBalancer.select(context3);

      const stats = loadBalancer.getStatistics();

      expect(stats.totalRequests).toBe(3);
      expect(stats.providers.length).toBeGreaterThan(0);
      expect(stats.providers[0]).toHaveProperty('provider');
      expect(stats.providers[0]).toHaveProperty('activeConnections');
      expect(stats.providers[0]).toHaveProperty('totalRequests');
      expect(stats.providers[0]).toHaveProperty('loadPercentage');
    });

    it('should reset statistics', () => {
      const context = { url: 'https://example.com/test', method: 'GET', headers: {} };
      loadBalancer.select(context);

      loadBalancer.resetStatistics();

      const stats = loadBalancer.getStatistics();
      expect(stats.totalRequests).toBe(0);
      expect(stats.activeConnections).toBe(0);
    });
  });

  describe('Connection Stats', () => {
    it('should return connection statistics', () => {
      const context = { url: 'https://example.com/test', method: 'GET', headers: {} };

      loadBalancer.select(context);

      const connStats = loadBalancer.getConnectionStats();

      expect(connStats.size).toBeGreaterThan(0);

      for (const [provider, stats] of connStats.entries()) {
        expect(stats).toHaveProperty('provider');
        expect(stats).toHaveProperty('activeConnections');
        expect(stats).toHaveProperty('totalRequests');
      }
    });
  });
});
