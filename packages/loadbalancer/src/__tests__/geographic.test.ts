/**
 * Tests for geographic routing
 */

import { describe, it, expect } from 'vitest';
import { GeographicRouter } from '../geographic/router.js';
import type { RegionInfo, GeoLocation, RoutingContext } from '../types/index.js';

describe('GeographicRouter', () => {
  const createMockRegions = (): Map<string, RegionInfo> => {
    const regions = new Map();

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

    return regions;
  };

  describe('distance calculation', () => {
    it('should calculate distance between two points', () => {
      const router = new GeographicRouter(createMockRegions());

      // Distance from New York to London (approximately 5570 km)
      const nyLat = 40.71;
      const nyLon = -74.01;
      const londonLat = 51.51;
      const londonLon = -0.13;

      const routerInstance = router as any;
      const distance = routerInstance.calculateDistance(nyLat, nyLon, londonLat, londonLon);

      expect(distance).toBeGreaterThan(5500);
      expect(distance).toBeLessThan(5600);
    });

    it('should estimate latency based on distance', () => {
      const router = new GeographicRouter(createMockRegions());

      const routerInstance = router as any;
      const latency = routerInstance.estimateLatency(5000); // 5000 km

      expect(latency).toBeGreaterThan(100);
      expect(latency).toBeLessThan(120);
    });
  });

  describe('routing decisions', () => {
    it('should route US user to US region', async () => {
      const router = new GeographicRouter(createMockRegions());

      const context: RoutingContext = {
        requestId: 'test-1',
        timestamp: Date.now(),
        sourceLocation: {
          country: 'US',
          continent: 'NA',
          latitude: 40.71,
          longitude: -74.01,
        },
        priority: 5,
        tags: [],
      };

      const decision = await router.route(context);

      expect(decision.selectedRegion).toBe('us-east-1');
      expect(decision.confidence).toBeGreaterThan(0.5);
    });

    it('should route EU user to EU region', async () => {
      const router = new GeographicRouter(createMockRegions());

      const context: RoutingContext = {
        requestId: 'test-2',
        timestamp: Date.now(),
        sourceLocation: {
          country: 'GB',
          continent: 'EU',
          latitude: 51.51,
          longitude: -0.13,
        },
        priority: 5,
        tags: [],
      };

      const decision = await router.route(context);

      expect(decision.selectedRegion).toBe('eu-west-1');
      expect(decision.confidence).toBeGreaterThan(0.5);
    });

    it('should route Asia user to Asia region', async () => {
      const router = new GeographicRouter(createMockRegions());

      const context: RoutingContext = {
        requestId: 'test-3',
        timestamp: Date.now(),
        sourceLocation: {
          country: 'SG',
          continent: 'AS',
          latitude: 1.35,
          longitude: 103.82,
        },
        priority: 5,
        tags: [],
      };

      const decision = await router.route(context);

      expect(decision.selectedRegion).toBe('ap-southeast-1');
      expect(decision.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('region management', () => {
    it('should update region information', () => {
      const router = new GeographicRouter(createMockRegions());

      router.updateRegion('us-east-1', {
        healthScore: 98,
        availableCapacity: 9000,
      });

      // Should not throw
      expect(() => router.updateRegion('us-east-1', {})).not.toThrow();
    });

    it('should get regions by continent', () => {
      const router = new GeographicRouter(createMockRegions());

      const naRegions = router.getRegionsByContinent('NA');
      const euRegions = router.getRegionsByContinent('EU');

      expect(naRegions.length).toBeGreaterThan(0);
      expect(naRegions[0].id).toContain('us-');

      expect(euRegions.length).toBeGreaterThan(0);
      expect(euRegions[0].id).toContain('eu-');
    });

    it('should find nearest region', () => {
      const router = new GeographicRouter(createMockRegions());

      const location: GeoLocation = {
        country: 'CA',
        continent: 'NA',
        latitude: 43.65,
        longitude: -79.38,
      };

      const nearest = router.findNearestRegion(location);

      expect(nearest).not.toBeNull();
      expect(nearest?.id).toBe('us-east-1');
    });
  });
});
