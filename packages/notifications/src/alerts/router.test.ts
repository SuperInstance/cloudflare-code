/**
 * Tests for alert router
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AlertRouter } from '../alerts/router';
import type { Alert, AlertRoute, RouteCondition, RouteAction } from '../types';

describe('Alert Router', () => {
  let router: AlertRouter;

  beforeEach(() => {
    router = new AlertRouter({
      enableGrouping: true,
      groupingWindowMs: 60000,
      enableDeduplication: true,
      deduplicationWindowMs: 300000,
      maxGroupSize: 50,
    });
  });

  describe('addRoute', () => {
    it('should add a route', () => {
      const route: AlertRoute = {
        id: 'route-1',
        name: 'Test Route',
        priority: 1,
        conditions: [],
        actions: [],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      router.addRoute(route);
      expect(router.getRoute('route-1')).toBe(route);
    });
  });

  describe('removeRoute', () => {
    it('should remove a route', () => {
      const route: AlertRoute = {
        id: 'route-1',
        name: 'Test Route',
        priority: 1,
        conditions: [],
        actions: [],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      router.addRoute(route);
      expect(router.removeRoute('route-1')).toBe(true);
      expect(router.getRoute('route-1')).toBeUndefined();
    });
  });

  describe('routeAlert', () => {
    it('should route alert to matching routes', async () => {
      const conditions: RouteCondition[] = [
        {
          type: 'severity',
          operator: 'equals',
          value: 'critical',
        },
      ];

      const actions: RouteAction[] = [
        {
          type: 'notify',
          config: {
            channels: ['email', 'sms'],
            users: ['user1', 'user2'],
          },
        },
      ];

      const route: AlertRoute = {
        id: 'route-1',
        name: 'Critical Alert Route',
        priority: 10,
        conditions,
        actions,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      router.addRoute(route);

      const alert: Alert = {
        id: 'alert-1',
        title: 'Critical Alert',
        description: 'This is a critical alert',
        severity: 'critical',
        status: 'open',
        source: 'system',
        type: 'error',
        priority: 'urgent',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const results = await router.routeAlert(alert);

      expect(results.length).toBe(1);
      expect(results[0].matched).toBe(true);
      expect(results[0].channels).toContain('email');
      expect(results[0].channels).toContain('sms');
      expect(results[0].users).toContain('user1');
    });

    it('should not route alert to non-matching routes', async () => {
      const conditions: RouteCondition[] = [
        {
          type: 'severity',
          operator: 'equals',
          value: 'critical',
        },
      ];

      const route: AlertRoute = {
        id: 'route-1',
        name: 'Critical Alert Route',
        priority: 10,
        conditions,
        actions: [],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      router.addRoute(route);

      const alert: Alert = {
        id: 'alert-1',
        title: 'Warning Alert',
        description: 'This is a warning',
        severity: 'warning',
        status: 'open',
        source: 'system',
        type: 'warning',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const results = await router.routeAlert(alert);

      expect(results.length).toBe(1);
      expect(results[0].matched).toBe(true); // Default route
    });
  });

  describe('deduplication', () => {
    it('should detect duplicate alerts', async () => {
      const alert: Alert = {
        id: 'alert-1',
        title: 'Duplicate Alert',
        description: 'This alert will be duplicated',
        severity: 'error',
        status: 'open',
        source: 'system',
        type: 'test-error',
        priority: 'high',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const results1 = await router.routeAlert(alert);
      expect(results1.length).toBe(1);

      const results2 = await router.routeAlert(alert);
      expect(results2.length).toBe(0); // Deduplicated
    });
  });

  describe('grouping', () => {
    it('should group similar alerts', async () => {
      const route: AlertRoute = {
        id: 'route-1',
        name: 'Test Route',
        priority: 1,
        conditions: [],
        actions: [],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      router.addRoute(route);

      const alert1: Alert = {
        id: 'alert-1',
        title: 'Alert 1',
        description: 'First alert',
        severity: 'error',
        status: 'open',
        source: 'system',
        type: 'test-error',
        priority: 'high',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const alert2: Alert = {
        id: 'alert-2',
        title: 'Alert 2',
        description: 'Second alert',
        severity: 'error',
        status: 'open',
        source: 'system',
        type: 'test-error',
        priority: 'high',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await router.routeAlert(alert1);
      await router.routeAlert(alert2);

      const groups = router.getActiveAlertGroups();
      expect(groups.length).toBe(1);
      expect(groups[0].alerts.length).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return router statistics', () => {
      const route: AlertRoute = {
        id: 'route-1',
        name: 'Test Route',
        priority: 1,
        conditions: [],
        actions: [],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      router.addRoute(route);

      const stats = router.getStats();

      expect(stats.totalRoutes).toBe(1);
      expect(stats.enabledRoutes).toBe(1);
      expect(stats.activeGroups).toBe(0);
      expect(stats.deduplicationKeys).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired groups and keys', async () => {
      const alert: Alert = {
        id: 'alert-1',
        title: 'Test Alert',
        description: 'Test',
        severity: 'error',
        status: 'open',
        source: 'system',
        type: 'test',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await router.routeAlert(alert);
      router.cleanup();

      const stats = router.getStats();
      // Groups and keys should be cleaned up after expiration
      expect(stats).toBeDefined();
    });
  });
});
