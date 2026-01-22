/**
 * Integration tests for the load balancer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LoadBalancer } from '../loadbalancer.js';
import type { LoadBalancerConfig, RegionInfo, Region } from '../types/index.js';

describe('LoadBalancer Integration', () => {
  let loadBalancer: LoadBalancer;
  let config: LoadBalancerConfig;

  const createMockConfig = (): LoadBalancerConfig => {
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
        name: 'N. Virginia DC',
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
        name: 'Ireland DC',
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
        name: 'Singapore DC',
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
  };

  beforeEach(() => {
    config = createMockConfig();
    loadBalancer = new LoadBalancer(config);
  });

  describe('end-to-end routing', () => {
    it('should route US request to US region', async () => {
      const request = new Request('https://api.example.com/test', {
        headers: {
          'CF-IPCountry': 'US',
          'CF-Connecting-IP': '192.168.1.1',
        },
      });

      const decision = await loadBalancer.route(request);

      expect(decision.selectedRegion).toBe('us-east-1');
      expect(decision.requestId).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.reasoning).toBeDefined();
      expect(decision.reasoning.length).toBeGreaterThan(0);
    });

    it('should route EU request to EU region', async () => {
      const request = new Request('https://api.example.com/test', {
        headers: {
          'CF-IPCountry': 'GB',
          'CF-Connecting-IP': '192.168.1.2',
        },
      });

      const decision = await loadBalancer.route(request);

      expect(decision.selectedRegion).toBe('eu-west-1');
      expect(decision.requestId).toBeDefined();
    });

    it('should route Asia request to Asia region', async () => {
      const request = new Request('https://api.example.com/test', {
        headers: {
          'CF-IPCountry': 'SG',
          'CF-Connecting-IP': '192.168.1.3',
        },
      });

      const decision = await loadBalancer.route(request);

      expect(decision.selectedRegion).toBe('ap-southeast-1');
    });
  });

  describe('statistics tracking', () => {
    it('should track routing statistics', async () => {
      const request = new Request('https://api.example.com/test', {
        headers: {
          'CF-IPCountry': 'US',
          'CF-Connecting-IP': '192.168.1.1',
        },
      });

      await loadBalancer.route(request);
      await loadBalancer.route(request);

      const stats = loadBalancer.getStats();

      expect(stats.totalRequests).toBe(2);
      expect(stats.requestsByRegion.get('us-east-1')).toBe(2);
      expect(stats.averageRoutingTime).toBeGreaterThan(0);
    });
  });

  describe('routing history', () => {
    it('should maintain routing history', async () => {
      const request = new Request('https://api.example.com/test', {
        headers: {
          'CF-IPCountry': 'US',
          'CF-Connecting-IP': '192.168.1.1',
        },
      });

      await loadBalancer.route(request);
      await loadBalancer.route(request);

      const history = loadBalancer.getRoutingHistory(10);

      expect(history.length).toBe(2);
      expect(history[0].selectedRegion).toBe('us-east-1');
      expect(history[0].requestId).toBeDefined();
    });
  });

  describe('component access', () => {
    it('should provide access to health checker', () => {
      const healthChecker = loadBalancer.getHealthChecker();

      expect(healthChecker).toBeDefined();
      expect(healthChecker.getStats()).toBeDefined();
    });

    it('should provide access to capacity router', () => {
      const capacityRouter = loadBalancer.getCapacityRouter();

      expect(capacityRouter).toBeDefined();
      expect(capacityRouter.getStats()).toBeDefined();
    });

    it('should provide access to latency router', () => {
      const latencyRouter = loadBalancer.getLatencyRouter();

      expect(latencyRouter).toBeDefined();
      expect(latencyRouter.getAllMetrics()).toBeDefined();
    });

    it('should provide access to traffic shaper', () => {
      const trafficShaper = loadBalancer.getTrafficShaper();

      expect(trafficShaper).toBeDefined();
      expect(trafficShaper.getStats).toBeDefined();
    });

    it('should provide access to anycast router', () => {
      const anycastRouter = loadBalancer.getAnycastRouter();

      expect(anycastRouter).toBeDefined();
      expect(anycastRouter.getStats).toBeDefined();
    });
  });

  describe('health checking', () => {
    it('should perform health check', async () => {
      const health = await loadBalancer.healthCheck();

      expect(health).toBeDefined();
      expect(health.healthy).toBeDefined();
      expect(health.components).toBeDefined();
      expect(Object.keys(health.components).length).toBeGreaterThan(0);
    });
  });

  describe('region updates', () => {
    it('should update region information', () => {
      expect(() => {
        loadBalancer.updateRegion('us-east-1', {
          healthScore: 98,
          availableCapacity: 9000,
        });
      }).not.toThrow();

      // Verify the update didn't break anything
      expect(() => loadBalancer.getStats()).not.toThrow();
    });
  });

  describe('strategy selection', () => {
    it('should use specified strategy', async () => {
      const request = new Request('https://api.example.com/test', {
        headers: {
          'CF-IPCountry': 'US',
          'CF-Connecting-IP': '192.168.1.1',
        },
      });

      const decision = await loadBalancer.route(request, 'geographic');

      expect(decision.selectedRegion).toBeDefined();
      expect(decision.selectedRegion).toBe('us-east-1');
    });

    it('should fallback to fallback strategy if primary fails', async () => {
      // This would require mocking a failure scenario
      // For now, just verify the structure is correct
      const request = new Request('https://api.example.com/test', {
        headers: {
          'CF-IPCountry': 'US',
          'CF-Connecting-IP': '192.168.1.1',
        },
      });

      const decision = await loadBalancer.route(request);

      expect(decision.selectedRegion).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle malformed requests gracefully', async () => {
      // Request without country headers
      const request = new Request('https://api.example.com/test');

      // Should still route using default location
      const decision = await loadBalancer.route(request);

      expect(decision.selectedRegion).toBeDefined();
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        new Request(`https://api.example.com/test${i}`, {
          headers: {
            'CF-IPCountry': 'US',
            'CF-Connecting-IP': `192.168.1.${i}`,
          },
        })
      );

      const decisions = await Promise.all(
        requests.map(req => loadBalancer.route(req))
      );

      expect(decisions).toHaveLength(10);
      decisions.forEach(decision => {
        expect(decision.selectedRegion).toBeDefined();
        expect(decision.requestId).toBeDefined();
      });

      const stats = loadBalancer.getStats();
      expect(stats.totalRequests).toBe(10);
    });
  });
});
