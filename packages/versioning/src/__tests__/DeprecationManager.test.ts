/**
 * Tests for DeprecationManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DeprecationManager } from '../deprecation/DeprecationManager';
import { DeprecationRecord, WarningSeverity, WarningType } from '../types';

describe('DeprecationManager', () => {
  let deprecationManager: DeprecationManager;

  beforeEach(() => {
    deprecationManager = new DeprecationManager();
  });

  describe('Deprecation Creation', () => {
    it('should create deprecation record', () => {
      const record: DeprecationRecord = {
        id: 'dep-1',
        apiVersion: '1.0.0',
        endpoint: '/users',
        method: 'GET',
        deprecationDate: new Date('2024-01-01'),
        sunsetDate: new Date('2024-12-31'),
        reason: 'Endpoint replaced',
        successorVersion: '2.0.0',
        successorEndpoint: '/api/v2/users',
        migrationGuide: 'Update to new endpoint',
        warnings: [],
        affectedClients: [],
      };

      const created = deprecationManager.createDeprecation(record);

      expect(created).toEqual(record);
    });

    it('should reject deprecation with sunset before deprecation', () => {
      const record: DeprecationRecord = {
        id: 'dep-1',
        apiVersion: '1.0.0',
        deprecationDate: new Date('2024-06-01'),
        sunsetDate: new Date('2024-05-01'),
        reason: 'Test',
        warnings: [],
        affectedClients: [],
      };

      expect(() => deprecationManager.createDeprecation(record)).toThrow();
    });

    it('should reject deprecation with insufficient notice period', () => {
      const record: DeprecationRecord = {
        id: 'dep-1',
        apiVersion: '1.0.0',
        deprecationDate: new Date('2024-01-01'),
        sunsetDate: new Date('2024-02-01'), // Only 31 days
        reason: 'Test',
        warnings: [],
        affectedClients: [],
      };

      expect(() => deprecationManager.createDeprecation(record)).toThrow();
    });
  });

  describe('Deprecation Querying', () => {
    beforeEach(() => {
      const records: DeprecationRecord[] = [
        {
          id: 'dep-1',
          apiVersion: '1.0.0',
          endpoint: '/users',
          method: 'GET',
          deprecationDate: new Date('2024-01-01'),
          sunsetDate: new Date('2024-12-31'),
          reason: 'Deprecated',
          warnings: [],
          affectedClients: [],
        },
        {
          id: 'dep-2',
          apiVersion: '2.0.0',
          endpoint: '/posts',
          method: 'POST',
          deprecationDate: new Date('2024-06-01'),
          sunsetDate: new Date('2025-06-01'),
          reason: 'Deprecated',
          warnings: [],
          affectedClients: [],
        },
      ];

      records.forEach(r => deprecationManager.createDeprecation(r));
    });

    it('should get deprecation by ID', () => {
      const deprecation = deprecationManager.getDeprecation('dep-1');

      expect(deprecation).toBeDefined();
      expect(deprecation?.id).toBe('dep-1');
    });

    it('should get deprecations by version', () => {
      const deprecations = deprecationManager.getDeprecationsByVersion('1.0.0');

      expect(deprecations).toHaveLength(1);
      expect(deprecations[0].apiVersion).toBe('1.0.0');
    });

    it('should get deprecations by endpoint', () => {
      const deprecations = deprecationManager.getDeprecationsByEndpoint('/users');

      expect(deprecations).toHaveLength(1);
      expect(deprecations[0].endpoint).toBe('/users');
    });
  });

  describe('Deprecation Headers', () => {
    beforeEach(() => {
      const record: DeprecationRecord = {
        id: 'dep-1',
        apiVersion: '1.0.0',
        endpoint: '/users',
        method: 'GET',
        deprecationDate: new Date('2024-01-01'),
        sunsetDate: new Date('2024-12-31'),
        reason: 'Deprecated',
        successorVersion: '2.0.0',
        successorEndpoint: '/api/v2/users',
        warnings: [],
        affectedClients: [],
      };

      deprecationManager.createDeprecation(record);
    });

    it('should generate deprecation headers', () => {
      const headers = deprecationManager.generateDeprecationHeaders('/users', '1.0.0');

      expect(headers.deprecation).toBe(true);
      expect(headers.sunset).toEqual(new Date('2024-12-31'));
      expect(headers.link).toContain('successor-version');
      expect(headers['successor-version']).toBe('2.0.0');
      expect(headers.warning).toBeDefined();
    });

    it('should return no deprecation for non-deprecated endpoint', () => {
      const headers = deprecationManager.generateDeprecationHeaders('/nonexistent', '1.0.0');

      expect(headers.deprecation).toBe(false);
    });
  });

  describe('Deprecation Warnings', () => {
    beforeEach(() => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 6);

      const record: DeprecationRecord = {
        id: 'dep-1',
        apiVersion: '1.0.0',
        endpoint: '/users',
        method: 'GET',
        deprecationDate: new Date(),
        sunsetDate: futureDate,
        reason: 'Deprecated',
        successorVersion: '2.0.0',
        warnings: [],
        affectedClients: [],
      };

      deprecationManager.createDeprecation(record);
    });

    it('should generate deprecation warnings', () => {
      const warnings = deprecationManager.generateWarnings('/users', '1.0.0');

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe(WarningType.DEPRECATION);
      expect(warnings[0].severity).toBeDefined();
    });
  });

  describe('Deprecation Statistics', () => {
    beforeEach(() => {
      const now = new Date();
      const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const records: DeprecationRecord[] = [
        {
          id: 'dep-1',
          apiVersion: '1.0.0',
          endpoint: '/users',
          deprecationDate: now,
          sunsetDate: future,
          reason: 'Active',
          warnings: [],
          affectedClients: [],
        },
        {
          id: 'dep-2',
          apiVersion: '2.0.0',
          deprecationDate: past,
          sunsetDate: new Date(future.getTime() + 30 * 24 * 60 * 60 * 1000),
          reason: 'Active',
          warnings: [],
          affectedClients: [],
        },
      ];

      records.forEach(r => deprecationManager.createDeprecation(r));
    });

    it('should get deprecation statistics', () => {
      const stats = deprecationManager.getDeprecationStats();

      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);
      expect(stats.byVersion['1.0.0']).toBe(1);
      expect(stats.byVersion['2.0.0']).toBe(1);
    });
  });

  describe('Version Deprecation', () => {
    it('should deprecate an API version', () => {
      const sunsetDate = new Date('2025-12-31');
      const deprecation = deprecationManager.deprecateVersion(
        '1.0.0',
        sunsetDate,
        '2.0.0',
        'New version available'
      );

      expect(deprecation.apiVersion).toBe('1.0.0');
      expect(deprecation.sunsetDate).toEqual(sunsetDate);
      expect(deprecation.successorVersion).toBe('2.0.0');
    });
  });

  describe('Endpoint Deprecation', () => {
    it('should deprecate an endpoint', () => {
      const sunsetDate = new Date('2025-12-31');
      const deprecation = deprecationManager.deprecateEndpoint(
        '/users',
        'GET',
        '1.0.0',
        sunsetDate,
        {
          successorEndpoint: '/api/v2/users',
          successorVersion: '2.0.0',
          reason: 'Endpoint replaced',
        }
      );

      expect(deprecation.endpoint).toBe('/users');
      expect(deprecation.method).toBe('GET');
      expect(deprecation.successorEndpoint).toBe('/api/v2/users');
    });
  });

  describe('Deprecation Timeline', () => {
    beforeEach(() => {
      const now = new Date();
      const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      const record: DeprecationRecord = {
        id: 'dep-1',
        apiVersion: '1.0.0',
        deprecationDate: now,
        sunsetDate: future,
        reason: 'Test',
        warnings: [],
        affectedClients: [],
      };

      deprecationManager.createDeprecation(record);
    });

    it('should get deprecation timeline', () => {
      const timeline = deprecationManager.getDeprecationTimeline();

      expect(timeline.length).toBe(2); // deprecation and sunset events
      expect(timeline[0].type).toBe('deprecation');
      expect(timeline[1].type).toBe('sunset');
    });
  });
});
